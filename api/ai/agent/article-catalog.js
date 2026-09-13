const { canAccessPost } = require('../../lib/post-access');

const MAX_CATALOG_SCAN = 5000;
const MAX_ARTICLE_OVERVIEW_CHARS = 360;
const SORTS = Object.freeze({
  published_desc: 'p.published_at DESC,p.id DESC',
  published_asc: 'p.published_at ASC,p.id ASC',
  updated_desc: 'p.updated_at DESC,p.id DESC',
  title_asc: 'p.title ASC,p.id ASC',
});
const TASK_TERMS = new Set(['本站', '站内', '文章', '博客', '内容', '帮我', '请', '一下', '所有', '全部', '列出', '推荐', '哪些', '多少', '有几', '有没有', '最新', '最近', '关于', '相关', 'article', 'articles', 'site', 'blog', 'please', 'recommend', 'list', 'find', 'show']);

function normalizeSearchQuery(value) {
  const text = String(value || '').toLocaleLowerCase().replace(/[，。！？、,.!?;:：()（）“”"'`]/g, ' ');
  const terms = new Set();
  for (const word of text.match(/[a-z0-9_./:-]{2,}/g) || []) if (!TASK_TERMS.has(word)) terms.add(word);
  const cjkText = text.replace(/帮我|请问|找几篇|找一下|哪些|什么|文章|内容|本站|站内|博客|相关的|相关|推荐|一下|所有|全部|有几|多少|和/g, ' ');
  for (const run of cjkText.match(/[\u3400-\u9fff\uf900-\ufaff]{2,}/g) || []) {
    if (!TASK_TERMS.has(run)) terms.add(run);
    for (let index = 0; index < run.length - 1; index += 1) {
      const term = run.slice(index, index + 2);
      if (!TASK_TERMS.has(term)) terms.add(term);
    }
  }
  return [...terms].slice(0, 12);
}

function includesTerm(value, term) { return String(value || '').toLocaleLowerCase().includes(term); }
function articleSearchScore(article, terms) {
  let score = 0;
  for (const term of terms) {
    if (includesTerm(article.title, term)) score += 8;
    if (includesTerm(article.excerpt, term)) score += 4;
    if ((article.categories || []).some((item) => includesTerm(`${item.name} ${item.slug}`, term))) score += 6;
    if ((article.tags || []).some((item) => includesTerm(`${item.name} ${item.slug}`, term))) score += 6;
    if (article.series && includesTerm(`${article.series.name} ${article.series.slug}`, term)) score += 5;
    if (includesTerm(String(article.contentMarkdown || '').slice(0, 6000), term)) score += 1;
  }
  return score;
}

function presentArticle(row, metadata) {
  const categories = metadata.categories.get(Number(row.id)) || [];
  const tags = metadata.tags.get(Number(row.id)) || [];
  const series = row.series_id ? { id: Number(row.series_id), name: row.series_name || '', slug: row.series_slug || '' } : null;
  const overview = String(row.excerpt || row.content_markdown || '').replace(/\s+/g, ' ').trim().slice(0, MAX_ARTICLE_OVERVIEW_CHARS);
  return {
    id: Number(row.id), title: String(row.title || ''), slug: String(row.slug || ''),
    excerpt: String(row.excerpt || row.content_markdown || '').slice(0, 600),
    // This is deliberately bounded and is the only article-body-derived
    // field catalog consumers should receive.  Full Markdown remains local
    // to authorization-aware ranking, never a catalog prompt payload.
    overview,
    publishedAt: row.published_at || null, updatedAt: row.updated_at || null,
    categories, tags, series, contentMarkdown: String(row.content_markdown || ''),
  };
}

function catalogEvidenceLine(article, index) {
  const details = [
    article.categories?.length ? `分类：${article.categories.map((item) => item.name || item.slug).filter(Boolean).join('、')}` : '',
    article.tags?.length ? `标签：${article.tags.map((item) => item.name || item.slug).filter(Boolean).join('、')}` : '',
    article.series?.name ? `系列：${article.series.name}` : '',
    article.publishedAt ? `发布：${String(article.publishedAt)}` : '',
    article.updatedAt ? `更新：${String(article.updatedAt)}` : '',
    article.overview ? `概览：${article.overview}` : '',
  ].filter(Boolean);
  return `[C${index + 1}] ${article.title}\nslug: ${article.slug}${details.length ? `\n${details.join('\n')}` : ''}`;
}

function formatCatalogEvidence(items, maximum = 12000) {
  const cap = Math.max(0, Number(maximum) || 0);
  const lines = [];
  let size = 0;
  for (const [index, article] of (items || []).entries()) {
    const line = catalogEvidenceLine(article, index);
    // Keep every entry atomic: slicing a prompt in the middle of an article
    // silently drops metadata and makes a directory look complete when it is
    // not.  The workflow reports the supplied/total count instead.
    if (lines.length && size + line.length + 2 > cap) break;
    if (!lines.length && line.length > cap) { lines.push(line.slice(0, cap)); size = cap; }
    else { lines.push(line); size += line.length + 2; }
  }
  return { content: lines.join('\n\n'), included: lines.length, truncated: lines.length < (items || []).length };
}

function createArticleCatalog({ db }) {
  const query = db.promise().query.bind(db.promise());

  async function loadMetadata(postIds) {
    const categories = new Map(); const tags = new Map();
    if (!postIds.length) return { categories, tags };
    const marks = postIds.map(() => '?').join(',');
    const [categoryRows] = await query(
      `SELECT pc.post_id,c.name,c.slug FROM post_categories pc JOIN categories c ON c.id=pc.category_id WHERE pc.post_id IN (${marks})`, postIds,
    );
    const [tagRows] = await query(
      `SELECT pt.post_id,t.name,t.slug FROM post_tags pt JOIN tags t ON t.id=pt.tag_id WHERE pt.post_id IN (${marks})`, postIds,
    );
    for (const row of categoryRows) {
      const id = Number(row.post_id); categories.set(id, [...(categories.get(id) || []), { name: row.name, slug: row.slug }]);
    }
    for (const row of tagRows) {
      const id = Number(row.post_id); tags.set(id, [...(tags.get(id) || []), { name: row.name, slug: row.slug }]);
    }
    return { categories, tags };
  }

  async function candidates({ category = null, tag = null, seriesId = null, sort = 'published_desc' } = {}) {
    const clauses = []; const params = [];
    if (category) {
      clauses.push('EXISTS (SELECT 1 FROM post_categories pc JOIN categories c ON c.id=pc.category_id WHERE pc.post_id=p.id AND c.slug=?)');
      params.push(String(category).slice(0, 120));
    }
    if (tag) {
      clauses.push('EXISTS (SELECT 1 FROM post_tags pt JOIN tags t ON t.id=pt.tag_id WHERE pt.post_id=p.id AND t.slug=?)');
      params.push(String(tag).slice(0, 120));
    }
    if (seriesId) { clauses.push('p.series_id=?'); params.push(Number(seriesId)); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const order = SORTS[sort] || SORTS.published_desc;
    const [rows] = await query(
      `SELECT p.*,s.name AS series_name,s.slug AS series_slug FROM posts p LEFT JOIN series s ON s.id=p.series_id ${where} ORDER BY ${order} LIMIT ${MAX_CATALOG_SCAN}`,
      params,
    );
    return rows;
  }

  async function authorizedRows(options = {}, context = {}) {
    const rows = await candidates(options);
    const allowed = [];
    for (const row of rows) if (await canAccessPost(query, row, context.user || null, context.shareToken || null)) allowed.push(row);
    const metadata = await loadMetadata(allowed.map((row) => Number(row.id)));
    return allowed.map((row) => presentArticle(row, metadata));
  }

  async function list(options = {}, context = {}) {
    const limit = Math.max(1, Math.min(50, Number(options.limit || 20)));
    const offset = Math.max(0, Number(options.offset || 0));
    const articles = await authorizedRows(options, context);
    return { items: articles.slice(offset, offset + limit).map(({ contentMarkdown, ...article }) => article), total: articles.length, offset, limit, hasMore: offset + limit < articles.length };
  }

  async function search(options = {}, context = {}) {
    const terms = normalizeSearchQuery(options.query);
    if (!terms.length) return { items: [], total: 0, terms: [] };
    const articles = await authorizedRows({ sort: 'updated_desc' }, context);
    const ranked = articles.map((article) => ({ article, score: articleSearchScore(article, terms) }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score || String(right.article.updatedAt || '').localeCompare(String(left.article.updatedAt || '')) || left.article.id - right.article.id);
    const limit = Math.max(1, Math.min(20, Number(options.limit || 5)));
    return { items: ranked.slice(0, limit).map(({ article, score }) => {
      const { contentMarkdown, ...item } = article; return { ...item, score };
    }), total: ranked.length, terms };
  }

  return { list, search, normalizeSearchQuery };
}

module.exports = { createArticleCatalog, normalizeSearchQuery, articleSearchScore, formatCatalogEvidence, catalogEvidenceLine, SORTS };
