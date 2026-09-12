const { z } = require('zod');
const { canAccessPost } = require('../../lib/post-access');
const { createArticleCatalog } = require('./article-catalog');

const maxText = (value, maximum) => String(value || '').slice(0, maximum);
function withTimeout(promise, timeoutMs = 2500) {
  let timer = null;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error('工具超时'), { code: 'TOOL_TIMEOUT' })), timeoutMs); }),
  ]).finally(() => clearTimeout(timer));
}

const tool = (name, description, parameters) => ({ type: 'function', function: { name, description, parameters } });

function createSkillRegistry({ db, config, articleDiscovery = null }) {
  const query = db.promise().query.bind(db.promise());
  const maxResultChars = config.limits.toolResultChars;
  const catalog = createArticleCatalog({ db });

  async function permittedPosts(rows, user, shareToken) {
    const allowed = [];
    for (const row of rows) if (await canAccessPost(query, row, user, shareToken)) allowed.push(row);
    return allowed;
  }

  const definitions = {
    search_articles: {
      schema: z.object({ query: z.string().min(1).max(300), limit: z.number().int().min(1).max(20).default(5) }).strict(),
      tool: tool('search_articles', '按标题、摘要、标签、分类、专栏和正文关键词搜索当前用户有权读取的站内文章。', { type: 'object', additionalProperties: false, properties: { query: { type: 'string', minLength: 1, maxLength: 300 }, limit: { type: 'integer', minimum: 1, maximum: 20 } }, required: ['query'] }),
      async run(input, context) {
        return catalog.search(input, context);
      },
    },
    list_articles: {
      schema: z.object({
        limit: z.number().int().min(1).max(50).default(20), offset: z.number().int().min(0).max(5000).default(0),
        sort: z.enum(['published_desc', 'published_asc', 'updated_desc', 'title_asc']).default('published_desc'),
        category: z.string().max(120).nullable().default(null), tag: z.string().max(120).nullable().default(null), seriesId: z.number().int().positive().nullable().default(null),
      }).strict(),
      tool: tool('list_articles', '列出当前用户有权访问的站内文章目录；用于“有哪些、全部、数量、最近发布”等完整目录问题。', { type: 'object', additionalProperties: false, properties: { limit: { type: 'integer', minimum: 1, maximum: 50 }, offset: { type: 'integer', minimum: 0, maximum: 5000 }, sort: { type: 'string', enum: ['published_desc', 'published_asc', 'updated_desc', 'title_asc'] }, category: { type: ['string', 'null'], maxLength: 120 }, tag: { type: ['string', 'null'], maxLength: 120 }, seriesId: { type: ['integer', 'null'], minimum: 1 } } }),
      async run(input, context) { return catalog.list(input, context); },
    },
    get_article: {
      schema: z.object({ postId: z.number().int().positive().optional() }).strict(),
      tool: tool('get_article', '读取当前用户有权访问的一篇文章。省略 postId 时仅可读取当前文章。', { type: 'object', additionalProperties: false, properties: { postId: { type: 'integer', minimum: 1 } } }),
      async run(input, context) {
        const id = input.postId || context.article?.id;
        if (!id) throw Object.assign(new Error('未指定文章'), { code: 'ARTICLE_REQUIRED' });
        const [rows] = await query('SELECT * FROM posts WHERE id=?', [id]);
        const post = rows[0];
        if (!post || !await canAccessPost(query, post, context.user, context.shareToken)) throw Object.assign(new Error('无权读取文章'), { code: 'FORBIDDEN' });
        return { id: Number(post.id), title: post.title, slug: post.slug, content: maxText(post.content_markdown, maxResultChars), truncated: String(post.content_markdown).length > maxResultChars };
      },
    },
    get_related_articles: {
      schema: z.object({ postId: z.number().int().positive().optional(), limit: z.number().int().min(1).max(5).default(5) }).strict(),
      tool: tool('get_related_articles', '查找一篇获准文章的相关站内文章。省略 postId 时仅可使用当前文章。', { type: 'object', additionalProperties: false, properties: { postId: { type: 'integer', minimum: 1 }, limit: { type: 'integer', minimum: 1, maximum: 5 } } }),
      async run(input, context) {
        const id = input.postId || context.article?.id;
        if (!id) throw Object.assign(new Error('未指定文章'), { code: 'ARTICLE_REQUIRED' });
        const [baseRows] = await query('SELECT * FROM posts WHERE id=?', [id]);
        const base = baseRows[0];
        if (!base || !await canAccessPost(query, base, context.user, context.shareToken)) throw Object.assign(new Error('无权读取文章'), { code: 'FORBIDDEN' });
        if (articleDiscovery) {
          const result = await articleDiscovery.related(base, context, input.limit);
          return result.items.map((post) => ({ id: Number(post.articleId), title: post.title, slug: post.slug, excerpt: maxText(post.excerpt, 500) }));
        }
        // The no-Qdrant fallback remains server-authorized and deterministic;
        // it deliberately searches the catalog rather than performing a raw
        // title LIKE query that would make "related" depend on a title match.
        const result = await catalog.search({ query: String(base.title || '').slice(0, 300), limit: input.limit + 1 }, context);
        return result.items.filter((post) => Number(post.id) !== Number(base.id)).slice(0, input.limit);
      },
    },
    search_projects: {
      schema: z.object({ query: z.string().min(1).max(300), limit: z.number().int().min(1).max(5).default(5) }).strict(),
      tool: tool('search_projects', '搜索当前用户有权查看的项目。', { type: 'object', additionalProperties: false, properties: { query: { type: 'string', minLength: 1, maxLength: 300 }, limit: { type: 'integer', minimum: 1, maximum: 5 } }, required: ['query'] }),
      async run(input, context) {
        const term = `%${input.query.trim().slice(0, 300)}%`;
        const ownerCondition = context.user?.id ? '(p.owner_id=? OR u.profile_visibility=\'public\')' : "u.profile_visibility='public'";
        const params = context.user?.id ? [context.user.id, term, term, input.limit] : [term, term, input.limit];
        const [rows] = await query(`SELECT p.* FROM projects p JOIN users u ON u.id=p.owner_id WHERE ${ownerCondition} AND (p.title LIKE ? OR p.summary LIKE ?) ORDER BY p.featured DESC,p.sort_order ASC,p.id ASC LIMIT ?`, params);
        return rows.map((project) => ({ id: Number(project.id), title: project.title, slug: project.slug, summary: maxText(project.summary, 500), role: project.role || '' }));
      },
    },
    get_series: {
      schema: z.object({ seriesId: z.number().int().positive().optional(), slug: z.string().max(180).optional() }).strict().refine((value) => value.seriesId || value.slug, '需要系列标识'),
      tool: tool('get_series', '读取当前用户有权查看的专栏及其文章。', { type: 'object', additionalProperties: false, properties: { seriesId: { type: 'integer', minimum: 1 }, slug: { type: 'string', maxLength: 180 } } }),
      async run(input, context) {
        const [seriesRows] = input.seriesId
          ? await query('SELECT * FROM series WHERE id=?', [input.seriesId])
          : await query('SELECT * FROM series WHERE slug=?', [input.slug]);
        const series = seriesRows[0];
        if (!series) throw Object.assign(new Error('专栏不存在'), { code: 'NOT_FOUND' });
        if (!context.user?.id || Number(series.owner_id) !== Number(context.user.id)) {
          const [ownerRows] = await query('SELECT profile_visibility,deleted_at FROM users WHERE id=?', [series.owner_id]);
          if (!ownerRows[0] || ownerRows[0].profile_visibility !== 'public' || ownerRows[0].deleted_at) throw Object.assign(new Error('无权读取专栏'), { code: 'FORBIDDEN' });
        }
        const [posts] = await query('SELECT * FROM posts WHERE series_id=? ORDER BY series_order ASC,published_at ASC,id ASC', [series.id]);
        const articles = (await permittedPosts(posts, context.user, context.shareToken)).slice(0, 20).map((post) => ({ id: Number(post.id), title: post.title, slug: post.slug, excerpt: maxText(post.excerpt, 500) }));
        return { id: Number(series.id), name: series.name, slug: series.slug, description: maxText(series.description, 1000), articles };
      },
    },
  };

  async function invoke(name, rawInput, context) {
    const definition = definitions[name];
    if (!definition) throw Object.assign(new Error('不支持的工具'), { code: 'TOOL_NOT_ALLOWED' });
    const input = definition.schema.parse(rawInput || {});
    const result = await withTimeout(definition.run(input, context), config.limits.toolTimeoutMs || 2500);
    const serialized = JSON.stringify(result);
    return serialized.length > maxResultChars ? { truncated: true, preview: serialized.slice(0, maxResultChars) } : result;
  }

  return { definitions, tools: () => Object.values(definitions).map((definition) => definition.tool), invoke };
}

module.exports = { createSkillRegistry, withTimeout };
