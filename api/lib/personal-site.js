const jwt = require('jsonwebtoken');

const OWNER_ID = () => {
  const value = Number(process.env.SITE_OWNER_USER_ID || 0);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
};

const slugify = (value, fallback = 'item') => String(value || '')
  .toLowerCase().trim().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
  .replace(/^-+|-+$/g, '').slice(0, 180) || fallback;

function parseList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean).slice(0, 20);
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 20);
  return [];
}

function safeUrl(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === 'https:' ? text.slice(0, 500) : null;
  } catch (_) {
    return null;
  }
}

function publicAvatarUrl(row) {
  return row?.avatar_path && row?.id ? `/api/public/avatars/${row.id}` : null;
}

function mountPersonalSiteRoutes(app, db, { getAuthToken, authSecret }) {
  const query = db.promise().query.bind(db.promise());
  const optionalAuth = (req, _res, next) => {
    const token = getAuthToken(req);
    if (!token) return next();
    try {
      const payload = jwt.verify(token, authSecret);
      const id = Number(payload.sub);
      return query('SELECT id,email,session_version FROM users WHERE id=? AND deleted_at IS NULL', [id])
        .then(([rows]) => {
          if (rows[0] && Number(payload.sv || 0) === Number(rows[0].session_version || 0)) {
            req.user = { id, email: rows[0].email };
          }
          next();
        }).catch(() => next());
    } catch (_) {
      return next();
    }
  };
  const requireAuth = (req, res, next) => req.user
    ? next()
    : res.status(401).json({ error: { code: 'AUTH_REQUIRED', message: '请先登录' } });
  const error = (res, status, code, message) => res.status(status).json({ error: { code, message } });
  const requireOwner = (req, res, next) => {
    const ownerId = OWNER_ID();
    if (!ownerId || Number(req.user?.id) !== ownerId) return error(res, 403, 'SITE_OWNER_REQUIRED', '仅站主可以管理个人网站内容');
    return next();
  };
  const parseId = (value) => {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  };
  const presentOwner = (row) => ({
    username: row.username || null,
    blog_title: row.blog_title || null,
    bio: row.bio || null,
    avatar_url: publicAvatarUrl(row),
    blog_slug: row.blog_slug || null,
    social_links: (() => {
      if (!row.social_links) return {};
      if (typeof row.social_links === 'object') return row.social_links;
      try {
        const parsed = JSON.parse(row.social_links);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
      } catch (_) {
        return {};
      }
    })(),
  });
  const presentProject = (row) => {
    let techStack = row.tech_stack;
    if (typeof techStack === 'string') { try { techStack = JSON.parse(techStack); } catch (_) { techStack = []; } }
    return {
    id: Number(row.id), title: row.title, slug: row.slug, summary: row.summary || '',
    description: row.description || '', cover: row.cover || null, year: row.year == null ? null : Number(row.year),
    role: row.role || '', tech_stack: Array.isArray(techStack) ? techStack : [],
    github_url: row.github_url || null, demo_url: row.demo_url || null,
    featured: Boolean(row.featured), sort_order: Number(row.sort_order || 0),
    };
  };
  const parseProject = (body = {}) => {
    const title = String(body.title || '').trim().slice(0, 160);
    if (!title) return { error: '项目名称不能为空' };
    const slug = slugify(body.slug || title, `project-${Date.now()}`);
    if (!/^[a-z0-9\u4e00-\u9fff-]{1,180}$/.test(slug)) return { error: '项目标识格式无效' };
    const year = body.year === '' || body.year == null ? null : Number(body.year);
    if (year != null && (!Number.isInteger(year) || year < 1900 || year > 2200)) return { error: '项目年份无效' };
    const cover = String(body.cover || '').trim();
    if (cover && !/^\/api\/public\/media\/\d+$/.test(cover) && !safeUrl(cover)) return { error: '项目封面必须是 HTTPS 图片地址或站内媒体地址' };
    return {
      title, slug, summary: String(body.summary || '').trim().slice(0, 500),
      description: String(body.description || '').slice(0, 20000), cover: cover || null, year,
      role: String(body.role || '').trim().slice(0, 120), techStack: parseList(body.tech_stack ?? body.techStack),
      githubUrl: safeUrl(body.github_url ?? body.githubUrl), demoUrl: safeUrl(body.demo_url ?? body.demoUrl),
      featured: Boolean(body.featured), sortOrder: Number.isInteger(Number(body.sort_order ?? body.sortOrder)) ? Number(body.sort_order ?? body.sortOrder) : 0,
    };
  };
  const coverOwnershipError = async (cover, userId) => {
    const match = String(cover || '').match(/^\/api\/public\/media\/(\d+)$/);
    if (!match) return null;
    const [rows] = await query('SELECT id FROM post_media WHERE id=? AND owner_id=?', [Number(match[1]), userId]);
    return rows[0] ? null : { status: 403, code: 'MEDIA_OWNERSHIP_REQUIRED', message: '项目封面只能使用自己拥有的媒体' };
  };
  const parseSeriesCover = (value) => {
    const cover = String(value || '').trim();
    if (!cover || /^\/api\/public\/media\/\d+$/.test(cover) || safeUrl(cover)) return { value: cover || null };
    return { error: '系列封面必须是 HTTPS 图片地址或站内媒体地址' };
  };
  const presentSeries = (row, articles = []) => ({
    id: Number(row.id), name: row.name, slug: row.slug, description: row.description || '', cover: row.cover || null,
    sort_order: Number(row.sort_order || 0), article_count: articles.length,
    total_reading_minutes: articles.reduce((sum, article) => sum + Math.max(1, Math.ceil(String(article.content_markdown || '').length / 500)), 0),
    articles: articles.map((article, index) => ({
      id: Number(article.id), title: article.title, slug: article.slug, excerpt: article.excerpt || '',
      published_at: article.published_at, series_order: Number(article.series_order || index + 1),
      reading_minutes: Math.max(1, Math.ceil(String(article.content_markdown || '').length / 500)),
    })),
  });

  app.get('/api/public/site-owner', optionalAuth, async (_req, res, next) => {
    try {
      const ownerId = OWNER_ID();
      if (!ownerId) return res.json({ owner: null });
      const [rows] = await query('SELECT id,username,blog_slug,avatar_path,bio,blog_title,social_links FROM users WHERE id=? AND profile_visibility=\'public\' AND deleted_at IS NULL', [ownerId]);
      if (!rows[0]) return res.json({ owner: null });
      let socialLinks = {};
      if (rows[0].social_links && typeof rows[0].social_links === 'object' && !Array.isArray(rows[0].social_links)) {
        socialLinks = rows[0].social_links;
      } else {
        try {
          const parsed = rows[0].social_links ? JSON.parse(rows[0].social_links) : {};
          socialLinks = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
        } catch (_) { socialLinks = {}; }
      }
      return res.json({ owner: presentOwner({ ...rows[0], social_links: socialLinks }) });
    } catch (e) { return next(e); }
  });

  app.get('/api/public/projects', optionalAuth, async (_req, res, next) => {
    try {
      const ownerId = OWNER_ID();
      if (!ownerId) return res.json({ items: [] });
      const [rows] = await query('SELECT p.* FROM projects p JOIN users u ON u.id=p.owner_id WHERE p.owner_id=? AND u.profile_visibility=\'public\' AND u.deleted_at IS NULL ORDER BY p.featured DESC,p.sort_order ASC,p.id ASC', [ownerId]);
      return res.json({ items: rows.map(presentProject) });
    } catch (e) { return next(e); }
  });

  app.get('/api/public/projects/:slug', optionalAuth, async (req, res, next) => {
    try {
      const ownerId = OWNER_ID();
      if (!ownerId) return error(res, 404, 'NOT_FOUND', '项目不存在');
      const [rows] = await query('SELECT p.* FROM projects p JOIN users u ON u.id=p.owner_id WHERE p.slug=? AND p.owner_id=? AND u.profile_visibility=\'public\' AND u.deleted_at IS NULL', [req.params.slug, ownerId]);
      return rows[0] ? res.json({ project: presentProject(rows[0]) }) : error(res, 404, 'NOT_FOUND', '项目不存在');
    } catch (e) { return next(e); }
  });

  app.get('/api/owner/projects', optionalAuth, requireAuth, requireOwner, async (req, res, next) => {
    try { const [rows] = await query('SELECT * FROM projects WHERE owner_id=? ORDER BY featured DESC,sort_order ASC,id ASC', [req.user.id]); return res.json({ items: rows.map(presentProject) }); } catch (e) { return next(e); }
  });
  app.post('/api/owner/projects', optionalAuth, requireAuth, requireOwner, async (req, res, next) => {
    try {
      const value = parseProject(req.body);
      if (value.error) return error(res, 400, 'INVALID_PROJECT', value.error);
      const coverError = await coverOwnershipError(value.cover, req.user.id);
      if (coverError) return error(res, coverError.status, coverError.code, coverError.message);
      const [duplicate] = await query('SELECT id FROM projects WHERE slug=?', [value.slug]);
      if (duplicate[0]) return error(res, 409, 'SLUG_TAKEN', '项目标识已被使用');
      const [result] = await query('INSERT INTO projects (owner_id,title,slug,summary,description,cover,year,role,tech_stack,github_url,demo_url,featured,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)', [req.user.id, value.title, value.slug, value.summary, value.description, value.cover, value.year, value.role, JSON.stringify(value.techStack), value.githubUrl, value.demoUrl, value.featured, value.sortOrder]);
      const [rows] = await query('SELECT * FROM projects WHERE id=? AND owner_id=?', [result.insertId, req.user.id]);
      return res.status(201).json({ project: presentProject(rows[0]) });
    } catch (e) { return next(e); }
  });
  app.put('/api/owner/projects/:id', optionalAuth, requireAuth, requireOwner, async (req, res, next) => {
    try {
      const id = parseId(req.params.id); if (!id) return error(res, 404, 'NOT_FOUND', '项目不存在');
      const value = parseProject(req.body); if (value.error) return error(res, 400, 'INVALID_PROJECT', value.error);
      const coverError = await coverOwnershipError(value.cover, req.user.id);
      if (coverError) return error(res, coverError.status, coverError.code, coverError.message);
      const [existing] = await query('SELECT id FROM projects WHERE id=? AND owner_id=?', [id, req.user.id]); if (!existing[0]) return error(res, 404, 'NOT_FOUND', '项目不存在');
      const [duplicate] = await query('SELECT id FROM projects WHERE slug=? AND id<>?', [value.slug, id]); if (duplicate[0]) return error(res, 409, 'SLUG_TAKEN', '项目标识已被使用');
      await query('UPDATE projects SET title=?,slug=?,summary=?,description=?,cover=?,year=?,role=?,tech_stack=?,github_url=?,demo_url=?,featured=?,sort_order=? WHERE id=? AND owner_id=?', [value.title, value.slug, value.summary, value.description, value.cover, value.year, value.role, JSON.stringify(value.techStack), value.githubUrl, value.demoUrl, value.featured, value.sortOrder, id, req.user.id]);
      const [rows] = await query('SELECT * FROM projects WHERE id=? AND owner_id=?', [id, req.user.id]); return res.json({ project: presentProject(rows[0]) });
    } catch (e) { return next(e); }
  });
  app.delete('/api/owner/projects/:id', optionalAuth, requireAuth, requireOwner, async (req, res, next) => {
    try { const id = parseId(req.params.id); if (!id) return error(res, 404, 'NOT_FOUND', '项目不存在'); const [result] = await query('DELETE FROM projects WHERE id=? AND owner_id=?', [id, req.user.id]); return result.affectedRows ? res.status(204).end() : error(res, 404, 'NOT_FOUND', '项目不存在'); } catch (e) { return next(e); }
  });

  app.get('/api/public/series/:slug', optionalAuth, async (req, res, next) => {
    try {
      const [seriesRows] = await query('SELECT s.*,u.username,u.blog_slug FROM series s JOIN users u ON u.id=s.owner_id WHERE s.slug=? AND u.profile_visibility=\'public\' AND u.deleted_at IS NULL', [req.params.slug]);
      if (!seriesRows[0]) return error(res, 404, 'NOT_FOUND', '专栏不存在');
      const [articles] = await query("SELECT p.id,p.title,p.slug,p.excerpt,p.content_markdown,p.published_at,p.series_order FROM posts p WHERE p.series_id=? AND p.status='published' AND p.visibility='public' ORDER BY p.series_order IS NULL,p.series_order ASC,p.published_at ASC,p.id ASC", [seriesRows[0].id]);
      return res.json({ series: { ...presentSeries(seriesRows[0], articles), username: seriesRows[0].username, blog_slug: seriesRows[0].blog_slug } });
    } catch (e) { return next(e); }
  });
  app.get('/api/series', optionalAuth, requireAuth, async (req, res, next) => {
    try { const [rows] = await query('SELECT * FROM series WHERE owner_id=? ORDER BY sort_order ASC,id ASC', [req.user.id]); return res.json({ items: rows.map((row) => presentSeries(row)) }); } catch (e) { return next(e); }
  });
  app.post('/api/series', optionalAuth, requireAuth, async (req, res, next) => {
    try {
      const name = String(req.body.name || '').trim().slice(0, 160);
      if (!name) return error(res, 400, 'INVALID_SERIES', '专栏名称不能为空');
      const slug = slugify(req.body.slug || name, `series-${Date.now()}`);
      if (!/^[a-z0-9\u4e00-\u9fff-]{1,180}$/.test(slug)) return error(res, 400, 'INVALID_SERIES', '专栏标识格式无效');
      const cover = parseSeriesCover(req.body.cover);
      if (cover.error) return error(res, 400, 'INVALID_SERIES', cover.error);
      const coverError = await coverOwnershipError(cover.value, req.user.id);
      if (coverError) return error(res, coverError.status, coverError.code, coverError.message);
      const [duplicate] = await query('SELECT id FROM series WHERE slug=?', [slug]);
      if (duplicate[0]) return error(res, 409, 'SLUG_TAKEN', '专栏标识已被使用');
      const [result] = await query('INSERT INTO series (owner_id,name,slug,description,cover,sort_order) VALUES (?,?,?,?,?,?)', [req.user.id, name, slug, String(req.body.description || '').slice(0, 1000), cover.value, Number(req.body.sort_order || 0)]);
      const [rows] = await query('SELECT * FROM series WHERE id=?', [result.insertId]);
      return res.status(201).json({ series: presentSeries(rows[0]) });
    } catch (e) { return next(e); }
  });
  app.put('/api/series/:id', optionalAuth, requireAuth, async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return error(res, 404, 'NOT_FOUND', '专栏不存在');
      const name = String(req.body.name || '').trim().slice(0, 160);
      if (!name) return error(res, 400, 'INVALID_SERIES', '专栏名称不能为空');
      const slug = slugify(req.body.slug || name, `series-${id}`);
      const cover = parseSeriesCover(req.body.cover);
      if (cover.error) return error(res, 400, 'INVALID_SERIES', cover.error);
      const coverError = await coverOwnershipError(cover.value, req.user.id);
      if (coverError) return error(res, coverError.status, coverError.code, coverError.message);
      const [existing] = await query('SELECT id FROM series WHERE id=? AND owner_id=?', [id, req.user.id]);
      if (!existing[0]) return error(res, 404, 'NOT_FOUND', '专栏不存在');
      const [duplicate] = await query('SELECT id FROM series WHERE slug=? AND id<>?', [slug, id]);
      if (duplicate[0]) return error(res, 409, 'SLUG_TAKEN', '专栏标识已被使用');
      await query('UPDATE series SET name=?,slug=?,description=?,cover=?,sort_order=? WHERE id=? AND owner_id=?', [name, slug, String(req.body.description || '').slice(0, 1000), cover.value, Number(req.body.sort_order || 0), id, req.user.id]);
      const [rows] = await query('SELECT * FROM series WHERE id=?', [id]);
      return res.json({ series: presentSeries(rows[0]) });
    } catch (e) { return next(e); }
  });
  app.delete('/api/series/:id', optionalAuth, requireAuth, async (req, res, next) => {
    try { const id = parseId(req.params.id); if (!id) return error(res, 404, 'NOT_FOUND', '专栏不存在'); const [result] = await query('DELETE FROM series WHERE id=? AND owner_id=?', [id, req.user.id]); return result.affectedRows ? res.status(204).end() : error(res, 404, 'NOT_FOUND', '专栏不存在'); } catch (e) { return next(e); }
  });
}

module.exports = { mountPersonalSiteRoutes, ownerId: OWNER_ID };
