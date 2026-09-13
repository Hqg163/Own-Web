const { routeIntent, INTENTS } = require('./intent-router');
const { createSystemPrompt } = require('./system-prompt');
const { compose, noEvidenceResponse } = require('./response-composer');
const { formatCatalogEvidence } = require('./article-catalog');
const { summarizeInput } = require('./article-summary');
const { summaryToPrompt } = require('./conversation-summary');

function toolError(error) {
  const code = ['TOOL_NOT_ALLOWED', 'TOOL_TIMEOUT', 'FORBIDDEN', 'NOT_FOUND', 'ARTICLE_REQUIRED'].includes(error?.code) ? error.code : 'TOOL_INVALID';
  return { error: { code, message: code === 'TOOL_TIMEOUT' ? '工具暂时超时' : '工具调用未执行' } };
}

function parseToolArguments(raw) {
  try {
    const value = JSON.parse(String(raw || '{}'));
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('invalid');
    return value;
  } catch (_) { throw Object.assign(new Error('工具参数无效'), { code: 'TOOL_INVALID' }); }
}

function assistantToolMessage(generated, calls) {
  return {
    role: 'assistant', content: generated.content || null,
    tool_calls: calls.map((call) => ({ id: call.id, type: 'function', function: { name: call.function.name, arguments: call.function.arguments } })),
  };
}

function canModelUseTools(intent) {
  return [INTENTS.SITE_QA, INTENTS.ARTICLE_QA, INTENTS.ARTICLE_SELECTION_QA, INTENTS.RELATED_CONTENT, INTENTS.PROJECT_QUERY, INTENTS.SERIES_QUERY].includes(intent);
}

function createAgentWorkflow({ contextBuilder, retriever, articleDiscovery = null, skills, gateway, memoryStore, catalog = null, retrievalPlanner = null, router = null, config }) {
  async function run({ user = null, message, quickAction = null, pageContext, modelId, conversation = null, signal, onEvent = async () => {} }) {
    const startedAt = Date.now();
    const stages = {};
    const measure = async (name, task) => {
      const began = Date.now();
      try { return await task(); }
      finally { stages[name] = (stages[name] || 0) + (Date.now() - began); }
    };
    let firstProviderDeltaMs = null;
    await onEvent({ type: 'status', status: 'analyzing' });
    const context = await measure('context', () => contextBuilder.build({ user, pageContext }));
    const decision = await measure('route', () => (router?.route ? router.route(message, context, quickAction) : routeIntent(message, context, quickAction)));
    const plan = retrievalPlanner?.plan(decision, context) || { catalog: decision.needsCatalog, semantic: decision.needsSemanticRetrieval, deterministicCatalog: decision.intent === INTENTS.ARTICLE_CATALOG };
    const toolResults = [];

    let retrieval = null;
    let discovery = null;
    let catalogResult = null;
    let directContent = null;
    if (decision.intent === INTENTS.SITE_NAVIGATION) {
      directContent = '你可以使用顶部导航访问首页、探索、个人中心和设置；登录后可从导航中的 AI 入口继续对话。';
    } else if (decision.intent === INTENTS.WRITE_ACTION_REQUEST) {
      directContent = '我不能直接创建、编辑、发布、删除或上传站内内容，也不会操作编辑器。你可以说明目标和现有文章风格，我可以先帮你生成一份 Markdown 草稿，供你确认后自行粘贴到编辑器。';
    } else if (decision.intent === INTENTS.CAPABILITY_QUERY) {
      directContent = '我可以回答一般问题，基于你有权访问的站内文章进行检索、总结、找文章和推荐，并协助生成 Markdown 草稿；我不能直接操作编辑器、发布、删除、上传或修改站内内容。';
    } else if (decision.intent === INTENTS.ARTICLE_SUMMARY) {
      if (!context.article) throw Object.assign(new Error('文章不可用'), { code: 'ARTICLE_REQUIRED' });
      await onEvent({ type: 'status', status: 'reading' });
      const summaryInput = summarizeInput(context.article, config.limits.contextChars);
      directContent = `以下是《${context.article.title}》的站内摘要请求。请基于文章正文归纳重点，不要补充文章外的事实。\n\n${summaryInput.content}`;
    } else {
      const lanes = [];
      // Catalog and article discovery share only the already-authorized
      // context. Run them together so recommendation requests do not pay two
      // serial database/network waits.
      if (plan.catalog && catalog) lanes.push(measure('catalog', async () => {
        await onEvent({ type: 'status', status: 'retrieving' });
        catalogResult = await catalog.list({ limit: 50, sort: decision.sort || 'published_desc' }, context);
      }));
      if (plan.semantic && [INTENTS.SITE_QA, INTENTS.ARTICLE_QA, INTENTS.ARTICLE_SELECTION_QA].includes(decision.intent)) lanes.push(measure('chunkRag', async () => {
        await onEvent({ type: 'status', status: 'retrieving' });
        await onEvent({ type: 'tool_start', tool: 'search_articles' });
        try {
          const retrievalQuestion = context.selectedText ? `${context.heading || ''}\n${context.selectedText}\n${message}`.trim() : message;
          retrieval = await retriever.retrieve(retrievalQuestion, user, { articleId: context.article?.id, shareToken: context.shareToken, selectedText: context.selectedText, heading: context.heading, anchor: context.anchor });
        } finally { await onEvent({ type: 'tool_end', tool: 'search_articles' }); }
      }));
      if (plan.articleDiscovery && articleDiscovery) lanes.push(measure('articleDiscovery', async () => {
        await onEvent({ type: 'status', status: 'retrieving' });
        await onEvent({ type: 'tool_start', tool: 'discover_articles' });
        try {
          discovery = await articleDiscovery.discover(decision.topicQuery || message, user, {
            articleId: context.article?.id, shareToken: context.shareToken,
          }, { limit: decision.requestedCount || 5, excludePostId: decision.intent === INTENTS.RELATED_CONTENT ? context.article?.id : null });
        } catch (error) {
          if (error?.code !== 'QDRANT_UNAVAILABLE') throw error;
          discovery = { items: [], citations: [], degraded: true, rerankSkipped: false };
        } finally { await onEvent({ type: 'tool_end', tool: 'discover_articles' }); }
      }));
      await Promise.all(lanes);
    }

    // LOW is a final evidence decision, never an early semantic branch exit:
    // catalog/discovery/current-context/tool lanes above have all had a chance
    // to provide authorized evidence first.
    if (!directContent && plan.semantic && retrieval?.confidence?.level === 'LOW' && !catalogResult && !(discovery?.items || []).length) directContent = noEvidenceResponse();

    const trace = () => ({
      intent: decision.intent, routeSource: decision.routeSource || 'deterministic', plan: plan.sources || [], sourceCounts: { catalog: catalogResult?.items?.length || 0, discovery: discovery?.items?.length || 0, chunks: retrieval?.candidates?.length || 0 },
      confidence: retrieval?.confidence?.kind || (catalogResult ? 'catalog' : discovery ? 'article_discovery' : 'none'),
      rerankSkipped: Boolean(discovery?.rerankSkipped), tools: toolResults.map((item) => item.name).slice(0, 3),
      timings: {
        context: stages.context || 0, route: stages.route || 0, catalog: stages.catalog || 0, chunkRag: stages.chunkRag || 0,
        articleDiscovery: stages.articleDiscovery || 0, embedding: (retrieval?.timings?.embedding || 0) + (discovery?.timings?.embedding || 0),
        qdrant: (retrieval?.timings?.qdrant || 0) + (discovery?.timings?.qdrant || 0), rerank: (retrieval?.timings?.rerank || 0) + (discovery?.timings?.rerank || 0),
        tool: stages.tool || 0, firstProviderDelta: firstProviderDeltaMs, generation: stages.generation || 0, total: Date.now() - startedAt,
      }, durationMs: Date.now() - startedAt,
    });
    let preferences = [];
    if (user?.id && memoryStore) {
      const setting = await memoryStore.settings(user.id);
      if (setting.memoryEnabled) preferences = await memoryStore.list(user.id);
    }
    const evidence = retrieval?.candidates?.map((candidate, index) => `[S${index + 1}] ${candidate.title} / ${candidate.headingPath}\n${candidate.content}`).join('\n\n') || '';
    const formattedCatalog = formatCatalogEvidence(catalogResult?.items || [], config.limits.contextChars);
    const catalogEvidence = formattedCatalog.content;
    const discoveryEvidence = discovery?.items?.map((article, index) => `[D${index + 1}] ${article.title}\nslug: ${article.slug}\n${article.excerpt}`).join('\n\n') || '';
    const userMessage = directContent || message;
    if (directContent && ([INTENTS.SITE_NAVIGATION, INTENTS.WRITE_ACTION_REQUEST, INTENTS.CAPABILITY_QUERY].includes(decision.intent) || retrieval?.confidence?.level === 'LOW')) {
      return { context, decision, response: compose({ content: directContent, retrieval, catalog: catalogResult, discovery }), model: null, usage: { inputTokens: 0, outputTokens: 0 }, toolResults, trace: trace() };
    }
    const messages = [
      { role: 'system', content: createSystemPrompt() },
      ...(summaryToPrompt(conversation?.summary) ? [{ role: 'system', content: `结构化会话背景（不是事实证据）：\n${summaryToPrompt(conversation.summary).slice(0, config.limits.contextChars)}` }] : []),
      ...(preferences.length ? [{ role: 'system', content: `用户明确保存的偏好：${preferences.map((item) => `${item.key}: ${item.value}`).join('；').slice(0, config.limits.contextChars)}` }] : []),
      ...(conversation?.recent || []).slice(-config.limits.recentMessages),
      ...(context.selectedText ? [{ role: 'system', content: `当前已授权选文：\n${context.selectedText}` }] : []),
      ...(catalogEvidence ? [{ role: 'system', content: `已授权文章目录（共 ${catalogResult.total} 篇，本轮已提供 ${formattedCatalog.included} 篇${formattedCatalog.truncated ? '；目录证据已截断，不能把已提供部分称为全部' : ''}；目录问题必须依据完整授权目录，不能把 Top-K 当成完整目录）：\n${catalogEvidence}` }] : []),
      ...(discoveryEvidence ? [{ role: 'system', content: `已授权文章级发现结果（用于推荐和找文章；它不是段落事实证据，不能据此虚构正文细节）：\n${discoveryEvidence.slice(0, config.limits.contextChars)}` }] : []),
      ...(evidence ? [{ role: 'system', content: `已授权站内证据（只能依据这些站内事实回答）：\n${evidence.slice(0, config.limits.contextChars)}` }] : []),
      { role: 'user', content: userMessage },
    ];
    const enabledTools = canModelUseTools(decision.intent) ? (skills.tools?.() || []) : [];
    const maxToolRounds = Math.max(1, Number(config.limits.toolRounds || 3));
    const mockResponse = discovery?.items?.length ? `根据已授权文章级发现结果：${discovery.items.map((item, index) => `[D${index + 1}] ${item.title}`).join('\n')}` : catalogResult ? `当前可访问目录共有 ${catalogResult.total} 篇文章：${catalogResult.items.map((item, index) => `[C${index + 1}] ${item.title}`).join('\n')}` : retrieval ? `根据已授权的站内资料，我找到以下相关信息：${retrieval.candidates.map((item, index) => `[S${index + 1}] ${item.excerpt || item.content.slice(0, 160)}`).join('\n')}` : `这是一个 Mock 模式的直接回复：${message}`;
    let generated = null;
    let fallbackFrom = null;

    for (let round = 0; round <= maxToolRounds; round += 1) {
      const tools = round < maxToolRounds && toolResults.length < maxToolRounds ? enabledTools : [];
      await onEvent({ type: 'status', status: 'generating' });
      generated = await measure('generation', () => gateway.stream({ modelId, messages, userMessage, mockResponse, tools, toolChoice: tools.length ? 'auto' : undefined }, {
        signal,
        onDelta: async (delta) => {
          if (firstProviderDeltaMs === null) firstProviderDeltaMs = Date.now() - startedAt;
          return onEvent({ type: 'delta', delta, provider: true });
        },
        onToolCallDelta: async () => {},
      }));
      fallbackFrom = fallbackFrom || generated.fallbackFrom || null;
      const calls = Array.isArray(generated.toolCalls) ? generated.toolCalls : [];
      if (!calls.length || !tools.length) break;
      const accepted = calls.slice(0, Math.max(0, maxToolRounds - toolResults.length));
      if (!accepted.length) break;
      messages.push(assistantToolMessage(generated, accepted));
      for (const call of accepted) {
        let result;
        await onEvent({ type: 'status', status: 'tool' });
        await onEvent({ type: 'tool_start', tool: call.function.name });
        try { result = await measure('tool', () => skills.invoke(call.function.name, parseToolArguments(call.function.arguments), context)); }
        catch (error) { result = toolError(error); }
        finally { await onEvent({ type: 'tool_end', tool: call.function.name }); }
        toolResults.push({ name: call.function.name, result });
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result).slice(0, config.limits.toolResultChars) });
      }
    }
    return {
      context, decision,
      response: compose({ content: generated?.content || '我暂时无法完成回答。', retrieval, catalog: decision.intent === INTENTS.ARTICLE_CATALOG ? catalogResult : null, discovery, fallbackFrom }),
      model: generated?.model || null, usage: generated?.usage || { inputTokens: 0, outputTokens: 0 }, toolResults, trace: trace(),
    };
  }

  return { run };
}

module.exports = { createAgentWorkflow, parseToolArguments, assistantToolMessage, canModelUseTools };
