const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { createRateLimiter, imageDimensions, validateUploadedFile } = require('./security');

const REPORT_REASON_CODES = Object.freeze([
  'spam',
  'harassment',
  'hate',
  'sexual',
  'violence',
  'illegal',
  'copyright',
  'privacy',
  'misinformation',
  'other',
]);
const REPORT_STATUSES = Object.freeze(['pending', 'reviewing', 'resolved', 'dismissed']);
const REPORT_TERMINAL_STATUSES = new Set(['resolved', 'dismissed']);
const REPORT_MEDIA_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const REPORT_MEDIA_MAX_COUNT = 3;
const REPORT_MEDIA_MAX_FILE_BYTES = 5 * 1024 * 1024;
const REPORT_MEDIA_MAX_TOTAL_BYTES = 15 * 1024 * 1024;
const REPORT_DETAIL_MAX_LENGTH = 2000;
const REPORT_INTERNAL_NOTE_MAX_LENGTH = 5000;

const legacyReasonCodes = new Map([
  ['垃圾广告', 'spam'],
  ['骚扰 / 辱骂', 'harassment'],
  ['骚扰/辱骂', 'harassment'],
  ['仇恨 / 歧视', 'hate'],
  ['色情 / 不适内容', 'sexual'],
  ['暴力 / 危险行为', 'violence'],
  ['违法内容', 'illegal'],
  ['侵权 / 抄袭', 'copyright'],
  ['隐私泄露', 'privacy'],
  ['虚假 / 误导信息', 'misinformation'],
]);

function parsePositiveId(value) {
  if (value === undefined || value === null || value === '') return null;
  const text = String(value).trim();
  if (!/^\d+$/.test(text)) return null;
  const parsed = Number(text);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseLimit(value, fallback = 20, maximum = 100) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

function parsePage(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 1000) : 1;
}

function parseMediaIds(value) {
  let candidate = value;
  if (typeof candidate === 'string') {
    try { candidate = JSON.parse(candidate); } catch (_) { return null; }
  }
  if (candidate === undefined || candidate === null) return [];
  if (!Array.isArray(candidate) || candidate.length > REPORT_MEDIA_MAX_COUNT) return null;
  const ids = [...new Set(candidate.map(parsePositiveId))];
  return ids.length === candidate.length && ids.every(Boolean) ? ids : null;
}

function normalizeReasonCode(value, legacyReason) {
  const code = String(value || '').trim().toLowerCase();
  if (REPORT_REASON_CODES.includes(code)) return code;
  return legacyReasonCodes.get(String(legacyReason || '').trim()) || 'other';
}

function normalizeText(value, maximum, { required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) return null;
    return '';
  }
  const text = String(value).trim();
  if (required && !text) return null;
  return text.slice(0, maximum);
}

function parseSnapshot(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try { return JSON.parse(String(value)); } catch (_) { return null; }
}

function reportMediaUrl(id) {
  return `/api/public/report-media/${encodeURIComponent(String(id))}`;
}

function reportError(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

function removeFile(filePath, resolveMediaPath) {
  const fullPath = resolveMediaPath(filePath);
  if (fullPath) fs.unlink(fullPath, () => {});
}

function mountReportRoutes(app, {
  db,
  uploadRoot,
  optionalAuth,
  requireAuth,
  error,
  loadAccessiblePost,
  withTransaction,
  resolveMediaPath,
  isAdmin,
}) {
  const query = db.promise().query.bind(db.promise());
  const reportUserRateLimit = createRateLimiter({
    windowMs: 10 * 60 * 1000,
    limit: 10,
    key: (req) => `report-user:${req.user?.id || 'anonymous'}`,
    message: '举报提交过于频繁，请稍后重试',
  });
  const reportIpRateLimit = createRateLimiter({
    windowMs: 10 * 60 * 1000,
    limit: 30,
    key: (req) => `report-ip:${req.ip || 'unknown'}`,
    message: '举报请求过于频繁，请稍后重试',
  });
  const mediaUserRateLimit = createRateLimiter({
    windowMs: 10 * 60 * 1000,
    limit: 20,
    key: (req) => `report-media-user:${req.user?.id || 'anonymous'}`,
    message: '举报证据上传过于频繁，请稍后重试',
  });
  const mediaIpRateLimit = createRateLimiter({
    windowMs: 10 * 60 * 1000,
    limit: 40,
    key: (req) => `report-media-ip:${req.ip || 'unknown'}`,
    message: '举报证据上传过于频繁，请稍后重试',
  });
  const reportStorage = multer.diskStorage({
    destination(req, _file, callback) {
      const directory = path.join(uploadRoot, 'reports', String(req.user.id));
      fs.mkdirSync(directory, { recursive: true });
      callback(null, directory);
    },
    filename(_req, file, callback) {
      const extensions = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' };
      callback(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extensions[String(file.mimetype).toLowerCase()] || '.bin'}`);
    },
  });
  const reportUpload = multer({
    storage: reportStorage,
    limits: { fileSize: REPORT_MEDIA_MAX_FILE_BYTES, files: REPORT_MEDIA_MAX_COUNT },
    fileFilter(_req, file, callback) {
      const field = String(file.fieldname || '');
      const type = String(file.mimetype || '').toLowerCase();
      if (!['images', 'media', 'evidence'].includes(field) || !REPORT_MEDIA_TYPES.has(type) || path.extname(file.originalname || '').toLowerCase() === '.svg') {
        return callback(reportError(400, 'UNSUPPORTED_MEDIA', '证据图片仅支持 PNG、JPEG 或 WebP'));
      }
      return callback(null, true);
    },
  });

  async function cleanupExpiredMedia() {
    const [expired] = await query('SELECT id,file_path FROM report_media WHERE report_id IS NULL AND expires_at IS NOT NULL AND expires_at < UTC_TIMESTAMP()');
    if (!expired.length) return;
    await query('DELETE FROM report_media WHERE report_id IS NULL AND expires_at IS NOT NULL AND expires_at < UTC_TIMESTAMP()');
    expired.forEach((item) => removeFile(item.file_path, resolveMediaPath));
  }

  async function mediaForReports(reportIds) {
    if (!reportIds.length) return new Map();
    const marks = reportIds.map(() => '?').join(',');
    const [rows] = await query(`SELECT id,report_id,mime_type,file_size,width,height,created_at FROM report_media WHERE report_id IN (${marks}) ORDER BY created_at ASC,id ASC`, reportIds);
    const media = new Map(reportIds.map((id) => [Number(id), []]));
    rows.forEach((row) => media.get(Number(row.report_id)).push({
      id: Number(row.id),
      url: reportMediaUrl(row.id),
      mime_type: row.mime_type,
      file_size: Number(row.file_size || 0),
      width: Number(row.width || 0),
      height: Number(row.height || 0),
      created_at: row.created_at,
    }));
    return media;
  }

  function presentReport(row, { admin = false, media = [] } = {}) {
    const snapshot = parseSnapshot(row.target_snapshot);
    const targetType = snapshot?.target_type || (row.comment_id == null ? 'post' : 'comment');
    const report = {
      id: Number(row.id),
      post_id: row.post_id == null ? null : Number(row.post_id),
      comment_id: row.comment_id == null ? null : Number(row.comment_id),
      target_type: targetType,
      reason_code: row.reason_code || normalizeReasonCode(null, row.reason),
      reason: row.reason,
      details: row.details || '',
      status: row.status === 'reviewed' ? 'resolved' : row.status,
      public_response: row.public_response || null,
      target_snapshot: snapshot,
      media,
      created_at: row.created_at,
      reviewed_at: row.reviewed_at || null,
      resolved_at: row.resolved_at || null,
      post_title: row.post_title || snapshot?.post_title || null,
      post_slug: row.post_slug || snapshot?.post_slug || null,
      reporter_name: row.reporter_name || undefined,
      target_author_name: row.target_author_name || undefined,
    };
    if (!admin) {
      delete report.reporter_name;
      delete report.target_author_name;
    } else {
      report.reporter_id = Number(row.reporter_id);
      report.target_author_id = row.target_author_id == null ? null : Number(row.target_author_id);
      report.internal_note = row.internal_note || '';
      report.reviewed_by = row.reviewed_by == null ? null : Number(row.reviewed_by);
      report.current_comment_content = row.current_comment_content || null;
      report.current_post_title = row.current_post_title || null;
      if (row.post_slug) report.current_content_url = `/posts/${encodeURIComponent(String(row.post_slug))}`;
    }
    return report;
  }

  async function listReports({ admin, userId, status, page, limit }) {
    const conditions = [];
    const params = [];
    if (!admin) { conditions.push('r.reporter_id=?'); params.push(userId); }
    if (status) { conditions.push('r.status=?'); params.push(status === 'reviewed' ? 'resolved' : status); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;
    const [[count]] = await query(`SELECT COUNT(*) total FROM reports r ${where}`, params);
    const [rows] = await query(`
      SELECT r.*, p.title post_title, p.slug post_slug,
        ru.username reporter_name,
        COALESCE(p.author_id, c.author_id) target_author_id,
        COALESCE(pu.username, cu.username) target_author_name,
        c.content current_comment_content,
        p.title current_post_title
      FROM reports r
      LEFT JOIN posts p ON p.id=r.post_id
      LEFT JOIN comments c ON c.id=r.comment_id
      LEFT JOIN users ru ON ru.id=r.reporter_id
      LEFT JOIN users pu ON pu.id=p.author_id
      LEFT JOIN users cu ON cu.id=c.author_id
      ${where}
      ORDER BY r.created_at DESC,r.id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    const media = await mediaForReports(rows.map((row) => row.id));
    return {
      items: rows.map((row) => presentReport(row, { admin, media: media.get(Number(row.id)) || [] })),
      page,
      limit,
      pageSize: limit,
      total: Number(count.total || 0),
    };
  }

  async function loadReport(id, { admin, userId }, res) {
    const reportId = parsePositiveId(id);
    if (!reportId) { error(res, 404, 'NOT_FOUND', '举报不存在'); return null; }
    const conditions = admin ? 'r.id=?' : 'r.id=? AND r.reporter_id=?';
    const params = admin ? [reportId] : [reportId, userId];
    const [rows] = await query(`
      SELECT r.*, p.title post_title, p.slug post_slug,
        ru.username reporter_name,
        COALESCE(p.author_id, c.author_id) target_author_id,
        COALESCE(pu.username, cu.username) target_author_name,
        c.content current_comment_content,
        p.title current_post_title
      FROM reports r
      LEFT JOIN posts p ON p.id=r.post_id
      LEFT JOIN comments c ON c.id=r.comment_id
      LEFT JOIN users ru ON ru.id=r.reporter_id
      LEFT JOIN users pu ON pu.id=p.author_id
      LEFT JOIN users cu ON cu.id=c.author_id
      WHERE ${conditions}`, params);
    if (!rows[0]) { error(res, 404, 'NOT_FOUND', '举报不存在'); return null; }
    const media = await mediaForReports([rows[0].id]);
    return presentReport(rows[0], { admin, media: media.get(Number(rows[0].id)) || [] });
  }

  async function resolveTarget(req, res) {
    const rawPostId = req.body.postId ?? req.body.post_id;
    const rawCommentId = req.body.commentId ?? req.body.comment_id;
    const hasPost = rawPostId !== undefined && rawPostId !== null && rawPostId !== '';
    const hasComment = rawCommentId !== undefined && rawCommentId !== null && rawCommentId !== '';
    if (!hasPost && !hasComment) { error(res, 400, 'TARGET_REQUIRED', '请选择举报内容'); return null; }
    let postId = hasPost ? parsePositiveId(rawPostId) : null;
    const commentId = hasComment ? parsePositiveId(rawCommentId) : null;
    if ((hasPost && !postId) || (hasComment && !commentId)) { error(res, 400, 'INVALID_TARGET', '举报目标无效'); return null; }

    let comment = null;
    if (commentId) {
      const [comments] = await query(`
        SELECT c.id,c.post_id,c.author_id,c.content,c.created_at,c.deleted_at,u.username,u.deleted_at author_deleted_at
        FROM comments c LEFT JOIN users u ON u.id=c.author_id WHERE c.id=?`, [commentId]);
      comment = comments[0];
      if (!comment || comment.deleted_at) { error(res, 404, 'NOT_FOUND', '评论不存在'); return null; }
      if (postId && postId !== Number(comment.post_id)) { error(res, 400, 'TARGET_MISMATCH', '评论不属于指定文章'); return null; }
      postId = Number(comment.post_id);
    }
    const post = await loadAccessiblePost(postId, req, res);
    if (!post) return null;
    const [authors] = await query('SELECT id,username,deleted_at FROM users WHERE id=?', [post.author_id]);
    const author = authors[0];
    const reportedAt = new Date().toISOString();
    const snapshot = {
      target_type: comment ? 'comment' : 'post',
      target_id: comment ? Number(comment.id) : Number(post.id),
      post_id: Number(post.id),
      post_title: String(post.title || '').slice(0, 180),
      post_slug: String(post.slug || '').slice(0, 180),
      author_id: Number(post.author_id),
      author_name: author?.deleted_at ? '已删除用户' : (author?.username || '已删除用户'),
      reported_at: reportedAt,
    };
    if (comment) {
      snapshot.comment_id = Number(comment.id);
      snapshot.comment_author_id = Number(comment.author_id);
      snapshot.comment_author_name = comment.author_deleted_at ? '已删除用户' : (comment.username || '已删除用户');
      snapshot.comment_excerpt = String(comment.content || '').slice(0, 500);
      snapshot.comment_created_at = comment.created_at;
    }
    return { post, comment, snapshot };
  }

  async function uploadReportMedia(req, res, next) {
    await cleanupExpiredMedia();
    const files = Object.values(req.files || {}).flat().filter(Boolean);
    if (!files.length) return error(res, 400, 'FILE_REQUIRED', '请选择 PNG、JPEG 或 WebP 证据图片');
    if (files.length > REPORT_MEDIA_MAX_COUNT) { files.forEach((file) => removeFile(file.path, resolveMediaPath)); return error(res, 400, 'MEDIA_COUNT_LIMIT', '每个举报最多上传 3 张图片'); }
    const [pending] = await query('SELECT COUNT(*) count,COALESCE(SUM(file_size),0) total FROM report_media WHERE owner_id=? AND report_id IS NULL', [req.user.id]);
    const incomingTotal = files.reduce((sum, file) => sum + Number(file.size || 0), 0);
    if (Number(pending.count) + files.length > REPORT_MEDIA_MAX_COUNT || Number(pending.total) + incomingTotal > REPORT_MEDIA_MAX_TOTAL_BYTES) {
      files.forEach((file) => removeFile(file.path, resolveMediaPath));
      return error(res, 400, 'MEDIA_LIMIT', '待提交举报证据最多 3 张且总大小不超过 15 MB');
    }
    const validated = [];
    try {
      for (const file of files) {
        const checked = validateUploadedFile(file, { allowed: REPORT_MEDIA_TYPES, maxBytes: REPORT_MEDIA_MAX_FILE_BYTES });
        const dimensions = imageDimensions(file.path);
        if (!dimensions?.width || !dimensions?.height) throw reportError(400, 'FILE_DIMENSIONS_INVALID', '证据图片尺寸无效');
        validated.push({ file, checked, dimensions });
      }
      const saved = await withTransaction(async (tx) => {
        const items = [];
        for (const { file, checked, dimensions } of validated) {
          const relative = path.relative(path.dirname(uploadRoot), file.path).replace(/\\/g, '/');
          const [result] = await tx.query(`INSERT INTO report_media (owner_id,report_id,file_path,mime_type,file_size,width,height,expires_at)
            VALUES (?,?, ?,?,?,?,?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 1 HOUR))`, [req.user.id, null, relative, checked.detectedMime, checked.size, dimensions.width, dimensions.height]);
          items.push({ id: Number(result.insertId), url: reportMediaUrl(result.insertId), mime_type: checked.detectedMime, file_size: checked.size, width: dimensions.width, height: dimensions.height });
        }
        return items;
      });
      return res.status(201).json({ items: saved });
    } catch (uploadError) {
      files.forEach((file) => removeFile(file.path, resolveMediaPath));
      return next(uploadError);
    }
  }

  function parseReportUpload(req, res, next) {
    return reportUpload.any()(req, res, (uploadError) => {
      if (!uploadError) return next();
      Object.values(req.files || {}).flat().filter(Boolean).forEach((file) => removeFile(file.path, resolveMediaPath));
      return next(uploadError);
    });
  }

  app.post('/api/reports/media', optionalAuth, requireAuth, mediaUserRateLimit, mediaIpRateLimit, parseReportUpload, uploadReportMedia);
  app.post('/api/report-media', optionalAuth, requireAuth, mediaUserRateLimit, mediaIpRateLimit, parseReportUpload, uploadReportMedia);

  app.delete(['/api/report-media/:id', '/api/reports/media/:id'], optionalAuth, requireAuth, async (req, res, next) => {
    try {
      const id = parsePositiveId(req.params.id);
      if (!id) return error(res, 404, 'NOT_FOUND', '证据图片不存在');
      const [rows] = await query('SELECT id,file_path FROM report_media WHERE id=? AND owner_id=? AND report_id IS NULL', [id, req.user.id]);
      if (!rows[0]) return error(res, 404, 'NOT_FOUND', '证据图片不存在');
      await query('DELETE FROM report_media WHERE id=? AND owner_id=? AND report_id IS NULL', [id, req.user.id]);
      removeFile(rows[0].file_path, resolveMediaPath);
      return res.status(204).end();
    } catch (requestError) { return next(requestError); }
  });

  app.post('/api/reports', optionalAuth, requireAuth, reportUserRateLimit, reportIpRateLimit, async (req, res, next) => {
    try {
      const target = await resolveTarget(req, res);
      if (!target) return;
      const hasReasonCode = req.body.reason_code !== undefined || req.body.reasonCode !== undefined;
      const rawReasonCode = String(req.body.reason_code ?? req.body.reasonCode ?? '').trim().toLowerCase();
      if (hasReasonCode && !REPORT_REASON_CODES.includes(rawReasonCode)) return error(res, 400, 'INVALID_REASON_CODE', '举报类型无效');
      const reasonCode = normalizeReasonCode(req.body.reason_code ?? req.body.reasonCode, req.body.reason);
      const legacyReason = normalizeText(req.body.reason ?? reasonCode, 80);
      if (req.body.details !== undefined && String(req.body.details || '').trim().length > REPORT_DETAIL_MAX_LENGTH) return error(res, 400, 'DETAILS_TOO_LONG', '详细说明不能超过 2000 个字符');
      const details = normalizeText(req.body.details, REPORT_DETAIL_MAX_LENGTH);
      // Old clients only sent `reason`; keep that contract permissive. The
      // required description rule applies to the new explicit `other` code.
      if (hasReasonCode && reasonCode === 'other' && !details) return error(res, 400, 'DETAILS_REQUIRED', '选择其他时请填写详细说明');
      const mediaIds = parseMediaIds(req.body.mediaIds ?? req.body.media_ids ?? req.body.media);
      if (mediaIds === null) return error(res, 400, 'INVALID_MEDIA', '证据图片标识无效');
      const reportId = await withTransaction(async (tx) => {
        const targetCondition = target.comment ? 'comment_id=?' : 'post_id=? AND comment_id IS NULL';
        const targetId = target.comment ? target.comment.id : target.post.id;
        const [duplicates] = await tx.query(`SELECT id FROM reports WHERE reporter_id=? AND ${targetCondition} AND status IN ('pending','reviewing') LIMIT 1 FOR UPDATE`, [req.user.id, targetId]);
        if (duplicates[0]) throw reportError(409, 'DUPLICATE_REPORT', '你已经提交过该内容的待处理举报');
        if (mediaIds.length) {
          const marks = mediaIds.map(() => '?').join(',');
          const [media] = await tx.query(`SELECT id,file_size FROM report_media WHERE owner_id=? AND report_id IS NULL AND (expires_at IS NULL OR expires_at>=UTC_TIMESTAMP()) AND id IN (${marks}) FOR UPDATE`, [req.user.id, ...mediaIds]);
          if (media.length !== mediaIds.length || media.reduce((sum, item) => sum + Number(item.file_size || 0), 0) > REPORT_MEDIA_MAX_TOTAL_BYTES) throw reportError(403, 'MEDIA_OWNERSHIP_REQUIRED', '证据图片不属于当前用户或已过期');
        }
        const [inserted] = await tx.query(`INSERT INTO reports
          (reporter_id,post_id,comment_id,reason,reason_code,details,status,target_snapshot)
          VALUES (?,?,?,?,?,?, 'pending', ?)`, [req.user.id, target.post.id, target.comment?.id || null, legacyReason || reasonCode, reasonCode, details || null, JSON.stringify(target.snapshot)]);
        const insertedId = Number(inserted.insertId);
        if (mediaIds.length) {
          const marks = mediaIds.map(() => '?').join(',');
          await tx.query(`UPDATE report_media SET report_id=?,expires_at=NULL WHERE owner_id=? AND report_id IS NULL AND id IN (${marks})`, [insertedId, req.user.id, ...mediaIds]);
        }
        return insertedId;
      });
      const report = await loadReport(reportId, { admin: false, userId: req.user.id }, res);
      return res.status(201).json({ report });
    } catch (requestError) { return next(requestError); }
  });

  app.get('/api/reports', optionalAuth, requireAuth, async (req, res, next) => {
    try { return res.json(await listReports({ admin: false, userId: req.user.id, page: parsePage(req.query.page), limit: parseLimit(req.query.limit) })); } catch (requestError) { return next(requestError); }
  });
  app.get('/api/reports/:id', optionalAuth, requireAuth, async (req, res, next) => {
    try {
      const report = await loadReport(req.params.id, { admin: false, userId: req.user.id }, res);
      return report ? res.json({ report }) : undefined;
    } catch (requestError) { return next(requestError); }
  });

  app.get(['/api/public/report-media/:id', '/api/report-media/:id'], optionalAuth, async (req, res, next) => {
    try {
      const id = parsePositiveId(req.params.id);
      if (!id) return error(res, 404, 'NOT_FOUND', '证据图片不存在');
      const [rows] = await query('SELECT rm.*,r.reporter_id FROM report_media rm LEFT JOIN reports r ON r.id=rm.report_id WHERE rm.id=?', [id]);
      const media = rows[0];
      if (!media) return error(res, 404, 'NOT_FOUND', '证据图片不存在');
      const authorized = req.user && (Number(media.owner_id) === Number(req.user.id) || (media.report_id && isAdmin(req)));
      if (!authorized || (media.report_id == null && media.expires_at && new Date(media.expires_at).getTime() < Date.now())) return error(res, 404, 'NOT_FOUND', '证据图片不存在');
      const fullPath = resolveMediaPath(media.file_path);
      if (!fullPath || !fs.existsSync(fullPath)) return error(res, 404, 'NOT_FOUND', '证据图片不存在');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Type', media.mime_type);
      res.setHeader('Content-Disposition', 'inline');
      return res.sendFile(fullPath);
    } catch (requestError) { return next(requestError); }
  });

  app.get('/api/admin/reports', optionalAuth, requireAuth, async (req, res, next) => {
    try {
      if (!isAdmin(req)) return error(res, 403, 'ADMIN_REQUIRED', '需要管理员权限');
      const status = req.query.status ? String(req.query.status) : null;
      if (status && !REPORT_STATUSES.includes(status) && status !== 'reviewed') return error(res, 400, 'INVALID_STATUS', '举报状态无效');
      return res.json(await listReports({ admin: true, status, page: parsePage(req.query.page), limit: parseLimit(req.query.limit) }));
    } catch (requestError) { return next(requestError); }
  });
  app.get('/api/admin/reports/:id', optionalAuth, requireAuth, async (req, res, next) => {
    try {
      if (!isAdmin(req)) return error(res, 403, 'ADMIN_REQUIRED', '需要管理员权限');
      const report = await loadReport(req.params.id, { admin: true, userId: req.user.id }, res);
      return report ? res.json({ report }) : undefined;
    } catch (requestError) { return next(requestError); }
  });
  app.put('/api/admin/reports/:id', optionalAuth, requireAuth, async (req, res, next) => {
    try {
      if (!isAdmin(req)) return error(res, 403, 'ADMIN_REQUIRED', '需要管理员权限');
      const reportId = parsePositiveId(req.params.id);
      if (!reportId) return error(res, 404, 'NOT_FOUND', '举报不存在');
      const requestedStatus = String(req.body.status || 'reviewed').toLowerCase();
      const legacyStatus = requestedStatus === 'reviewed' || requestedStatus === 'dismissed';
      const status = requestedStatus === 'reviewed' ? 'resolved' : requestedStatus;
      if (!REPORT_STATUSES.includes(status)) return error(res, 400, 'INVALID_STATUS', '举报状态无效');
      const publicResponseInput = req.body.public_response ?? req.body.publicResponse;
      const internalNoteInput = req.body.internal_note ?? req.body.internalNote;
      const result = await withTransaction(async (tx) => {
        const [rows] = await tx.query('SELECT * FROM reports WHERE id=? FOR UPDATE', [reportId]);
        const current = rows[0];
        if (!current) throw reportError(404, 'NOT_FOUND', '举报不存在');
        const publicResponse = publicResponseInput === undefined ? (current.public_response || '') : normalizeText(publicResponseInput, REPORT_DETAIL_MAX_LENGTH);
        const internalNote = internalNoteInput === undefined ? (current.internal_note || '') : normalizeText(internalNoteInput, REPORT_INTERNAL_NOTE_MAX_LENGTH);
        if (REPORT_TERMINAL_STATUSES.has(status) && !publicResponse && !legacyStatus) throw reportError(400, 'PUBLIC_RESPONSE_REQUIRED', '处理举报时必须填写用户可见说明');
        const wasTerminal = REPORT_TERMINAL_STATUSES.has(current.status);
        await tx.query(`UPDATE reports SET status=?, reviewed_by=?, reviewed_at=?, resolved_at=?, public_response=?, internal_note=? WHERE id=?`, [
          status,
          status === 'pending' ? null : req.user.id,
          status === 'pending' ? null : (current.reviewed_at || new Date()),
          REPORT_TERMINAL_STATUSES.has(status) ? (current.resolved_at || new Date()) : null,
          publicResponse || null,
          internalNote || null,
          reportId,
        ]);
        if (REPORT_TERMINAL_STATUSES.has(status) && (!wasTerminal || current.status !== status)) {
          await tx.query(`INSERT INTO notifications (recipient_id,actor_id,type,post_id,comment_id,report_id) VALUES (?,?,?,?,?,?)`, [current.reporter_id, req.user.id, 'report_update', current.post_id, current.comment_id, reportId]);
        }
        return true;
      });
      if (!result) return error(res, 404, 'NOT_FOUND', '举报不存在');
      const report = await loadReport(reportId, { admin: true, userId: req.user.id }, res);
      return res.json({ report });
    } catch (requestError) { return next(requestError); }
  });
}

module.exports = {
  REPORT_REASON_CODES,
  REPORT_STATUSES,
  REPORT_MEDIA_TYPES,
  REPORT_MEDIA_MAX_COUNT,
  REPORT_MEDIA_MAX_FILE_BYTES,
  REPORT_MEDIA_MAX_TOTAL_BYTES,
  parsePositiveId,
  normalizeReasonCode,
  reportMediaUrl,
  mountReportRoutes,
};
