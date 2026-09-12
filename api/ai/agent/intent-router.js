const { z } = require('zod');

const INTENTS = Object.freeze({
  DIRECT_CHAT: 'DIRECT_CHAT', SITE_QA: 'SITE_QA', ARTICLE_QA: 'ARTICLE_QA',
  ARTICLE_SELECTION_QA: 'ARTICLE_SELECTION_QA', ARTICLE_SUMMARY: 'ARTICLE_SUMMARY',
  RELATED_CONTENT: 'RELATED_CONTENT', SITE_NAVIGATION: 'SITE_NAVIGATION',
  PROJECT_QUERY: 'PROJECT_QUERY', SERIES_QUERY: 'SERIES_QUERY', ARTICLE_CATALOG: 'ARTICLE_CATALOG',
  ARTICLE_DISCOVERY: 'ARTICLE_DISCOVERY', ARTICLE_RECOMMENDATION: 'ARTICLE_RECOMMENDATION',
});

const RouterDecisionSchema = z.object({
  intent: z.enum(Object.values(INTENTS)), needsCatalog: z.boolean(), needsSemanticRetrieval: z.boolean(),
  needsArticleDiscovery: z.boolean(), needsCurrentArticle: z.boolean(), requestedCount: z.number().int().min(1).max(50).nullable(),
  sort: z.enum(['published_desc', 'published_asc', 'updated_desc', 'title_asc']).nullable(), topicQuery: z.string().max(300).nullable(), reason: z.string().max(120),
}).strict();

function numberRequested(text) {
  const chinese = String(text).match(/([一二三四五六七八九十])\s*篇/);
  const numeric = String(text).match(/(\d{1,2})\s*篇/);
  const values = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  return numeric ? Math.min(50, Number(numeric[1])) : chinese ? values[chinese[1]] : null;
}

function decision(intent, reason, patch = {}) {
  return RouterDecisionSchema.parse({ intent, reason, needsCatalog: false, needsSemanticRetrieval: false, needsArticleDiscovery: false, needsCurrentArticle: false, requestedCount: null, sort: null, topicQuery: null, ...patch });
}

function routeIntent(message, context, quickAction = null) {
  if (quickAction === 'summary_current') return decision(context.selectedText ? INTENTS.ARTICLE_SELECTION_QA : INTENTS.ARTICLE_SUMMARY, 'quick-action-summary', { needsCurrentArticle: true, needsSemanticRetrieval: Boolean(context.selectedText) });
  if (quickAction === 'related_content') return decision(INTENTS.RELATED_CONTENT, 'quick-action-related', { needsArticleDiscovery: true, needsCurrentArticle: Boolean(context.article) });
  if (['selection_explain', 'selection_expand', 'selection_example'].includes(quickAction)) return decision(INTENTS.ARTICLE_SELECTION_QA, 'quick-action-selection', { needsCurrentArticle: true, needsSemanticRetrieval: true });
  if (quickAction === 'explain_concept') return decision(context.selectedText ? INTENTS.ARTICLE_SELECTION_QA : (context.article ? INTENTS.ARTICLE_QA : INTENTS.DIRECT_CHAT), 'quick-action-explain', { needsCurrentArticle: Boolean(context.article || context.selectedText), needsSemanticRetrieval: Boolean(context.article || context.selectedText) });
  const text = String(message || '').toLowerCase();
  if (context.selectedText) return decision(INTENTS.ARTICLE_SELECTION_QA, 'selection', { needsCurrentArticle: true, needsSemanticRetrieval: true });
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

module.exports = { INTENTS, RouterDecisionSchema, routeIntent, numberRequested };
