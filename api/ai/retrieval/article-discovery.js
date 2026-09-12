const { buildRetrievalScope } = require('./scope');
const { canAccessPost } = require('../../lib/post-access');
const { createArticleDocument } = require('./article-document');

function mergePoints(responses) {
  const byId = new Map();
  for (const response of responses) for (const point of response?.points || response || []) {
    const key = String(point.id);
    if (!byId.has(key) || Number(point.score || 0) > Number(byId.get(key).score || 0)) byId.set(key, point);
  }
  return [...byId.values()];
}

function createArticleDiscovery({ db, config, qdrant, embeddingProvider, rerankerProvider, retrievalCache = null }) {
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
      `SELECT a.point_id,a.content_hash,a.discovery_content,p.* FROM ai_article_index a
       JOIN posts p ON p.id=a.post_id WHERE a.point_id IN (${marks})`, ids,
    );
    const postIds = rows.map((row) => Number(row.id));
    const byPost = new Map(rows.map((row) => [Number(row.id), { ...row, categories: [], tags: [] }]));
    if (postIds.length) {
      const postMarks = postIds.map(() => '?').join(',');
      const [categories] = await query(`SELECT pc.post_id,c.name,c.slug FROM post_categories pc JOIN categories c ON c.id=pc.category_id WHERE pc.post_id IN (${postMarks})`, postIds);
      const [tags] = await query(`SELECT pt.post_id,t.name,t.slug FROM post_tags pt JOIN tags t ON t.id=pt.tag_id WHERE pt.post_id IN (${postMarks})`, postIds);
      for (const row of categories) byPost.get(Number(row.post_id))?.categories.push(row);
      for (const row of tags) byPost.get(Number(row.post_id))?.tags.push(row);
    }
    const scores = new Map(points.map((point) => [String(point.id), Number(point.score || 0)]));
    const allowed = [];
    for (const record of byPost.values()) {
      if (!await canAccessPost(query, record, user, context.shareToken)) continue;
      const current = createArticleDocument(record);
      if (current.contentHash !== record.content_hash) continue;
      allowed.push({
        articleId: Number(record.id), pointId: record.point_id, title: record.title, slug: record.slug,
        excerpt: String(record.excerpt || record.content_markdown || '').slice(0, 700),
        content: record.discovery_content, score: scores.get(String(record.point_id)) || 0,
        category: record.categories.map((item) => item.slug), tags: record.tags.map((item) => item.slug),
        publishedAt: record.published_at || null, updatedAt: record.updated_at || null,
      });
    }
    return allowed;
  }

  async function discover(question, user, context = {}, { limit = 5, excludePostId = null } = {}) {
    if (!qdrant.client) throw Object.assign(new Error('文章发现暂时不可用'), { code: 'QDRANT_UNAVAILABLE' });
    const scope = await buildRetrievalScope(query, user, { ...context, sourceTypes: ['article'] });
    const version = await indexVersion();
    const cacheKey = `article:${String(question).trim().toLowerCase()}|${scope.hash}|${version}|${excludePostId || ''}`;
    const cached = retrievalCache?.get(cacheKey);
    if (cached) return cached;
    const [vector] = await embeddingProvider.embed([question]);
    let responses;
    try {
      responses = await Promise.all(scope.filters.map((filter) => qdrant.client.query(qdrant.collection, {
        prefetch: [
          { query: vector, using: 'dense', limit: 20, filter },
          { query: { text: question, model: 'Qdrant/bm25', options: qdrant.bm25 || { tokenizer: 'multilingual', stemmer: { type: 'none' }, stopwords: {} } }, using: 'bm25', limit: 20, filter },
        ], query: { rrf: { k: 60 } }, limit: 20, with_payload: true,
      })));
    } catch (error) { throw Object.assign(new Error('文章发现暂时不可用'), { code: 'QDRANT_UNAVAILABLE', cause: error }); }
    const hydrated = (await hydrate(mergePoints(responses), user, context)).filter((item) => Number(item.articleId) !== Number(excludePostId || 0));
    let ranked = hydrated;
    let degraded = false;
    try { ranked = await rerankerProvider.rerank(question, hydrated); } catch (_) { degraded = true; }
    const items = ranked.sort((left, right) => Number(right.rerankScore ?? right.score ?? 0) - Number(left.rerankScore ?? left.score ?? 0)).slice(0, Math.min(10, Math.max(1, limit)));
    const result = { scope, items, degraded, citations: items.map((item, index) => ({ id: `D${index + 1}`, ...item })) };
    retrievalCache?.set(cacheKey, result);
    return result;
  }

  async function related(post, context, limit = 5) {
    const queryText = [post.title, post.excerpt, post.content_markdown].filter(Boolean).join('\n').slice(0, 2400);
    return discover(queryText || post.title, context.user, context, { limit, excludePostId: post.id });
  }

  return { discover, related };
}

module.exports = { createArticleDiscovery, mergePoints };
