const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const { spawn } = require('node:child_process');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2');

const apiRoot = path.join(__dirname, '..');
dotenv.config({ path: path.join(apiRoot, '..', '.env') });
for (const key of ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'AUTH_SECRET']) assert(process.env[key], `缺少 ${key}，无法运行账户访问测试`);

const suffix = `account-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
const port = 36000 + Math.floor(Math.random() * 1000);
const email = `Account-${suffix}@Example.Test`;
const password = 'Account-Pass-123';
const newPassword = 'Account-Next-456';
const testDatabase = process.env.TEST_DB_NAME || 'own_web_test';
const db = mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: testDatabase });
const query = db.promise().query.bind(db.promise());
let server;
let userId;

function auth() { return { authorization: `Bearer ${jwt.sign({ sub: String(userId), email: email.toLowerCase() }, process.env.AUTH_SECRET, { expiresIn: '5m' })}` }; }
async function request(pathname, options = {}) { options.headers = { Origin:'http://localhost:5173', ...(options.headers || {}) }; const response = await fetch(`http://127.0.0.1:${port}${pathname}`, options); const text = await response.text(); let body; try { body = text ? JSON.parse(text) : null; } catch (_) { body = text; } return { status: response.status, body, headers: response.headers }; }
async function expectStatus(pathname, status, options) { const result = await request(pathname, options); assert.equal(result.status, status, `${options?.method || 'GET'} ${pathname} 应返回 ${status}，实际为 ${result.status}: ${JSON.stringify(result.body)}`); return result; }
async function waitForServer() { const deadline = Date.now() + 20000; while (Date.now() < deadline) { try { if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) return; } catch (_) {} await new Promise((resolve) => setTimeout(resolve, 200)); } throw new Error('账户测试服务器启动超时'); }
async function cleanUp() { if (server && !server.killed) { server.kill(); await new Promise((resolve) => server.once('exit', resolve)); } if (userId) await query('DELETE FROM users WHERE id=?', [userId]); await db.promise().end(); }

async function run() {
  server = spawn(process.execPath, ['server.js'], { cwd: apiRoot, env: { ...process.env, DB_NAME:testDatabase, PORT: String(port), CORS_ORIGIN:'http://localhost:5173' }, stdio: ['ignore', 'ignore', 'ignore'], windowsHide: true });
  await waitForServer();
  await expectStatus('/api/register', 400, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'invalid', password }) });
  await expectStatus('/api/register', 400, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'short' }) });
  const registered = await expectStatus('/api/register', 201, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
  userId = registered.body.userId;
  const [[user]] = await query('SELECT id,email,username FROM users WHERE id=?', [userId]);
  assert.equal(user.email, email.toLowerCase(), '注册邮箱应标准化为小写');
  assert.match(user.username, /^用户\d+$/, '注册用户应获得稳定的非冲突默认用户名');
  const [[categoryCount]] = await query('SELECT COUNT(*) count FROM learning_categories WHERE user_id=?', [userId]);
  assert.equal(categoryCount.count, 7, '注册后应创建七个默认学习分类');
  const duplicate = await expectStatus('/api/register', 409, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: email.toLowerCase(), password }) });
  assert.equal(duplicate.body.error.code, 'EMAIL_TAKEN', '重复邮箱应返回统一错误码');
  const login = await expectStatus('/api/login', 200, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: email.toLowerCase(), password }) });
  assert(login.headers.get('set-cookie')?.includes('HttpOnly'), '登录应签发 HttpOnly 会话 Cookie');
  await expectStatus(`/api/user/${userId}/password`, 401, { method: 'PUT', headers: { ...auth(), 'content-type': 'application/json' }, body: JSON.stringify({ oldPassword: '错误密码', newPassword }) });
  await expectStatus(`/api/user/${userId}/password`, 200, { method: 'PUT', headers: { ...auth(), 'content-type': 'application/json' }, body: JSON.stringify({ oldPassword: password, newPassword }) });
  await expectStatus('/api/login', 401, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: email.toLowerCase(), password }) });
  await expectStatus('/api/login', 200, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: email.toLowerCase(), password: newPassword }) });
  console.log('auth-account-smoke: passed');
}

run().then(cleanUp, async (error) => { console.error(error.stack || error); await cleanUp().catch(() => {}); process.exitCode = 1; });
