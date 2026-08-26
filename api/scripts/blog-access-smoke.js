const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const dotenv = require('dotenv');
const express = require('express');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2');
const { mountBlogRoutes } = require('../blog');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'AUTH_SECRET'];
for (const key of required) assert(process.env[key], `缺少 ${key}，无法运行访问矩阵`);

const suffix = `access-audit-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});
const query = db.promise().query.bind(db.promise());
const uploadRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'own-web-blog-access-'));
let server;
let author;
let follower;
let stranger;
let posts = {};
let privateTagId;

const tokenFor = (user) => jwt.sign({ sub: user.id, email: user.email }, process.env.AUTH_SECRET, { expiresIn: '5m' });
const auth = (user) => ({ authorization: `Bearer ${tokenFor(user)}` });

async function request(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch (_) { body = text; }
  return { status: response.status, body };
}

async function expectStatus(baseUrl, pathname, expected, options) {
  const result = await request(baseUrl, pathname, options);
  assert.equal(result.status, expected, `${options?.method || 'GET'} ${pathname} 应返回 ${expected}，实际为 ${result.status}: ${JSON.stringify(result.body)}`);
  return result.body;
}

async function createUser(role) {
  const username = `${role}-${suffix}`.slice(0, 50);
  const email = `${role}-${suffix}@example.test`.slice(0, 100);
  const blogSlug = `${role}-${suffix}`.slice(0, 50);
  const [result] = await query('INSERT INTO users (username,email,password,blog_slug,profile_visibility) VALUES (?,?,?,?,?)', [username, email, 'audit-only-password', blogSlug, 'public']);
  return { id: result.insertId, email, username, blogSlug };
}

async function createPost(visibility, status = 'published') {
  const slug = `${visibility}-${status}-${suffix}`.slice(0, 180);
  const shareToken = crypto.randomBytes(32).toString('hex');
  const [result] = await query(
    'INSERT INTO posts (author_id,title,slug,excerpt,content_markdown,content_html,status,visibility,share_token,allow_comments,published_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    [author.id, `${visibility} ${status}`, slug, 'audit', '访问矩阵测试', '<p>访问矩阵测试</p>', status, visibility, shareToken, true, status === 'published' ? new Date() : null]
  );
  return { id: result.insertId, slug, shareToken };
}

async function startTestServer() {
  const app = express();
  app.use(express.json());
  mountBlogRoutes(app, db, {
    getAuthToken(req) {
      const header = req.headers.authorization || '';
      return header.startsWith('Bearer ') ? header.slice(7) : null;
    },
    authSecret: process.env.AUTH_SECRET,
    uploadRoot
  });
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: { code: 'INTERNAL', message: error.message } }));
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  return `http://127.0.0.1:${server.address().port}`;
}

async function cleanUp() {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (author || follower || stranger) {
    await query('DELETE FROM users WHERE id IN (?,?,?)', [author?.id || 0, follower?.id || 0, stranger?.id || 0]);
  }
  if (privateTagId) await query('DELETE FROM tags WHERE id=?', [privateTagId]);
  fs.rmSync(uploadRoot, { recursive: true, force: true });
  await db.promise().end();
}

async function run() {
  author = await createUser('author');
  follower = await createUser('follower');
  stranger = await createUser('stranger');
  posts.public = await createPost('public');
  posts.private = await createPost('private');
  posts.followers = await createPost('followers');
  posts.unlisted = await createPost('unlisted');
  posts.draft = await createPost('private', 'draft');
  await query('INSERT INTO follows (follower_id,following_id) VALUES (?,?)', [follower.id, author.id]);
  const [tag] = await query('INSERT INTO tags (name,slug) VALUES (?,?)', [`私有审计 ${suffix}`.slice(0, 60), `private-${suffix}`.slice(0, 80)]);
  privateTagId = tag.insertId;
  await query('INSERT INTO post_tags (post_id,tag_id) VALUES (?,?)', [posts.private.id, privateTagId]);

  const baseUrl = await startTestServer();
  await expectStatus(baseUrl, `/api/public/posts/${posts.public.slug}`, 200);
  const publicPost = await expectStatus(baseUrl, `/api/public/posts/${posts.public.slug}`, 200);
  assert.equal('share_token' in publicPost.post, false, '公开 DTO 不得包含 share_token');
  assert.equal('author_id' in publicPost.post, false, '公开 DTO 不得包含 author_id');
  await expectStatus(baseUrl, `/api/posts/${posts.private.id}/comments`, 401);
  await expectStatus(baseUrl, `/api/posts/${posts.private.id}/comments`, 200, { headers: auth(author) });
  await expectStatus(baseUrl, `/api/posts/${posts.private.id}/comments`, 403, { headers: auth(stranger) });
  await expectStatus(baseUrl, `/api/posts/${posts.followers.id}/comments`, 200, { headers: auth(follower) });
  await expectStatus(baseUrl, `/api/posts/${posts.followers.id}/comments`, 403, { headers: auth(stranger) });
  await expectStatus(baseUrl, `/api/posts/${posts.unlisted.id}/comments`, 404, { headers: auth(stranger) });
  await expectStatus(baseUrl, `/api/posts/${posts.unlisted.id}/comments?share=${posts.unlisted.shareToken}`, 200);
  await expectStatus(baseUrl, `/api/posts/${posts.private.id}/like`, 403, { method: 'POST', headers: auth(stranger) });
  await expectStatus(baseUrl, `/api/posts/${posts.followers.id}/like`, 200, { method: 'POST', headers: auth(follower) });
  await expectStatus(baseUrl, `/api/posts/${posts.followers.id}/like`, 200, { method: 'POST', headers: auth(follower) });
  const [[likedPost]] = await query('SELECT like_count FROM posts WHERE id=?', [posts.followers.id]);
  assert.equal(likedPost.like_count, 1, '重复点赞只能累计一次');
  await expectStatus(baseUrl, `/api/posts/${posts.private.id}/bookmark`, 403, { method: 'POST', headers: auth(stranger) });
  await expectStatus(baseUrl, `/api/posts/${posts.followers.id}/bookmark`, 200, { method: 'POST', headers: auth(follower) });
  await expectStatus(baseUrl, `/api/posts/${posts.unlisted.id}/bookmark?share=${posts.unlisted.shareToken}`, 400, { method: 'POST', headers: auth(follower) });
  await expectStatus(baseUrl, `/api/posts/${posts.draft.id}/comments`, 403, { method: 'POST', headers: { ...auth(stranger), 'content-type': 'application/json' }, body: JSON.stringify({ content: '不应写入' }) });
  await expectStatus(baseUrl, `/api/posts/${posts.followers.id}/comments`, 201, { method: 'POST', headers: { ...auth(follower), 'content-type': 'application/json' }, body: JSON.stringify({ content: '关注者可评论' }) });
  await expectStatus(baseUrl, '/api/public/taxonomy', 200).then((taxonomy) => assert.equal(taxonomy.tags.some((tagItem) => tagItem.id === privateTagId || tagItem.slug === `private-${suffix}`), false, '私有文章标签不得进入公开分类'));
  const form = new FormData();
  form.set('postId', String(posts.private.id));
  form.set('altText', '访问审计图片');
  form.set('image', new Blob([Buffer.from([137, 80, 78, 71])], { type: 'image/png' }), 'audit.png');
  await expectStatus(baseUrl, '/api/posts/media', 403, { method: 'POST', headers: auth(stranger), body: form });
  console.log('blog-access-smoke: passed');
}

run().then(cleanUp, async (error) => {
  console.error(error.stack || error);
  await cleanUp().catch(() => {});
  process.exitCode = 1;
});
