const crypto = require('crypto');
const http = require('http');
const path = require('path');
const dotenv = require('dotenv');
const express = require('express');
const mysql = require('mysql2');
const { installUtcPool } = require('../lib/utc-pool');
const { loadAiConfig } = require('../ai/config');
const { createQdrantStore } = require('../ai/qdrant');
const { createEmbeddingProvider } = require('../ai/providers/embedding-provider');
const { createRerankerProvider } = require('../ai/providers/reranker-provider');
const { createRetriever } = require('../ai/retrieval/retriever');
const { createArticleDiscovery } = require('../ai/retrieval/article-discovery');
const { TtlLruCache } = require('../ai/cache');
const { createContextBuilder } = require('../ai/agent/context-builder');
const { createSkillRegistry } = require('../ai/agent/skills');
const { createConversationStore } = require('../ai/agent/conversation-store');
const { createMemoryStore } = require('../ai/agent/memory-store');
const { createArticleCatalog } = require('../ai/agent/article-catalog');
const { createRetrievalPlanner } = require('../ai/agent/retrieval-planner');
const { createHybridIntentRouter } = require('../ai/agent/intent-router');
const { createModelGateway } = require('../ai/agent/model-gateway');
const { createAgentWorkflow } = require('../ai/agent/workflow');
const { mountAiRoutes } = require('../ai/routes');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

function emit(status, checks) {
  console.log(JSON.stringify({ requestId: crypto.randomUUID(), status, checks }));
}

function parseSse(buffer, consume) {
  const events = buffer.split(/\r?\n\r?\n/);
  const tail = events.pop() || '';
  for (const raw of events) {
    const lines = raw.split(/\r?\n/);
    const type = lines.find((line) => line.startsWith('event:'))?.slice(6).trim();
    const data = lines.find((line) => line.startsWith('data:'))?.slice(5).trim();
    if (type && data) {
      try { consume(type, JSON.parse(data)); } catch (_) { /* malformed local diagnostic event */ }
    }
  }
  return tail;
}

async function main() {
  if (process.env.AI_LIVE_TESTS !== '1') return emit('FAIL', [{ name: 'live_opt_in', status: 'FAIL', count: 0 }]);
  const config = loadAiConfig();
  if (!config.enabled || config.providerMode !== 'live') return emit('FAIL', [{ name: 'live_provider', status: 'FAIL', count: 0 }]);
  const db = mysql.createPool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, timezone: 'Z', connectionLimit: 2 });
  installUtcPool(db);
  const qdrant = createQdrantStore(config);
  const embedding = createEmbeddingProvider(config);
  const reranker = createRerankerProvider(config);
  const cache = new TtlLruCache(config.cache);
  const gateway = createModelGateway({ config });
  const discovery = createArticleDiscovery({ db, config, qdrant, embeddingProvider: embedding, rerankerProvider: reranker, retrievalCache: cache });
  const catalog = createArticleCatalog({ db });
  const workflow = createAgentWorkflow({
    contextBuilder: createContextBuilder({ db, config }), retriever: createRetriever({ db, config, qdrant, embeddingProvider: embedding, rerankerProvider: reranker, retrievalCache: cache }),
    articleDiscovery: discovery, catalog, retrievalPlanner: createRetrievalPlanner(), skills: createSkillRegistry({ db, config, articleDiscovery: discovery }), gateway,
    memoryStore: createMemoryStore({ db }), router: createHybridIntentRouter({ gateway, config }), config,
  });
  const app = express(); app.use(express.json());
  mountAiRoutes(app, db, { getAuthToken: () => null, authSecret: process.env.AUTH_SECRET || 'ai-stream-doctor-local-only', config, gateway, workflow, conversationStore: createConversationStore({ db, config }), memoryStore: createMemoryStore({ db }), qdrant });
  const server = http.createServer(app);
  try {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    const startedAt = Date.now();
    const response = await fetch(`http://127.0.0.1:${port}/api/ai/chat`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      // A direct prompt deliberately avoids site terms, RAG, and tools. This
      // makes the timing check a transport/provider streaming measurement
      // instead of conflating first-token time with retrieval or tool rounds.
      body: JSON.stringify({ message: '请用至少二百六十个汉字，连贯地说明写作时如何引用可靠资料、如何避免把不确定的信息说成事实，以及读者怎样提出更清晰的后续问题。' }),
    });
    let buffer = ''; let firstStatusMs = null; let firstClientDeltaMs = null; let doneMs = null; let deltaCount = 0; let largestDeltaChars = 0; let doneBeforeDelta = false;
    const reader = response.body?.getReader();
    if (!reader) throw new Error('STREAM_BODY_MISSING');
    const decoder = new TextDecoder();
    const consume = (type, payload) => {
      if (type === 'status' && firstStatusMs === null) firstStatusMs = Date.now() - startedAt;
      if (type === 'delta') {
        if (firstClientDeltaMs === null) firstClientDeltaMs = Date.now() - startedAt;
        deltaCount += 1; largestDeltaChars = Math.max(largestDeltaChars, String(payload.text || '').length);
      }
      if (type === 'done') { doneMs = Date.now() - startedAt; if (!deltaCount) doneBeforeDelta = true; }
    };
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer = parseSse(buffer + decoder.decode(value, { stream: true }), consume);
    }
    parseSse(buffer + decoder.decode(), consume);
    const headersPass = /no-transform/i.test(String(response.headers.get('cache-control') || '')) && response.headers.get('x-accel-buffering') === 'no';
    const progressive = deltaCount >= 3 && firstClientDeltaMs !== null && doneMs !== null && !doneBeforeDelta;
    const checks = [
      { name: 'sse_transport_headers', status: headersPass ? 'PASS' : 'FAIL', count: headersPass ? 1 : 0 },
      { name: 'express_client_progressive_stream', status: progressive ? 'PASS' : 'FAIL', count: deltaCount, firstStatusMs, firstClientDeltaMs, requestDoneMs: doneMs, largestDeltaChars },
    ];
    emit(checks.every((item) => item.status === 'PASS') ? 'PASS' : 'FAIL', checks);
  } catch (_) {
    emit('FAIL', [{ name: 'express_client_progressive_stream', status: 'FAIL', count: 0 }]);
  } finally {
    await new Promise((resolve) => server.close(resolve)).catch(() => {});
    await db.promise().end().catch(() => {});
  }
}

main();
