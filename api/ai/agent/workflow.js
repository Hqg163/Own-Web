const { routeIntent, INTENTS } = require('./intent-router');
const { createSystemPrompt } = require('./system-prompt');
const { compose, noEvidenceResponse } = require('./response-composer');
const { summarizeInput } = require('./article-summary');

function extractToolText(result, maximum) { return JSON.stringify(result).slice(0, maximum); }

function createAgentWorkflow({ contextBuilder, retriever, skills, gateway, memoryStore, config }) {
  async function run({ user = null, message, quickAction = null, pageContext, modelId, conversation = null, signal, onEvent = async () => {} }) {
    await onEvent({ type: 'status', status: 'analyzing' });
    const context = await contextBuilder.build({ user, pageContext });
    const decision = routeIntent(message, context, quickAction);
    const toolResults = [];
    const invoke = async (name, input) => {
      if (toolResults.length >= config.limits.toolRounds) throw Object.assign(new Error('工具调用超过上限'), { code: 'TOOL_LIMIT' });
      await onEvent({ type: 'status', status: 'tool' });
      await onEvent({ type: 'tool_start', tool: name });
      const result = await skills.invoke(name, input, context);
      toolResults.push({ name, result });
      await onEvent({ type: 'tool_end', tool: name });
      return result;
    };

    let retrieval = null;
    let directContent = null;
    if (decision.intent === INTENTS.SITE_NAVIGATION) {
      directContent = '你可以使用顶部导航访问首页、探索、个人中心和设置；登录后可从导航中的 AI 入口继续对话。';
    } else if (decision.intent === INTENTS.ARTICLE_SUMMARY) {
      if (!context.article) throw Object.assign(new Error('文章不可用'), { code: 'ARTICLE_REQUIRED' });
      await onEvent({ type: 'status', status: 'reading' });
      await onEvent({ type: 'tool_start', tool: 'get_article' });
      const summaryInput = summarizeInput(context.article, config.limits.contextChars);
      toolResults.push({ name: 'get_article', result: { postId: context.article.id, mode: summaryInput.mode, sections: summaryInput.sections } });
      await onEvent({ type: 'tool_end', tool: 'get_article' });
      directContent = `以下是《${context.article.title}》的站内摘要请求。请基于文章正文归纳重点，不要补充文章外的事实。\n\n${summaryInput.content}`;
    } else if (decision.intent === INTENTS.RELATED_CONTENT) {
      await invoke('get_related_articles', { postId: context.article?.id, limit: 5 });
    } else if (decision.intent === INTENTS.PROJECT_QUERY) {
      await invoke('search_projects', { query: message, limit: 5 });
    } else if (decision.intent === INTENTS.SERIES_QUERY && context.article?.id) {
      directContent = '当前问题涉及专栏，但没有提供可授权的专栏标识。请从专栏页面发起，或说明具体专栏。';
    } else if (decision.intent !== INTENTS.DIRECT_CHAT) {
      await onEvent({ type: 'status', status: 'retrieving' });
      await onEvent({ type: 'tool_start', tool: 'search_articles' });
      try {
        retrieval = await retriever.retrieve(message, user, { articleId: context.article?.id, shareToken: context.shareToken, selectedText: context.selectedText, heading: context.heading });
      } finally { await onEvent({ type: 'tool_end', tool: 'search_articles' }); }
      if (retrieval.confidence.level === 'LOW') directContent = noEvidenceResponse();
    }

    let preferences = [];
    if (user?.id && memoryStore) {
      const setting = await memoryStore.settings(user.id);
      if (setting.memoryEnabled) preferences = await memoryStore.list(user.id);
    }
    const evidence = retrieval?.candidates?.map((candidate, index) => `[S${index + 1}] ${candidate.title} / ${candidate.headingPath}\n${candidate.content}`).join('\n\n') || '';
    const toolText = toolResults.map((tool) => `${tool.name}: ${extractToolText(tool.result, config.limits.toolResultChars)}`).join('\n');
    const userMessage = directContent || message;
    if (directContent && (decision.intent === INTENTS.SITE_NAVIGATION || retrieval?.confidence?.level === 'LOW')) {
      return { context, decision, response: compose({ content: directContent, retrieval }), model: null, usage: { inputTokens: 0, outputTokens: 0 }, toolResults };
    }
    const history = conversation?.recent || [];
    const messages = [
      { role: 'system', content: createSystemPrompt() },
      ...(conversation?.summary ? [{ role: 'system', content: `已压缩的本次会话背景：${String(conversation.summary).slice(0, config.limits.contextChars)}` }] : []),
      ...(preferences.length ? [{ role: 'system', content: `用户明确保存的偏好：${preferences.map((item) => `${item.key}: ${item.value}`).join('；').slice(0, config.limits.contextChars)}` }] : []),
      ...history.slice(-config.limits.recentMessages),
      ...(context.selectedText ? [{ role: 'system', content: `当前已授权选文：\n${context.selectedText}` }] : []),
      ...(evidence ? [{ role: 'system', content: `已授权站内证据（只能依据这些站内事实回答）：\n${evidence.slice(0, config.limits.contextChars)}` }] : []),
      ...(toolText ? [{ role: 'system', content: `只读工具结果：\n${toolText}` }] : []),
      { role: 'user', content: userMessage },
    ];
    const mockResponse = retrieval ? `根据已授权的站内资料，我找到以下相关信息：${retrieval.candidates.map((item, index) => `[S${index + 1}] ${item.excerpt || item.content.slice(0, 160)}`).join('\n')}` : (toolResults.length ? `根据已授权的站内数据：${toolText}` : `这是一个 Mock 模式的直接回复：${message}`);
    await onEvent({ type: 'status', status: 'generating' });
    const generated = await gateway.stream({ modelId, messages, userMessage, mockResponse }, { signal, onDelta: async (delta) => onEvent({ type: 'delta', delta }) });
    return { context, decision, response: compose({ content: generated.content, retrieval, fallbackFrom: generated.fallbackFrom }), model: generated.model, usage: generated.usage, toolResults };
  }

  return { run };
}

module.exports = { createAgentWorkflow };
