const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { createAiRateLimiter } = require('./rate-limit');

const GUEST_COOKIE = 'own_web_ai_guest';
const idSchema = z.string().uuid();
const QUICK_ACTIONS = Object.freeze({
  summary_current: '请总结当前已授权内容的核心要点。',
  explain_concept: '请解释当前内容中的核心概念。',
  related_content: '请推荐与当前文章相关的站内文章。',
  selection_explain: '请解释当前已授权选文。',
  selection_expand: '请展开说明当前已授权选文的含义、前提与影响。',
  selection_example: '请基于当前已授权选文给出一个简明例子。',
});
const PRODUCT_STATUSES = new Set(['analyzing', 'retrieving', 'reading', 'tool', 'generating']);
const chatSchema = z.object({
  conversationId: idSchema.optional(), message: z.string().trim().min(1).max(8000).optional(),
  pageContext: z.object({
    route: z.string().max(300).optional(), articleId: z.coerce.number().int().positive().optional(), selectedText: z.string().max(4000).optional(),
    heading: z.string().max(500).optional(), anchor: z.string().max(255).optional(), shareToken: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  }).strict().optional(),
  modelId: z.string().max(80).optional(),
  quickAction: z.enum(Object.keys(QUICK_ACTIONS)).optional(),
  regenerate: z.object({ assistantMessageId: idSchema }).strict().optional(),
}).strict()
  .refine((value) => value.message || value.regenerate || value.quickAction, '需要消息、快捷动作或受控重新生成参数')
  .refine((value) => !(value.quickAction && (value.message || value.regenerate)), '快捷动作不能与消息或重新生成参数同时使用');

function cookieValue(req, name) {
  return String(req.headers.cookie || '').split(';').map((item) => item.trim()).find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1) || null;
}
function hmac(value, secret) { return crypto.createHmac('sha256', secret).update(value).digest('hex'); }
function error(res, status, code, message, fields) { return res.status(status).json({ error: { code, message, ...(fields ? { fields } : {}) } }); }
function sse(res, type, payload) { res.write(`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`); }
function guestCookie(res, value) {
  const attrs = ['HttpOnly', 'Path=/', 'SameSite=Lax'];
  if (process.env.NODE_ENV === 'production') attrs.push('Secure');
  res.append('Set-Cookie', `${GUEST_COOKIE}=${encodeURIComponent(value)}; ${attrs.join('; ')}`);
}

function assertQuickActionContext(action, pageContext) {
  if (!action) return;
  const articleRequired = ['summary_current', 'related_content', 'selection_explain', 'selection_expand', 'selection_example'].includes(action);
  const selectionRequired = ['selection_explain', 'selection_expand', 'selection_example'].includes(action);
  if (articleRequired && !pageContext?.articleId) throw Object.assign(new Error('该快捷动作需要当前文章上下文'), { code: 'QUICK_ACTION_CONTEXT_REQUIRED', status: 400 });
  if (selectionRequired && !String(pageContext?.selectedText || '').trim()) throw Object.assign(new Error('该快捷动作需要当前选文'), { code: 'QUICK_ACTION_SELECTION_REQUIRED', status: 400 });
}

async function safeStatusSnapshot({ config, gateway, qdrant, query }) {
  const featureEnabled = Boolean(config.enabled);
  if (!featureEnabled) return { state: 'disabled', featureEnabled: false, chatReady: false, ragReady: false, indexReady: false, message: 'AI 功能尚未启用。' };
  let models = [];
  try { models = gateway.models?.() || []; } catch (_) { models = []; }
  const chatReady = Array.isArray(models) && models.length > 0;
  if (!chatReady) return { state: 'unconfigured', featureEnabled: true, chatReady: false, ragReady: false, indexReady: false, message: 'AI 服务尚未完成模型配置。' };
  let ragReady = false;
  try { ragReady = Boolean((await qdrant?.health?.())?.ready); } catch (_) { ragReady = false; }
  let indexReady = false;
  if (ragReady) {
    try { const [rows] = await query('SELECT version FROM ai_index_state WHERE id=1 LIMIT 1'); indexReady = Number(rows?.[0]?.version || 0) > 0; } catch (_) { indexReady = false; }
  }
  if (!ragReady) return { state: 'degraded', featureEnabled: true, chatReady: true, ragReady: false, indexReady: false, message: 'AI 对话可用，站内检索暂不可用。' };
  if (!indexReady) return { state: 'degraded', featureEnabled: true, chatReady: true, ragReady: true, indexReady: false, message: 'AI 对话可用，站内索引正在准备。' };
  return { state: 'ready', featureEnabled: true, chatReady: true, ragReady: true, indexReady: true, message: 'AI 对话和站内检索已就绪。' };
}

function createGuestStore() {
  const sessions = new Map();
  const get = (sessionHash) => {
    if (!sessions.has(sessionHash)) sessions.set(sessionHash, new Map());
    return sessions.get(sessionHash);
  };
  const create = (sessionHash, modelId) => {
    const conversation = { id: crypto.randomUUID(), title: '新对话', selectedModel: modelId, summary: '', messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    get(sessionHash).set(conversation.id, conversation); return conversation;
  };
  const list = (sessionHash) => [...get(sessionHash).values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((conversation) => ({ ...conversation, messages: undefined }));
  const find = (sessionHash, id) => get(sessionHash).get(id) || null;
  const remove = (sessionHash, id) => get(sessionHash).delete(id);
  return { create, list, find, remove };
}

function mountAiRoutes(app, db, {
  getAuthToken, authSecret, config, gateway, workflow, conversationStore, memoryStore, qdrant = null,
}) {
  const query = db.promise().query.bind(db.promise());
  const limiter = createAiRateLimiter({ db, config });
  const guests = createGuestStore();
  const optionalAuth = (req, _res, next) => {
    const token = getAuthToken(req);
    if (!token) return next();
    try {
      const payload = jwt.verify(token, authSecret);
      return query('SELECT id,email,session_version FROM users WHERE id=?', [Number(payload.sub)])
        .then(([rows]) => {
          if (rows[0] && Number(payload.sv || 0) === Number(rows[0].session_version || 0)) req.user = { id: Number(payload.sub), email: rows[0].email };
          next();
        }).catch(() => next());
    } catch (_) { return next(); }
  };
  const requireUser = (req, res, next) => req.user ? next() : error(res, 401, 'AUTH_REQUIRED', '请先登录');
  const aiAvailable = (req, res, next) => config.enabled ? next() : error(res, 503, 'AI_DISABLED', 'AI 功能尚未启用');
  const ensureGuest = (req, res) => {
    let raw = cookieValue(req, GUEST_COOKIE);
    if (!raw || !/^[a-zA-Z0-9_-]{32,128}$/.test(raw)) { raw = crypto.randomBytes(24).toString('base64url'); guestCookie(res, raw); }
    return hmac(raw, authSecret);
  };
  const subjectFor = (req, res) => req.user ? { userId: Number(req.user.id), sessionHash: null } : { userId: null, sessionHash: ensureGuest(req, res) };
  const log = (payload) => console.info('[ai]', JSON.stringify(payload));

  async function getConversation(subject, id, modelId, create = true) {
    if (subject.userId) {
      let conversation = id ? await conversationStore.get(subject.userId, id) : null;
      if (!conversation && id) return null;
      if (!conversation && create) {
        const created = await conversationStore.create(subject.userId, { modelId });
        conversation = await conversationStore.get(subject.userId, created.id);
      }
      return conversation;
    }
    let conversation = id ? guests.find(subject.sessionHash, id) : null;
    if (!conversation && id) return null;
    if (!conversation && create) conversation = guests.create(subject.sessionHash, modelId || config.defaultModel);
    return conversation;
  }

  async function historyFor(subject, conversation) {
    if (subject.userId) return conversationStore.context(subject.userId, conversation.id);
    return { conversation, summary: conversation.summary || '', recent: conversation.messages.slice(-config.limits.recentMessages).map((message) => ({ role: message.role, content: message.content })) };
  }

  function appendGuest(conversation, message) {
    const entry = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), status: 'complete', ...message };
    conversation.messages.push(entry); conversation.updatedAt = entry.createdAt; return entry;
  }

  app.get('/api/ai/status', optionalAuth, async (_req, res) => {
    const status = await safeStatusSnapshot({ config, gateway, qdrant, query });
    res.setHeader('Cache-Control', 'no-store');
    res.json(status);
  });

  app.get('/api/ai/models', optionalAuth, aiAvailable, (req, res) => {
    res.json({ models: gateway.models(), defaultModel: config.defaultModel, signedIn: Boolean(req.user) });
  });

  app.get('/api/ai/conversations', optionalAuth, aiAvailable, async (req, res, next) => {
    try {
      const subject = subjectFor(req, res);
      const items = subject.userId ? await conversationStore.list(subject.userId) : guests.list(subject.sessionHash);
      res.json({ items, persistent: Boolean(subject.userId) });
    } catch (caught) { next(caught); }
  });
  app.post('/api/ai/conversations', optionalAuth, aiAvailable, async (req, res, next) => {
    try {
      const body = z.object({ title: z.string().max(180).optional(), modelId: z.string().max(80).optional() }).strict().parse(req.body || {});
      const model = gateway.models().find((item) => item.id === (body.modelId || config.defaultModel));
      if (!model) return error(res, 400, 'MODEL_UNAVAILABLE', '所选模型不可用');
      const subject = subjectFor(req, res);
      const conversation = subject.userId ? await conversationStore.create(subject.userId, { title: body.title, modelId: model.id }) : guests.create(subject.sessionHash, model.id);
      if (!subject.userId && body.title) conversation.title = body.title.trim().slice(0, 180) || '新对话';
      res.status(201).json({ conversation, persistent: Boolean(subject.userId) });
    } catch (caught) { if (caught instanceof z.ZodError || Array.isArray(caught?.issues)) return error(res, 400, 'INVALID_REQUEST', '请求格式无效'); next(caught); }
  });
  app.get('/api/ai/conversations/:id', optionalAuth, aiAvailable, async (req, res, next) => {
    try {
      const id = idSchema.parse(req.params.id); const subject = subjectFor(req, res);
      const conversation = await getConversation(subject, id, null, false);
      if (!conversation) return error(res, 404, 'CONVERSATION_NOT_FOUND', '会话不存在或不可访问');
      res.json({ conversation, persistent: Boolean(subject.userId) });
    } catch (caught) { if (caught instanceof z.ZodError) return error(res, 400, 'INVALID_REQUEST', '会话标识无效'); next(caught); }
  });
  app.patch('/api/ai/conversations/:id', optionalAuth, aiAvailable, async (req, res, next) => {
    try {
      const id = idSchema.parse(req.params.id);
      const body = z.object({ title: z.string().trim().min(1).max(180).optional(), selectedModel: z.string().min(1).max(80).optional() }).strict()
        .refine((value) => value.title !== undefined || value.selectedModel !== undefined, '至少提供一个会话更新字段').parse(req.body || {});
      if (body.selectedModel && !gateway.models().some((model) => model.id === body.selectedModel)) return error(res, 400, 'MODEL_UNAVAILABLE', '所选模型不可用');
      const subject = subjectFor(req, res);
      if (subject.userId) {
        if (!await conversationStore.update(subject.userId, id, body)) return error(res, 404, 'CONVERSATION_NOT_FOUND', '会话不存在或不可访问');
      } else {
        const conversation = guests.find(subject.sessionHash, id);
        if (!conversation) return error(res, 404, 'CONVERSATION_NOT_FOUND', '会话不存在或不可访问');
        if (body.title !== undefined) conversation.title = body.title;
        if (body.selectedModel !== undefined) conversation.selectedModel = body.selectedModel;
        conversation.updatedAt = new Date().toISOString();
      }
      res.json({ ...(body.title !== undefined ? { title: body.title } : {}), ...(body.selectedModel !== undefined ? { selectedModel: body.selectedModel } : {}) });
    } catch (caught) { if (caught instanceof z.ZodError || Array.isArray(caught?.issues)) return error(res, 400, 'INVALID_REQUEST', '请求格式无效'); next(caught); }
  });
  app.delete('/api/ai/conversations/:id', optionalAuth, aiAvailable, async (req, res, next) => {
    try {
      const id = idSchema.parse(req.params.id); const subject = subjectFor(req, res);
      const removed = subject.userId ? await conversationStore.remove(subject.userId, id) : guests.remove(subject.sessionHash, id);
      return removed ? res.status(204).end() : error(res, 404, 'CONVERSATION_NOT_FOUND', '会话不存在或不可访问');
    } catch (caught) { if (caught instanceof z.ZodError) return error(res, 400, 'INVALID_REQUEST', '会话标识无效'); next(caught); }
  });

  app.get('/api/ai/settings', optionalAuth, aiAvailable, requireUser, async (req, res, next) => { try { res.json({ settings: await memoryStore.settings(req.user.id) }); } catch (caught) { next(caught); } });
  app.put('/api/ai/settings', optionalAuth, aiAvailable, requireUser, async (req, res, next) => {
    try {
      const body = z.object({ memoryEnabled: z.boolean().optional(), defaultModel: z.string().max(80).optional() }).strict().parse(req.body || {});
      if (body.defaultModel && !gateway.models().some((model) => model.id === body.defaultModel)) return error(res, 400, 'MODEL_UNAVAILABLE', '所选模型不可用');
      res.json({ settings: await memoryStore.updateSettings(req.user.id, body) });
    } catch (caught) { if (caught instanceof z.ZodError) return error(res, 400, 'INVALID_REQUEST', '设置格式无效'); next(caught); }
  });
  app.get('/api/ai/memories', optionalAuth, aiAvailable, requireUser, async (req, res, next) => { try { res.json({ items: await memoryStore.list(req.user.id) }); } catch (caught) { next(caught); } });
  app.post('/api/ai/memories', optionalAuth, aiAvailable, requireUser, async (req, res, next) => {
    try { const body = z.object({ key: z.string().trim().min(1).max(120), value: z.string().trim().min(1).max(2000), conversationId: idSchema.optional() }).strict().parse(req.body || {}); res.status(201).json({ memory: await memoryStore.save(req.user.id, body) }); }
    catch (caught) { if (caught instanceof z.ZodError) return error(res, 400, 'INVALID_MEMORY', 'Memory 格式无效'); next(caught); }
  });
  app.delete('/api/ai/memories', optionalAuth, aiAvailable, requireUser, async (req, res, next) => { try { res.json({ deleted: await memoryStore.clear(req.user.id) }); } catch (caught) { next(caught); } });
  app.delete('/api/ai/memories/:id', optionalAuth, aiAvailable, requireUser, async (req, res, next) => { try { return await memoryStore.remove(req.user.id, idSchema.parse(req.params.id)) ? res.status(204).end() : error(res, 404, 'MEMORY_NOT_FOUND', 'Memory 不存在'); } catch (caught) { next(caught); } });

  app.post('/api/ai/feedback', optionalAuth, aiAvailable, requireUser, async (req, res, next) => {
    try {
      const body = z.object({ messageId: idSchema, rating: z.number().int().min(-1).max(1), reason: z.string().max(1000).optional() }).strict().parse(req.body || {});
      const [messages] = await query('SELECT 1 FROM ai_messages m JOIN ai_conversations c ON c.id=m.conversation_id WHERE m.id=? AND c.user_id=?', [body.messageId, req.user.id]);
      if (!messages[0]) return error(res, 404, 'MESSAGE_NOT_FOUND', '消息不存在或不可访问');
      await query('INSERT INTO ai_feedback (user_id,message_id,rating,reason) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE rating=VALUES(rating),reason=VALUES(reason),created_at=CURRENT_TIMESTAMP', [req.user.id, body.messageId, body.rating, body.reason || null]);
      res.status(201).json({ ok: true });
    } catch (caught) { if (caught instanceof z.ZodError) return error(res, 400, 'INVALID_FEEDBACK', '反馈格式无效'); next(caught); }
  });

  app.post('/api/ai/chat', optionalAuth, aiAvailable, async (req, res, next) => {
    let release = null; let assistantId = null; let subject = null; let conversation = null; let requestId = crypto.randomUUID(); let startedAt = Date.now(); let streamStarted = false; let streamedContent = ''; let streamedToolCalls = 0; let inputMessage = '';
    try {
      const body = chatSchema.parse(req.body || {});
      if (body.message && body.message.length > config.limits.inputChars) return error(res, 400, 'INPUT_TOO_LARGE', '消息长度超过上限');
      assertQuickActionContext(body.quickAction, body.pageContext);
      const models = gateway.models(); const requestedModel = body.modelId || config.defaultModel;
      if (!models.some((model) => model.id === requestedModel)) return error(res, 400, 'MODEL_UNAVAILABLE', '所选模型不可用');
      subject = subjectFor(req, res);
      release = await limiter.begin(subject, req.ip, requestId);
      conversation = await getConversation(subject, body.conversationId, requestedModel, true);
      if (!conversation) return error(res, 404, 'CONVERSATION_NOT_FOUND', '会话不存在或不可访问');
      if (!subject.userId) conversation.selectedModel = requestedModel;
      let message = body.quickAction ? QUICK_ACTIONS[body.quickAction] : (body.message || '');
      const history = await historyFor(subject, conversation);
      if (body.regenerate) {
        const priorMessages = subject.userId ? conversation.messages : conversation.messages;
        const assistantIndex = priorMessages.findIndex((item) => item.id === body.regenerate.assistantMessageId && item.role === 'assistant');
        const previousUser = assistantIndex > 0 ? priorMessages.slice(0, assistantIndex).reverse().find((item) => item.role === 'user') : null;
        if (!previousUser) return error(res, 400, 'INVALID_REGENERATE', '只能重新生成当前会话中的助手消息');
        message = previousUser.content;
      }
      inputMessage = message;
      if (!body.regenerate) {
        if (subject.userId) await conversationStore.append(subject.userId, conversation.id, { role: 'user', content: message, model: requestedModel });
        else appendGuest(conversation, { role: 'user', content: message, model: requestedModel });
      }
      assistantId = crypto.randomUUID();
      if (subject.userId) await conversationStore.append(subject.userId, conversation.id, { id: assistantId, role: 'assistant', content: '', model: requestedModel, status: 'streaming' });
      else appendGuest(conversation, { id: assistantId, role: 'assistant', content: '', model: requestedModel, status: 'streaming' });

      const controller = new AbortController();
      req.once('aborted', () => controller.abort());
      res.once('close', () => { if (!res.writableEnded) controller.abort(); });
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8'); res.setHeader('Cache-Control', 'no-store, no-cache'); res.setHeader('Connection', 'keep-alive'); res.setHeader('X-Accel-Buffering', 'no'); res.flushHeaders?.();
      streamStarted = true; sse(res, 'start', { requestId, conversationId: conversation.id, messageId: assistantId, modelId: requestedModel });
      const result = await workflow.run({
        user: req.user || null, message, quickAction: body.quickAction || null, pageContext: body.pageContext || {}, modelId: requestedModel, conversation: history, signal: controller.signal,
        onEvent: async (event) => {
          if (event.type === 'delta') { streamedContent += event.delta; sse(res, 'delta', { text: event.delta }); }
          if (event.type === 'status' && PRODUCT_STATUSES.has(event.status)) sse(res, 'status', { status: event.status });
          if (event.type === 'tool_start' || event.type === 'tool_end') { if (event.type === 'tool_start') streamedToolCalls += 1; sse(res, event.type, { tool: event.tool }); }
        },
      });
      const completedContent = String(result.response.content || '');
      // Some safe workflow exits (navigation and LOW-confidence refusal) do
      // not invoke a streaming provider. Still send their completed product
      // response through the single client delta channel.
      if (!streamedContent && completedContent) {
        streamedContent = completedContent;
        sse(res, 'delta', { text: completedContent });
      } else {
        streamedContent = completedContent || streamedContent;
      }
      for (const citation of result.response.citations) sse(res, 'citation', citation);
      const latencyMs = Date.now() - startedAt;
      const status = controller.signal.aborted ? 'aborted' : 'complete';
      if (subject.userId) { await conversationStore.updateMessage(subject.userId, conversation.id, assistantId, { content: streamedContent, status, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, latencyMs }); await conversationStore.compact(subject.userId, conversation.id); }
      else { const item = conversation.messages.find((entry) => entry.id === assistantId); if (item) Object.assign(item, { content: streamedContent, status, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, latencyMs }); }
      if (subject.userId) {
        for (const [index, citation] of result.response.citations.entries()) {
          await query('INSERT INTO ai_message_sources (message_id,source_type,source_id,post_id,chunk_id,title,slug,heading,heading_anchor,excerpt,source_rank,score) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', [
            assistantId, 'post', String(citation.postId || ''), citation.postId || null, citation.chunkId || null, citation.title || '站内文章', citation.slug || null,
            citation.heading || null, citation.headingAnchor || null, citation.excerpt || null, index + 1, citation.score ?? null,
          ]);
        }
      }
      await limiter.record({ requestId, subject, provider: result.model?.provider || null, model: result.model?.model || requestedModel, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, latencyMs, status, intent: result.decision.intent, toolCalls: streamedToolCalls });
      sse(res, 'usage', { inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, latencyMs, degraded: result.response.degraded });
      sse(res, 'done', { messageId: assistantId, status, fallbackFrom: result.response.fallbackFrom || null });
      log({ requestId, subject: subject.userId ? `user:${subject.userId}` : 'guest', model: requestedModel, fallbackFrom: result.response.fallbackFrom || null, intent: result.decision.intent, latencyMs, toolCalls: streamedToolCalls, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, status, ...(config.developerTrace ? { trace: result.trace } : {}) });
      res.end();
    } catch (caught) {
      const isValidationError = caught instanceof z.ZodError || Array.isArray(caught?.issues);
      const code = caught.code || (isValidationError ? 'INVALID_REQUEST' : 'AI_UNAVAILABLE');
      const status = caught.status || (code === 'INVALID_REQUEST' ? 400 : code === 'CONVERSATION_NOT_FOUND' ? 404 : code === 'FORBIDDEN' ? 403 : code === 'QDRANT_UNAVAILABLE' ? 503 : 500);
      const message = code === 'INVALID_REQUEST' ? '请求格式无效' : code === 'QDRANT_UNAVAILABLE' ? '本站知识检索暂时不可用，暂不能回答站内资料问题。' : code === 'ABORTED' ? '生成已停止' : (caught.message || 'AI 服务暂时不可用');
      if (!streamStarted) return error(res, status, code, message);
      const latencyMs = Date.now() - startedAt;
      const estimatedInput = Math.ceil(inputMessage.length / 4); const estimatedOutput = Math.ceil(streamedContent.length / 4);
      if (assistantId && subject?.userId && conversation) await conversationStore.updateMessage(subject.userId, conversation.id, assistantId, { content: streamedContent, status: code === 'ABORTED' ? 'aborted' : 'error', inputTokens: estimatedInput, outputTokens: estimatedOutput, latencyMs }).catch(() => {});
      if (assistantId && !subject?.userId && conversation) { const item = conversation.messages.find((entry) => entry.id === assistantId); if (item) Object.assign(item, { content: streamedContent, status: code === 'ABORTED' ? 'aborted' : 'error', inputTokens: estimatedInput, outputTokens: estimatedOutput, latencyMs }); }
      if (subject) await limiter.record({ requestId, subject, inputTokens: estimatedInput, outputTokens: estimatedOutput, latencyMs, status: code === 'ABORTED' ? 'aborted' : 'error', toolCalls: streamedToolCalls }).catch(() => {});
      sse(res, 'error', { code, message }); sse(res, 'done', { messageId: assistantId, status: code === 'ABORTED' ? 'aborted' : 'error' }); res.end();
      log({ requestId, subject: subject?.userId ? `user:${subject.userId}` : 'guest', latencyMs, status: code });
    } finally { release?.(); }
  });
}

module.exports = { mountAiRoutes, createGuestStore, chatSchema };
