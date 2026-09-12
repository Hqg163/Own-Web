const { INTENTS } = require('./intent-router');

function createRetrievalPlanner() {
  function plan(decision, context = {}) {
    const intent = decision.intent;
    return {
      catalog: Boolean(decision.needsCatalog || intent === INTENTS.ARTICLE_CATALOG),
      semantic: Boolean(decision.needsSemanticRetrieval),
      articleDiscovery: Boolean(decision.needsArticleDiscovery),
      currentArticle: Boolean(decision.needsCurrentArticle && context.article),
      deterministicCatalog: intent === INTENTS.ARTICLE_CATALOG,
    };
  }
  return { plan };
}

module.exports = { createRetrievalPlanner };
