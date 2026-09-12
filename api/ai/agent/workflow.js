const { routeIntent, INTENTS } = require('./intent-router');
const { createSystemPrompt } = require('./system-prompt');
const { compose, noEvidenceResponse } = require('./response-composer');
const { summarizeInput } = require('./article-summary');

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

function createAgentWorkflow({ contextBuilder, retriever, skills, gateway, memoryStore, catalog = null, retrievalPlanner = null, config }) {
  async function run({ user = null, message, quickAction = null, pageContext, modelId, conversation = null, signal, onEvent = async () => {} }) {
    await onEvent({ type: 'status', status: 'analyzing' });
    const context = await contextBuilder.build({ user, pageContext });
    const decision = routeIntent(message, context, quickAction);
    const plan = retrievalPlanner?.plan(decision, context) || { catalog: decision.needsCatalog, semantic: decision.needsSemanticRetrieval, deterministicCatalog: decision.intent === INTENTS.ARTICLE_CATALOG };
    const toolResults = [];

    let retrieval = null;
    let catalogResult = null;
    let directContent = null;
    if (decision.intent === INTENTS.SITE_NAVIGATION) {
      directContent = '你可以使用顶部导航访问首页、探索、个人中心和设置；登录后可从导航中的 AI 入口继续对话。';
    } else if (decision.intent === INTENTS.ARTICLE_SUMMARY) {
      if (!context.article) throw Object.assign(new Error('文章不可用'), { code: 'ARTICLE_REQUIRED' });
      await onEvent({ type: 'status', status: 'reading' });
      const summaryInput = summarizeInput(context.article, config.limits.contextChars);
      directContent = `以下是《${context.article.title}》的站内摘要请求。请基于文章正文归纳重点，不要补充文章外的事实。\n\n${summaryInput.content}`;
    } else if (plan.catalog && catalog) {
      await onEvent({ type: 'status', status: 'retrieving' });
      catalogResult = await catalog.list({ limit: 50, sort: decision.sort || 'published_desc' }, context);
    }
    if (plan.semantic && [INTENTS.SITE_QA, INTENTS.ARTICLE_QA, INTENTS.ARTICLE_SELECTION_QA].includes(decision.intent)) {
      await onEvent({ type: 'status', status: 'retrieving' });
      await onEvent({ type: 'tool_start', tool: 'search_articles' });
      try {
        const retrievalQuestion = context.selectedText ? `${context.heading || ''}\n${context.selectedText}\n${message}`.trim() : message;
        retrieval = await retriever.retrieve(retrievalQuestion, user, { articleId: context.article?.id, shareToken: context.shareToken, selectedText: context.selectedText, heading: context.heading, anchor: context.anchor });
      } finally { await onEvent({ type: 'tool_end', tool: 'search_articles' }); }
      if (retrieval.confidence.level === 'LOW') directContent = noEvidenceResponse();
    }

    let preferences = [];
    if (user?.id && memoryStore) {
      const setting = await memoryStore.settings(user.id);
      if (setting.memoryEnabled) preferences = await memoryStore.list(user.id);
    }
    const evidence = retrieval?.candidates?.map((candidate, index) => `[S${index + 1}] ${candidate.title} / ${candidate.headingPath}\n${candidate.content}`).join('\n\n') || '';
    const catalogEvidence = catalogResult?.items?.map((article, index) => `[C${index + 1}] ${article.title}\nslug: ${article.slug}\n${article.excerpt}`).join('\n\n') || '';
    const userMessage = directContent || message;
    if (directContent && (decision.intent === INTENTS.SITE_NAVIGATION || retrieval?.confidence?.level === 'LOW')) {
      return { context, decision, response: compose({ content: directContent, retrieval }), model: null, usage: { inputTokens: 0, outputTokens: 0 }, toolResults };
    }
    const messages = [
      { role: 'system', content: createSystemPrompt() },
      ...(conversation?.summary ? [{ role: 'system', content: `已压缩的本次会话背景：${String(conversation.summary).slice(0, config.limits.contextChars)}` }] : []),
      ...(preferences.length ? [{ role: 'system', content: `用户明确保存的偏好：${preferences.map((item) => `${item.key}: ${item.value}`).join('；').slice(0, config.limits.contextChars)}` }] : []),
      ...(conversation?.recent || []).slice(-config.limits.recentMessages),
      ...(context.selectedText ? [{ role: 'system', content: `当前已授权选文：\n${context.selectedText}` }] : []),
      ...(catalogEvidence ? [{ role: 'system', content: `已授权文章目录（目录问题必须依据全部目录，不能把 Top-K 当成完整目录）：\n${catalogEvidence.slice(0, config.limits.contextChars)}` }] : []),
      ...(evidence ? [{ role: 'system', content: `已授权站内证据（只能依据这些站内事实回答）：\n${evidence.slice(0, config.limits.contextChars)}` }] : []),
      { role: 'user', content: userMessage },
    ];
    const enabledTools = canModelUseTools(decision.intent) ? (skills.tools?.() || []) : [];
    const maxToolRounds = Math.max(1, Number(config.limits.toolRounds || 3));
    const mockResponse = catalogResult ? `当前可访问目录共有 ${catalogResult.total} 篇文章：${catalogResult.items.map((item, index) => `[C${index + 1}] ${item.title}`).join('\n')}` : retrieval ? `根据已授权的站内资料，我找到以下相关信息：${retrieval.candidates.map((item, index) => `[S${index + 1}] ${item.excerpt || item.content.slice(0, 160)}`).join('\n')}` : `这是一个 Mock 模式的直接回复：${message}`;
    let generated = null;
    let fallbackFrom = null;

    for (let round = 0; round <= maxToolRounds; round += 1) {
      const tools = round < maxToolRounds && toolResults.length < maxToolRounds ? enabledTools : [];
      await onEvent({ type: 'status', status: 'generating' });
      generated = await gateway.stream({ modelId, messages, userMessage, mockResponse, tools, toolChoice: tools.length ? 'auto' : undefined }, {
        signal,
        onDelta: async (delta) => onEvent({ type: 'delta', delta }),
        onToolCallDelta: async () => {},
      });
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
        try { result = await skills.invoke(call.function.name, parseToolArguments(call.function.arguments), context); }
        catch (error) { result = toolError(error); }
        finally { await onEvent({ type: 'tool_end', tool: call.function.name }); }
        toolResults.push({ name: call.function.name, result });
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result).slice(0, config.limits.toolResultChars) });
      }
    }
    return {
      context, decision,
      response: compose({ content: generated?.content || '我暂时无法完成回答。', retrieval, catalog: catalogResult, fallbackFrom }),
      model: generated?.model || null, usage: generated?.usage || { inputTokens: 0, outputTokens: 0 }, toolResults,
    };
  }

  return { run };
}

module.exports = { createAgentWorkflow, parseToolArguments, assistantToolMessage, canModelUseTools };
