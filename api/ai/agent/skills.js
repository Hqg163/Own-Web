const { z } = require('zod');
const { canAccessPost } = require('../../lib/post-access');

const maxText = (value, maximum) => String(value || '').slice(0, maximum);
const withTimeout = async (promise, timeoutMs = 2500) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error('工具超时'), { code: 'TOOL_TIMEOUT' })), timeoutMs)),
]);

function createSkillRegistry({ db, config }) {
  const query = db.promise().query.bind(db.promise());
  const maxResultChars = config.limits.toolResultChars;

  async function permittedPosts(rows, user, shareToken) {
    const allowed = [];
    for (const row of rows) if (await canAccessPost(query, row, user, shareToken)) allowed.push(row);
    return allowed;
  }

  const definitions = {
    search_articles: {
      schema: z.object({ query: z.string().min(1).max(300), limit: z.number().int().min(1).max(5).default(5) }),
      async run(input, context) {
        const term = `%${input.query.trim().slice(0, 300)}%`;
        const [rows] = await query('SELECT * FROM posts WHERE title LIKE ? OR excerpt LIKE ? OR content_markdown LIKE ? ORDER BY updated_at DESC,id DESC LIMIT 20', [term, term, term]);
        return (await permittedPosts(rows, context.user, context.shareToken)).slice(0, input.limit).map((post) => ({
          id: Number(post.id), title: post.title, slug: post.slug, excerpt: maxText(post.excerpt || post.content_markdown, 600),
        }));
      },
    },
    get_article: {
      schema: z.object({ postId: z.number().int().positive().optional() }),
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
      schema: z.object({ postId: z.number().int().positive().optional(), limit: z.number().int().min(1).max(5).default(5) }),
      async run(input, context) {
        const id = input.postId || context.article?.id;
        if (!id) throw Object.assign(new Error('未指定文章'), { code: 'ARTICLE_REQUIRED' });
        const [baseRows] = await query('SELECT * FROM posts WHERE id=?', [id]);
        const base = baseRows[0];
        if (!base || !await canAccessPost(query, base, context.user, context.shareToken)) throw Object.assign(new Error('无权读取文章'), { code: 'FORBIDDEN' });
        const [rows] = await query('SELECT * FROM posts WHERE id<>? AND (title LIKE ? OR content_markdown LIKE ?) ORDER BY published_at DESC,id DESC LIMIT 20', [base.id, `%${String(base.title).slice(0, 80)}%`, `%${String(base.title).slice(0, 80)}%`]);
        return (await permittedPosts(rows, context.user, context.shareToken)).slice(0, input.limit).map((post) => ({ id: Number(post.id), title: post.title, slug: post.slug, excerpt: maxText(post.excerpt || post.content_markdown, 500) }));
      },
    },
    search_projects: {
      schema: z.object({ query: z.string().min(1).max(300), limit: z.number().int().min(1).max(5).default(5) }),
      async run(input, context) {
        const term = `%${input.query.trim().slice(0, 300)}%`;
        const ownerCondition = context.user?.id ? '(p.owner_id=? OR u.profile_visibility=\'public\')' : "u.profile_visibility='public'";
        const params = context.user?.id ? [context.user.id, term, term, input.limit] : [term, term, input.limit];
        const [rows] = await query(`SELECT p.* FROM projects p JOIN users u ON u.id=p.owner_id WHERE ${ownerCondition} AND (p.title LIKE ? OR p.summary LIKE ?) ORDER BY p.featured DESC,p.sort_order ASC,p.id ASC LIMIT ?`, params);
        return rows.map((project) => ({ id: Number(project.id), title: project.title, slug: project.slug, summary: maxText(project.summary, 500), role: project.role || '' }));
      },
    },
    get_series: {
      schema: z.object({ seriesId: z.number().int().positive().optional(), slug: z.string().max(180).optional() }).refine((value) => value.seriesId || value.slug, '需要系列标识'),
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
    const result = await withTimeout(definition.run(input, context));
    const serialized = JSON.stringify(result);
    return serialized.length > maxResultChars ? { truncated: true, preview: serialized.slice(0, maxResultChars) } : result;
  }

  return { definitions, invoke };
}

module.exports = { createSkillRegistry, withTimeout };
