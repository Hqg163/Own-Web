const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { createShareToken } = require('./migrations');
const canonicalContent = require('./lib/content');
const { validateUploadedFile } = require('./lib/security');

const PAGE_SIZE = 12;
const allowedVisibilities = new Set(['public', 'private', 'followers', 'unlisted']);
const allowedStatuses = new Set(['draft', 'published', 'scheduled', 'archived']);
const slugify = (value, fallback = 'post') => String(value || '').toLowerCase().trim().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 160) || fallback;
function mountBlogRoutes(app, db, { getAuthToken, authSecret, uploadRoot }) {
  const query = db.promise().query.bind(db.promise());
  const adminEmails = new Set(String(process.env.ADMIN_EMAILS || '').split(',').map((email) => email.trim()).filter(Boolean));
  const jwt = require('jsonwebtoken');
  const optionalAuth = (req, _res, next) => { const token = getAuthToken(req); if (!token) return next(); try { const p = jwt.verify(token, authSecret); db.promise().query('SELECT id,email,session_version FROM users WHERE id=?', [Number(p.sub)]).then(([rows]) => { if (rows[0] && Number(p.sv || 0) === Number(rows[0].session_version || 0)) req.user = { id:Number(p.sub), email:rows[0].email }; next(); }).catch(() => next()); } catch (_) { next(); } };
  const requireAuth = (req, res, next) => req.user ? next() : res.status(401).json({ error: { code: 'AUTH_REQUIRED', message: '请先登录' } });
  const error = (res, status, code, message, fields) => res.status(status).json({ error: { code, message, ...(fields ? { fields } : {}) } });
  const page = (req) => Math.max(1, Number(req.query.page) || 1);
  const isAdmin = (req) => adminEmails.has(req.user?.email);
  function normalizeSocialLinks(input) {
    if (input == null) return { links: {} };
    if (typeof input !== 'object' || Array.isArray(input)) return { message: '社交链接格式无效' };
    const links = {};
    for (const key of ['website', 'github', 'other']) {
      const value = String(input[key] || '').trim();
      if (!value) continue;
      if (value.length > 300) return { message: '单个社交链接不能超过 300 个字符' };
      try {
        const parsed = new URL(value);
        if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return { message: '社交链接仅支持不含登录信息的 HTTP 或 HTTPS 地址' };
        links[key] = parsed.toString();
      } catch (_) {
        return { message: '请输入有效的 HTTP 或 HTTPS 社交链接' };
      }
    }
    return { links };
  }
  async function access(post, viewer, token) {
    if (!post) return false;
    if (viewer?.id === post.author_id) return true;
    if (post.status !== 'published') return false;
    if (post.visibility === 'public') return true;
    if (post.visibility === 'unlisted') return token && token === post.share_token;
    if (post.visibility !== 'followers' || !viewer) return false;
    const [rows] = await query('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?', [viewer.id, post.author_id]); return rows.length > 0;
  }
  async function loadAccessiblePost(id, req, res) {
    const [rows] = await query('SELECT * FROM posts WHERE id=?', [id]);
    const post = rows[0];
    if (!post) { error(res, 404, 'NOT_FOUND', '文章不存在'); return null; }
    if (await access(post, req.user, req.query?.share)) return post;
    // 仅链接内容不能向猜测 ID 或漏传 token 的访问者确认其存在。
    if (post.visibility === 'unlisted') { error(res, 404, 'NOT_FOUND', '文章不存在'); return null; }
    error(res, req.user ? 403 : 401, req.user ? 'FORBIDDEN' : 'AUTH_REQUIRED', req.user ? '无权阅读此文章' : '请登录后阅读此文章');
    return null;
  }
  async function postMeta(postIds) {
    if (!postIds.length) return new Map();
    const marks = postIds.map(() => '?').join(',');
    const [rows] = await query(`SELECT pc.post_id, c.name, c.slug FROM post_categories pc JOIN categories c ON c.id=pc.category_id WHERE pc.post_id IN (${marks})`, postIds);
    const result = new Map(postIds.map((id) => [id, []])); rows.forEach((row) => result.get(row.post_id).push({ name: row.name, slug: row.slug })); return result;
  }
  async function postTags(postIds) {
    if (!postIds.length) return new Map();
    const marks = postIds.map(() => '?').join(',');
    const [rows] = await query(`SELECT pt.post_id, t.name, t.slug FROM post_tags pt JOIN tags t ON t.id=pt.tag_id WHERE pt.post_id IN (${marks})`, postIds);
    const result = new Map(postIds.map((id) => [id, []])); rows.forEach((row) => result.get(row.post_id).push({ name: row.name, slug: row.slug })); return result;
  }
  async function viewerPostStates(postIds, userId) {
    const states = new Map(postIds.map((id) => [id, { liked: false, bookmarked: false }]));
    if (!userId || !postIds.length) return states;
    const marks = postIds.map(() => '?').join(',');
    const [likes] = await query(`SELECT post_id FROM post_likes WHERE user_id=? AND post_id IN (${marks})`, [userId, ...postIds]);
    const [bookmarks] = await query(`SELECT post_id FROM post_bookmarks WHERE user_id=? AND post_id IN (${marks})`, [userId, ...postIds]);
    likes.forEach((row) => { if (states.has(row.post_id)) states.get(row.post_id).liked = true; });
    bookmarks.forEach((row) => { if (states.has(row.post_id)) states.get(row.post_id).bookmarked = true; });
    return states;
  }
  async function ensureOwnedBlockMedia(doc, ownerId, postId) {
    const requested = new Map();
    const walk = (node) => {
      if (['image', 'attachment', 'audio', 'video'].includes(node?.type)) {
        const match = String(node.attrs?.src || '').match(/^\/api\/public\/media\/(\d+)/);
        if (match) requested.set(Number(match[1]), node.type === 'attachment' ? 'file' : node.type);
      }
      if (node?.type === 'gallery') for (const item of node.attrs?.items || []) { const match = String(item?.src || '').match(/^\/api\/public\/media\/(\d+)/); if (match) requested.set(Number(match[1]), 'image'); }
      (node?.content || []).forEach(walk);
    };
    walk(doc);
    if (!requested.size) return;
    const ids = [...requested.keys()], markers = ids.map(() => '?').join(',');
    const [rows] = await query(`SELECT id,post_id,media_kind FROM post_media WHERE owner_id=? AND id IN (${markers})`, [ownerId, ...ids]);
    if (rows.length !== ids.length || rows.some((row) => row.media_kind !== requested.get(row.id))) throw Object.assign(new Error('媒体类型或归属不符合当前文章'), { status: 403, code: 'MEDIA_OWNERSHIP_REQUIRED' });
    if (!postId || rows.some((row) => row.post_id !== null && Number(row.post_id) !== Number(postId))) throw Object.assign(new Error('媒体必须绑定到当前文章'), { status: 403, code: 'MEDIA_POST_REQUIRED' });
    for (const row of rows.filter((row) => row.post_id === null)) await query('UPDATE post_media SET post_id=? WHERE id=? AND owner_id=? AND post_id IS NULL', [postId, row.id, ownerId]);
  }
  async function ensureOwnedCover(coverImage, ownerId) {
    const match = String(coverImage || '').match(/^\/api\/public\/media\/(\d+)$/);
    if (!match) throw Object.assign(new Error('封面必须来自已上传的图片媒体'), { status: 400, code: 'INVALID_COVER' });
    const [rows] = await query("SELECT id FROM post_media WHERE id=? AND owner_id=? AND media_kind='image'", [match[1], ownerId]);
    if (!rows.length) throw Object.assign(new Error('封面图片不属于当前用户'), { status: 403, code: 'COVER_OWNERSHIP_REQUIRED' });
  }
  function presentPublicPost(row, categories, shareToken, tags = new Map(), viewer = null) {
    const post = {
      id: row.id, title: row.title, slug: row.slug, excerpt: row.excerpt,
      content_markdown: row.content_markdown, content_html: row.content_html, content_format: row.content_format,
      cover_image: row.cover_image, cover_alt_text: row.cover_alt_text, status: row.status, visibility: row.visibility,
      allow_comments: Boolean(row.allow_comments), published_at: row.published_at,
      scheduled_at: row.scheduled_at, view_count: row.view_count, like_count: row.like_count,
      bookmark_count: row.bookmark_count, comment_count: row.comment_count,
      created_at: row.created_at, updated_at: row.updated_at, username: row.username,
      blog_slug: row.blog_slug, avatar_path: publicAvatarUrl(row), bio: row.bio,
      blog_title: row.blog_title, categories: categories.get(row.id) || [], tags: tags.get(row.id) || [],
      reading_minutes: Math.max(1, Math.ceil((row.content_markdown || '').length / 500)),
      viewer_liked: Boolean(viewer?.liked), viewer_bookmarked: Boolean(viewer?.bookmarked)
    };
    if (row.visibility === 'unlisted' && shareToken) {
      const token = encodeURIComponent(shareToken);
      post.content_markdown = String(post.content_markdown || '').replace(/(\/api\/public\/media\/\d+)(?![\w?])/g, `$1?share=${token}`);
      post.content_html = String(post.content_html || '').replace(/(src="\/api\/public\/media\/\d+)(")/g, `$1?share=${token}$2`);
    }
    return post;
  }
  function presentOwnerPost(row, categories) {
    return { ...presentPublicPost(row, categories), author_id: row.author_id, share_token: row.share_token };
  }
  const removeUploadedFile = (file) => { if (file?.path) fs.unlink(file.path, () => {}); };
  const publicAvatarUrl = (row) => row?.avatar_path && (row.profile_user_id || row.author_id || row.id) ? `/api/public/avatars/${row.profile_user_id || row.author_id || row.id}` : null;
  const resolveAvatarPath = (avatarPath) => {
    const root = path.resolve(uploadRoot);
    const resolved = path.resolve(path.dirname(uploadRoot), String(avatarPath || '').replace(/^[/\\]+/, ''));
    return resolved.startsWith(`${root}${path.sep}`) ? resolved : null;
  };
  async function createNotification(recipient, actor, type, postId, commentId) { if (recipient !== actor) await query('INSERT INTO notifications (recipient_id,actor_id,type,post_id,comment_id) VALUES (?,?,?,?,?)', [recipient, actor, type, postId || null, commentId || null]); }
  async function syncTaxonomy(postId, categorySlugs, tagNames) {
    await query('DELETE FROM post_categories WHERE post_id=?', [postId]);
    const categories = [...new Set(Array.isArray(categorySlugs) ? categorySlugs.slice(0, 3) : [])];
    for (const slug of categories) { const [rows] = await query('SELECT id FROM categories WHERE slug=?', [slug]); if (rows[0]) await query('INSERT IGNORE INTO post_categories (post_id,category_id) VALUES (?,?)', [postId, rows[0].id]); }
    await query('DELETE FROM post_tags WHERE post_id=?', [postId]);
    const tags = [...new Set((Array.isArray(tagNames) ? tagNames : []).map((tag) => String(tag).trim()).filter(Boolean).slice(0, 10))];
    for (const name of tags) { const slug = slugify(name, `tag-${Date.now()}`); await query('INSERT IGNORE INTO tags (name,slug) VALUES (?,?)', [name.slice(0,60), slug]); const [rows] = await query('SELECT id FROM tags WHERE slug=?', [slug]); if (rows[0]) await query('INSERT IGNORE INTO post_tags (post_id,tag_id) VALUES (?,?)', [postId, rows[0].id]); }
  }
  const storage = multer.diskStorage({ destination(req, _file, cb) { const dir = path.join(uploadRoot, 'posts', String(req.user.id)); fs.mkdirSync(dir, { recursive: true }); cb(null, dir); }, filename(_req, file, cb) { cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(file.originalname).toLowerCase()}`); } });
  const mediaTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
  const mediaUpload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter(_req, file, cb) { cb(null, mediaTypes.has(String(file.mimetype).toLowerCase()) && path.extname(file.originalname || '').toLowerCase() !== '.svg'); } });
  const allowedAttachmentTypes = new Set(['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/aac', 'audio/flac', 'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'application/pdf', 'application/zip', 'application/x-zip-compressed', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
  const attachmentUpload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 }, fileFilter(_req, file, cb) { cb(null, allowedAttachmentTypes.has(file.mimetype)); } });
  const inspectAttachment = (file) => {
    const head = fs.readFileSync(file.path).subarray(0, 32), starts = (value) => head.subarray(0, value.length).equals(Buffer.from(value));
    if (starts('%PDF-')) return 'application/pdf';
    if (starts('PK\x03\x04') || starts('PK\x05\x06') || starts('PK\x07\x08')) return 'application/zip';
    if (starts('RIFF') && head.subarray(8, 12).equals(Buffer.from('WAVE'))) return 'audio/wav';
    if (starts('OggS')) return 'audio/ogg';
    if (starts('fLaC')) return 'audio/flac';
    if (starts('ID3') || (head[0] === 0xff && (head[1] & 0xe0) === 0xe0)) return 'audio/mpeg';
    if (starts('\x1aE\xdf\xa3')) return 'video/webm';
    if (head.subarray(4, 8).equals(Buffer.from('ftyp'))) return file.mimetype === 'audio/mp4' ? 'audio/mp4' : file.mimetype === 'video/quicktime' ? 'video/quicktime' : 'video/mp4';
    if (head.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))) return 'application/msword';
    return null;
  };
  const avatarStorage = multer.diskStorage({ destination(req, _file, cb) { const dir = path.join(uploadRoot, 'avatars', String(req.user.id)); fs.mkdirSync(dir, { recursive: true }); cb(null, dir); }, filename(_req, file, cb) { cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(file.originalname).toLowerCase()}`); } });
  const avatarUpload = multer({ storage: avatarStorage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter(_req, file, cb) { cb(null, /^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype)); } });

  app.get('/api/public/home', optionalAuth, async (req, res, next) => { try { const [latest] = await query(`SELECT p.*,u.username,u.blog_slug,u.avatar_path,u.blog_title FROM posts p JOIN users u ON u.id=p.author_id WHERE p.status='published' AND p.visibility='public' ORDER BY p.published_at DESC LIMIT 6`); const cats = await postMeta(latest.map(p => p.id)); const [tags] = await query('SELECT t.name,t.slug,COUNT(*) count FROM tags t JOIN post_tags pt ON pt.tag_id=t.id JOIN posts p ON p.id=pt.post_id WHERE p.status=\'published\' AND p.visibility=\'public\' GROUP BY t.id ORDER BY count DESC LIMIT 10'); res.json({ latest: latest.map(p => presentPublicPost(p,cats)), featured: latest.slice(0,3).map(p => presentPublicPost(p,cats)), tags }); } catch (e) { next(e); } });
  app.get('/api/public/posts', optionalAuth, async (req, res, next) => { try {
    const p = Math.min(100, page(req)), offset = (p - 1) * PAGE_SIZE, params = [], where = ["p.status='published'", "p.visibility='public'"];
    const feed = ['discover', 'latest', 'hot', 'following'].includes(req.query.feed) ? req.query.feed : 'discover';
    if (feed === 'following') { if (!req.user) return error(res, 401, 'AUTH_REQUIRED', '请登录后查看关注内容'); where.push('EXISTS (SELECT 1 FROM follows f WHERE f.follower_id=? AND f.following_id=p.author_id)'); params.push(req.user.id); }
    if (req.query.tag) { where.push('EXISTS (SELECT 1 FROM post_tags pt JOIN tags t ON t.id=pt.tag_id WHERE pt.post_id=p.id AND t.slug=?)'); params.push(String(req.query.tag).slice(0, 80)); }
    if (req.query.category) { where.push('EXISTS (SELECT 1 FROM post_categories pc JOIN categories c ON c.id=pc.category_id WHERE pc.post_id=p.id AND c.slug=?)'); params.push(String(req.query.category).slice(0, 80)); }
    if (req.query.q) {
      const term = `%${String(req.query.q).slice(0, 100)}%`;
      where.push('(p.title LIKE ? OR p.excerpt LIKE ? OR p.content_markdown LIKE ? OR u.username LIKE ? OR EXISTS (SELECT 1 FROM post_categories sc JOIN categories sca ON sca.id=sc.category_id WHERE sc.post_id=p.id AND (sca.name LIKE ? OR sca.slug LIKE ?)) OR EXISTS (SELECT 1 FROM post_tags st JOIN tags sta ON sta.id=st.tag_id WHERE st.post_id=p.id AND (sta.name LIKE ? OR sta.slug LIKE ?)))');
      params.push(term, term, term, term, term, term, term, term);
    }
    const ageHours = 'GREATEST(TIMESTAMPDIFF(HOUR, COALESCE(p.published_at,p.updated_at), UTC_TIMESTAMP()), 0)';
    const order = feed === 'latest' ? 'p.published_at DESC, p.id DESC' : feed === 'hot' ? `((p.like_count * 2) + (p.comment_count * 3) + (p.view_count * 0.2)) / POW(${ageHours} + 2, 1.2) DESC, p.published_at DESC` : `((p.like_count * 2) + (p.comment_count * 3) + (p.view_count * 0.2) + 1) / POW(${ageHours} + 2, 0.9) DESC, p.published_at DESC, p.id DESC`;
    const from = `FROM posts p JOIN users u ON u.id=p.author_id WHERE ${where.join(' AND ')}`;
    const [[total]] = await query(`SELECT COUNT(*) total ${from}`, params);
    const [rows] = await query(`SELECT p.*,u.username,u.blog_slug,u.avatar_path ${from} ORDER BY ${order} LIMIT ? OFFSET ?`, [...params, PAGE_SIZE, offset]);
    const ids = rows.map((row) => row.id);
    const [cats, tags, states] = await Promise.all([postMeta(ids), postTags(ids), viewerPostStates(ids, req.user?.id)]);
    const items = rows.map((row) => {
      const post = presentPublicPost(row, cats, null, tags, states.get(row.id));
      delete post.content_markdown;
      delete post.content_html;
      return post;
    });
    res.json({ items, page: p, total: Number(total.total || 0), pageSize: PAGE_SIZE, feed });
  } catch (e) { next(e); } });
  app.get('/api/public/creators', optionalAuth, async (req, res, next) => { try {
    const ownFilter = req.user ? ' AND u.id<>?' : '';
    const params = req.user ? [req.user.id] : [];
    const [items] = await query(`SELECT u.id,u.username,u.blog_slug,u.avatar_path,COUNT(p.id) post_count,COUNT(DISTINCT f.follower_id) follower_count
      FROM users u JOIN posts p ON p.author_id=u.id AND p.status='published' AND p.visibility='public'
      LEFT JOIN follows f ON f.following_id=u.id WHERE u.profile_visibility='public'${ownFilter}
      GROUP BY u.id ORDER BY post_count DESC,follower_count DESC,u.id DESC LIMIT 5`, params);
    res.json({ items: items.map((item) => ({ ...item, avatar_url: publicAvatarUrl(item) })) });
  } catch (e) { next(e); } });
  app.get('/api/public/posts/:slug', optionalAuth, async (req,res,next)=>{ try { const [rows] = await query('SELECT p.*,u.username,u.blog_slug,u.avatar_path,u.bio,u.blog_title FROM posts p JOIN users u ON u.id=p.author_id WHERE p.slug=?',[req.params.slug]); const post=rows[0]; if (!post) return error(res,404,'NOT_FOUND','文章不存在'); if (!await access(post,req.user,req.query.share)) { if (post.visibility === 'unlisted') return error(res,404,'NOT_FOUND','文章不存在'); return error(res,req.user?403:401,req.user?'FORBIDDEN':'AUTH_REQUIRED',req.user?'无权阅读此文章':'请登录后阅读此文章'); } const [cats,tags,states]=await Promise.all([postMeta([post.id]),postTags([post.id]),viewerPostStates([post.id],req.user?.id)]); if (post.visibility==='public') { await query('UPDATE posts SET view_count=view_count+1 WHERE id=?',[post.id]); post.view_count++; } res.json({ post:presentPublicPost(post,cats,req.query.share,tags,states.get(post.id)), canComment:post.allow_comments }); } catch(e){next(e);} });
  app.get('/api/public/posts/:slug/related', optionalAuth, async (req, res, next) => { try {
    const [currentRows] = await query("SELECT p.id,p.author_id,p.published_at FROM posts p WHERE p.slug=? AND p.status='published'", [req.params.slug]);
    if (!currentRows[0]) return error(res, 404, 'NOT_FOUND', '文章不存在');
    const current = currentRows[0];
    const [relatedRows] = await query("SELECT p.id,p.title,p.slug,p.excerpt,p.published_at,p.cover_image,p.cover_alt_text,u.username,u.blog_slug,u.avatar_path FROM posts p JOIN users u ON u.id=p.author_id WHERE p.status='published' AND p.visibility='public' AND p.id<>? ORDER BY (p.author_id=? ) DESC,p.published_at DESC,p.id DESC LIMIT 3", [current.id, current.author_id]);
    const [[previous]] = await query("SELECT p.title,p.slug,p.published_at FROM posts p WHERE p.status='published' AND p.visibility='public' AND p.published_at<? ORDER BY p.published_at DESC,p.id DESC LIMIT 1", [current.published_at]);
    const [[next]] = await query("SELECT p.title,p.slug,p.published_at FROM posts p WHERE p.status='published' AND p.visibility='public' AND p.published_at>? ORDER BY p.published_at ASC,p.id ASC LIMIT 1", [current.published_at]);
    res.json({ related:relatedRows, previous:previous || null, next:next || null });
  } catch (e) { next(e); } });
  app.get('/api/public/users/:slug', optionalAuth, async (req,res,next)=>{ try { const [users]=await query("SELECT id,username,blog_slug,avatar_path,bio,blog_title,social_links FROM users WHERE blog_slug=? AND profile_visibility='public'",[req.params.slug]); if(!users[0])return error(res,404,'NOT_FOUND','用户不存在'); const u=users[0]; const [[count]]=await query("SELECT COUNT(*) count FROM posts WHERE author_id=? AND status='published' AND visibility='public'",[u.id]); const [[followers]]=await query('SELECT COUNT(*) count FROM follows WHERE following_id=?',[u.id]); let following=false; if(req.user){const [f]=await query('SELECT 1 FROM follows WHERE follower_id=? AND following_id=?',[req.user.id,u.id]);following=!!f.length;} res.json({user:{...u,avatar_url:publicAvatarUrl(u),post_count:count.count,follower_count:followers.count,following}});}catch(e){next(e);} });
  app.get('/api/public/users/:slug/posts', optionalAuth, async (req, res, next) => { try {
    const [users] = await query("SELECT id FROM users WHERE blog_slug=? AND profile_visibility='public'", [req.params.slug]);
    if (!users[0]) return error(res, 404, 'NOT_FOUND', '用户不存在');
    const currentPage = Math.min(100, page(req)), offset = (currentPage - 1) * PAGE_SIZE;
    const base = "FROM posts p JOIN users u ON u.id=p.author_id WHERE p.author_id=? AND p.status='published' AND p.visibility='public'";
    const [[count]] = await query(`SELECT COUNT(*) total ${base}`, [users[0].id]);
    const [rows] = await query(`SELECT p.*,u.username,u.blog_slug,u.avatar_path ${base} ORDER BY p.published_at DESC,p.id DESC LIMIT ? OFFSET ?`, [users[0].id, PAGE_SIZE, offset]);
    const cats = await postMeta(rows.map((x) => x.id));
    res.json({ items: rows.map((x) => presentPublicPost(x, cats)), page: currentPage, pageSize: PAGE_SIZE, total: Number(count.total || 0) });
  } catch (e) { next(e); } });
  app.get('/api/public/taxonomy', async (_req,res,next)=>{try{const [categories]=await query("SELECT DISTINCT c.name,c.slug FROM categories c JOIN post_categories pc ON pc.category_id=c.id JOIN posts p ON p.id=pc.post_id WHERE p.status='published' AND p.visibility='public' ORDER BY c.name");const [tags]=await query("SELECT DISTINCT t.name,t.slug FROM tags t JOIN post_tags pt ON pt.tag_id=t.id JOIN posts p ON p.id=pt.post_id WHERE p.status='published' AND p.visibility='public' ORDER BY t.name LIMIT 50");res.json({categories,tags});}catch(e){next(e);}});
  app.get('/api/editor/taxonomy', optionalAuth, requireAuth, async (_req, res, next) => { try {
    const [categories] = await query('SELECT name,slug,description FROM categories ORDER BY name');
    const [tags] = await query('SELECT name,slug FROM tags ORDER BY name LIMIT 200');
    res.json({ categories, tags });
  } catch (e) { next(e); } });
  app.post('/api/editor/preview', optionalAuth, requireAuth, async (req, res, next) => { try {
    const format = req.body.contentFormat === 'blocks' ? 'blocks' : 'markdown';
    const blocks = format === 'blocks' ? canonicalContent.validateBlocks(req.body.contentBlocks) : null;
    if (blocks && req.body.postId) await ensureOwnedBlockMedia(blocks, req.user.id, Number(req.body.postId));
    const markdown = format === 'blocks' ? canonicalContent.blocksToMarkdown(blocks) : String(req.body.contentMarkdown || '');
    const html = format === 'blocks' ? canonicalContent.blocksToSafeHtml(blocks) : canonicalContent.renderMarkdown(markdown);
    res.json({ html, contentMarkdown: markdown, contentFormat: format });
  } catch (e) { next(e); } });
  app.get('/api/public/media/:id', optionalAuth, async(req,res,next)=>{try{const [rows]=await query('SELECT m.*,p.author_id,p.status,p.visibility,p.share_token FROM post_media m LEFT JOIN posts p ON p.id=m.post_id WHERE m.id=?',[req.params.id]);const m=rows[0];if(!m)return error(res,404,'NOT_FOUND','媒体不存在');if(!m.post_id ? req.user?.id!==m.owner_id : !await access(m,req.user,req.query.share))return error(res,m.visibility==='unlisted'?404:403,m.visibility==='unlisted'?'NOT_FOUND':'FORBIDDEN',m.visibility==='unlisted'?'媒体不存在':'无权访问媒体');res.setHeader('X-Content-Type-Options','nosniff');if(m.media_kind==='file')res.attachment(path.basename(m.label||m.file_path));res.sendFile(path.resolve(uploadRoot,'..',m.file_path.replace(/^[/\\]+/,'')));}catch(e){next(e);}});
  app.get('/api/public/avatars/:userId', optionalAuth, async(req,res,next)=>{try{const [users]=await query('SELECT id,avatar_path,profile_visibility FROM users WHERE id=?',[req.params.userId]);const user=users[0];if(!user||!user.avatar_path||((user.profile_visibility!=='public')&&req.user?.id!==user.id))return error(res,404,'NOT_FOUND','头像不存在');const avatarPath=resolveAvatarPath(user.avatar_path);if(!avatarPath||!fs.existsSync(avatarPath))return error(res,404,'NOT_FOUND','头像不存在');res.sendFile(avatarPath);}catch(e){next(e);}});

  app.get('/api/me/blog-profile', optionalAuth, requireAuth, async(req,res,next)=>{try{const [r]=await query('SELECT id,username,avatar_path,bio,blog_title,blog_slug,social_links,profile_visibility FROM users WHERE id=?',[req.user.id]);const profile=r[0];if(profile)profile.avatar_url=publicAvatarUrl(profile);res.json({profile});}catch(e){next(e);}});
  app.post('/api/me/avatar', optionalAuth, requireAuth, avatarUpload.single('avatar'), async(req,res,next)=>{try{if(!req.file)return error(res,400,'FILE_REQUIRED','请选择 PNG、JPEG、WebP 或 GIF 格式的头像');const [users]=await query('SELECT avatar_path FROM users WHERE id=?',[req.user.id]);const previousPath=resolveAvatarPath(users[0]?.avatar_path);const avatarPath=path.relative(path.dirname(uploadRoot),req.file.path).replace(/\\/g,'/');await query('UPDATE users SET avatar_path=? WHERE id=?',[avatarPath,req.user.id]);if(previousPath&&previousPath!==req.file.path)fs.unlink(previousPath,()=>{});res.status(201).json({avatarUrl:publicAvatarUrl({id:req.user.id,avatar_path:avatarPath})});}catch(e){removeUploadedFile(req.file);next(e);}});
  app.put('/api/me/blog-profile', optionalAuth, requireAuth, async(req,res,next)=>{try{const {bio='',blogTitle='',blogSlug='',socialLinks={},profileVisibility='public'}=req.body;const slug=slugify(blogSlug,`u-${req.user.id}`);if(!/^[a-z0-9-]{3,50}$/.test(slug))return error(res,400,'INVALID_SLUG','主页标识须为 3–50 位小写字母、数字或连字符');if(!['public','private'].includes(profileVisibility))return error(res,400,'INVALID_VISIBILITY','主页可见性无效');const normalizedLinks=normalizeSocialLinks(socialLinks);if(normalizedLinks.message)return error(res,400,'INVALID_SOCIAL_LINK',normalizedLinks.message);const [dup]=await query('SELECT id FROM users WHERE blog_slug=? AND id<>?',[slug,req.user.id]);if(dup.length)return error(res,409,'SLUG_TAKEN','该主页标识已被使用');await query('UPDATE users SET bio=?,blog_title=?,blog_slug=?,social_links=?,profile_visibility=? WHERE id=?',[String(bio).slice(0,1000),String(blogTitle).slice(0,120),slug,JSON.stringify(normalizedLinks.links),profileVisibility,req.user.id]);const [saved]=await query('SELECT id,username,avatar_path,bio,blog_title,blog_slug,social_links,profile_visibility FROM users WHERE id=?',[req.user.id]);if(saved[0])saved[0].avatar_url=publicAvatarUrl(saved[0]);res.json({profile:saved[0]});}catch(e){next(e);}});
  app.get('/api/dashboard/overview',optionalAuth,requireAuth,async(req,res,next)=>{try{const [[stats]]=await query("SELECT COUNT(*) total, SUM(status='draft') drafts, SUM(status='published') published, SUM(view_count) views FROM posts WHERE author_id=?",[req.user.id]);const [recent]=await query('SELECT id,title,status,updated_at FROM posts WHERE author_id=? ORDER BY updated_at DESC LIMIT 5',[req.user.id]);res.json({stats,recent});}catch(e){next(e);}});
  app.get('/api/posts', optionalAuth, requireAuth, async (req, res, next) => { try {
    const pageNumber = Math.min(100, page(req)), offset = (pageNumber - 1) * PAGE_SIZE, params = [req.user.id], conditions = ['author_id=?'];
    if (req.query.status && allowedStatuses.has(req.query.status)) { conditions.push('status=?'); params.push(req.query.status); }
    if (req.query.visibility && allowedVisibilities.has(req.query.visibility)) { conditions.push('visibility=?'); params.push(req.query.visibility); }
    if (req.query.q) { conditions.push('(title LIKE ? OR excerpt LIKE ? OR content_markdown LIKE ?)'); const term = `%${String(req.query.q).slice(0,100)}%`; params.push(term,term,term); }
    const from = `FROM posts WHERE ${conditions.join(' AND ')}`;
    const [[count]] = await query(`SELECT COUNT(*) total ${from}`, params);
    const order = req.query.sort === 'views' ? 'view_count DESC,updated_at DESC' : req.query.sort === 'title' ? 'title ASC,id DESC' : 'updated_at DESC,id DESC';
    const [rows] = await query(`SELECT * ${from} ORDER BY ${order} LIMIT ? OFFSET ?`, [...params, PAGE_SIZE, offset]);
    const cats = await postMeta(rows.map((x) => x.id));
    res.json({ items:rows.map((x) => presentOwnerPost(x,cats)), page:pageNumber, pageSize:PAGE_SIZE, total:Number(count.total || 0) });
  } catch (e) { next(e); } });
  app.post('/api/posts', optionalAuth, requireAuth, async (req, res, next) => {
    let insertedPostId = null;
    try {
      const title = String(req.body.title || '未命名草稿').trim().slice(0, 180);
      let slug = slugify(req.body.slug || title, `post-${Date.now()}`);
      const [taken] = await query('SELECT id FROM posts WHERE slug=?', [slug]);
      if (taken.length) slug = `${slug.slice(0, 145)}-${Date.now().toString(36)}`;
      const wantsBlocks = req.body.contentFormat === 'blocks' || req.body.contentBlocks !== undefined;
      const blocks = wantsBlocks ? canonicalContent.validateBlocks(req.body.contentBlocks || { type:'doc', content:[] }) : null;
      const format = blocks ? 'blocks' : 'markdown';
      const markdown = blocks ? canonicalContent.blocksToMarkdown(blocks) : String(req.body.contentMarkdown || '');
      const html = blocks ? canonicalContent.blocksToSafeHtml(blocks) : canonicalContent.renderMarkdown(markdown);
      const [result] = await query("INSERT INTO posts (author_id,title,slug,excerpt,content_markdown,content_html,content_format,content_blocks,status,visibility,allow_comments,share_token) VALUES (?,?,?,?,?,?,?,?, 'draft','private',TRUE,?)", [req.user.id, title, slug, '', markdown, html, format, blocks ? JSON.stringify(blocks) : null, createShareToken()]);
      insertedPostId = result.insertId;
      if (blocks) await ensureOwnedBlockMedia(blocks, req.user.id, insertedPostId);
      await query("INSERT INTO post_revisions (post_id,editor_id,title,content_markdown,content_format,content_blocks,source) VALUES (?,?,?,?,?,?,'manual')", [insertedPostId, req.user.id, title, markdown, format, blocks ? JSON.stringify(blocks) : null]);
      res.status(201).json({ post: { id: insertedPostId, title, slug, status: 'draft' } });
    } catch (e) {
      if (insertedPostId) await query('DELETE FROM posts WHERE id=? AND author_id=?', [insertedPostId, req.user.id]).catch(() => {});
      next(e);
    }
  });
  app.get('/api/posts/:id',optionalAuth,requireAuth,async(req,res,next)=>{try{const [r]=await query('SELECT * FROM posts WHERE id=? AND author_id=?',[req.params.id,req.user.id]);if(!r[0])return error(res,404,'NOT_FOUND','文章不存在');const [categories]=await query('SELECT c.slug FROM post_categories pc JOIN categories c ON c.id=pc.category_id WHERE pc.post_id=?',[r[0].id]);const [tags]=await query('SELECT t.name FROM post_tags pt JOIN tags t ON t.id=pt.tag_id WHERE pt.post_id=?',[r[0].id]);res.json({post:{...r[0],categorySlugs:categories.map(x=>x.slug),tags:tags.map(x=>x.name)}});}catch(e){next(e);}});
  app.put('/api/posts/:id', optionalAuth, requireAuth, async (req, res, next) => {
    try {
      const [rows] = await query('SELECT * FROM posts WHERE id=? AND author_id=?', [req.params.id, req.user.id]);
      const old = rows[0];
      if (!old) return error(res, 404, 'NOT_FOUND', '文章不存在');
      const title = String(req.body.title ?? old.title).trim().slice(0, 180);
      const format = req.body.contentFormat === 'blocks' || req.body.contentBlocks !== undefined ? 'blocks' : req.body.contentFormat === 'markdown' || req.body.contentMarkdown !== undefined ? 'markdown' : (old.content_format || 'markdown');
      const blocks = format === 'blocks' ? canonicalContent.validateBlocks(req.body.contentBlocks === undefined ? canonicalContent.parseStoredBlocks(old.content_blocks) || { type: 'doc', content: [] } : req.body.contentBlocks) : null;
      if (blocks) await ensureOwnedBlockMedia(blocks, req.user.id, old.id);
      const markdown = format === 'blocks' ? canonicalContent.blocksToMarkdown(blocks) : String(req.body.contentMarkdown ?? old.content_markdown ?? '');
      const html = format === 'blocks' ? canonicalContent.blocksToSafeHtml(blocks) : canonicalContent.renderMarkdown(markdown);
      const visibility = allowedVisibilities.has(req.body.visibility) ? req.body.visibility : old.visibility;
      const status = allowedStatuses.has(req.body.status) ? req.body.status : old.status;
      let slug = slugify(req.body.slug ?? old.slug, old.slug);
      const [duplicate] = await query('SELECT id FROM posts WHERE slug=? AND id<>?', [slug, old.id]);
      if (duplicate.length) return error(res, 409, 'SLUG_TAKEN', '文章链接已被使用');
      let scheduledAt = null;
      if (status === 'scheduled') {
        const rawSchedule = String(req.body.scheduledAt || '');
        if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(rawSchedule)) return error(res, 400, 'SCHEDULE_TIMEZONE_REQUIRED', '定时发布时间必须包含时区');
        const scheduledDate = new Date(rawSchedule);
        if (Number.isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) return error(res, 400, 'INVALID_SCHEDULE', '定时发布时间必须晚于当前时间');
        scheduledAt = scheduledDate;
      }
      const publishedAt = status === 'published' ? (old.published_at || new Date()) : old.published_at;
      const excerpt = String((req.body.excerpt ?? old.excerpt) || '').slice(0, 500);
      const coverImage = req.body.coverImage === undefined ? old.cover_image : (req.body.coverImage || null);
      const coverAlt = String(req.body.coverAltText ?? old.cover_alt_text ?? '').trim().slice(0, 255) || null;
      if (coverImage) await ensureOwnedCover(coverImage, req.user.id);
      await query('UPDATE posts SET title=?,slug=?,excerpt=?,content_markdown=?,content_html=?,content_format=?,content_blocks=?,content_version=content_version+1,content_source=?,cover_image=?,cover_alt_text=?,status=?,visibility=?,allow_comments=?,scheduled_at=?,published_at=? WHERE id=?', [title, slug, excerpt, markdown, html, format, blocks ? JSON.stringify(blocks) : null, req.body.contentSource || 'editor', coverImage, coverAlt, status, visibility, req.body.allowComments ?? old.allow_comments, scheduledAt, publishedAt, old.id]);
      await syncTaxonomy(old.id, req.body.categorySlugs, req.body.tags);
      const revisionSource = status === 'published' ? 'publish' : 'manual';
      await query("INSERT INTO post_revisions (post_id,editor_id,title,content_markdown,content_format,content_blocks,source,content_source) VALUES (?,?,?,?,?,?, ?, ?)", [old.id, req.user.id, title, markdown, format, blocks ? JSON.stringify(blocks) : null, revisionSource, req.body.contentSource || 'editor']);
      res.json({ message: status === 'published' ? '文章已发布' : status === 'scheduled' ? '文章已安排定时发布' : '草稿已保存', status, slug, scheduledAt: scheduledAt ? scheduledAt.toISOString() : null });
    } catch (e) { next(e); }
  });
  app.post('/api/posts/:id/autosave', optionalAuth, requireAuth, async (req, res, next) => {
    try {
      const [rows] = await query('SELECT * FROM posts WHERE id=? AND author_id=?', [req.params.id, req.user.id]);
      const old = rows[0];
      if (!old) return error(res, 404, 'NOT_FOUND', '文章不存在');
      const title = String(req.body.title ?? old.title).trim().slice(0, 180);
      const format = req.body.contentFormat === 'blocks' || req.body.contentBlocks !== undefined ? 'blocks' : 'markdown';
      const blocks = format === 'blocks' ? canonicalContent.validateBlocks(req.body.contentBlocks) : null;
      if (blocks) await ensureOwnedBlockMedia(blocks, req.user.id, old.id);
      const markdown = format === 'blocks' ? canonicalContent.blocksToMarkdown(blocks) : String(req.body.contentMarkdown ?? '');
      const html = format === 'blocks' ? canonicalContent.blocksToSafeHtml(blocks) : canonicalContent.renderMarkdown(markdown);
      await query('UPDATE posts SET title=?,content_markdown=?,content_html=?,content_format=?,content_blocks=?,content_version=content_version+1,content_source=? WHERE id=? AND author_id=?', [title, markdown, html, format, blocks ? JSON.stringify(blocks) : null, req.body.contentSource || 'autosave', old.id, req.user.id]);
      const [recent] = await query("SELECT id FROM post_revisions WHERE post_id=? AND editor_id=? AND source='autosave' AND created_at >= DATE_SUB(NOW(), INTERVAL 2 MINUTE) ORDER BY created_at DESC LIMIT 1", [old.id, req.user.id]);
      const values = [old.id, req.user.id, title, markdown, format, blocks ? JSON.stringify(blocks) : null, req.body.contentSource || 'autosave'];
      if (recent[0]) await query('UPDATE post_revisions SET title=?,content_markdown=?,content_format=?,content_blocks=?,content_version=(SELECT content_version FROM posts WHERE id=?),content_source=? WHERE id=?', [title, markdown, format, blocks ? JSON.stringify(blocks) : null, old.id, req.body.contentSource || 'autosave', recent[0].id]);
      else await query("INSERT INTO post_revisions (post_id,editor_id,title,content_markdown,content_format,content_blocks,source,content_source) VALUES (?,?,?,?,?,?, 'autosave', ?)", values);
      res.json({ savedAt: new Date().toISOString(), status: 'saved' });
    } catch (e) { next(e); }
  });
  app.get('/api/posts/:id/revisions', optionalAuth, requireAuth, async (req, res, next) => {
    try {
      const [rows] = await query('SELECT r.id,r.post_id,r.title,r.content_format,r.content_version,r.source,r.content_source,r.created_at,u.username FROM post_revisions r JOIN users u ON u.id=r.editor_id JOIN posts p ON p.id=r.post_id WHERE r.post_id=? AND p.author_id=? ORDER BY r.created_at DESC LIMIT 100', [req.params.id, req.user.id]);
      res.json({ items: rows });
    } catch (e) { next(e); }
  });
  app.post('/api/posts/:id/revisions/:revisionId/restore', optionalAuth, requireAuth, async (req, res, next) => {
    try {
      const [rows] = await query('SELECT r.* FROM post_revisions r JOIN posts p ON p.id=r.post_id WHERE r.id=? AND r.post_id=? AND p.author_id=?', [req.params.revisionId, req.params.id, req.user.id]);
      const revision = rows[0];
      if (!revision) return error(res, 404, 'NOT_FOUND', '修订不存在');
      const blocks = revision.content_format === 'blocks' ? canonicalContent.validateBlocks(revision.content_blocks) : null;
      const markdown = revision.content_format === 'blocks' ? canonicalContent.blocksToMarkdown(blocks) : revision.content_markdown;
      const html = revision.content_format === 'blocks' ? canonicalContent.blocksToSafeHtml(blocks) : canonicalContent.renderMarkdown(markdown);
      await query('UPDATE posts SET title=?,content_markdown=?,content_html=?,content_format=?,content_blocks=?,content_version=content_version+1,content_source=? WHERE id=? AND author_id=?', [revision.title, markdown, html, revision.content_format, blocks ? JSON.stringify(blocks) : null, 'restore', req.params.id, req.user.id]);
      await query("INSERT INTO post_revisions (post_id,editor_id,title,content_markdown,content_format,content_blocks,source,content_source) VALUES (?,?,?,?,?,?, 'manual', 'restore')", [req.params.id, req.user.id, revision.title, markdown, revision.content_format, blocks ? JSON.stringify(blocks) : null]);
      res.json({ message: '修订已恢复' });
    } catch (e) { next(e); }
  });
  app.delete('/api/posts/:id', optionalAuth, requireAuth, async (req, res, next) => { try {
    const [posts] = await query('SELECT id,status FROM posts WHERE id=? AND author_id=?', [req.params.id, req.user.id]);
    const post = posts[0];
    if (!post) return error(res, 404, 'NOT_FOUND', '文章不存在');
    if (post.status === 'published') return error(res, 409, 'POST_NOT_DELETABLE', '已发布文章不能从此处删除');
    const [media] = await query('SELECT file_path FROM post_media WHERE post_id=? AND owner_id=?', [post.id, req.user.id]);
    await query('DELETE FROM post_media WHERE post_id=? AND owner_id=?', [post.id, req.user.id]);
    await query('DELETE FROM posts WHERE id=? AND author_id=? AND status IN (\'draft\',\'scheduled\')', [post.id, req.user.id]);
    for (const item of media) removeUploadedFile({ path:path.resolve(path.dirname(uploadRoot), String(item.file_path || '').replace(/^[/\\]+/, '')) });
    res.status(204).end();
  } catch (e) { next(e); } });
  app.post('/api/posts/media', optionalAuth, requireAuth, mediaUpload.single('image'), async (req, res, next) => { try {
    if (!req.file) return error(res, 400, 'FILE_REQUIRED', '请选择 PNG、JPEG、WebP 或 GIF 图片');
    const validated = validateUploadedFile(req.file, { allowed: mediaTypes, maxBytes: 10 * 1024 * 1024 });
    const alt = String(req.body.altText || '').trim();
    if (!alt) { removeUploadedFile(req.file); return error(res, 400, 'ALT_REQUIRED', '图片必须提供替代文本'); }
    const rawPostId = String(req.body.postId || '').trim(); let postId = null;
    if (rawPostId) {
      if (!/^\d+$/.test(rawPostId)) { removeUploadedFile(req.file); return error(res, 400, 'INVALID_POST', '文章标识无效'); }
      const [posts] = await query('SELECT id FROM posts WHERE id=? AND author_id=?', [rawPostId, req.user.id]);
      if (!posts[0]) { removeUploadedFile(req.file); return error(res, 403, 'POST_OWNERSHIP_REQUIRED', '只能向自己的文章上传媒体'); }
      postId = posts[0].id;
    }
    const rel = path.relative(path.dirname(uploadRoot), req.file.path).replace(/\\/g, '/');
    const [result] = await query('INSERT INTO post_media (owner_id,post_id,file_path,mime_type,alt_text,media_kind) VALUES (?,?,?,?,?,\'image\')', [req.user.id, postId, rel, validated.detectedMime, alt]);
    res.status(201).json({ media: { id: result.insertId, url: `/api/public/media/${result.insertId}`, altText: alt } });
  } catch (e) { removeUploadedFile(req.file); next(e); } });
  app.post('/api/posts/media/attachment', optionalAuth, requireAuth, (req, res, next) => attachmentUpload.single('media')(req, res, (uploadError) => {
    if (!uploadError) return next();
    removeUploadedFile(req.file);
    return error(res, uploadError.code === 'LIMIT_FILE_SIZE' ? 413 : 400, uploadError.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE' : 'UNSUPPORTED_MEDIA', uploadError.code === 'LIMIT_FILE_SIZE' ? '单个媒体文件不能超过 50 MB' : '请选择受支持的音频、视频或附件');
  }), async (req, res, next) => {
    try {
      if (!req.file) return error(res, 400, 'UNSUPPORTED_MEDIA', '请选择受支持的音频、视频或附件（单个文件不超过 50 MB）');
      const label = String(req.body.label || '').trim().slice(0, 255);
      const rawPostId = String(req.body.postId || '').trim();
      if (!label) { removeUploadedFile(req.file); return error(res, 400, 'LABEL_REQUIRED', '附件必须提供可访问名称'); }
      if (!/^\d+$/.test(rawPostId)) { removeUploadedFile(req.file); return error(res, 400, 'INVALID_POST', '文章标识无效'); }
      const [posts] = await query('SELECT id FROM posts WHERE id=? AND author_id=?', [rawPostId, req.user.id]);
      if (!posts[0]) { removeUploadedFile(req.file); return error(res, 403, 'POST_OWNERSHIP_REQUIRED', '只能向自己的文章上传媒体'); }
      const validated = validateUploadedFile(req.file, { allowed: allowedAttachmentTypes, maxBytes: 50 * 1024 * 1024 });
      const detectedType = validated.detectedMime || inspectAttachment(req.file);
      if (!detectedType || (detectedType !== req.file.mimetype && !(detectedType === 'application/zip' && req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'))) { removeUploadedFile(req.file); return error(res, 400, 'INVALID_MEDIA_CONTENT', '文件内容与声明的媒体类型不一致'); }
      const kind = detectedType.startsWith('audio/') ? 'audio' : detectedType.startsWith('video/') ? 'video' : 'file';
      const rel = path.relative(path.dirname(uploadRoot), req.file.path).replace(/\\/g, '/');
      const [result] = await query('INSERT INTO post_media (owner_id,post_id,file_path,mime_type,alt_text,media_kind,label) VALUES (?,?,?,?,?,?,?)', [req.user.id, posts[0].id, rel, detectedType, label, kind, label]);
      res.status(201).json({ media: { id: result.insertId, url: `/api/public/media/${result.insertId}`, label, kind } });
    } catch (e) { removeUploadedFile(req.file); next(e); }
  });
  app.get('/api/posts/:id/media', optionalAuth, requireAuth, async (req, res, next) => { try {
    const [rows] = await query('SELECT id,media_kind,mime_type,alt_text,label,caption,created_at FROM post_media WHERE post_id=? AND owner_id=? ORDER BY created_at DESC', [req.params.id, req.user.id]);
    res.json({ items: rows.map((media) => ({ ...media, url: `/api/public/media/${media.id}` })) });
  } catch (e) { next(e); } });
  app.delete('/api/posts/media/:mediaId', optionalAuth, requireAuth, async (req, res, next) => { try {
    const [rows] = await query('SELECT id,file_path FROM post_media WHERE id=? AND owner_id=?', [req.params.mediaId, req.user.id]);
    if (!rows[0]) return error(res, 404, 'NOT_FOUND', '媒体不存在');
    await query('DELETE FROM post_media WHERE id=? AND owner_id=?', [req.params.mediaId, req.user.id]);
    removeUploadedFile({ path: path.resolve(uploadRoot, '..', rows[0].file_path.replace(/^[/\\]+/, '')) });
    res.status(204).end();
  } catch (e) { next(e); } });
  app.post('/api/posts/:id/like',optionalAuth,requireAuth,async(req,res,next)=>{try{const post=await loadAccessiblePost(req.params.id,req,res);if(!post)return;const [r]=await query('INSERT IGNORE INTO post_likes (post_id,user_id) VALUES (?,?)',[post.id,req.user.id]);if(r.affectedRows){await query('UPDATE posts SET like_count=like_count+1 WHERE id=?',[post.id]);await createNotification(post.author_id,req.user.id,'like',post.id);}res.json({liked:true});}catch(e){next(e);}});
  app.delete('/api/posts/:id/like',optionalAuth,requireAuth,async(req,res,next)=>{try{const post=await loadAccessiblePost(req.params.id,req,res);if(!post)return;const [r]=await query('DELETE FROM post_likes WHERE post_id=? AND user_id=?',[post.id,req.user.id]);if(r.affectedRows)await query('UPDATE posts SET like_count=GREATEST(0,like_count-1) WHERE id=?',[post.id]);res.json({liked:false});}catch(e){next(e);}});
  app.post('/api/posts/:id/bookmark',optionalAuth,requireAuth,async(req,res,next)=>{try{const post=await loadAccessiblePost(req.params.id,req,res);if(!post)return;if(post.visibility==='unlisted'&&post.author_id!==req.user.id)return error(res,400,'UNLISTED_BOOKMARK_UNSUPPORTED','仅链接文章不支持收藏');const [r]=await query('INSERT IGNORE INTO post_bookmarks (post_id,user_id) VALUES (?,?)',[post.id,req.user.id]);if(r.affectedRows)await query('UPDATE posts SET bookmark_count=bookmark_count+1 WHERE id=?',[post.id]);res.json({bookmarked:true});}catch(e){next(e);}});
  app.delete('/api/posts/:id/bookmark', optionalAuth, requireAuth, async (req, res, next) => { try {
    const post = await loadAccessiblePost(req.params.id, req, res); if (!post) return;
    const [result] = await query('DELETE FROM post_bookmarks WHERE post_id=? AND user_id=?', [post.id, req.user.id]);
    if (result.affectedRows) await query('UPDATE posts SET bookmark_count=GREATEST(0,bookmark_count-1) WHERE id=?', [post.id]);
    res.json({ bookmarked: false });
  } catch (e) { next(e); } });
  app.get('/api/bookmarks',optionalAuth,requireAuth,async(req,res,next)=>{try{const [rows]=await query("SELECT p.*,u.username,u.blog_slug,u.avatar_path FROM post_bookmarks b JOIN posts p ON p.id=b.post_id JOIN users u ON u.id=p.author_id WHERE b.user_id=? AND p.status='published' AND p.visibility<>'unlisted' ORDER BY b.created_at DESC",[req.user.id]);const accessible=[];for(const post of rows){if(await access(post,req.user,null))accessible.push(post);}const cats=await postMeta(accessible.map(x=>x.id));res.json({items:accessible.map(x=>presentPublicPost(x,cats))});}catch(e){next(e);}});
  app.post('/api/users/:slug/follow',optionalAuth,requireAuth,async(req,res,next)=>{try{const [u]=await query('SELECT id FROM users WHERE blog_slug=?',[req.params.slug]);if(!u[0])return error(res,404,'NOT_FOUND','用户不存在');if(u[0].id===req.user.id)return error(res,400,'SELF_FOLLOW','不能关注自己');const [r]=await query('INSERT IGNORE INTO follows (follower_id,following_id) VALUES (?,?)',[req.user.id,u[0].id]);if(r.affectedRows)await createNotification(u[0].id,req.user.id,'follow');res.json({following:true});}catch(e){next(e);}});
  app.delete('/api/users/:slug/follow',optionalAuth,requireAuth,async(req,res,next)=>{try{const [u]=await query('SELECT id FROM users WHERE blog_slug=?',[req.params.slug]);if(!u[0])return error(res,404,'NOT_FOUND','用户不存在');await query('DELETE FROM follows WHERE follower_id=? AND following_id=?',[req.user.id,u[0].id]);res.json({following:false});}catch(e){next(e);}});
  app.get('/api/posts/:id/comments',optionalAuth,async(req,res,next)=>{try{const post=await loadAccessiblePost(req.params.id,req,res);if(!post)return;const [items]=await query("SELECT c.*,u.username,u.blog_slug,u.avatar_path FROM comments c JOIN users u ON u.id=c.author_id WHERE c.post_id=? ORDER BY c.created_at ASC",[post.id]);res.json({items:items.map((item)=>item.deleted_at?{id:item.id,post_id:item.post_id,parent_id:item.parent_id,content:'[评论已删除]',created_at:item.created_at,updated_at:item.updated_at,deleted_at:item.deleted_at,author_id:null,username:'已删除评论',blog_slug:null,avatar_path:null}:{id:item.id,post_id:item.post_id,parent_id:item.parent_id,content:item.content,created_at:item.created_at,updated_at:item.updated_at,deleted_at:null,author_id:item.author_id,username:item.username,blog_slug:item.blog_slug,avatar_path:item.avatar_path})});}catch(e){next(e);}});
  app.post('/api/posts/:id/comments',optionalAuth,requireAuth,async(req,res,next)=>{try{const post=await loadAccessiblePost(req.params.id,req,res);if(!post)return;const content=String(req.body.content||'').trim();if(!content)return error(res,400,'CONTENT_REQUIRED','评论不能为空');if(!post.allow_comments)return error(res,403,'COMMENTS_DISABLED','该文章不允许评论');let parent=null;if(req.body.parentId){const [parents]=await query('SELECT id,parent_id,author_id FROM comments WHERE id=? AND post_id=? AND deleted_at IS NULL',[req.body.parentId,post.id]);if(!parents[0]||parents[0].parent_id)return error(res,400,'INVALID_REPLY','仅支持回复一级评论');parent=parents[0];}const [r]=await query('INSERT INTO comments (post_id,author_id,parent_id,content) VALUES (?,?,?,?)',[post.id,req.user.id,parent?.id||null,content.slice(0,5000)]);await query('UPDATE posts SET comment_count=comment_count+1 WHERE id=?',[post.id]);await createNotification(parent?parent.author_id:post.author_id,req.user.id,parent?'reply':'comment',post.id,r.insertId);res.status(201).json({comment:{id:r.insertId,content,parent_id:parent?.id||null}});}catch(e){next(e);}});
  app.delete('/api/comments/:id',optionalAuth,requireAuth,async(req,res,next)=>{try{const [r]=await query('UPDATE comments SET deleted_at=NOW(),content=\'[评论已删除]\' WHERE id=? AND author_id=? AND deleted_at IS NULL',[req.params.id,req.user.id]);if(!r.affectedRows)return error(res,404,'NOT_FOUND','评论不存在');res.status(204).end();}catch(e){next(e);}});
  app.get('/api/notifications',optionalAuth,requireAuth,async(req,res,next)=>{try{const [items]=await query('SELECT n.*,u.username actor_name,u.blog_slug actor_slug,p.slug post_slug,p.title post_title FROM notifications n LEFT JOIN users u ON u.id=n.actor_id LEFT JOIN posts p ON p.id=n.post_id WHERE n.recipient_id=? ORDER BY n.created_at DESC LIMIT 50',[req.user.id]);res.json({items});}catch(e){next(e);}});
  app.put('/api/notifications/:id/read',optionalAuth,requireAuth,async(req,res,next)=>{try{await query('UPDATE notifications SET is_read=TRUE WHERE id=? AND recipient_id=?',[req.params.id,req.user.id]);res.status(204).end();}catch(e){next(e);}});
  app.post('/api/reports',optionalAuth,requireAuth,async(req,res,next)=>{try{if(!req.body.postId&&!req.body.commentId)return error(res,400,'TARGET_REQUIRED','请选择举报内容');let postId=req.body.postId?Number(req.body.postId):null,commentId=req.body.commentId?Number(req.body.commentId):null;if((req.body.postId&&!Number.isInteger(postId))||(req.body.commentId&&!Number.isInteger(commentId)))return error(res,400,'INVALID_TARGET','举报目标无效');if(commentId){const [comments]=await query('SELECT id,post_id FROM comments WHERE id=?',[commentId]);if(!comments[0])return error(res,404,'NOT_FOUND','评论不存在');if(postId&&postId!==comments[0].post_id)return error(res,400,'TARGET_MISMATCH','评论不属于指定文章');postId=comments[0].post_id;}const post=await loadAccessiblePost(postId,req,res);if(!post)return;const [r]=await query('INSERT INTO reports (reporter_id,post_id,comment_id,reason,details) VALUES (?,?,?,?,?)',[req.user.id,post.id,commentId,String(req.body.reason||'其他').slice(0,80),String(req.body.details||'').slice(0,2000)]);res.status(201).json({report:{id:r.insertId,status:'pending'}});}catch(e){next(e);}});
  app.get('/api/admin/reports',optionalAuth,requireAuth,async(req,res,next)=>{try{if(!isAdmin(req))return error(res,403,'ADMIN_REQUIRED','需要管理员权限');const [items]=await query('SELECT * FROM reports ORDER BY created_at DESC LIMIT 100');res.json({items});}catch(e){next(e);}});
  app.put('/api/admin/reports/:id',optionalAuth,requireAuth,async(req,res,next)=>{try{if(!isAdmin(req))return error(res,403,'ADMIN_REQUIRED','需要管理员权限');const status=['reviewed','dismissed'].includes(req.body.status)?req.body.status:'reviewed';await query('UPDATE reports SET status=?,reviewed_by=?,reviewed_at=NOW() WHERE id=?',[status,req.user.id,req.params.id]);res.status(204).end();}catch(e){next(e);}});
  async function publishDuePosts() {
    if (typeof db.getConnection !== 'function') {
      await query("UPDATE posts SET status='published',published_at=COALESCE(published_at,UTC_TIMESTAMP()),scheduled_at=NULL WHERE status='scheduled' AND scheduled_at IS NOT NULL AND scheduled_at<=UTC_TIMESTAMP()");
      return;
    }
    const connection = await new Promise((resolve, reject) => db.getConnection((connectError, poolConnection) => connectError ? reject(connectError) : resolve(poolConnection)));
    try {
      const [lockRows] = await connection.promise().query("SELECT GET_LOCK('own_web_scheduled_publisher', 0) AS acquired");
      if (!lockRows[0]?.acquired) return;
      await connection.promise().query("UPDATE posts SET status='published',published_at=COALESCE(published_at,UTC_TIMESTAMP()),scheduled_at=NULL WHERE status='scheduled' AND scheduled_at IS NOT NULL AND scheduled_at<=UTC_TIMESTAMP()");
      await connection.promise().query("SELECT RELEASE_LOCK('own_web_scheduled_publisher')");
    } finally { connection.release(); }
  }
  setTimeout(() => publishDuePosts().catch((error) => console.error('[scheduler] startup compensation failed', error)), 0).unref();
  setInterval(() => publishDuePosts().catch((error) => console.error('[scheduler] scheduled publish failed', error)), 60 * 1000).unref();
}
module.exports = { mountBlogRoutes };
