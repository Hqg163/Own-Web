const INTENTS = Object.freeze({
  DIRECT_CHAT: 'DIRECT_CHAT', SITE_QA: 'SITE_QA', ARTICLE_QA: 'ARTICLE_QA',
  ARTICLE_SELECTION_QA: 'ARTICLE_SELECTION_QA', ARTICLE_SUMMARY: 'ARTICLE_SUMMARY',
  RELATED_CONTENT: 'RELATED_CONTENT', SITE_NAVIGATION: 'SITE_NAVIGATION',
  PROJECT_QUERY: 'PROJECT_QUERY', SERIES_QUERY: 'SERIES_QUERY',
});

function routeIntent(message, context, quickAction = null) {
  if (quickAction === 'summary_current') return { intent: context.selectedText ? INTENTS.ARTICLE_SELECTION_QA : INTENTS.ARTICLE_SUMMARY, reason: 'quick-action-summary' };
  if (quickAction === 'related_content') return { intent: INTENTS.RELATED_CONTENT, reason: 'quick-action-related' };
  if (['selection_explain', 'selection_expand', 'selection_example'].includes(quickAction)) return { intent: INTENTS.ARTICLE_SELECTION_QA, reason: 'quick-action-selection' };
  if (quickAction === 'explain_concept') return { intent: context.selectedText ? INTENTS.ARTICLE_SELECTION_QA : (context.article ? INTENTS.ARTICLE_QA : INTENTS.DIRECT_CHAT), reason: 'quick-action-explain' };
  const text = String(message || '').toLowerCase();
  if (context.selectedText) return { intent: INTENTS.ARTICLE_SELECTION_QA, reason: 'selection' };
  if (context.article && /(总结|摘要|概述|summari[sz]e|tl;?dr)/i.test(text)) return { intent: INTENTS.ARTICLE_SUMMARY, reason: 'article-summary' };
  if (/(相关文章|类似文章|延伸阅读|related)/i.test(text)) return { intent: INTENTS.RELATED_CONTENT, reason: 'related-content' };
  if (/(项目|project|作品集|portfolio)/i.test(text)) return { intent: INTENTS.PROJECT_QUERY, reason: 'project-keyword' };
  if (/(专栏|系列|series)/i.test(text)) return { intent: INTENTS.SERIES_QUERY, reason: 'series-keyword' };
  if (/(在哪|怎么进入|导航|页面|设置|where|navigate)/i.test(text)) return { intent: INTENTS.SITE_NAVIGATION, reason: 'navigation-keyword' };
  if (context.article) return { intent: INTENTS.ARTICLE_QA, reason: 'article-context' };
  if (/(本站|站内|文章|博客|own-web|网站)/i.test(text)) return { intent: INTENTS.SITE_QA, reason: 'site-keyword' };
  return { intent: INTENTS.DIRECT_CHAT, reason: 'default' };
}

module.exports = { INTENTS, routeIntent };
