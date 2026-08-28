const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2');

const apiRoot = path.join(__dirname, '..');
dotenv.config({ path: path.join(apiRoot, '..', '.env') });

const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'AUTH_SECRET'];
for (const key of required) assert(process.env[key], `缺少 ${key}，无法运行学习区访问测试`);

const suffix = `study-access-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
const port = 34000 + Math.floor(Math.random() * 1000);
const testDatabase = process.env.TEST_DB_NAME || 'own_web_test';
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: testDatabase
});
const query = db.promise().query.bind(db.promise());
let server;
let owner;
let other;

function auth(user) {
  const token = jwt.sign({ sub: String(user.id), email: user.email }, process.env.AUTH_SECRET, { expiresIn: '5m' });
  return { authorization: `Bearer ${token}` };
}

async function request(pathname, options = {}) {
  options.headers = { Origin: 'http://localhost:5173', ...(options.headers || {}) };
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`, options);
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch (_) { body = text; }
  return { status: response.status, body };
}

async function expectStatus(pathname, expected, options) {
  const result = await request(pathname, options);
  assert.equal(result.status, expected, `${options?.method || 'GET'} ${pathname} 应返回 ${expected}，实际为 ${result.status}: ${JSON.stringify(result.body)}`);
  return result.body;
}

async function waitForServer() {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) return;
    } catch (_) {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('学习区测试服务器启动超时');
}

async function createUser(role) {
  const username = `${role}-${suffix}`.slice(0, 50);
  const email = `${role}-${suffix}@example.test`.slice(0, 100);
  const blogSlug = `${role}-${suffix}`.slice(0, 50);
  const [result] = await query(
    'INSERT INTO users (username,email,password,blog_slug,profile_visibility) VALUES (?,?,?,?,?)',
    [username, email, 'audit-only-password', blogSlug, 'public']
  );
  return { id: result.insertId, username, email };
}

async function createCategory(user, name) {
  const [result] = await query(
    'INSERT INTO learning_categories (user_id,name,sort_order,is_default) VALUES (?,?,?,FALSE)',
    [user.id, name, 0]
  );
  return result.insertId;
}

async function cleanUp() {
  if (server && !server.killed) {
    server.kill();
    await new Promise((resolve) => server.once('exit', resolve));
  }
  const userIds = [owner?.id, other?.id].filter(Boolean);
  if (userIds.length) {
    await query('DELETE FROM users WHERE id IN (?)', [userIds]);
    for (const userId of userIds) {
      const uploadDirectory = path.join(apiRoot, 'uploads', String(userId));
      fs.rmSync(uploadDirectory, { recursive: true, force: true });
    }
  }
  await db.promise().end();
}

async function run() {
  server = spawn(process.execPath, ['server.js'], {
    cwd: apiRoot,
    env: { ...process.env, DB_NAME:testDatabase, PORT: String(port), CORS_ORIGIN:'http://localhost:5173' },
    stdio: ['ignore', 'ignore', 'ignore'],
    windowsHide: true
  });
  await waitForServer();

  owner = await createUser('study-owner');
  other = await createUser('study-other');
  const ownerCategoryId = await createCategory(owner, `owner-${suffix}`.slice(0, 50));
  const otherCategoryId = await createCategory(other, `other-${suffix}`.slice(0, 50));

  await expectStatus('/api/upload-markdown', 403, {
    method: 'POST',
    headers: { ...auth(owner), 'content-type': 'application/json' },
    body: JSON.stringify({ categoryId: otherCategoryId, title: '越权测试', content: '# 无权写入' })
  });
  const [[afterDeniedMarkdown]] = await query('SELECT COUNT(*) AS count FROM learning_files WHERE user_id=?', [owner.id]);
  assert.equal(afterDeniedMarkdown.count, 0, '越权 Markdown 请求不得创建文件记录');

  await expectStatus('/api/upload-markdown', 201, {
    method: 'POST',
    headers: { ...auth(owner), 'content-type': 'application/json' },
    body: JSON.stringify({ categoryId: ownerCategoryId, title: '我的 Markdown', content: '# 可写入' })
  });
  const [[afterOwnMarkdown]] = await query('SELECT COUNT(*) AS count FROM learning_files WHERE user_id=?', [owner.id]);
  assert.equal(afterOwnMarkdown.count, 1, '自己的分类应可创建 Markdown 文件');

  const form = new FormData();
  form.set('categoryId', String(otherCategoryId));
  form.set('file', new Blob(['blocked'], { type: 'text/plain' }), 'blocked.txt');
  await expectStatus('/api/upload', 403, { method: 'POST', headers: auth(owner), body: form });
  const [[afterDeniedUpload]] = await query('SELECT COUNT(*) AS count FROM learning_files WHERE user_id=?', [owner.id]);
  assert.equal(afterDeniedUpload.count, 1, '越权上传不得创建文件记录');

  await expectStatus('/api/upload-markdown', 403, {
    method: 'POST',
    headers: { ...auth(owner), 'content-type': 'application/json' },
    body: JSON.stringify({ userId: other.id, categoryId: ownerCategoryId, title: '伪造身份', content: '# 不应写入' })
  });
  console.log('study-access-smoke: passed');
}

run().then(cleanUp, async (error) => {
  console.error(error.stack || error);
  await cleanUp().catch(() => {});
  process.exitCode = 1;
});
