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

for (const key of ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'AUTH_SECRET']) {
  assert(process.env[key], `缺少 ${key}，无法运行媒体访问测试`);
}

const suffix = `media-access-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
const port = 35000 + Math.floor(Math.random() * 1000);
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});
const query = db.promise().query.bind(db.promise());
let server;
let owner;
let other;
let image;
let video;
let music;
const files = [];

function auth(user) {
  const token = jwt.sign({ sub: String(user.id), email: user.email }, process.env.AUTH_SECRET, { expiresIn: '5m' });
  return { authorization: `Bearer ${token}` };
}

async function request(pathname, options = {}) {
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
      if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) return;
    } catch (_) {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('媒体访问测试服务器启动超时');
}

async function createUser(role) {
  const username = `${role}-${suffix}`.slice(0, 50);
  const email = `${role}-${suffix}@example.test`.slice(0, 100);
  const blogSlug = `${role}-${suffix}`.slice(0, 50);
  const [result] = await query(
    'INSERT INTO users (username,email,password,blog_slug,profile_visibility) VALUES (?,?,?,?,?)',
    [username, email, 'audit-only-password', blogSlug, 'public']
  );
  return { id: result.insertId, email };
}

function createOwnedFile(kind, extension) {
  const folder = path.join(apiRoot, 'uploads', 'entertainment', kind, String(owner.id));
  const filename = `${suffix}-${kind}${extension}`;
  const fullPath = path.join(folder, filename);
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(fullPath, Buffer.from('media-access-audit-content'));
  files.push(fullPath);
  return { fullPath, relativePath: `/uploads/entertainment/${kind}/${owner.id}/${filename}` };
}

async function insertMedia() {
  const imageFile = createOwnedFile('images', '.png');
  const videoFile = createOwnedFile('videos', '.mp4');
  const musicFile = createOwnedFile('music', '.mp3');
  const [imageResult] = await query(
    'INSERT INTO entertainment_images (user_id,title,style,file_type,file_size,file_path,description,width,height) VALUES (?,?,?,?,?,?,?,?,?)',
    [owner.id, `image-${suffix}`, '旧分类', '.png', 24, imageFile.relativePath, 'audit image', 1, 1]
  );
  const [videoResult] = await query(
    'INSERT INTO entertainment_videos (user_id,title,file_type,file_size,file_path,duration,frame_rate,frame_count) VALUES (?,?,?,?,?,?,?,?)',
    [owner.id, `video-${suffix}`, '.mp4', 24, videoFile.relativePath, '0:01', '1fps', 1]
  );
  const [musicResult] = await query(
    'INSERT INTO entertainment_music (user_id,title,artist,album,file_type,file_size,file_path,duration,play_count) VALUES (?,?,?,?,?,?,?,?,?)',
    [owner.id, `music-${suffix}`, 'audit artist', '', '.mp3', 24, musicFile.relativePath, '0:01', 0]
  );
  image = { id: imageResult.insertId, ...imageFile };
  video = { id: videoResult.insertId, ...videoFile };
  music = { id: musicResult.insertId, ...musicFile };
}

async function cleanUp() {
  if (server && !server.killed) {
    server.kill();
    await new Promise((resolve) => server.once('exit', resolve));
  }
  for (const fullPath of files) fs.rmSync(fullPath, { force: true });
  const userIds = [owner?.id, other?.id].filter(Boolean);
  if (userIds.length) await query('DELETE FROM users WHERE id IN (?)', [userIds]);
  await db.promise().end();
}

async function run() {
  server = spawn(process.execPath, ['server.js'], {
    cwd: apiRoot,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'ignore', 'ignore'],
    windowsHide: true
  });
  await waitForServer();
  owner = await createUser('media-owner');
  other = await createUser('media-other');
  await insertMedia();

  await expectStatus(`/api/entertainment/image-file/${image.id}`, 401);
  const compatibilityList = await expectStatus(`/api/entertainment/images/${other.id}`, 200, { headers: auth(owner) });
  assert.equal(compatibilityList.images.length, 1, '兼容路径的 userId 参数不得改变会话资源范围');
  assert.equal(compatibilityList.images[0].id, image.id, '兼容路径必须仍返回当前会话用户的资源');
  await expectStatus(`/api/entertainment/image-file/${image.id}`, 404, { headers: auth(other) });
  await expectStatus(`/api/entertainment/video-file/${video.id}`, 404, { headers: auth(other) });
  await expectStatus(`/api/entertainment/music-file/${music.id}`, 404, { headers: auth(other) });
  await expectStatus(`/api/entertainment/images/${image.id}`, 404, {
    method: 'PUT', headers: { ...auth(other), 'content-type': 'application/json' }, body: JSON.stringify({ title: '越权', style: '越权', description: '越权' })
  });
  await expectStatus('/api/entertainment/images', 404, {
    method: 'DELETE', headers: { ...auth(other), 'content-type': 'application/json' }, body: JSON.stringify({ imageIds: [image.id] })
  });
  await expectStatus('/api/entertainment/videos', 404, {
    method: 'DELETE', headers: { ...auth(other), 'content-type': 'application/json' }, body: JSON.stringify({ videoIds: [video.id] })
  });
  await expectStatus('/api/entertainment/music', 404, {
    method: 'DELETE', headers: { ...auth(other), 'content-type': 'application/json' }, body: JSON.stringify({ musicIds: [music.id] })
  });
  const [[ownedImage]] = await query('SELECT id FROM entertainment_images WHERE id=?', [image.id]);
  assert(ownedImage, '越权删除不得移除所有者的图片记录');
  assert(fs.existsSync(image.fullPath), '越权删除不得移除所有者的图片文件');

  await expectStatus('/api/entertainment/images/batch-style', 400, {
    method: 'PUT', headers: { ...auth(owner), 'content-type': 'application/json' }, body: JSON.stringify({ imageIds: [image.id, 'not-an-id'], style: '资料' })
  });
  const styleResult = await expectStatus('/api/entertainment/images/batch-style', 200, {
    method: 'PUT', headers: { ...auth(owner), 'content-type': 'application/json' }, body: JSON.stringify({ imageIds: [image.id], style: '资料' })
  });
  assert.equal(styleResult.affectedRows, 1, '批量归类应返回实际影响行数');
  await expectStatus(`/api/entertainment/music/${music.id}/lyrics`, 404, {
    method: 'PUT', headers: { ...auth(other), 'content-type': 'application/json' }, body: JSON.stringify({ lyrics: '[00:00] 越权' })
  });
  await expectStatus(`/api/entertainment/music/${music.id}/lyrics`, 200, {
    method: 'PUT', headers: { ...auth(owner), 'content-type': 'application/json' }, body: JSON.stringify({ lyrics: '[00:00] 所有者' })
  });
  await expectStatus(`/api/entertainment/music/${music.id}/play`, 200, { method: 'POST', headers: auth(owner) });
  await expectStatus(`/api/entertainment/video-file/${video.id}`, 206, { headers: { ...auth(owner), range: 'bytes=0-3' } });

  const imageDelete = await expectStatus('/api/entertainment/images', 200, {
    method: 'DELETE', headers: { ...auth(owner), 'content-type': 'application/json' }, body: JSON.stringify({ imageIds: [image.id] })
  });
  const videoDelete = await expectStatus('/api/entertainment/videos', 200, {
    method: 'DELETE', headers: { ...auth(owner), 'content-type': 'application/json' }, body: JSON.stringify({ videoIds: [video.id] })
  });
  const musicDelete = await expectStatus('/api/entertainment/music', 200, {
    method: 'DELETE', headers: { ...auth(owner), 'content-type': 'application/json' }, body: JSON.stringify({ musicIds: [music.id] })
  });
  for (const result of [imageDelete, videoDelete, musicDelete]) {
    assert.equal(result.count, 1, '删除响应必须返回实际删除数量');
    assert.equal(result.cleanupFailed, false, '审计文件应被成功清理');
  }
  for (const media of [image, video, music]) assert.equal(fs.existsSync(media.fullPath), false, '数据库删除后应清理受保护媒体文件');
  console.log('media-access-smoke: passed');
}

run().then(cleanUp, async (error) => {
  console.error(error.stack || error);
  await cleanUp().catch(() => {});
  process.exitCode = 1;
});
