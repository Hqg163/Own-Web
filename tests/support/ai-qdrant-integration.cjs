const { spawnSync } = require('child_process');
const path = require('path');

async function main() {
  if (process.env.AI_RAG_INTEGRATION !== '1') {
    console.log('[ai-rag-integration] skipped: set AI_RAG_INTEGRATION=1 to require isolated Docker Compose Qdrant.')
    return;
  }

  // Qdrant is an API-workspace dependency and is deliberately not hoisted into
  // the browser application's dependency set.
  const { QdrantClient } = require(path.join(__dirname, '..', '..', 'api', 'node_modules', '@qdrant', 'js-client-rest'));

  const compose = spawnSync('docker', ['compose', 'up', '-d', 'qdrant'], { cwd: process.cwd(), encoding: 'utf8' });
  if (compose.error || compose.status !== 0) {
    const detail = compose.error?.message || compose.stderr || compose.stdout || 'unknown Docker Compose error';
    throw new Error(`[ai-rag-integration] Docker Compose Qdrant is required but unavailable: ${detail.trim()}`);
  }

  const client = new QdrantClient({ url: process.env.QDRANT_URL || 'http://127.0.0.1:6333', apiKey: process.env.QDRANT_API_KEY || undefined });
  const collection = `own_web_ai_test_${Date.now()}`;
  try {
    await client.createCollection(collection, {
      vectors: { dense: { size: 1024, distance: 'Cosine' } },
      sparse_vectors: { bm25: { modifier: 'idf' } },
    });
    await client.createPayloadIndex(collection, { field_name: 'post_id', field_schema: 'integer' });
    const schema = await client.getCollection(collection);
    if (schema.config?.params?.vectors?.dense?.size !== 1024) throw new Error('Qdrant dense vector schema is not 1024-dimensional');
    console.log(JSON.stringify({ ok: true, collection, dimensions: 1024 }));
  } finally {
    await client.deleteCollection(collection).catch(() => {});
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
