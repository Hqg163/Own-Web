const { QdrantClient } = require('@qdrant/js-client-rest');

function createQdrantStore(config) {
  const client = config.qdrant.url ? new QdrantClient({ url: config.qdrant.url, apiKey: config.qdrant.apiKey || undefined }) : null;
  const collection = config.qdrant.collection;

  async function ensureCollection() {
    if (!client) throw Object.assign(new Error('Qdrant 未配置'), { code: 'QDRANT_UNAVAILABLE' });
    try { await client.getCollection(collection); } catch (_) {
      await client.createCollection(collection, {
        vectors: { dense: { size: config.embedding.dimensions, distance: 'Cosine' } },
        sparse_vectors: { bm25: { modifier: 'idf' } },
      });
    }
    const indexes = [
      ['post_id', 'integer'], ['author_id', 'integer'], ['status', 'keyword'], ['visibility', 'keyword'],
      ['series_id', 'integer'], ['published_at', 'datetime'], ['updated_at', 'datetime'],
    ];
    for (const [field, schema] of indexes) {
      try { await client.createPayloadIndex(collection, { field_name: field, field_schema: schema }); } catch (_) { /* idempotent across Qdrant minor versions */ }
    }
    return { collection, dimensions: config.embedding.dimensions };
  }

  async function health() {
    if (!client) return { configured: false, ready: false };
    try { await client.getCollections(); return { configured: true, ready: true }; } catch (_) { return { configured: true, ready: false }; }
  }

  return { client, collection, ensureCollection, health };
}

module.exports = { createQdrantStore };
