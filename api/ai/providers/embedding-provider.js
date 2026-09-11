const crypto = require('crypto');

function deterministicEmbedding(text, dimensions) {
  const vector = new Array(dimensions).fill(0);
  for (const token of String(text || '').toLowerCase().match(/[\p{L}\p{N}_./:-]+/gu) || []) {
    const digest = crypto.createHash('sha256').update(token).digest();
    const index = digest.readUInt32BE(0) % dimensions;
    vector[index] += digest[4] % 2 ? 1 : -1;
  }
  const norm = Math.hypot(...vector) || 1;
  return vector.map((value) => value / norm);
}

function createEmbeddingProvider(config) {
  async function embed(texts) {
    const input = Array.isArray(texts) ? texts : [texts];
    if (config.providerMode === 'mock') return input.map((text) => deterministicEmbedding(text, config.embedding.dimensions));
    if (!config.qwen.apiKey || !config.qwen.baseUrl) throw Object.assign(new Error('Embedding Provider 未配置'), { code: 'EMBEDDING_UNAVAILABLE' });
    const response = await fetch(`${config.qwen.baseUrl.replace(/\/$/, '')}/embeddings`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${config.qwen.apiKey}` },
      body: JSON.stringify({ model: config.embedding.model, input }),
    });
    if (!response.ok) throw Object.assign(new Error('Embedding Provider 不可用'), { code: 'EMBEDDING_UNAVAILABLE' });
    const payload = await response.json();
    const vectors = (payload.data || []).sort((left, right) => left.index - right.index).map((item) => item.embedding);
    if (vectors.length !== input.length || vectors.some((vector) => !Array.isArray(vector) || vector.length !== config.embedding.dimensions)) throw Object.assign(new Error('Embedding 维度无效'), { code: 'EMBEDDING_INVALID' });
    return vectors;
  }
  return { embed };
}

module.exports = { createEmbeddingProvider, deterministicEmbedding };
