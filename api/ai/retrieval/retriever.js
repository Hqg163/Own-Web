const { buildRetrievalScope } = require('./scope');
const { evaluateConfidence } = require('./confidence');
const { canAccessPost } = require('../../lib/post-access');
const { createChunks } = require('./chunker');

function createRetriever({ db, config, qdrant, embeddingProvider, rerankerProvider, retrievalCache }) {
  const query = db.promise().query.bind(db.promise());

  async function indexVersion() {
    const [rows] = await query('SELECT version FROM ai_index_state WHERE id=1');
    return Number(rows[0]?.version || 0);
  }

  async function hydrate(points, user, context) {
    const ids = points.map((point) => String(point.id)).filter(Boolean);
    if (!ids.length) return [];
    const marks = ids.map(() => '?').join(',');
    const [rows] = await query(
      `SELECT c.*,p.author_id,p.status,p.visibility,p.share_token,p.title,p.slug,p.published_at,p.updated_at,p.content_markdown
       FROM ai_index_chunks c JOIN posts p ON p.id=c.post_id WHERE c.chunk_id IN (${marks})`, ids,
    );
    const pointScore = new Map(points.map((point) => [String(point.id), Number(point.score || 0)]));
    const pointPayload = new Map(points.map((point) => [String(point.id), point.payload || {}]));
    const currentChunks = new Map();
    const allowed = [];
    for (const row of rows) {
      if (!await canAccessPost(query, row, user, context.shareToken)) continue;
      const postId = Number(row.post_id);
      if (!currentChunks.has(postId)) {
        const chunks = createChunks({ id: postId, content_markdown: row.content_markdown || '' });
        currentChunks.set(postId, new Map(chunks.map((chunk) => [chunk.chunkId, chunk.contentHash])));
      }
      const currentHash = currentChunks.get(postId).get(String(row.chunk_id));
      const pointHash = pointPayload.get(String(row.chunk_id))?.content_hash;
      // An async index job may lag an article edit. Do not send an obsolete
      // chunk to the reranker or model merely because its vector still exists.
      if (!currentHash || currentHash !== row.content_hash || (pointHash && pointHash !== row.content_hash)) continue;
      allowed.push({
        chunkId: row.chunk_id, postId: Number(row.post_id), content: row.content, heading: row.heading || '',
        headingPath: row.heading_path || '', headingAnchor: row.heading_anchor || '', title: row.title, slug: row.slug,
        score: pointScore.get(String(row.chunk_id)) || 0,
      });
    }
    return allowed;
  }

  function diversify(candidates, limit = 5, currentArticleId = null) {
    const counts = new Map();
    return candidates.filter((candidate) => {
      const current = counts.get(candidate.postId) || 0;
      const allowed = currentArticleId && Number(currentArticleId) === candidate.postId ? 5 : 3;
      if (current >= allowed) return false;
      counts.set(candidate.postId, current + 1); return true;
    }).slice(0, limit);
  }

  async function retrieve(question, user, context = {}) {
    if (!qdrant.client) throw Object.assign(new Error('本站知识检索暂时不可用'), { code: 'QDRANT_UNAVAILABLE' });
    const scope = await buildRetrievalScope(query, user, context);
    const version = await indexVersion();
    const cacheKey = `${question.trim().toLowerCase()}|${scope.hash}|${version}`;
    const cached = retrievalCache?.get(cacheKey);
    if (cached) return cached;
    const [vector] = await embeddingProvider.embed([question]);
    let response;
    try {
      response = await qdrant.client.query(qdrant.collection, {
        prefetch: [
          { query: vector, using: 'dense', limit: 20, filter: scope.filter },
          { query: { text: question, model: 'Qdrant/bm25', options: qdrant.bm25 || { tokenizer: 'multilingual', stemmer: { type: 'none' }, stopwords: {} } }, using: 'bm25', limit: 20, filter: scope.filter },
        ], query: { rrf: { k: 60 } }, limit: 20, with_payload: true,
      });
    } catch (error) { throw Object.assign(new Error('本站知识检索暂时不可用'), { code: 'QDRANT_UNAVAILABLE', cause: error }); }
    const points = response?.points || response || [];
    const hydrated = await hydrate(Array.isArray(points) ? points : [], user, context);
    let reranked = hydrated;
    let degraded = false;
    try { reranked = await rerankerProvider.rerank(question, hydrated); } catch (_) { degraded = true; }
    const candidates = diversify(reranked, 5, context.articleId);
    const result = {
      scope, candidates, confidence: evaluateConfidence(candidates, config.confidence), degraded,
      citations: candidates.map((candidate, index) => ({ id: `S${index + 1}`, ...candidate, excerpt: candidate.content.slice(0, 420) })),
    };
    retrievalCache?.set(cacheKey, result);
    return result;
  }
  return { retrieve, buildRetrievalScope: (user, context) => buildRetrievalScope(query, user, context) };
}

module.exports = { createRetriever };
