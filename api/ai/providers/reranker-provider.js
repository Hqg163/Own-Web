function lexicalScore(query, text) {
  const terms = new Set((String(query).toLowerCase().match(/[\p{L}\p{N}_./:-]+/gu) || []));
  if (!terms.size) return 0;
  const candidate = String(text).toLowerCase();
  return [...terms].filter((term) => candidate.includes(term)).length / terms.size;
}

function createRerankerProvider(config) {
  async function rerank(query, candidates) {
    if (!config.rerank.enabled) return candidates.map((candidate, index) => ({ ...candidate, rerankScore: Number(candidate.score || 0), rank: index + 1 }));
    if (config.providerMode === 'mock') return candidates
      .map((candidate) => ({ ...candidate, rerankScore: lexicalScore(query, candidate.content) + Number(candidate.score || 0) * 0.01 }))
      .sort((left, right) => right.rerankScore - left.rerankScore)
      .map((candidate, index) => ({ ...candidate, rank: index + 1 }));
    const baseUrl = config.qwen.rerankBaseUrl || config.qwen.baseUrl;
    if (!config.qwen.apiKey || !baseUrl) throw Object.assign(new Error('Reranker Provider 未配置'), { code: 'RERANK_UNAVAILABLE' });
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/reranks`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${config.qwen.apiKey}` },
      body: JSON.stringify({ model: config.rerank.model, query, documents: candidates.map((candidate) => candidate.content), top_n: candidates.length }),
    });
    if (!response.ok) throw Object.assign(new Error('Reranker Provider 不可用'), { code: 'RERANK_UNAVAILABLE' });
    const payload = await response.json();
    return (payload.results || []).map((result, rank) => ({ ...candidates[result.index], rerankScore: Number(result.relevance_score || 0), rank: rank + 1 })).filter(Boolean);
  }
  return { rerank };
}

module.exports = { createRerankerProvider };
