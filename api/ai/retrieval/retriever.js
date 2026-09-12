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

  async function selectionNeighbors(user, context) {
    if (!context.articleId || !context.selectedText) return [];
    const [rows] = await query(
      `SELECT c.*,p.author_id,p.status,p.visibility,p.share_token,p.title,p.slug,p.published_at,p.updated_at,p.content_markdown
       FROM ai_index_chunks c JOIN posts p ON p.id=c.post_id WHERE c.post_id=? ORDER BY c.chunk_index ASC`,
      [Number(context.articleId)],
    );
    if (!rows.length || !await canAccessPost(query, rows[0], user, context.shareToken)) return [];
    const current = new Map(createChunks({ id: Number(context.articleId), content_markdown: rows[0].content_markdown || '' }).map((chunk) => [chunk.chunkId, chunk.contentHash]));
    const valid = rows.filter((row) => current.get(String(row.chunk_id)) === row.content_hash);
    const needle = String(context.selectedText).trim().slice(0, 160);
    const bySelectedText = valid.findIndex((row) => needle && String(row.content || '').includes(needle));
    const center = valid.findIndex((row) => String(row.heading_anchor || '') === String(context.anchor || ''));
    const byHeading = center >= 0 ? center : valid.findIndex((row) => context.heading && String(row.heading || '') === String(context.heading));
    const selectedIndex = bySelectedText >= 0 ? bySelectedText : byHeading;
    if (selectedIndex < 0) return [];
    const wanted = new Set([selectedIndex - 1, selectedIndex, selectedIndex + 1]);
    return valid.filter((_row, index) => wanted.has(index)).map((row) => ({
      chunkId: row.chunk_id, postId: Number(row.post_id), content: row.content, heading: row.heading || '',
      headingPath: row.heading_path || '', headingAnchor: row.heading_anchor || '', title: row.title, slug: row.slug,
      score: 1, rerankScore: 1, selectionEvidence: true,
    }));
  }

  function prioritize(candidates, context) {
    const currentArticleId = Number(context.articleId || 0);
    return [...candidates].sort((left, right) => {
      const selectionOrder = Number(Boolean(right.selectionEvidence)) - Number(Boolean(left.selectionEvidence));
      if (selectionOrder) return selectionOrder;
      const currentOrder = Number(Number(right.postId) === currentArticleId) - Number(Number(left.postId) === currentArticleId);
      if (currentOrder) return currentOrder;
      return Number(right.rerankScore ?? right.score ?? 0) - Number(left.rerankScore ?? left.score ?? 0);
    });
  }

  function diversify(candidates, limit = 5) {
    const counts = new Map();
    return candidates.filter((candidate) => {
      const current = counts.get(candidate.postId) || 0;
      if (current >= 3) return false;
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
    const byId = new Map(reranked.map((candidate) => [String(candidate.chunkId), candidate]));
    for (const neighbor of await selectionNeighbors(user, context)) {
      const existing = byId.get(String(neighbor.chunkId));
      if (existing) Object.assign(existing, { selectionEvidence: true, rerankScore: Math.max(Number(existing.rerankScore ?? existing.score ?? 0), 1) });
      else byId.set(String(neighbor.chunkId), neighbor);
    }
    const candidates = diversify(prioritize([...byId.values()], context), 5);
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
