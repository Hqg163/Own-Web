const crypto = require('crypto');
const path = require('path');
const dotenv = require('dotenv');
const mysql = require('mysql2');
const { runMigrations } = require('../migrations');
const { installUtcPool } = require('../lib/utc-pool');
const { loadAiConfig } = require('../ai/config');
const { createQdrantStore } = require('../ai/qdrant');
const { createEmbeddingProvider } = require('../ai/providers/embedding-provider');
const { createRerankerProvider } = require('../ai/providers/reranker-provider');
const { createModelGateway } = require('../ai/agent/model-gateway');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

function check(name, action) {
  return Promise.resolve().then(action)
    .then((count = 0) => ({ name, status: 'PASS', count: Number.isFinite(Number(count)) ? Number(count) : 0 }))
    .catch(() => ({ name, status: 'FAIL', count: 0 }));
}

async function main() {
  const requestId = crypto.randomUUID();
  const config = loadAiConfig();
  const pool = mysql.createPool({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, database: process.env.DB_NAME, timezone: 'Z', connectionLimit: 2,
  });
  installUtcPool(pool);
  const qdrant = createQdrantStore(config);
  const embedding = createEmbeddingProvider(config);
  const reranker = createRerankerProvider(config);
  const gateway = createModelGateway({ config });
  const checks = [];
  try {
    const configured = config.enabled && config.providerMode === 'live' && Boolean(config.qdrant.url) && Boolean(config.qwen.apiKey) && Boolean(config.qwen.chatBaseUrl) && Boolean(config.qwen.embeddingBaseUrl) && Boolean(config.qwen.rerankBaseUrl);
    checks.push({ name: 'configuration', status: configured ? 'PASS' : 'FAIL', count: configured ? 1 : 0 });
    checks.push(await check('migration', async () => {
      await runMigrations(pool);
      const [rows] = await pool.promise().query("SELECT COUNT(*) AS count FROM schema_migrations WHERE id IN ('20260911_ai_v1','20260912_ai_index_lifecycle_v1')");
      if (Number(rows[0]?.count || 0) !== 2) throw new Error('migration missing');
      return rows[0].count;
    }));
    checks.push(await check('qdrant', async () => {
      await qdrant.ensureCollection();
      const schema = await qdrant.client.getCollection(qdrant.collection);
      if (schema.config?.params?.vectors?.dense?.size !== config.embedding.dimensions || schema.config?.params?.vectors?.dense?.distance !== 'Cosine' || schema.config?.params?.sparse_vectors?.bm25?.modifier !== 'idf') throw new Error('schema mismatch');
      return Number((await qdrant.client.count(qdrant.collection, { exact: true })).count || 0);
    }));
    checks.push(await check('embedding', async () => {
      const vectors = await embedding.embed(['Own-Web AI doctor embedding check.']);
      if (!Array.isArray(vectors[0]) || vectors[0].length !== config.embedding.dimensions) throw new Error('embedding shape');
      return vectors.length;
    }));
    checks.push(await check('rerank', async () => {
      const results = await reranker.rerank('Own-Web', [{ content: 'Own-Web AI retrieval diagnostic', score: 1 }]);
      if (!Array.isArray(results) || !results.length) throw new Error('rerank result');
      return results.length;
    }));
    checks.push(await check('chat', async () => {
      const result = await gateway.generate({
        modelId: 'qwen-fast', messages: [{ role: 'user', content: 'Reply with OK.' }], userMessage: 'Reply with OK.',
      });
      if (!String(result.content || '').trim()) throw new Error('empty chat');
      return 1;
    }));
  } finally {
    await pool.promise().end().catch(() => {});
  }
  const status = checks.every((item) => item.status === 'PASS') ? 'PASS' : 'FAIL';
  console.log(JSON.stringify({ requestId, status, checks }));
}

main().catch(() => {
  console.log(JSON.stringify({ requestId: crypto.randomUUID(), status: 'FAIL', checks: [] }));
  process.exitCode = 1;
});
