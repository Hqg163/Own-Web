const { spawnSync } = require('child_process');
const path = require('path');

async function main() {
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
  const bm25 = { tokenizer: 'multilingual', stemmer: { type: 'none' }, stopwords: {} };
  try {
    await client.createCollection(collection, {
      vectors: { dense: { size: 1024, distance: 'Cosine' } },
      sparse_vectors: { bm25: { modifier: 'idf' } },
    });
    await client.createPayloadIndex(collection, { field_name: 'post_id', field_schema: 'integer' });
    const schema = await client.getCollection(collection);
    if (schema.config?.params?.vectors?.dense?.size !== 1024) throw new Error('Qdrant dense vector schema is not 1024-dimensional');
    if (schema.config?.params?.vectors?.dense?.distance !== 'Cosine') throw new Error('Qdrant dense vector schema is not Cosine');
    if (schema.config?.params?.sparse_vectors?.bm25?.modifier !== 'idf') throw new Error('Qdrant sparse vector schema is not BM25 IDF');
    const vector = new Array(1024).fill(0); vector[0] = 1;
    await client.upsert(collection, {
      wait: true,
      points: [
        { id: 'a132dc20-6aad-4e6e-8777-0bf5144aa111', vector: { dense: vector, bm25: { text: '中文 检索 YOLOv8 DeepSORT /api/v1 Kalman Filter', model: 'Qdrant/bm25', options: bm25 } }, payload: { post_id: 1 } },
        { id: 'b132dc20-6aad-4e6e-8777-0bf5144aa222', vector: { dense: vector, bm25: { text: 'unrelated document', model: 'Qdrant/bm25', options: bm25 } }, payload: { post_id: 2 } },
      ],
    });
    const expected = 'a132dc20-6aad-4e6e-8777-0bf5144aa111';
    for (const term of ['中文检索', 'YOLOv8', 'DeepSORT', '/api/v1', 'Kalman Filter']) {
      const result = await client.query(collection, {
        prefetch: [{ query: { text: term, model: 'Qdrant/bm25', options: bm25 }, using: 'bm25', limit: 5 }],
        query: { rrf: { k: 60 } }, limit: 5,
      });
      if (!(result.points || []).some((point) => String(point.id) === expected)) throw new Error(`Qdrant BM25 did not return the expected point for ${term}`);
    }
    const rrf = await client.query(collection, {
      prefetch: [
        { query: vector, using: 'dense', limit: 5 },
        { query: { text: 'YOLOv8', model: 'Qdrant/bm25', options: bm25 }, using: 'bm25', limit: 5 },
      ],
      query: { rrf: { k: 60 } }, limit: 5,
    });
    if (!(rrf.points || []).some((point) => String(point.id) === expected)) throw new Error('Qdrant RRF did not return the expected point');
    await client.delete(collection, { wait: true, filter: { must: [{ key: 'post_id', match: { value: 1 } }] } });
    const remaining = await client.count(collection, { exact: true, filter: { must: [{ key: 'post_id', match: { value: 1 } }] } });
    if (Number(remaining.count || 0) !== 0) throw new Error('Qdrant payload-filter deletion did not remove the expected point');
    console.log(JSON.stringify({ ok: true, dimensions: 1024, bm25Queries: 5, rrf: true, filteredDelete: true }));
  } finally {
    await client.deleteCollection(collection).catch(() => {});
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
