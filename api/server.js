
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const express = require('express');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const mime = require('mime-types');
const { imageSize } = require('image-size');
const mm = require('music-metadata');
const { runMigrations } = require('./migrations');
const { mountBlogRoutes } = require('./blog');
const { sendError, createRateLimiter, originGuard, imageDimensions, validateUploadedFile } = require('./lib/security');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const requiredEnv = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'AUTH_SECRET'];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(`[config] Missing required environment variables: ${missingEnv.join(', ')}`);
  process.exit(1);
}

const app = express();
// API 返回的是会话相关或用户私有数据，不应被浏览器或代理复用。
app.disable('etag');
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
const PORT = Number(process.env.PORT || 3000);
const DB_PORT = Number(process.env.DB_PORT || 3306);
const UPLOAD_ROOT = path.resolve(__dirname, 'uploads');
const AUTH_COOKIE_NAME = 'own_web_session';
const AUTH_EXPIRES_IN = process.env.AUTH_EXPIRES_IN || '7d';
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// Keep the security baseline explicit and reviewable without introducing a second
// framework layer. The policy is intentionally conservative for a personal blog.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data: blob:; media-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' http://localhost:3000 http://127.0.0.1:3000");
  next();
});

function resolveStoredFile(storedPath) {
  const normalizedPath = String(storedPath || '').replace(/^[/\\]+/, '');
  const resolvedPath = path.resolve(__dirname, normalizedPath);
  if (resolvedPath !== UPLOAD_ROOT && !resolvedPath.startsWith(`${UPLOAD_ROOT}${path.sep}`)) {
    return null;
  }
  return resolvedPath;
}

function safePathSegment(value, fallback = 'unknown') {
  const segment = String(value ?? '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  return segment || fallback;
}

function normalizeMediaBatchIds(value, maximum = 100) {
  if (!Array.isArray(value) || value.length === 0 || value.length > maximum) return null;
  const ids = [...new Set(value.map((item) => Number(item)))];
  return ids.length > 0 && ids.every((id) => Number.isSafeInteger(id) && id > 0) ? ids : null;
}

function removeStoredMediaFiles(records, label) {
  let cleanupFailed = false;
  for (const record of records) {
    const fullPath = resolveStoredFile(record.file_path);
    if (!fullPath || !fs.existsSync(fullPath)) continue;
    try {
      fs.unlinkSync(fullPath);
    } catch (error) {
      cleanupFailed = true;
      console.error(`[media] Failed to remove ${label} file after database deletion`, error);
    }
  }
  return cleanupFailed;
}

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origin is not allowed by CORS'));
  },
  credentials: true
}));
app.use('/api', originGuard(allowedOrigins));
const authRateLimitScale = process.env.NODE_ENV === 'test' ? Number(process.env.TEST_AUTH_RATE_LIMIT_SCALE || 10) : 1;
app.use('/api/login', createRateLimiter({ windowMs: 15 * 60 * 1000, limit: 20 * authRateLimitScale, message: '登录尝试过于频繁，请稍后重试' }));
app.use('/api/register', createRateLimiter({ windowMs: 60 * 60 * 1000, limit: 10 * authRateLimitScale, message: '注册请求过于频繁，请稍后重试' }));
app.use('/api/reports', createRateLimiter({ windowMs: 10 * 60 * 1000, limit: 15 }));
app.use(bodyParser.json({ limit: '3mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '3mb' }));

app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

function parseCookies(cookieHeader = '') {
  return cookieHeader.split(';').reduce((cookies, item) => {
    const separatorIndex = item.indexOf('=');
    if (separatorIndex === -1) return cookies;
    const key = item.slice(0, separatorIndex).trim();
    const value = item.slice(separatorIndex + 1).trim();
    cookies[key] = decodeURIComponent(value);
    return cookies;
  }, {});
}

function createAuthToken(user) {
  return jwt.sign(
    { sub: String(user.id), email: user.email, sv: Number(user.session_version || 0) },
    process.env.AUTH_SECRET,
    { expiresIn: AUTH_EXPIRES_IN }
  );
}

function durationToSeconds(value) {
  const match = String(value).match(/^(\d+)([smhd])$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
  return amount * multipliers[match[2].toLowerCase()];
}

function setAuthCookie(res, user) {
  const secure = process.env.NODE_ENV === 'production';
  const attributes = ['HttpOnly', 'Path=/', 'SameSite=Lax'];
  const maxAge = durationToSeconds(AUTH_EXPIRES_IN);
  if (maxAge) attributes.push(`Max-Age=${maxAge}`);
  if (secure) attributes.push('Secure');
  res.setHeader(
    'Set-Cookie',
    `${AUTH_COOKIE_NAME}=${encodeURIComponent(createAuthToken(user))}; ${attributes.join('; ')}`
  );
}

function clearAuthCookie(res) {
  res.setHeader(
    'Set-Cookie',
    `${AUTH_COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`
  );
}

function getAuthToken(req) {
  const cookies = parseCookies(req.headers.cookie);
  if (cookies[AUTH_COOKIE_NAME]) return cookies[AUTH_COOKIE_NAME];

  const authorization = req.headers.authorization || '';
  if (authorization.startsWith('Bearer ')) return authorization.slice(7);
  return null;
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function validatePassword(value) {
  const password = String(value || '');
  if (password.length < 10 || password.length > 128) return '密码长度必须为 10–128 位';
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) return '密码需同时包含大小写字母和数字';
  return null;
}

function requireAuth(req, res, next) {
  const token = getAuthToken(req);
  if (!token) return res.status(401).json({ error: { code: 'AUTH_REQUIRED', message: '请先登录' } });

  try {
    const payload = jwt.verify(token, process.env.AUTH_SECRET);
    req.user = { id: Number(payload.sub), email: payload.email };
    return db.promise().query('SELECT id,email,session_version FROM users WHERE id=?', [req.user.id])
      .then(([rows]) => {
        const user = rows[0];
        if (!user || Number(payload.sv || 0) !== Number(user.session_version || 0)) return res.status(401).json({ error: { code: 'SESSION_REVOKED', message: '登录状态已失效，请重新登录' } });
        req.user.email = user.email;
        return next();
      })
      .catch(() => res.status(503).json({ error: { code: 'AUTH_UNAVAILABLE', message: '认证服务暂时不可用' } }));
  } catch (error) {
    return res.status(401).json({ error: { code: 'AUTH_REQUIRED', message: '登录状态已失效，请重新登录' } });
  }
}

function findRequestedUserIds(req) {
  const values = [
    req.params.userId,
    req.query.userId,
    req.body && req.body.userId,
    req.body && req.body.senderId,
    req.headers['x-user-id']
  ];
  return values
    .filter((value) => value !== undefined && value !== null && value !== '')
    .map((value) => String(value));
}

function authenticatedApiRequest(req, res, next) {
  if (req.method === 'OPTIONS' || req.path === '/login' || req.path === '/register' || req.path === '/health') {
    return next();
  }

  return requireAuth(req, res, () => {
    const requestedUserIds = findRequestedUserIds(req);
    if (requestedUserIds.some((id) => id !== String(req.user.id))) {
      return sendError(res, 403, 'OWNER_REQUIRED', '无权访问其他用户的数据');
    }
    req.authUserId = req.user.id;
    return next();
  });
}

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// MySQL pool: every request gets a short-lived connection and the pool can
// recover from a dropped connection without leaking a singleton socket.
const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  timezone: 'Z',
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL_SIZE || 10),
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// 博客路由在旧的全局鉴权前注册：公开读取接口自行做可选会话识别，
// 写入接口则明确使用 requireAuth。旧接口仍由下方的全局中间件保护。
mountBlogRoutes(app, db, {
  getAuthToken,
  authSecret: process.env.AUTH_SECRET,
  uploadRoot: UPLOAD_ROOT
});
app.use('/api', authenticatedApiRequest);

// Database initialization is awaited before the HTTP listener is opened. This
// prevents requests from seeing a partially migrated schema after a restart.
const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50),
      email VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      birthday DATE,
      hobbies TEXT,
      occupation VARCHAR(50),
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `;
const createCategoriesTable = `
    CREATE TABLE IF NOT EXISTS learning_categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      name VARCHAR(50) NOT NULL,
      sort_order INT DEFAULT 0,
      is_default BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE KEY unique_category_per_user (user_id, name)
    )
  `;
const createFilesTable = `
    CREATE TABLE IF NOT EXISTS learning_files (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      category_id INT NOT NULL,
      filename VARCHAR(255) NOT NULL,
      original_name VARCHAR(255) NOT NULL,
      file_type VARCHAR(50) NOT NULL,
      file_size BIGINT,
      file_path VARCHAR(500) NOT NULL,
      markdown_content TEXT,
      is_markdown BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES learning_categories(id) ON DELETE CASCADE
    )
  `;
const createEmailsTable = `
    CREATE TABLE IF NOT EXISTS learning_emails (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sender_id INT NOT NULL,
      sender_email VARCHAR(100) NOT NULL,
      sender_name VARCHAR(50),
      recipient_email VARCHAR(100) NOT NULL,
      subject VARCHAR(255) NOT NULL,
      content TEXT,
      attachments JSON,
      is_read BOOLEAN DEFAULT FALSE,
      has_attachments BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_recipient (recipient_email),
      INDEX idx_created (created_at)
    )
  `;

async function initializeDatabase() {
  await db.promise().query(createUsersTable);
  // Media tables must exist before migrations inspect them on a fresh test or
  // production database.
  await db.promise().query(createImagesTable);
  await db.promise().query(createVideosTable);
  await db.promise().query(createMusicTable);
  await runMigrations(db);
  await db.promise().query(createCategoriesTable);
  await db.promise().query(createFilesTable);
  await db.promise().query(createEmailsTable);
  const defaultCategories = ['数学', '物理', '天文', 'web/app', '嵌入式', 'AI', '其它'];
  const [users] = await db.promise().query('SELECT id FROM users');
  await Promise.all(users.flatMap((user) => defaultCategories.map((category, index) => db.promise().query(
    'INSERT IGNORE INTO learning_categories (user_id, name, sort_order, is_default) VALUES (?, ?, ?, TRUE)',
    [user.id, category, index]
  ))));
  await db.promise().query('SELECT 1');
  console.log(`MySQL pool connected; database ${process.env.DB_NAME} is ready`);
}

let databaseReady;

// 配置multer存储
// 修改 server.js 中的 storage 配置（第68-84行附近）
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const userId = req.authUserId;
    const categoryId = req.body.categoryId || req.body.category || '其它';
    
    // 需要根据 categoryId 查询分类名称，或者直接使用 categoryId 作为目录名
    // 这里简化处理，使用 categoryId
    const uploadPath = path.join(__dirname, 'uploads', safePathSegment(userId), safePathSegment(categoryId, 'other'));
    
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB限制
  fileFilter: function (req, file, cb) {
    // 允许所有文件类型，但会在前端提示
    cb(null, true);
  }
});

// ========== 用户认证相关API ==========

// 注册 API
app.post('/api/register', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');

    if (!email || !password) {
      return sendError(res, 400, 'FIELDS_REQUIRED', '邮箱、密码都是必填项');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendError(res, 400, 'INVALID_EMAIL', '请输入有效的邮箱地址');
    const passwordError = validatePassword(password);
    if (passwordError) return sendError(res, 400, 'WEAK_PASSWORD', passwordError);

    const [existingUsers] = await db.promise().query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUsers.length > 0) return sendError(res, 409, 'EMAIL_TAKEN', '该邮箱已被注册');

    const username = `用户${Date.now()}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.promise().query('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hashedPassword]);
    await db.promise().query('UPDATE users SET blog_slug=? WHERE id=?', [`u-${result.insertId}`, result.insertId]);
    const defaultCategories = ['数学', '物理', '天文', 'web/app', '嵌入式', 'AI', '其它'];
    await Promise.all(defaultCategories.map((category, index) => db.promise().query(
      'INSERT INTO learning_categories (user_id, name, sort_order, is_default) VALUES (?, ?, ?, TRUE)',
      [result.insertId, category, index]
    )));
    res.status(201).json({ message: '用户注册成功', userId: result.insertId });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return sendError(res, 409, 'EMAIL_TAKEN', '该邮箱已被注册');
    console.error('注册错误:', error);
    sendError(res, 500, 'INTERNAL_ERROR', '服务器内部错误');
  }
});

// 登录 API
app.post('/api/login', async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');
  if (!email || !password) return sendError(res, 400, 'FIELDS_REQUIRED', '邮箱和密码是必填项');
  try {
    const [results] = await db.promise().query('SELECT * FROM users WHERE email = ?', [email]);
    if (!results.length || !await bcrypt.compare(password, results[0].password)) return sendError(res, 401, 'INVALID_CREDENTIALS', '邮箱或密码错误');
    const { password: _, ...userWithoutPassword } = results[0];
    setAuthCookie(res, userWithoutPassword);
    res.status(200).json({ message: '登录成功', user: userWithoutPassword });
  } catch (error) {
    console.error('登录错误:', error);
    sendError(res, 503, 'DATABASE_UNAVAILABLE', '认证服务暂时不可用');
  }
});
const workspaceFileTypes = new Set(['image/png','image/jpeg','image/webp','image/gif','audio/mpeg','audio/ogg','audio/wav','audio/x-wav','audio/mp4','audio/aac','audio/flac','video/mp4','video/webm','video/ogg','video/quicktime','application/pdf','application/zip','application/x-zip-compressed','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
function validateWorkspaceFile(file) {
  const extension = path.extname(file?.originalname || '').toLowerCase();
  if (['.md','.markdown','.txt','.csv','.json'].includes(extension) && /^text\//.test(String(file?.mimetype || ''))) {
    if (!file.size) throw Object.assign(new Error('文件不能为空'), { status:400, code:'FILE_INVALID' });
    return file;
  }
  return validateUploadedFile(file, { allowed:workspaceFileTypes, maxBytes:100 * 1024 * 1024 });
}

app.post('/api/logout', requireAuth, async (req, res) => {
  await db.promise().query('UPDATE users SET session_version=session_version+1,session_revoked_at=NOW() WHERE id=?', [req.user.id]);
  clearAuthCookie(res);
  res.status(200).json({ message: '已退出登录' });
});

app.get('/api/me', (req, res) => {
  const query = 'SELECT id, username, email, birthday, hobbies, occupation, notes, avatar_path, blog_slug, bio, blog_title FROM users WHERE id = ?';
  db.query(query, [req.authUserId], (err, results) => {
    if (err) return res.status(500).json({ error: '数据库查询失败' });
    if (results.length === 0) return res.status(404).json({ error: '用户不存在' });
    const user = results[0];
    user.avatar_url = user.avatar_path ? `/api/public/avatars/${user.id}` : null;
    delete user.avatar_path;
    res.status(200).json({ user });
  });
});

// 获取用户信息 API
app.get('/api/user/:userId', (req, res) => {
  const userId = req.authUserId;
  const query = 'SELECT id, username, email, birthday, hobbies, occupation, notes, avatar_path FROM users WHERE id = ?';
  db.query(query, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: '数据库查询失败' });
    if (results.length === 0) return res.status(404).json({ error: '用户不存在' });
    const user = results[0];
    user.avatar_url = user.avatar_path ? `/api/public/avatars/${user.id}` : null;
    delete user.avatar_path;
    res.status(200).json({ user });
  });
});

// 更新用户信息 API
app.put('/api/user/:userId', (req, res) => {
  const userId = req.authUserId;
  const { username, birthday, hobbies, occupation, notes } = req.body;
  
  const checkUsernameQuery = 'SELECT * FROM users WHERE username = ? AND id != ?';
  db.query(checkUsernameQuery, [username, userId], (err, results) => {
    if (err) return res.status(500).json({ error: '数据库查询失败' });
    if (results.length > 0) return res.status(400).json({ error: '该用户名已被使用' });
    
    const updateQuery = `UPDATE users SET username = ?, birthday = ?, hobbies = ?, occupation = ?, notes = ? WHERE id = ?`;
    db.query(updateQuery, [username, birthday, hobbies, occupation, notes, userId], (err, results) => {
      if (err) return res.status(500).json({ error: '更新用户信息失败' });
      if (results.affectedRows === 0) return res.status(404).json({ error: '用户不存在' });
      res.status(200).json({ message: '用户信息更新成功' });
    });
  });
});

// 更新密码 API
app.put('/api/user/:userId/password', async (req, res) => {
  const userId = req.authUserId;
  const { oldPassword, newPassword } = req.body;
  
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: '旧密码和新密码都是必填项' });
  }
  const passwordError = validatePassword(newPassword);
  if (passwordError) return sendError(res, 400, 'WEAK_PASSWORD', passwordError);
  
  const query = 'SELECT password FROM users WHERE id = ?';
  db.query(query, [userId], async (err, results) => {
    if (err) return res.status(500).json({ error: '数据库查询失败' });
    if (results.length === 0) return res.status(404).json({ error: '用户不存在' });
    
    const user = results[0];
    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordValid) return res.status(401).json({ error: '旧密码错误' });
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    const updateQuery = 'UPDATE users SET password = ? WHERE id = ?';
    db.query(updateQuery, [hashedPassword, userId], async (err, results) => {
      if (err) return res.status(500).json({ error: '更新密码失败' });
      await db.promise().query('UPDATE users SET session_version=session_version+1,session_revoked_at=NOW() WHERE id=?', [userId]);
      res.status(200).json({ message: '密码更新成功' });
    });
  });
});

// ========== 学习区 - 分类管理API ==========

// 获取分类列表
app.get('/api/categories/:userId', (req, res) => {
  const userId = req.authUserId;
  const query = 'SELECT * FROM learning_categories WHERE user_id = ? ORDER BY sort_order ASC, id ASC';
  db.query(query, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: '获取分类失败' });
    res.status(200).json({ categories: results });
  });
});

// 添加新分类
app.post('/api/categories', (req, res) => {
  const { name } = req.body;
  const userId = req.authUserId;
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: '分类名称不能为空' });
  }
  
  // 获取当前最大sort_order（在"其它"之前插入）
  const getMaxOrderQuery = 'SELECT MAX(sort_order) as max_order FROM learning_categories WHERE user_id = ? AND name != "其它"';
  db.query(getMaxOrderQuery, [userId], (err, results) => {
    const newOrder = results[0].max_order !== null ? results[0].max_order + 1 : 0;
    
    const insertQuery = 'INSERT INTO learning_categories (user_id, name, sort_order, is_default) VALUES (?, ?, ?, FALSE)';
    db.query(insertQuery, [userId, name.trim(), newOrder], (err, result) => {
      if (err) {
        if (err.message.includes('Duplicate entry')) {
          return res.status(400).json({ error: '该分类名称已存在' });
        }
        return res.status(500).json({ error: '创建分类失败' });
      }
      res.status(201).json({ message: '分类创建成功', categoryId: result.insertId });
    });
  });
});

// ========== 学习区 - 文件管理API ==========

// 获取文件列表（支持按分类筛选）
app.get('/api/files/:userId', (req, res) => {
  const userId = req.authUserId;
  const { categoryId, search } = req.query;
  
  let query = `
    SELECT f.*, c.name as category_name 
    FROM learning_files f 
    JOIN learning_categories c ON f.category_id = c.id 
    WHERE f.user_id = ?
  `;
  const params = [userId];
  
  if (categoryId && categoryId !== 'all') {
    query += ' AND f.category_id = ?';
    params.push(categoryId);
  }
  
  if (search && search.trim() !== '') {
    query += ' AND (f.original_name LIKE ? OR f.filename LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  
  query += ' ORDER BY f.created_at DESC';
  
  db.query(query, params, (err, results) => {
    if (err) return res.status(500).json({ error: '获取文件列表失败' });
    res.status(200).json({ files: results });
  });
});

// 上传文件
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    const { categoryId, customName } = req.body;
    const userId = req.authUserId;
    const removeTemporaryUpload = () => {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    };
    
    if (!req.file) {
      return res.status(400).json({ error: '请选择要上传的文件' });
    }
    try { validateWorkspaceFile(req.file); } catch (validationError) { removeTemporaryUpload(); return sendError(res, validationError.status || 400, validationError.code || 'FILE_INVALID', validationError.message); }

    if (!categoryId) {
      removeTemporaryUpload();
      return res.status(400).json({ error: '请选择有效分类' });
    }
    
    // 分类 ID 来自客户端，但归属只能以当前会话用户为准。
    const categoryQuery = 'SELECT id FROM learning_categories WHERE id = ? AND user_id = ? LIMIT 1';
    db.query(categoryQuery, [categoryId, userId], (categoryErr, categories) => {
      if (categoryErr) {
        removeTemporaryUpload();
        return res.status(500).json({ error: '验证文件分类失败' });
      }
      if (categories.length === 0) {
        removeTemporaryUpload();
        return res.status(403).json({ error: '无权向此分类上传文件' });
      }

      // 检查是否同名
      const checkQuery = 'SELECT id FROM learning_files WHERE user_id = ? AND category_id = ? AND original_name = ?';
      db.query(checkQuery, [userId, categoryId, req.file.originalname], (err, results) => {
      if (err) {
        removeTemporaryUpload();
        return res.status(500).json({ error: '检查文件名失败' });
      }
      if (results.length > 0) {
        removeTemporaryUpload();
        return res.status(400).json({ error: '该分类下已存在同名文件' });
      }
      
      const displayName = customName || req.file.originalname;
      const fileType = path.extname(req.file.originalname).toLowerCase() || 'unknown';
      
      // 关键修复：确保 file_path 以 /uploads 开头，存储绝对路径格式
      let filePath = req.file.path.replace(__dirname, '').replace(/\\/g, '/');
      
      // 确保路径以 /uploads 开头
      if (!filePath.startsWith('/uploads')) {
        if (filePath.startsWith('/')) {
          filePath = '/uploads' + filePath;
        } else {
          filePath = '/uploads/' + filePath;
        }
      }
      
      console.log('存储的 file_path:', filePath); // 调试：应该是 /uploads/temp/其它/filename.png
      
      const insertQuery = `
        INSERT INTO learning_files (user_id, category_id, filename, original_name, file_type, file_size, file_path, is_markdown) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const isMarkdown = fileType === '.md';
      
      db.query(insertQuery, [
        userId, 
        categoryId, 
        req.file.filename, 
        displayName,
        fileType, 
        req.file.size, 
        filePath,  // 现在存储的是 /uploads/temp/其它/filename.png
        isMarkdown
      ], (err, result) => {
        if (err) {
          removeTemporaryUpload();
          return res.status(500).json({ error: '保存文件信息失败' });
        }
        res.status(201).json({ message: '上传成功', fileId: result.insertId });
      });
      });
    });
  } catch (error) {
    console.error('上传错误:', error);
    res.status(500).json({ error: '上传失败' });
  }
});

// 上传Markdown内容
app.post('/api/upload-markdown', (req, res) => {
  const { categoryId, title, content } = req.body;
  const userId = req.authUserId;

  if (!categoryId || typeof title !== 'string' || !title.trim() || typeof content !== 'string') {
    return res.status(400).json({ error: '请提供有效的分类、标题和 Markdown 内容' });
  }

  const categoryQuery = 'SELECT id FROM learning_categories WHERE id = ? AND user_id = ? LIMIT 1';
  db.query(categoryQuery, [categoryId, userId], (categoryErr, categories) => {
    if (categoryErr) return res.status(500).json({ error: '验证文件分类失败' });
    if (categories.length === 0) return res.status(403).json({ error: '无权向此分类创建 Markdown 文件' });

    // 仅在分类归属得到验证后创建物理文件。
    const categoryDir = path.join(__dirname, 'uploads', userId.toString(), 'markdown');
    fs.mkdirSync(categoryDir, { recursive: true });
    const filename = `md-${Date.now()}-${Math.round(Math.random() * 1E9)}.md`;
    const filePath = path.join(categoryDir, filename);
    
    fs.writeFile(filePath, content, (err) => {
      if (err) return res.status(500).json({ error: '保存Markdown文件失败' });
      const insertQuery = `
        INSERT INTO learning_files (user_id, category_id, filename, original_name, file_type, file_size, file_path, is_markdown, markdown_content)
        VALUES (?, ?, ?, ?, '.md', ?, ?, TRUE, ?)
      `;
      const relativePath = filePath.replace(__dirname, '').replace(/\\/g, '/');

      db.query(insertQuery, [
        userId,
        categoryId,
        filename,
        title.trim() + '.md',
        Buffer.byteLength(content, 'utf8'),
        relativePath,
        content
      ], (insertErr, result) => {
        if (insertErr) {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          return res.status(500).json({ error: '保存文件信息失败' });
        }
        res.status(201).json({ message: '发布成功', fileId: result.insertId });
      });
    });
  });
});

// 下载文件
app.get('/api/download/:fileId', (req, res) => {
  const { fileId } = req.params;
  const userId = req.authUserId;
  
  const query = 'SELECT * FROM learning_files WHERE id = ? AND user_id = ?';
  db.query(query, [fileId, userId], (err, results) => {
    if (err) return res.status(500).json({ error: '查询文件失败' });
    if (results.length === 0) return res.status(404).json({ error: '文件不存在' });
    
    const file = results[0];
    const fullPath = resolveStoredFile(file.file_path);
    
    if (!fullPath || !fs.existsSync(fullPath)) {
      return res.status(404).json({ error: '文件已丢失' });
    }
    
    // 关键修复：确保下载文件名有正确的扩展名
    let downloadName = file.original_name;
    const ext = file.file_type || '';
    
    if (ext && ext !== 'unknown') {
      const extWithDot = ext.startsWith('.') ? ext : '.' + ext;
      const lowerName = downloadName.toLowerCase();
      const lowerExt = extWithDot.toLowerCase();
      
      // 如果文件名没有以该扩展名结尾，则追加
      if (!lowerName.endsWith(lowerExt)) {
        downloadName = downloadName + extWithDot;
      }
    }
    
    // 编码文件名支持中文
    let encodedName = '';
    try {
      encodedName = encodeURIComponent(downloadName);
    } catch (e) {
      encodedName = downloadName;
    }
    
    // 设置Content-Type
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.json': 'application/json',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.mp4': 'video/mp4',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.zip': 'application/zip',
      '.rar': 'application/x-rar-compressed'
    };
    
    const contentType = mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    
    // RFC 5987编码
    const asciiName = downloadName.replace(/[^\x00-\x7F]/g, '').replace(/["']/g, '') || 'download';
    res.setHeader('Content-Disposition', `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`);
    
    res.sendFile(fullPath, (err) => {
      if (err) {
        console.error('下载错误:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: '下载失败' });
        }
      }
    });
  });
});

// 获取文件内容（预览）
app.get('/api/file-content/:fileId', (req, res) => {
  const { fileId } = req.params;
  const userId = req.authUserId;
  
  const query = 'SELECT * FROM learning_files WHERE id = ? AND user_id = ?';
  db.query(query, [fileId, userId], (err, results) => {
    if (err) return res.status(500).json({ error: '查询失败' });
    if (results.length === 0) return res.status(404).json({ error: '文件不存在' });
    
    const file = results[0];
    const fullPath = resolveStoredFile(file.file_path);
    
    if (!fullPath || !fs.existsSync(fullPath)) {
      return res.status(404).json({ error: '文件已丢失' });
    }
    
    // 如果是Markdown且数据库有内容，直接返回
    if (file.is_markdown && file.markdown_content) {
      return res.json({ 
        file: file, 
        content: file.markdown_content,
        type: 'markdown'
      });
    }
    
    // 拓展：支持更多文本/代码文件格式
    const textExtensions = [
      '.txt', '.md', '.js', '.html', '.css', '.py', '.c', '.cpp', '.h', 
      '.java', '.json', '.xml', '.ts', '.vue', '.php', '.go', '.rs', 
      '.rb', '.swift', '.kt', '.sql', '.yaml', '.yml', '.sh', '.bash',
      '.css', '.scss', '.sass', '.less', '.jsx', '.tsx', '.csv', '.log'
    ];
    
    if (textExtensions.includes(file.file_type.toLowerCase())) {
      fs.readFile(fullPath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: '读取文件失败' });
        res.json({ 
          file: file, 
          content: data, 
          type: file.file_type === '.md' ? 'markdown' : 'text' 
        });
      });
    } else {
      // 对于二进制文件，返回文件信息和URL
      res.json({ 
        file: file, 
        content: null, 
        type: 'binary',
        url: `/api/file-stream/${file.id}`
      });
    }
  });
});

app.get('/api/file-stream/:fileId', (req, res) => {
  const query = 'SELECT * FROM learning_files WHERE id = ? AND user_id = ?';
  db.query(query, [req.params.fileId, req.authUserId], (err, results) => {
    if (err) return res.status(500).json({ error: '查询文件失败' });
    if (results.length === 0) return res.status(404).json({ error: '文件不存在' });

    const file = results[0];
    const fullPath = resolveStoredFile(file.file_path);
    if (!fullPath || !fs.existsSync(fullPath)) {
      return res.status(404).json({ error: '文件已丢失' });
    }

    res.type(mime.lookup(fullPath) || 'application/octet-stream');
    return res.sendFile(fullPath);
  });
});

// 批量删除文件
app.delete('/api/files', (req, res) => {
  const { fileIds } = req.body;
  const userId = req.authUserId;
  
  if (!fileIds || fileIds.length === 0) {
    return res.status(400).json({ error: '未选择要删除的文件' });
  }
  
  // 获取文件路径
  const query = 'SELECT * FROM learning_files WHERE id IN (?) AND user_id = ?';
  db.query(query, [fileIds, userId], (err, files) => {
    if (err) return res.status(500).json({ error: '查询文件失败' });
    
    // 删除物理文件
    files.forEach(file => {
      const fullPath = resolveStoredFile(file.file_path);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    });
    
    // 删除数据库记录
    const deleteQuery = 'DELETE FROM learning_files WHERE id IN (?) AND user_id = ?';
    db.query(deleteQuery, [fileIds, userId], (err) => {
      if (err) return res.status(500).json({ error: '删除失败' });
      res.status(200).json({ message: '删除成功', count: fileIds.length });
    });
  });
});

// ========== 学习区 - 邮件系统API ==========

// 检查用户是否存在（用于发送邮件前验证）
app.get('/api/check-user', (req, res) => {
  const { email } = req.query;
  
  if (!email) {
    return res.status(400).json({ error: '请提供邮箱地址' });
  }
  
  // 查询用户是否存在
  const query = 'SELECT id, username, email FROM users WHERE email = ?';
  db.query(query, [email], (err, results) => {
    if (err) {
      console.error('检查用户失败:', err);
      return res.status(500).json({ error: '检查用户失败' });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ error: '该邮箱用户不存在', exists: false });
    }
    
    res.status(200).json({ 
      exists: true, 
      user: {
        id: results[0].id,
        username: results[0].username,
        email: results[0].email
      }
    });
  });
});

// 发送邮件（带收件人检查）
app.post('/api/emails', (req, res) => {
  const { senderName, recipientEmail, subject, content, attachments } = req.body;
  const senderId = req.authUserId;
  const senderEmail = req.user.email;
  
  if (!recipientEmail || !subject) {
    return res.status(400).json({ error: '收件人和主题不能为空' });
  }
  
  // 先检查收件人是否存在
  const checkUserQuery = 'SELECT id FROM users WHERE email = ? OR username = ?';
  db.query(checkUserQuery, [recipientEmail, recipientEmail], (err, users) => {
    if (err) {
      console.error('检查收件人失败:', err);
      return res.status(500).json({ error: '检查收件人失败' });
    }
    
    if (users.length === 0) {
      return res.status(404).json({ error: '收件人不存在' });
    }
    
    // 收件人存在，执行发送
    const hasAttachments = attachments && attachments.length > 0;
    
    const insertQuery = `
      INSERT INTO learning_emails (sender_id, sender_email, sender_name, recipient_email, subject, content, attachments, has_attachments) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    db.query(insertQuery, [
      senderId, senderEmail, senderName, recipientEmail, subject, content, 
      JSON.stringify(attachments || []), hasAttachments
    ], (err, result) => {
      if (err) {
        console.error('发送邮件失败:', err);
        return res.status(500).json({ error: '发送邮件失败' });
      }
      res.status(201).json({ message: '邮件发送成功', emailId: result.insertId });
    });
  });
});

// 获取收件箱
app.get('/api/emails/:userEmail', (req, res) => {
  const userEmail = req.user.email;
  const { filter } = req.query; // all, unread, read
  
  let query = 'SELECT * FROM learning_emails WHERE recipient_email = ?';
  const params = [userEmail];
  
  if (filter === 'unread') {
    query += ' AND is_read = FALSE';
  } else if (filter === 'read') {
    query += ' AND is_read = TRUE';
  }
  
  query += ' ORDER BY created_at DESC';
  
  db.query(query, params, (err, results) => {
    if (err) return res.status(500).json({ error: '获取邮件失败' });
    
    // 确保attachments字段是数组
    const emails = results.map(email => {
      try {
        if (typeof email.attachments === 'string') {
          email.attachments = JSON.parse(email.attachments);
        }
      } catch (e) {
        email.attachments = [];
      }
      if (!Array.isArray(email.attachments)) {
        email.attachments = [];
      }
      return email;
    });
    
    res.status(200).json({ emails: emails });
  });
});

// 标记邮件已读
app.put('/api/emails/:emailId/read', (req, res) => {
  const { emailId } = req.params;
  const query = 'UPDATE learning_emails SET is_read = TRUE WHERE id = ? AND recipient_email = ?';
  db.query(query, [emailId, req.user.email], (err, result) => {
    if (err) return res.status(500).json({ error: '更新状态失败' });
    if (result.affectedRows === 0) return res.status(404).json({ error: '邮件不存在或无权操作' });
    res.status(200).json({ message: '已标记为已读' });
  });
});

// 获取单封邮件详情（修复版 - 包含附件下载链接）
app.get('/api/email/:emailId/detail', (req, res) => {
  const { emailId } = req.params;
  const userEmail = req.user.email;
  
  // 查询邮件 - 收件人或发件人都可以查看
  const query = 'SELECT * FROM learning_emails WHERE id = ? AND (recipient_email = ? OR sender_email = ?)';
  db.query(query, [emailId, userEmail, userEmail], (err, results) => {
    if (err) {
      console.error('获取邮件详情失败:', err);
      return res.status(500).json({ error: '获取邮件详情失败' });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ error: '邮件不存在或无权访问' });
    }
    
    const email = results[0];
    
    // 处理附件，添加下载URL
    let attachments = [];
    try {
      if (typeof email.attachments === 'string') {
        attachments = JSON.parse(email.attachments);
      } else if (Array.isArray(email.attachments)) {
        attachments = email.attachments;
      }
    } catch (e) {
      console.error('解析附件失败:', e);
      attachments = [];
    }
    
    // 为每个附件添加下载URL
    const attachmentsWithUrls = attachments.map((att, index) => {
      if (att.type === 'internal' && att.fileId) {
        return {
          ...att,
          downloadUrl: `/api/email-attachment/${email.id}/${index}`
        };
      }
      return att;
    });
    
    res.status(200).json({
      email: {
        ...email,
        attachments: attachmentsWithUrls,
        has_attachments: attachmentsWithUrls.length > 0
      }
    });
  });
});

// 下载邮件附件（专用API）
app.get('/api/email-attachment/:emailId/:attachmentIndex', (req, res) => {
  const { emailId, attachmentIndex } = req.params;
  const userEmail = req.user.email;
  
  // 查询邮件
  const query = 'SELECT * FROM learning_emails WHERE id = ? AND (recipient_email = ? OR sender_email = ?)';
  db.query(query, [emailId, userEmail, userEmail], (err, results) => {
    if (err) {
      console.error('查询邮件失败:', err);
      return res.status(500).json({ error: '查询邮件失败' });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ error: '邮件不存在或无权访问' });
    }
    
    const email = results[0];
    
    // 解析附件
    let attachments = [];
    try {
      if (typeof email.attachments === 'string') {
        attachments = JSON.parse(email.attachments);
      } else if (Array.isArray(email.attachments)) {
        attachments = email.attachments;
      }
    } catch (e) {
      return res.status(500).json({ error: '附件数据损坏' });
    }
    
    const idx = parseInt(attachmentIndex);
    if (isNaN(idx) || idx < 0 || idx >= attachments.length) {
      return res.status(400).json({ error: '附件索引无效' });
    }
    
    const att = attachments[idx];
    
    // 处理不同类型的附件
    if (att.type === 'internal' && att.fileId) {
      // 站内文件：查询文件信息并下载
      const fileQuery = 'SELECT * FROM learning_files WHERE id = ? AND user_id = ?';
      db.query(fileQuery, [att.fileId, email.sender_id], (err, files) => {
        if (err || files.length === 0) {
          return res.status(404).json({ error: '文件不存在' });
        }
        
        const file = files[0];
        const fullPath = resolveStoredFile(file.file_path);
        
        if (!fullPath || !fs.existsSync(fullPath)) {
          return res.status(404).json({ error: '文件已丢失' });
        }
        
        // 设置下载头
        let downloadName = att.name || file.original_name;
        const ext = file.file_type || '';
        
        if (ext && ext !== 'unknown') {
          const extWithDot = ext.startsWith('.') ? ext : '.' + ext;
          const lowerName = downloadName.toLowerCase();
          const lowerExt = extWithDot.toLowerCase();
          if (!downloadName.toLowerCase().endsWith(extWithDot.toLowerCase())) {
            downloadName = downloadName + extWithDot;
          }
        }
        
        const encodedName = encodeURIComponent(downloadName);
        const asciiName = downloadName.replace(/[^\x00-\x7F]/g, '').replace(/["']/g, '') || 'download';
        
        res.setHeader('Content-Disposition', `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`);
        res.sendFile(fullPath);
      });
    } else {
      return res.status(400).json({ error: '不支持的附件类型或附件不存在' });
    }
  });
});

// ========== 娱乐区 - 图片管理API ==========

// 创建图片表
const createImagesTable = `
  CREATE TABLE IF NOT EXISTS entertainment_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    style VARCHAR(50) DEFAULT '普通',
    file_type VARCHAR(20) NOT NULL,
    file_size BIGINT,
    file_path VARCHAR(500) NOT NULL,
    thumbnail_path VARCHAR(500),
    description TEXT,
    width INT,
    height INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`;


// 创建视频表
const createVideosTable = `
  CREATE TABLE IF NOT EXISTS entertainment_videos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    file_type VARCHAR(20) NOT NULL,
    file_size BIGINT,
    file_path VARCHAR(500) NOT NULL,
    cover_path VARCHAR(500),
    duration VARCHAR(20),
    frame_rate VARCHAR(10),
    frame_count INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`;


// 创建音乐表
const createMusicTable = `
  CREATE TABLE IF NOT EXISTS entertainment_music (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    artist VARCHAR(100),
    album VARCHAR(100),
    release_date DATE,
    file_type VARCHAR(20) NOT NULL,
    file_size BIGINT,
    file_path VARCHAR(500) NOT NULL,
    cover_path VARCHAR(500),
    duration VARCHAR(20),
    lyrics TEXT,
    lyrics_offset_ms INT NOT NULL DEFAULT 0,
    play_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`;


// 图片上传配置
const imageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, 'uploads', 'entertainment', 'images', String(req.authUserId));
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'img-' + uniqueSuffix + ext);
  }
});

const imageUpload = multer({ 
  storage: imageStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片格式文件'));
    }
  }
});

// 获取最新5张图片（用于娱乐区首页预览）
app.get('/api/entertainment/images/recent/:userId', (req, res) => {
  const userId = req.authUserId;
  const query = `
    SELECT id, title, file_type, style, created_at, 
           CONCAT('/uploads/entertainment/images/', user_id, '/', filename) as thumbnail_path
    FROM entertainment_images 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT 5
  `;
  
  // 简化查询，返回基础信息
  const simpleQuery = `
    SELECT id, title, file_type, style, created_at, file_path, width, height
    FROM entertainment_images 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT 5
  `;
  
  db.query(simpleQuery, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: '获取图片失败' });
    res.status(200).json({ images: results });
  });
});

// 获取所有图片
app.get('/api/entertainment/images/:userId', (req, res) => {
  const userId = req.authUserId;
  const { style } = req.query;
  
  let query = `
    SELECT id, title, file_type, style, file_path, thumbnail_path, 
           description, width, height, created_at
    FROM entertainment_images 
    WHERE user_id = ?
  `;
  const params = [userId];
  
  if (style && style !== 'all') {
    query += ' AND style = ?';
    params.push(style);
  }
  
  query += ' ORDER BY created_at DESC';
  
  db.query(query, params, (err, results) => {
    if (err) return res.status(500).json({ error: '获取图片列表失败' });
    res.status(200).json({ images: results });
  });
});

// 上传图片
app.post('/api/entertainment/images', imageUpload.single('image'), (req, res) => {
  try {
    const { title, style, description } = req.body;
    const userId = req.authUserId;
    
    if (!req.file) {
      return res.status(400).json({ error: '请选择图片文件' });
    }
    try { validateUploadedFile(req.file, { allowed:new Set(['image/png','image/jpeg','image/webp','image/gif']), maxBytes:50 * 1024 * 1024 }); } catch (validationError) { removeUploadedImage(req.file); return sendError(res, validationError.status || 400, validationError.code || 'FILE_INVALID', validationError.message); }
    
    const ext = path.extname(req.file.originalname).toLowerCase();
    const finalTitle = title || req.file.originalname.replace(ext, '');
    const finalStyle = style || '普通';
    
    // 读取已通过 magic bytes 校验的图片尺寸，避免在不可信输入上调用有已知 DoS 风险的解析器。
    let width = 0, height = 0;
    try {
      const dimensions = imageDimensions(req.file.path);
      width = dimensions?.width || 0;
      height = dimensions?.height || 0;
    } catch (err) {
      console.error('读取图片尺寸失败:', err);
      width = 0;
      height = 0;
    }
    
    let relativePath = req.file.path.replace(__dirname, '').replace(/\\/g, '/');
    if (!relativePath.startsWith('/uploads')) {
      relativePath = '/uploads' + relativePath;
    }
    
    const insertQuery = `
      INSERT INTO entertainment_images 
      (user_id, title, style, file_type, file_size, file_path, description, width, height) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    db.query(insertQuery, [
      userId, finalTitle, finalStyle, ext, req.file.size, 
      relativePath, description || finalTitle, width, height
    ], (err, result) => {
      if (err) {
        fs.unlinkSync(req.file.path);
        return res.status(500).json({ error: '保存图片信息失败' });
      }
      res.status(201).json({ message: '上传成功', imageId: result.insertId });
    });
  } catch (error) {
    console.error('上传图片错误:', error);
    res.status(500).json({ error: '上传失败' });
  }
});

const canvasImageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: function (_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
    if (allowed[ext] && allowed[ext] === file.mimetype) return cb(null, true);
    cb(new Error('编辑后的图片仅支持 JPEG、PNG 或 WebP 格式'));
  }
});

// 从浏览器 Canvas 生成一个新的私有图片。原图记录与文件始终保留。
app.post('/api/entertainment/images/:imageId/derivatives', canvasImageUpload.single('image'), (req, res) => {
  const imageId = Number(req.params.imageId);
  const userId = req.authUserId;
  if (!Number.isInteger(imageId) || imageId < 1) {
    removeUploadedImage(req.file);
    return res.status(400).json({ error: '图片标识无效' });
  }
  if (!req.file) return res.status(400).json({ error: '请选择编辑后的图片文件' });
  try { validateUploadedFile(req.file, { allowed:new Set(['image/png','image/jpeg','image/webp']), maxBytes:50 * 1024 * 1024 }); } catch (validationError) { removeUploadedImage(req.file); return sendError(res, validationError.status || 400, validationError.code || 'FILE_INVALID', validationError.message); }

  db.query('SELECT * FROM entertainment_images WHERE id = ? AND user_id = ?', [imageId, userId], (lookupError, rows) => {
    if (lookupError) {
      removeUploadedImage(req.file);
      return res.status(500).json({ error: '查询原图片失败' });
    }
    const original = rows[0];
    if (!original) {
      removeUploadedImage(req.file);
      return res.status(404).json({ error: '图片不存在或无权操作' });
    }

    let metadata;
    try {
      metadata = getEditedImageMetadata(req.file);
    } catch (error) {
      removeUploadedImage(req.file);
      return res.status(400).json({ error: error.message || '编辑后的图片无效' });
    }

    const title = String(req.body.title || `${original.title}（编辑副本）`).trim().slice(0, 255) || `${original.title}（编辑副本）`;
    const description = String(req.body.description || original.description || title).slice(0, 5000);
    db.query(
      `INSERT INTO entertainment_images
        (user_id, title, style, file_type, file_size, file_path, description, width, height)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, title, original.style || '普通', metadata.fileType, metadata.fileSize, metadata.filePath, description, metadata.width, metadata.height],
      (insertError, result) => {
        if (insertError) {
          removeUploadedImage(req.file);
          return res.status(500).json({ error: '创建编辑副本失败' });
        }
        db.query('SELECT * FROM entertainment_images WHERE id = ? AND user_id = ?', [result.insertId, userId], (readError, savedRows) => {
          if (readError || !savedRows[0]) return res.status(201).json({ message: '已生成新图片', imageId: result.insertId });
          res.status(201).json({ message: '已生成新图片', image: presentOwnedImage(savedRows[0]) });
        });
      }
    );
  });
});

// 替换保留同一数据库记录：先安全落盘新文件，数据库成功更新后再清理旧文件。
app.put('/api/entertainment/images/:imageId/file', canvasImageUpload.single('image'), (req, res) => {
  const imageId = Number(req.params.imageId);
  const userId = req.authUserId;
  if (!Number.isInteger(imageId) || imageId < 1) {
    removeUploadedImage(req.file);
    return res.status(400).json({ error: '图片标识无效' });
  }
  if (String(req.body.confirmReplace) !== 'true') {
    removeUploadedImage(req.file);
    return res.status(400).json({ error: '请确认替换原图' });
  }
  if (!req.file) return res.status(400).json({ error: '请选择编辑后的图片文件' });
  try { validateUploadedFile(req.file, { allowed:new Set(['image/png','image/jpeg','image/webp']), maxBytes:50 * 1024 * 1024 }); } catch (validationError) { removeUploadedImage(req.file); return sendError(res, validationError.status || 400, validationError.code || 'FILE_INVALID', validationError.message); }

  db.query('SELECT * FROM entertainment_images WHERE id = ? AND user_id = ?', [imageId, userId], (lookupError, rows) => {
    if (lookupError) {
      removeUploadedImage(req.file);
      return res.status(500).json({ error: '查询原图片失败' });
    }
    const original = rows[0];
    if (!original) {
      removeUploadedImage(req.file);
      return res.status(404).json({ error: '图片不存在或无权操作' });
    }

    let metadata;
    try {
      metadata = getEditedImageMetadata(req.file);
    } catch (error) {
      removeUploadedImage(req.file);
      return res.status(400).json({ error: error.message || '编辑后的图片无效' });
    }

    db.query(
      `UPDATE entertainment_images
       SET file_type = ?, file_size = ?, file_path = ?, width = ?, height = ?
       WHERE id = ? AND user_id = ?`,
      [metadata.fileType, metadata.fileSize, metadata.filePath, metadata.width, metadata.height, imageId, userId],
      (updateError, result) => {
        if (updateError || !result.affectedRows) {
          removeUploadedImage(req.file);
          return res.status(updateError ? 500 : 404).json({ error: updateError ? '替换原图失败' : '图片不存在或无权操作' });
        }
        const previousFile = resolveStoredFile(original.file_path);
        const nextFile = path.resolve(req.file.path);
        if (previousFile && previousFile !== nextFile) fs.unlink(previousFile, () => {});
        db.query('SELECT * FROM entertainment_images WHERE id = ? AND user_id = ?', [imageId, userId], (readError, savedRows) => {
          if (readError || !savedRows[0]) return res.json({ message: '原图已替换', imageId });
          res.json({ message: '原图已替换', image: presentOwnedImage(savedRows[0]) });
        });
      }
    );
  });
});

// 批量更新图片风格
app.put('/api/entertainment/images/batch-style', (req, res) => {
  const { style } = req.body;
  const imageIds = normalizeMediaBatchIds(req.body.imageIds);
  const userId = req.authUserId;
  
  if (!imageIds) {
    return res.status(400).json({ error: '图片选择无效，最多可同时处理 100 张图片' });
  }
  
  if (typeof style !== 'string' || !style.trim() || style.trim().length > 50) {
    return res.status(400).json({ error: '风格不能为空' });
  }
  
  // 生成占位符，例如：3个id -> '?,?,?'
  const placeholders = imageIds.map(() => '?').join(',');
  
  const updateQuery = `
    UPDATE entertainment_images 
    SET style = ?
    WHERE id IN (${placeholders}) AND user_id = ?
  `;
  
  // 参数顺序：style, id1, id2, id3..., userId
  const params = [style.trim(), ...imageIds, userId];
  
  db.query(updateQuery, params, (err, result) => {
    if (err) {
      console.error('批量归类失败:', err);
      return res.status(500).json({ error: '批量归类失败' });
    }
    if (result.affectedRows === 0) return res.status(404).json({ error: '图片不存在或无权操作' });
    res.status(200).json({ 
      message: '归类成功', 
      affectedRows: result.affectedRows 
    });
  });
});

// 更新图片信息
app.put('/api/entertainment/images/:imageId', (req, res) => {
  const { imageId } = req.params;
  const { title, style, description } = req.body;
  const userId = req.authUserId;
  
  const updateQuery = `
    UPDATE entertainment_images 
    SET title = ?, style = ?, description = ?
    WHERE id = ? AND user_id = ?
  `;
  
  db.query(updateQuery, [title, style, description, imageId, userId], (err, result) => {
    if (err) return res.status(500).json({ error: '更新失败' });
    if (result.affectedRows === 0) return res.status(404).json({ error: '图片不存在或无权操作' });
    res.status(200).json({ message: '更新成功' });
  });
});

function removeUploadedImage(file) {
  if (file?.path) fs.unlink(file.path, () => {});
}

function getEditedImageMetadata(file) {
  const dimensions = imageDimensions(file.path);
  const typeToExtension = { jpg: '.jpg', png: '.png', webp: '.webp' };
  const typeToMime = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
  if (!dimensions?.type || !typeToExtension[dimensions.type]) {
    throw new Error('编辑后的文件不是受支持的图片格式');
  }
  const requestedExtension = path.extname(file.originalname).toLowerCase();
  if (requestedExtension !== typeToExtension[dimensions.type] && !(dimensions.type === 'jpg' && requestedExtension === '.jpeg')) {
    throw new Error('图片文件扩展名与实际格式不匹配');
  }
  return {
    fileType: typeToExtension[dimensions.type],
    mimeType: typeToMime[dimensions.type],
    width: Number(dimensions.width) || 0,
    height: Number(dimensions.height) || 0,
    fileSize: file.size,
    filePath: file.path.replace(__dirname, '').replace(/\\/g, '/')
  };
}

function presentOwnedImage(row) {
  return {
    id: row.id,
    title: row.title,
    style: row.style,
    description: row.description,
    file_type: row.file_type,
    file_size: row.file_size,
    width: row.width,
    height: row.height,
    created_at: row.created_at,
    updated_at: row.updated_at,
    url: `/api/entertainment/image-file/${row.id}`
  };
}

// 批量删除图片
app.delete('/api/entertainment/images', (req, res) => {
  const imageIds = normalizeMediaBatchIds(req.body.imageIds);
  const userId = req.authUserId;
  
  if (!imageIds) {
    return res.status(400).json({ error: '图片选择无效，最多可同时删除 100 张图片' });
  }
  
  // 获取文件路径
  const query = 'SELECT * FROM entertainment_images WHERE id IN (?) AND user_id = ?';
  db.query(query, [imageIds, userId], (err, images) => {
    if (err) return res.status(500).json({ error: '查询失败' });
    if (images.length === 0) return res.status(404).json({ error: '图片不存在或无权操作' });
    
    // First remove owned records. A database failure must never delete the physical file.
    const deleteQuery = 'DELETE FROM entertainment_images WHERE id IN (?) AND user_id = ?';
    db.query(deleteQuery, [imageIds, userId], (err, result) => {
      if (err) return res.status(500).json({ error: '删除失败' });
      const cleanupFailed = removeStoredMediaFiles(images, 'image');
      res.status(200).json({ message: cleanupFailed ? '删除成功，部分文件等待清理' : '删除成功', count: result.affectedRows, cleanupFailed });
    });
  });
});

// 获取图片文件
app.get('/api/entertainment/image-file/:imageId', (req, res) => {
  const { imageId } = req.params;
  const userId = req.authUserId;
  
  const query = 'SELECT * FROM entertainment_images WHERE id = ? AND user_id = ?';
  db.query(query, [imageId, userId], (err, results) => {
    if (err) return res.status(500).json({ error: '查询失败' });
    if (results.length === 0) return res.status(404).json({ error: '图片不存在' });
    
    const image = results[0];
    const fullPath = resolveStoredFile(image.file_path);
    
    if (!fullPath || !fs.existsSync(fullPath)) {
      return res.status(404).json({ error: '文件已丢失' });
    }
    
    res.sendFile(fullPath);
  });
});

// ========== 娱乐区 - 视频管理API ==========

const videoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, 'uploads', 'entertainment', 'videos', String(req.authUserId));
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'video-' + uniqueSuffix + ext);
  }
});

const videoUpload = multer({ 
  storage: videoStorage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['.mp4', '.avi', '.mov', '.mkv', '.flv', '.wmv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传视频格式文件'));
    }
  }
});

// 获取最新5个视频（用于娱乐区首页预览）
app.get('/api/entertainment/videos/recent/:userId', (req, res) => {
  const userId = req.authUserId;
  const query = `
    SELECT id, title, file_type, duration, created_at
    FROM entertainment_videos 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT 5
  `;
  
  db.query(query, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: '获取视频失败' });
    res.status(200).json({ videos: results });
  });
});

// 获取所有视频
app.get('/api/entertainment/videos/:userId', (req, res) => {
  const userId = req.authUserId;
  const query = `
    SELECT id, title, file_type, file_path, cover_path, duration, 
           frame_rate, frame_count, created_at
    FROM entertainment_videos 
    WHERE user_id = ?
    ORDER BY created_at DESC
  `;
  
  db.query(query, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: '获取视频列表失败' });
    res.status(200).json({ videos: results });
  });
});

// 上传视频
app.post('/api/entertainment/videos', videoUpload.single('video'), async (req, res) => {
  try {
    const { title } = req.body;
    const userId = req.authUserId;
    
    if (!req.file) {
      return res.status(400).json({ error: '请选择视频文件' });
    }
    try { validateUploadedFile(req.file, { allowed:new Set(['video/mp4','video/webm','video/ogg','video/quicktime']), maxBytes:500 * 1024 * 1024 }); } catch (validationError) { if (req.file?.path) fs.unlink(req.file.path, () => {}); return sendError(res, validationError.status || 400, validationError.code || 'FILE_INVALID', validationError.message); }
    
    const ext = path.extname(req.file.originalname).toLowerCase();
    const finalTitle = title || req.file.originalname.replace(ext, '');
    
    // 使用 fluent-ffmpeg 获取视频信息
    let duration = '0:00';
    let frameRate = '未知';
    let frameCount = 0;
    
    try {
      const ffmpeg = require('fluent-ffmpeg');
      
      // 获取视频元数据
      const metadata = await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(req.file.path, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });
      
      // 提取时长
      if (metadata.format && metadata.format.duration) {
        const totalSeconds = Math.floor(metadata.format.duration);
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        duration = `${mins}:${secs.toString().padStart(2, '0')}`;
      }
      
      // 提取帧率和帧数
      if (metadata.streams && metadata.streams[0]) {
        const videoStream = metadata.streams.find(s => s.codec_type === 'video') || metadata.streams[0];
        
        // 帧率 (fps)
        if (videoStream.r_frame_rate) {
          const [num, den] = videoStream.r_frame_rate.split('/').map(Number);
          frameRate = den ? Math.round(num / den) + 'fps' : videoStream.r_frame_rate;
        } else if (videoStream.avg_frame_rate) {
          const [num, den] = videoStream.avg_frame_rate.split('/').map(Number);
          frameRate = den ? Math.round(num / den) + 'fps' : videoStream.avg_frame_rate;
        }
        
        // 帧数
        if (videoStream.nb_frames) {
          frameCount = parseInt(videoStream.nb_frames);
        } else if (metadata.format.duration && frameRate !== '未知') {
          // 估算帧数 = 时长 * 帧率
          const fps = parseInt(frameRate);
          frameCount = Math.round(metadata.format.duration * fps);
        }
      }
      
    } catch (err) {
      console.error('读取视频元数据失败:', err);
      // 使用默认值继续上传
    }
    
    let relativePath = req.file.path.replace(__dirname, '').replace(/\\/g, '/');
    if (!relativePath.startsWith('/uploads')) {
      relativePath = '/uploads' + relativePath;
    }
    
    const insertQuery = `
      INSERT INTO entertainment_videos 
      (user_id, title, file_type, file_size, file_path, duration, frame_rate, frame_count) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    db.query(insertQuery, [
      userId, finalTitle, ext, req.file.size, 
      relativePath, duration, frameRate, frameCount
    ], (err, result) => {
      if (err) {
        fs.unlinkSync(req.file.path);
        return res.status(500).json({ error: '保存视频信息失败' });
      }
      res.status(201).json({ message: '上传成功', videoId: result.insertId });
    });
  } catch (error) {
    console.error('上传视频错误:', error);
    res.status(500).json({ error: '上传失败' });
  }
});

// 批量删除视频
app.delete('/api/entertainment/videos', (req, res) => {
  const videoIds = normalizeMediaBatchIds(req.body.videoIds);
  const userId = req.authUserId;
  
  if (!videoIds) {
    return res.status(400).json({ error: '视频选择无效，最多可同时删除 100 个视频' });
  }
  
  const query = 'SELECT * FROM entertainment_videos WHERE id IN (?) AND user_id = ?';
  db.query(query, [videoIds, userId], (err, videos) => {
    if (err) return res.status(500).json({ error: '查询失败' });
    if (videos.length === 0) return res.status(404).json({ error: '视频不存在或无权操作' });
    
    const deleteQuery = 'DELETE FROM entertainment_videos WHERE id IN (?) AND user_id = ?';
    db.query(deleteQuery, [videoIds, userId], (err, result) => {
      if (err) return res.status(500).json({ error: '删除失败' });
      const cleanupFailed = removeStoredMediaFiles(videos, 'video');
      res.status(200).json({ message: cleanupFailed ? '删除成功，部分文件等待清理' : '删除成功', count: result.affectedRows, cleanupFailed });
    });
  });
});

// 获取视频文件
app.get('/api/entertainment/video-file/:videoId', (req, res) => {
  const { videoId } = req.params;
  const userId = req.authUserId;
  
  const query = 'SELECT * FROM entertainment_videos WHERE id = ? AND user_id = ?';
  db.query(query, [videoId, userId], (err, results) => {
    if (err) return res.status(500).json({ error: '查询失败' });
    if (results.length === 0) return res.status(404).json({ error: '视频不存在' });
    
    const video = results[0];
    const fullPath = resolveStoredFile(video.file_path);
    
    if (!fullPath || !fs.existsSync(fullPath)) {
      return res.status(404).json({ error: '文件已丢失' });
    }
    
    // 支持视频流式传输
    const stat = fs.statSync(fullPath);
    const fileSize = stat.size;
    const range = req.headers.range;
    
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(fullPath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(200, head);
      fs.createReadStream(fullPath).pipe(res);
    }
  });
});

// ========== 娱乐区 - 音乐管理API ==========

const musicStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, 'uploads', 'entertainment', 'music', String(req.authUserId));
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'music-' + uniqueSuffix + ext);
  }
});

const musicUpload = multer({ 
  storage: musicStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传音频格式文件'));
    }
  }
});

// 获取最新5首音乐（用于娱乐区首页预览）
app.get('/api/entertainment/music/recent/:userId', (req, res) => {
  const userId = req.authUserId;
  const query = `
    SELECT id, title, artist, duration, created_at
    FROM entertainment_music 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT 5
  `;
  
  db.query(query, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: '获取音乐失败' });
    res.status(200).json({ music: results });
  });
});

// 获取所有音乐
app.get('/api/entertainment/music/:userId', (req, res) => {
  const userId = req.authUserId;
  const query = `
    SELECT id, title, artist, album, release_date, file_type, 
           file_path, cover_path, duration, lyrics, lyrics_offset_ms, created_at
    FROM entertainment_music 
    WHERE user_id = ?
    ORDER BY created_at DESC
  `;
  
  db.query(query, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: '获取音乐列表失败' });
    res.status(200).json({ music: results });
  });
});

// 上传音乐
app.post('/api/entertainment/music', musicUpload.single('music'), async (req, res) => {
  try {
    const { title, artist, album, releaseDate } = req.body;
    const userId = req.authUserId;
    
    if (!req.file) {
      return res.status(400).json({ error: '请选择音乐文件' });
    }
    try { validateUploadedFile(req.file, { allowed:new Set(['audio/mpeg','audio/ogg','audio/wav','audio/x-wav','audio/mp4','audio/aac','audio/flac']), maxBytes:100 * 1024 * 1024 }); } catch (validationError) { if (req.file?.path) fs.unlink(req.file.path, () => {}); return sendError(res, validationError.status || 400, validationError.code || 'FILE_INVALID', validationError.message); }
    
    const ext = path.extname(req.file.originalname).toLowerCase();
    const finalTitle = title || req.file.originalname.replace(ext, '');
    
    // 使用 music-metadata 解析音频文件获取时长和元数据
    let duration = '0:00';
    let finalArtist = artist || '未知歌手';
    let finalAlbum = album || '';
    
    try {
      const metadata = await mm.parseFile(req.file.path);
      
      // 获取时长（转换为 mm:ss 格式）
      if (metadata.format.duration) {
        const totalSeconds = Math.floor(metadata.format.duration);
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        duration = `${mins}:${secs.toString().padStart(2, '0')}`;
      }
      
      // 从元数据获取歌手和专辑（如果前端没提供）
      if (metadata.common) {
        if (!artist && metadata.common.artist) {
          finalArtist = metadata.common.artist;
        }
        if (!album && metadata.common.album) {
          finalAlbum = metadata.common.album;
        }
      }
    } catch (err) {
      console.error('解析音频元数据失败:', err);
      // 解析失败时继续使用默认值
    }
    
    let relativePath = req.file.path.replace(__dirname, '').replace(/\\/g, '/');
    if (!relativePath.startsWith('/uploads')) {
      relativePath = '/uploads' + relativePath;
    }
    
    const insertQuery = `
      INSERT INTO entertainment_music 
      (user_id, title, artist, album, release_date, file_type, file_size, file_path, duration) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    db.query(insertQuery, [
      userId, finalTitle, finalArtist, finalAlbum, releaseDate || null,
      ext, req.file.size, relativePath, duration
    ], (err, result) => {
      if (err) {
        fs.unlinkSync(req.file.path);
        return res.status(500).json({ error: '保存音乐信息失败' });
      }
      res.status(201).json({ 
        message: '上传成功', 
        musicId: result.insertId,
        duration: duration,
        fileSize: req.file.size
      });
    });
  } catch (error) {
    console.error('上传音乐错误:', error);
    res.status(500).json({ error: '上传失败' });
  }
});

// 批量删除音乐
app.delete('/api/entertainment/music', (req, res) => {
  const musicIds = normalizeMediaBatchIds(req.body.musicIds);
  const userId = req.authUserId;
  
  if (!musicIds) {
    return res.status(400).json({ error: '歌曲选择无效，最多可同时删除 100 首歌曲' });
  }
  
  const query = 'SELECT * FROM entertainment_music WHERE id IN (?) AND user_id = ?';
  db.query(query, [musicIds, userId], (err, musics) => {
    if (err) return res.status(500).json({ error: '查询失败' });
    if (musics.length === 0) return res.status(404).json({ error: '音乐不存在或无权操作' });
    
    const deleteQuery = 'DELETE FROM entertainment_music WHERE id IN (?) AND user_id = ?';
    db.query(deleteQuery, [musicIds, userId], (err, result) => {
      if (err) return res.status(500).json({ error: '删除失败' });
      const cleanupFailed = removeStoredMediaFiles(musics, 'music');
      res.status(200).json({ message: cleanupFailed ? '删除成功，部分文件等待清理' : '删除成功', count: result.affectedRows, cleanupFailed });
    });
  });
});

// 获取音乐文件
app.get('/api/entertainment/music-file/:musicId', (req, res) => {
  const { musicId } = req.params;
  const userId = req.authUserId;
  
  const query = 'SELECT * FROM entertainment_music WHERE id = ? AND user_id = ?';
  db.query(query, [musicId, userId], (err, results) => {
    if (err) return res.status(500).json({ error: '查询失败' });
    if (results.length === 0) return res.status(404).json({ error: '音乐不存在' });
    
    const music = results[0];
    const fullPath = resolveStoredFile(music.file_path);
    
    if (!fullPath || !fs.existsSync(fullPath)) {
      return res.status(404).json({ error: '文件已丢失' });
    }
    
    res.sendFile(fullPath);
  });
});

// 更新音乐歌词
app.put('/api/entertainment/music/:musicId/lyrics', (req, res) => {
  const { musicId } = req.params;
  const { lyrics, lyricsOffsetMs } = req.body;
  const userId = req.authUserId;

  const parsedOffset = lyricsOffsetMs == null ? 0 : Number(lyricsOffsetMs);
  if (!Number.isInteger(parsedOffset) || Math.abs(parsedOffset) > 30000) {
    return res.status(400).json({ error: '歌词偏移必须在正负 30 秒内' });
  }
  if (typeof lyrics !== 'string' || lyrics.length > 200000) {
    return res.status(400).json({ error: '歌词内容无效或过长' });
  }

  const updateQuery = 'UPDATE entertainment_music SET lyrics = ?, lyrics_offset_ms = ? WHERE id = ? AND user_id = ?';
  db.query(updateQuery, [lyrics, parsedOffset, musicId, userId], (err, result) => {
    if (err) return res.status(500).json({ error: '更新歌词失败' });
    if (result.affectedRows === 0) return res.status(404).json({ error: '音乐不存在或无权操作' });
    res.status(200).json({ message: '更新成功' });
  });
});

// 更新播放次数
app.post('/api/entertainment/music/:musicId/play', (req, res) => {
  const { musicId } = req.params;
  const userId = req.authUserId;
  
  // 先检查音乐是否存在且属于该用户
  const checkQuery = 'SELECT id FROM entertainment_music WHERE id = ? AND user_id = ?';
  db.query(checkQuery, [musicId, userId], (err, results) => {
    if (err) {
      return res.status(500).json({ error: '查询失败' });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: '音乐不存在' });
    }
    
    // 更新播放次数 - 需要先添加 play_count 字段到数据库表
    const updateQuery = `
      UPDATE entertainment_music 
      SET play_count = COALESCE(play_count, 0) + 1 
      WHERE id = ? AND user_id = ?
    `;
    
    db.query(updateQuery, [musicId, userId], (err, result) => {
      if (err) {
        return res.status(500).json({ error: '更新播放次数失败' });
      }
      if (result.affectedRows === 0) return res.status(404).json({ error: '音乐不存在或无权操作' });
      res.status(200).json({ message: '播放次数已更新' });
    });
  });
});

if (process.env.NODE_ENV === 'production') {
  const clientDist = path.resolve(__dirname, '..', 'dist');
  app.use(express.static(clientDist));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.use((error, req, res, next) => {
  console.error('[api error]', error);
  if (res.headersSent) return next(error);
  const statusCode = error instanceof multer.MulterError ? 400 : (error.status || 500);
  return sendError(res, statusCode, error.code || (statusCode === 500 ? 'INTERNAL_ERROR' : 'REQUEST_INVALID'), statusCode === 500 ? '服务器内部错误' : error.message);
});

// Start only after all base tables and additive migrations are ready.
databaseReady = initializeDatabase().catch((error) => {
  console.error('[startup] Database initialization failed:', error);
  process.exitCode = 1;
  throw error;
});
const serverReady = databaseReady.then(() => new Promise((resolve) => {
  const server = app.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
    console.log(`API地址: http://localhost:${PORT}`);
    resolve(server);
  });
}));

// 优雅关闭
async function shutdown(signal) {
  try { const server = await serverReady; await new Promise((resolve) => server.close(resolve)); } catch (_) { /* startup failed */ }
  await db.end();
  console.log('数据库连接已关闭');
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
