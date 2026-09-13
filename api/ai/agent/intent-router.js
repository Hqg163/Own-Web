const { z } = require('zod');

const INTENTS = Object.freeze({
  DIRECT_CHAT: 'DIRECT_CHAT', SITE_QA: 'SITE_QA', ARTICLE_QA: 'ARTICLE_QA',
  ARTICLE_SELECTION_QA: 'ARTICLE_SELECTION_QA', ARTICLE_SUMMARY: 'ARTICLE_SUMMARY',
  RELATED_CONTENT: 'RELATED_CONTENT', SITE_NAVIGATION: 'SITE_NAVIGATION',
  PROJECT_QUERY: 'PROJECT_QUERY', SERIES_QUERY: 'SERIES_QUERY', ARTICLE_CATALOG: 'ARTICLE_CATALOG',
  ARTICLE_DISCOVERY: 'ARTICLE_DISCOVERY', ARTICLE_RECOMMENDATION: 'ARTICLE_RECOMMENDATION',
  WRITE_ACTION_REQUEST: 'WRITE_ACTION_REQUEST', CAPABILITY_QUERY: 'CAPABILITY_QUERY',
});

const RouterDecisionSchema = z.object({
  intent: z.enum(Object.values(INTENTS)), needsCatalog: z.boolean(), needsSemanticRetrieval: z.boolean(),
  needsArticleDiscovery: z.boolean(), needsCurrentArticle: z.boolean(), requestedCount: z.number().int().min(1).max(50).nullable(),
  sort: z.enum(['published_desc', 'published_asc', 'updated_desc', 'title_asc']).nullable(), topicQuery: z.string().max(300).nullable(), reason: z.string().max(120),
  comparison: z.boolean(), secondaryIntents: z.array(z.enum(Object.values(INTENTS))).max(3),
  routeSource: z.enum(['deterministic', 'structured', 'fallback']),
}).strict();

function numberRequested(text) {
  const chinese = String(text).match(/([一二三四五六七八九十])\s*篇/);
  const numeric = String(text).match(/(\d{1,2})\s*篇/);
  const values = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  return numeric ? Math.min(50, Number(numeric[1])) : chinese ? values[chinese[1]] : null;
}

function decision(intent, reason, patch = {}) {
  return RouterDecisionSchema.parse({ intent, reason, needsCatalog: false, needsSemanticRetrieval: false, needsArticleDiscovery: false, needsCurrentArticle: false, requestedCount: null, sort: null, topicQuery: null, comparison: false, secondaryIntents: [], routeSource: 'deterministic', ...patch });
}

function isWriteAction(text) {
  // Treat a request as a write action only when an operation and a mutable
  // Own-Web target form one command.  Two independent keyword matches would
  // incorrectly turn questions such as “文章中多个同步写入” into a publish
  // request, bypassing authorized retrieval.
  const action = '(?:发布|创建|新建|编辑|修改|删除|上传|保存|写入|publish|create|edit|delete|upload|save|write)';
  const target = '(?:文章|博客|帖子|内容|项目|专栏|系列|编辑器|post|article|blog|project|series|editor)';
  return new RegExp(`(?:${action})\\s*(?:这|一|新|该)?(?:篇|个|条)?\\s*${target}|${target}\\s*(?:请|帮我|要|需要|想)?\\s*${action}`, 'i').test(String(text || ''));
}

function isCapabilityQuestion(text) {
  return /(你能.{0,8}(做|帮|创建|发布|编辑|删除|上传)|可以.{0,8}(做|帮|创建|发布|编辑|删除|上传)|能否|支持(什么|哪些|发布|编辑|删除|上传)|what can you do|can you (create|publish|edit|delete|upload))/i.test(text);
}

function routeIntent(message, context, quickAction = null) {
  if (quickAction === 'summary_current') return decision(context.selectedText ? INTENTS.ARTICLE_SELECTION_QA : INTENTS.ARTICLE_SUMMARY, 'quick-action-summary', { needsCurrentArticle: true, needsSemanticRetrieval: Boolean(context.selectedText) });
  if (quickAction === 'related_content') return decision(INTENTS.RELATED_CONTENT, 'quick-action-related', { needsArticleDiscovery: true, needsCurrentArticle: Boolean(context.article) });
  if (['selection_explain', 'selection_expand', 'selection_example'].includes(quickAction)) return decision(INTENTS.ARTICLE_SELECTION_QA, 'quick-action-selection', { needsCurrentArticle: true, needsSemanticRetrieval: true });
  if (quickAction === 'explain_concept') return decision(context.selectedText ? INTENTS.ARTICLE_SELECTION_QA : (context.article ? INTENTS.ARTICLE_QA : INTENTS.DIRECT_CHAT), 'quick-action-explain', { needsCurrentArticle: Boolean(context.article || context.selectedText), needsSemanticRetrieval: Boolean(context.article || context.selectedText) });
  const text = String(message || '').toLowerCase();
  if (context.selectedText) return decision(INTENTS.ARTICLE_SELECTION_QA, 'selection', { needsCurrentArticle: true, needsSemanticRetrieval: true });
  if (isCapabilityQuestion(text)) return decision(INTENTS.CAPABILITY_QUERY, 'capability-question');
  if (isWriteAction(text)) return decision(INTENTS.WRITE_ACTION_REQUEST, 'write-action');
  if (context.article && /(总结|摘要|概述|summari[sz]e|tl;?dr)/i.test(text)) return decision(INTENTS.ARTICLE_SUMMARY, 'article-summary', { needsCurrentArticle: true });
  if (/(挑|推荐|值得看|recommend)/i.test(text) && /(文章|内容|篇|阅读|read)/i.test(text)) return decision(INTENTS.ARTICLE_RECOMMENDATION, 'recommendation-keyword', { needsCatalog: true, needsArticleDiscovery: true, requestedCount: numberRequested(text) || 3, topicQuery: text });
  if (/(有哪些|有几|多少篇|一共.*篇|列出|全部|所有|最近.*(发布|写)|最新.*(发布|文章)|list.*articles|how many.*articles|recent.*(posts|articles))/i.test(text) && /(本站|站内|文章|博客|内容|发布|articles?|posts?|site|blog)/i.test(text)) return decision(INTENTS.ARTICLE_CATALOG, 'catalog-keyword', { needsCatalog: true, requestedCount: numberRequested(text), sort: /(最近|最新|recent|latest)/i.test(text) ? 'published_desc' : null });
  if (/(哪些文章|什么文章|找.*文章|文章.*(ai|目标检测|算法|主题)|find.*articles|articles?.*(about|with))/i.test(text)) return decision(INTENTS.ARTICLE_DISCOVERY, 'discovery-keyword', { needsCatalog: true, needsArticleDiscovery: true, topicQuery: text });
  if (/(相关文章|类似文章|延伸阅读|related)/i.test(text)) return decision(INTENTS.RELATED_CONTENT, 'related-content', { needsArticleDiscovery: true, needsCurrentArticle: Boolean(context.article) });
  if (/(项目|project|作品集|portfolio)/i.test(text)) return decision(INTENTS.PROJECT_QUERY, 'project-keyword');
  if (/(专栏|系列|series)/i.test(text)) return decision(INTENTS.SERIES_QUERY, 'series-keyword');
  if (/(在哪|怎么进入|导航|页面|设置|where|navigate)/i.test(text)) return decision(INTENTS.SITE_NAVIGATION, 'navigation-keyword');
  if (context.article) return decision(INTENTS.ARTICLE_QA, 'article-context', { needsCurrentArticle: true, needsSemanticRetrieval: true });
  if (/(本站|站内|文章|博客|own-web|网站)/i.test(text)) return decision(INTENTS.SITE_QA, 'site-keyword', { needsSemanticRetrieval: true });
  return decision(INTENTS.DIRECT_CHAT, 'default');
}

function shouldUseStructuredRouter(message, context, quickAction = null) {
  if (quickAction || context.selectedText) return false;
  const text = String(message || '').trim();
  if (!text || isWriteAction(text) || isCapabilityQuestion(text)) return false;
  // A bounded second opinion is reserved for genuinely compound requests or
  // questions where a site/content reference is present but the deterministic
  // rules cannot safely tell which evidence lane is needed.
  const compound = /(并且|同时|然后|再|以及|分别|比较|对比|compare|and then|also|both)/i.test(text)
    && /(文章|内容|本站|站内|博客|推荐|目录|articles?|posts?|site|blog)/i.test(text);
  const ambiguousSiteQuestion = /[？?]/.test(text)
    && /(本站|站内|文章|博客|内容|own-web|网站|articles?|posts?|site|blog)/i.test(text)
    && !/(有哪些|有几|多少篇|一共.*篇|列出|全部|所有|最近|最新|哪些文章|找.*文章|相关文章|类似文章|延伸阅读)/i.test(text);
  return compound || ambiguousSiteQuestion;
}

const structuredDecisionSchema = RouterDecisionSchema.omit({ reason: true, routeSource: true }).extend({
  intent: z.enum(Object.values(INTENTS)),
  secondaryIntents: z.array(z.enum(Object.values(INTENTS))).max(3).default([]),
});

function structuredPrompt(context) {
  return [
    '你是 Own-Web 的受限意图路由器。只输出 JSON，不要解释。',
    `可用 intent: ${Object.values(INTENTS).join(', ')}。`,
    '只可选择只读计划：目录 needsCatalog；找文章/推荐 needsArticleDiscovery；正文事实 needsSemanticRetrieval；当前文章 needsCurrentArticle。',
    '写入、发布、编辑、删除、上传请求必须是 WRITE_ACTION_REQUEST；能力询问是 CAPABILITY_QUERY。不得请求工具、不得输出用户数据或推理。',
    `当前文章存在: ${Boolean(context.article)}；当前选文存在: ${Boolean(context.selectedText)}。`,
  ].join('\n');
}

function createHybridIntentRouter({ gateway, config }) {
  async function route(message, context, quickAction = null) {
    const deterministic = routeIntent(message, context, quickAction);
    if (!config?.router?.structuredEnabled || !shouldUseStructuredRouter(message, context, quickAction)) return deterministic;
    try {
      const result = await gateway.generate({
        modelId: config.router.modelId || 'qwen-fast',
        messages: [{ role: 'system', content: structuredPrompt(context) }, { role: 'user', content: String(message || '').slice(0, 800) }],
        userMessage: String(message || '').slice(0, 800), temperature: 0, responseFormat: 'json_object',
      });
      const parsed = JSON.parse(String(result.content || ''));
      const candidate = structuredDecisionSchema.parse(parsed);
      // Context is server-derived. A model can reduce work, never manufacture
      // an article or selected-text authorization lane that is not present.
      if (!context.article) candidate.needsCurrentArticle = false;
      if (!context.article && candidate.intent === INTENTS.ARTICLE_SUMMARY) return { ...deterministic, routeSource: 'fallback', reason: 'structured-invalid-context' };
      return RouterDecisionSchema.parse({ ...candidate, reason: 'structured-router', routeSource: 'structured' });
    } catch (_) {
      return RouterDecisionSchema.parse({ ...deterministic, routeSource: 'fallback', reason: 'structured-fallback' });
    }
  }
  return { route };
}

module.exports = { INTENTS, RouterDecisionSchema, routeIntent, numberRequested, shouldUseStructuredRouter, createHybridIntentRouter };
