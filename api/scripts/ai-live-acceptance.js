const crypto = require('crypto');
const path = require('path');
const dotenv = require('dotenv');
const mysql = require('mysql2');
const { installUtcPool } = require('../lib/utc-pool');
const { loadAiConfig } = require('../ai/config');
const { createQdrantStore } = require('../ai/qdrant');
const { createEmbeddingProvider } = require('../ai/providers/embedding-provider');
const { createRerankerProvider } = require('../ai/providers/reranker-provider');
const { createRetriever } = require('../ai/retrieval/retriever');
const { createArticleDiscovery } = require('../ai/retrieval/article-discovery');
const { createArticleCatalog } = require('../ai/agent/article-catalog');
const { createRetrievalPlanner } = require('../ai/agent/retrieval-planner');
const { TtlLruCache } = require('../ai/cache');
const { createContextBuilder } = require('../ai/agent/context-builder');
const { createSkillRegistry } = require('../ai/agent/skills');
const { createMemoryStore } = require('../ai/agent/memory-store');
const { createModelGateway } = require('../ai/agent/model-gateway');
const { createAgentWorkflow } = require('../ai/agent/workflow');
const { createHybridIntentRouter } = require('../ai/agent/intent-router');
const { noEvidenceResponse } = require('../ai/agent/response-composer');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

function fail(code) {
  throw Object.assign(new Error(code), { code });
}

async function main() {
  if (process.env.AI_LIVE_TESTS !== '1') fail('LIVE_TESTS_OPT_IN_REQUIRED');
  const config = loadAiConfig();
  if (!config.enabled || config.providerMode !== 'live') fail('LIVE_PROVIDER_REQUIRED');
  const db = mysql.createPool({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, database: process.env.DB_NAME, timezone: 'Z', connectionLimit: 2,
  });
  installUtcPool(db);
  const qdrant = createQdrantStore(config);
  const embedding = createEmbeddingProvider(config);
  const reranker = createRerankerProvider(config);
  const cache = new TtlLruCache(config.cache);
  const articleDiscovery = createArticleDiscovery({ db, config, qdrant, embeddingProvider: embedding, rerankerProvider: reranker, retrievalCache: cache });
  const catalogService = createArticleCatalog({ db });
  const gateway = createModelGateway({ config });
  const workflow = createAgentWorkflow({
    contextBuilder: createContextBuilder({ db, config }),
    retriever: createRetriever({ db, config, qdrant, embeddingProvider: embedding, rerankerProvider: reranker, retrievalCache: cache }),
    articleDiscovery, catalog: catalogService, retrievalPlanner: createRetrievalPlanner(),
    skills: createSkillRegistry({ db, config, articleDiscovery }), gateway, memoryStore: createMemoryStore({ db }),
    router: createHybridIntentRouter({ gateway, config }), config,
  });
  const run = async (message) => {
    const events = [];
    const result = await workflow.run({ user: null, message, pageContext: {}, modelId: 'qwen-fast', onEvent: async (event) => {
      if (event.type === 'status') events.push(event.status);
      if (event.type === 'tool_start' || event.type === 'tool_end') events.push(`${event.type}:${event.tool}`);
    } });
    return { result, events };
  };
  try {
    const tool = await run('请使用 search_articles 工具按标题搜索本站的 Vue 调度文章；取得工具结果后再简短回答。');
    const toolNames = tool.result.toolResults.map((item) => item.name);
    if (!toolNames.includes('search_articles') || tool.events.filter((event) => event === 'generating').length < 2) fail('TOOL_ROUNDTRIP_FAILED');

    const rag = await run('本站文章中，为什么 Vue 3 的多个同步写入不会立刻造成十次渲染？');
    if (!rag.result.model || !rag.result.response.citations.length || rag.result.decision.intent !== 'SITE_QA') {
      // Keep diagnostics safe: acceptance logs only execution state and counts,
      // never generated content, prompt context, or source text.
      console.error(JSON.stringify({
        check: 'rag_citation', modelReturned: Boolean(rag.result.model),
        citationCount: rag.result.response.citations.length,
        intent: rag.result.decision.intent,
        confidence: rag.result.response.confidence?.level || null,
      }));
      fail('RAG_CITATION_FAILED');
    }

    const low = await run('站内文章有没有给出量子计算芯片的价格？');
    if (low.result.model || low.result.response.citations.length || low.result.response.content !== noEvidenceResponse()) fail('LOW_CONFIDENCE_REFUSAL_FAILED');

    // These data-source probes deliberately avoid a needless model generation:
    // catalog completeness and article selection are evaluated at their
    // authoritative source boundary, while the workflow paths are covered by
    // the real tool and RAG calls above.
    const catalog = await catalogService.list({ limit: 50, sort: 'published_desc' }, { user: null, shareToken: null });
    if (catalog.total !== catalog.items.length || catalog.items.length < 4) fail('CATALOG_COMPLETENESS_FAILED');
    const discovery = await articleDiscovery.discover('哪些文章与 Vue 响应式调度有关？', null, {}, { limit: 5 });
    if (!discovery.items.some((citation) => citation.slug === 'vue-3-响应式与调度-一次更新为什么不会立刻触发十次渲染')) fail('ARTICLE_DISCOVERY_FAILED');

    console.log(JSON.stringify({
      requestId: crypto.randomUUID(), status: 'PASS',
      checks: [
        { name: 'tool_call_roundtrip', status: 'PASS', trace: ['model_tool_call:search_articles', 'server_validation_and_skill:search_articles', 'tool_result_returned', 'second_model_call'] },
        { name: 'rag_citation', status: 'PASS', citationCount: rag.result.response.citations.length },
        { name: 'low_confidence_refusal', status: 'PASS', citationCount: 0 },
        { name: 'catalog_completeness', status: 'PASS', citationCount: catalog.items.length },
        { name: 'article_discovery', status: 'PASS', citationCount: discovery.items.length },
      ],
    }));
  } finally {
    await db.promise().end();
  }
}

main().catch((error) => {
  console.error(`[ai:live-acceptance] ${error.code || 'CHECK_FAILED'}`);
  process.exitCode = 1;
});
