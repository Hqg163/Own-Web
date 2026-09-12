const { QdrantClient } = require('@qdrant/js-client-rest');

function createQdrantStore(config) {
  const client = config.qdrant.url ? new QdrantClient({ url: config.qdrant.url, apiKey: config.qdrant.apiKey || undefined }) : null;
  const collection = config.qdrant.collection;
  const bm25 = { tokenizer: 'multilingual', stemmer: { type: 'none' }, stopwords: {} };
  const isCollectionMissing = (error) => Number(error?.status || error?.response?.status || error?.data?.status?.error?.code) === 404;

  async function ensureCollection() {
    if (!client) throw Object.assign(new Error('Qdrant 未配置'), { code: 'QDRANT_UNAVAILABLE' });
    try { await client.getCollection(collection); } catch (error) {
      if (!isCollectionMissing(error)) throw Object.assign(new Error('Qdrant 连接或认证失败'), { code: 'QDRANT_UNAVAILABLE', cause: error });
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
    return { collection, dimensions: config.embedding.dimensions, bm25 };
  }

  async function health() {
    if (!client) return { configured: false, ready: false };
    try { await client.getCollections(); return { configured: true, ready: true }; } catch (_) { return { configured: true, ready: false }; }
  }

  return { client, collection, bm25, ensureCollection, health };
}

module.exports = { createQdrantStore };
