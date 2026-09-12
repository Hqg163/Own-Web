const { buildRetrievalScope } = require('./scope');
const { evaluateConfidence, evaluateRrfConfidence } = require('./confidence');
const { canAccessPost } = require('../../lib/post-access');
const { createChunks } = require('./chunker');
const { createRetrievalQueries } = require('./query-rewriter');

function rerankScore(candidate) {
  return Number(candidate?.rerankScore ?? candidate?.score ?? 0);
}

function selectSupportedCandidates(candidates, confidence = {}) {
  const topScore = rerankScore(candidates[0]);
  const minimum = Number(confidence.minEvidenceScore ?? 0.4);
  const floor = Math.max(minimum, topScore * 0.5);
  return candidates.filter((candidate) => candidate.selectionEvidence || rerankScore(candidate) >= floor);
}

const GENERIC_TERMS = new Set(['本站', '文章', '问题', '关于', '相关', '内容', '什么', '为何', '为什么', '如何', '怎么', '有没', '没有', '给出', '哪些', '多少', '是否', '这个', '那个', '其中', '一下', '请问', '解释', '说明', '推荐', 'which', 'what', 'when', 'where', 'why', 'how', 'the', 'and', 'for', 'with', 'from', 'post', 'article', 'site']);

function meaningfulTerms(value) {
  const terms = new Set();
  const text = String(value || '').toLocaleLowerCase();
  for (const word of text.match(/[a-z0-9_./:-]{2,}/g) || []) if (!GENERIC_TERMS.has(word)) terms.add(word);
  for (const run of text.match(/[\u3400-\u9fff\uf900-\ufaff]+/g) || []) {
    for (let index = 0; index < run.length - 1; index += 1) {
      const term = run.slice(index, index + 2);
      if (!GENERIC_TERMS.has(term)) terms.add(term);
    }
  }
  return terms;
}

function hasLexicalSupport(question, candidates, minimum = 1) {
  const questionTerms = meaningfulTerms(question);
  if (!questionTerms.size) return true;
  const evidenceTerms = new Set();
  for (const candidate of candidates) {
    for (const term of meaningfulTerms(`${candidate.title || ''}\n${candidate.heading || ''}\n${candidate.content || ''}`)) evidenceTerms.add(term);
  }
  let matches = 0;
  for (const term of questionTerms) if (evidenceTerms.has(term) && ++matches >= Math.max(1, Number(minimum) || 1)) return true;
  return false;
}

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
    const retrievalQueries = createRetrievalQueries(question, context);
    const cacheKey = `${retrievalQueries.join('\u0000').toLowerCase()}|${scope.hash}|${version}`;
    const cached = retrievalCache?.get(cacheKey);
    if (cached) return cached;
    const vectors = await embeddingProvider.embed(retrievalQueries);
    let responses;
    try {
      responses = await Promise.all(retrievalQueries.flatMap((retrievalQuery, queryIndex) => (scope.filters || [scope.filter]).map((filter) => qdrant.client.query(qdrant.collection, {
        prefetch: [
          { query: vectors[queryIndex], using: 'dense', limit: 20, filter },
          { query: { text: retrievalQuery, model: 'Qdrant/bm25', options: qdrant.bm25 || { tokenizer: 'multilingual', stemmer: { type: 'none' }, stopwords: {} } }, using: 'bm25', limit: 20, filter },
        ], query: { rrf: { k: 60 } }, limit: 20, with_payload: true,
      }))));
    } catch (error) { throw Object.assign(new Error('本站知识检索暂时不可用'), { code: 'QDRANT_UNAVAILABLE', cause: error }); }
    const pointsById = new Map();
    for (const response of responses) {
      for (const point of response?.points || response || []) {
        const existing = pointsById.get(String(point.id));
        if (!existing || Number(point.score || 0) > Number(existing.score || 0)) pointsById.set(String(point.id), point);
      }
    }
    const hydrated = await hydrate([...pointsById.values()], user, context);
    let reranked = hydrated;
    let degraded = false;
    try { reranked = await rerankerProvider.rerank(question, hydrated); } catch (_) { degraded = true; }
    const byId = new Map(reranked.map((candidate) => [String(candidate.chunkId), candidate]));
    for (const neighbor of await selectionNeighbors(user, context)) {
      const existing = byId.get(String(neighbor.chunkId));
      if (existing) Object.assign(existing, { selectionEvidence: true, rerankScore: Math.max(Number(existing.rerankScore ?? existing.score ?? 0), 1) });
      else byId.set(String(neighbor.chunkId), neighbor);
    }
    const candidates = diversify(selectSupportedCandidates(prioritize([...byId.values()], context), config.confidence), 5);
    const lexicalSupport = Boolean(context.articleId || context.selectedText) || hasLexicalSupport(question, candidates, config.confidence?.minLexicalTerms);
    const evaluated = degraded ? evaluateRrfConfidence(candidates) : evaluateConfidence(candidates, config.confidence);
    const confidence = lexicalSupport
      ? { ...evaluated, kind: degraded ? 'rrf' : 'rerank' }
      : { ...evaluated, level: 'LOW', reason: 'no_lexical_support', lexicalSupport: false, kind: degraded ? 'rrf' : 'rerank' };
    const evidence = lexicalSupport ? candidates : [];
    const result = {
      scope, queries: retrievalQueries, candidates: evidence, confidence, degraded,
      citations: evidence.map((candidate, index) => ({ id: `S${index + 1}`, ...candidate, excerpt: candidate.content.slice(0, 420) })),
    };
    retrievalCache?.set(cacheKey, result);
    return result;
  }
  return { retrieve, buildRetrievalScope: (user, context) => buildRetrievalScope(query, user, context) };
}

module.exports = { createRetriever, selectSupportedCandidates, hasLexicalSupport };
