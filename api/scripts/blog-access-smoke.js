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
const testDatabase = process.env.TEST_DB_NAME || 'own_web_test';
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: testDatabase
});
const query = db.promise().query.bind(db.promise());
const uploadRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'own-web-blog-access-'));
const validPng = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000000020001e221bc330000000049454e44ae426082', 'hex');
let server;
let author;
let follower;
let stranger;
let posts = {};
let privateTagId;
const mediaFiles = [];

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

async function createPostMedia(post) {
  const filename = `media-${post.id}-${suffix}.png`;
  const relativePath = path.join('posts', String(author.id), filename);
  const absolutePath = path.join(uploadRoot, relativePath);
  const storedPath = path.relative(path.dirname(uploadRoot), absolutePath).replace(/\\/g, '/');
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, validPng);
  mediaFiles.push(absolutePath);
  const [result] = await query('INSERT INTO post_media (owner_id,post_id,file_path,mime_type,alt_text) VALUES (?,?,?,?,?)', [author.id, post.id, storedPath, 'image/png', '访问审计媒体']);
  return result.insertId;
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
  mediaFiles.forEach((file) => fs.rmSync(file, { force: true }));
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
  posts.privateMediaId = await createPostMedia(posts.private);
  posts.unlistedMediaId = await createPostMedia(posts.unlisted);
  await query('INSERT INTO follows (follower_id,following_id) VALUES (?,?)', [follower.id, author.id]);
  const [tag] = await query('INSERT INTO tags (name,slug) VALUES (?,?)', [`私有审计 ${suffix}`.slice(0, 60), `private-${suffix}`.slice(0, 80)]);
  privateTagId = tag.insertId;
  await query('INSERT INTO post_tags (post_id,tag_id) VALUES (?,?)', [posts.private.id, privateTagId]);

  const baseUrl = await startTestServer();
  const followersAudioForm = new FormData();
  followersAudioForm.set('postId', String(posts.followers.id));
  followersAudioForm.set('label', '关注者音频');
  followersAudioForm.set('media', new Blob([Buffer.from('ID3')], { type: 'audio/mpeg' }), 'followers.mp3');
  const followersAudio = await expectStatus(baseUrl, '/api/posts/media/attachment', 201, { method: 'POST', headers: auth(author), body: followersAudioForm });
  const unlistedAudioForm = new FormData();
  unlistedAudioForm.set('postId', String(posts.unlisted.id));
  unlistedAudioForm.set('label', '仅链接音频');
  unlistedAudioForm.set('media', new Blob([Buffer.from('ID3')], { type: 'audio/mpeg' }), 'unlisted.mp3');
  const unlistedAudio = await expectStatus(baseUrl, '/api/posts/media/attachment', 201, { method: 'POST', headers: auth(author), body: unlistedAudioForm });
  await expectStatus(baseUrl, followersAudio.media.url, 403, { headers: auth(stranger) });
  await expectStatus(baseUrl, followersAudio.media.url, 200, { headers: auth(follower) });
  await expectStatus(baseUrl, unlistedAudio.media.url, 404, { headers: auth(stranger) });
  await expectStatus(baseUrl, `${unlistedAudio.media.url}?share=${posts.unlisted.shareToken}`, 200);
  await expectStatus(baseUrl, '/api/me/avatar', 401, { method: 'POST' });
  const avatarForm = new FormData();
  avatarForm.set('avatar', new Blob([validPng], { type: 'image/png' }), 'avatar.png');
  const avatarResult = await expectStatus(baseUrl, '/api/me/avatar', 201, { method: 'POST', headers: auth(author), body: avatarForm });
  assert.equal(avatarResult.avatarUrl, `/api/public/avatars/${author.id}`, '头像上传应返回公开读取 URL');
  await expectStatus(baseUrl, `/api/public/avatars/${author.id}`, 200);
  await query("UPDATE users SET profile_visibility='private' WHERE id=?", [author.id]);
  await expectStatus(baseUrl, `/api/public/avatars/${author.id}`, 404);
  await expectStatus(baseUrl, `/api/public/avatars/${author.id}`, 200, { headers: auth(author) });
  await query("UPDATE users SET profile_visibility='public' WHERE id=?", [author.id]);
  await expectStatus(baseUrl, '/api/me/blog-profile', 400, { method: 'PUT', headers: { ...auth(author), 'content-type': 'application/json' }, body: JSON.stringify({ blogSlug: author.blogSlug, socialLinks: { website: 'javascript:alert(1)' } }) });
  const savedProfile = await expectStatus(baseUrl, '/api/me/blog-profile', 200, { method: 'PUT', headers: { ...auth(author), 'content-type': 'application/json' }, body: JSON.stringify({ blogTitle: '访问审计主页', blogSlug: author.blogSlug, socialLinks: { website: 'https://example.com/profile', github: 'https://github.com/example' }, profileVisibility: 'public' }) });
  const savedLinks = typeof savedProfile.profile.social_links === 'string' ? JSON.parse(savedProfile.profile.social_links) : savedProfile.profile.social_links;
  assert.equal(savedLinks.website, 'https://example.com/profile', '社交链接应由服务端规范化后保存');
  await expectStatus(baseUrl, `/api/public/posts/${posts.public.slug}`, 200);
  const publicPost = await expectStatus(baseUrl, `/api/public/posts/${posts.public.slug}`, 200);
  assert.equal('share_token' in publicPost.post, false, '公开 DTO 不得包含 share_token');
  assert.equal('author_id' in publicPost.post, false, '公开 DTO 不得包含 author_id');
  const publicListing = await expectStatus(baseUrl, '/api/public/posts?feed=discover', 200);
  assert.deepEqual(publicListing.items.map((item) => item.id), [posts.public.id], '公开发现流只能包含已发布公开文章');
  assert.equal('content_markdown' in publicListing.items[0], false, '文章列表不得返回完整正文');
  await expectStatus(baseUrl, '/api/public/posts?feed=following', 401);
  const followingListing = await expectStatus(baseUrl, '/api/public/posts?feed=following', 200, { headers: auth(follower) });
  assert.deepEqual(followingListing.items.map((item) => item.id), [posts.public.id], '关注流只能包含已关注作者的公开文章');
  const creatorsForAuthor = await expectStatus(baseUrl, '/api/public/creators', 200, { headers: auth(author) });
  assert.equal(creatorsForAuthor.items.some((item) => item.id === author.id), false, '创作者推荐不得包含当前用户');
  await expectStatus(baseUrl, '/api/posts', 400, {
    method: 'POST', headers: { ...auth(author), 'content-type': 'application/json' },
    body: JSON.stringify({ title: '非法块', contentBlocks: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '危险链接', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }] } })
  });
  await expectStatus(baseUrl, '/api/posts', 400, {
    method: 'POST', headers: { ...auth(author), 'content-type': 'application/json' },
    body: JSON.stringify({ title: '非法嵌入', contentBlocks: { type: 'doc', content: [{ type: 'embed', attrs: { url: 'https://example.test/embed' } }] } })
  });
  await expectStatus(baseUrl, '/api/posts', 400, {
    method: 'POST', headers: { ...auth(author), 'content-type': 'application/json' },
    body: JSON.stringify({ title: '非法媒体块', contentBlocks: { type: 'doc', content: [{ type: 'audio', attrs: { src: 'https://example.test/audio.mp3', label: '不可信来源' } }] } })
  });
  const foreignAttachment = new FormData();
  foreignAttachment.set('postId', String(posts.private.id));
  foreignAttachment.set('label', '不应写入的音频');
  foreignAttachment.set('media', new Blob([Buffer.from('ID3')], { type: 'audio/mpeg' }), 'blocked.mp3');
  await expectStatus(baseUrl, '/api/posts/media/attachment', 403, { method: 'POST', headers: auth(stranger), body: foreignAttachment });
  const ownAttachment = new FormData();
  ownAttachment.set('postId', String(posts.private.id));
  ownAttachment.set('label', '所有者音频');
  ownAttachment.set('media', new Blob([Buffer.from('ID3')], { type: 'audio/mpeg' }), 'owned.mp3');
  const uploadedAttachment = await expectStatus(baseUrl, '/api/posts/media/attachment', 201, { method: 'POST', headers: auth(author), body: ownAttachment });
  assert.equal(uploadedAttachment.media.kind, 'audio', '音频上传应保留受控媒体类型');
  await expectStatus(baseUrl, uploadedAttachment.media.url, 403, { headers: auth(stranger) });
  await expectStatus(baseUrl, uploadedAttachment.media.url, 200, { headers: auth(author) });
  const mismatchedAttachment = new FormData();
  mismatchedAttachment.set('postId', String(posts.private.id));
  mismatchedAttachment.set('label', '伪造音频');
  mismatchedAttachment.set('media', new Blob([Buffer.from('<html>not media</html>')], { type: 'audio/mpeg' }), 'spoofed.mp3');
  await expectStatus(baseUrl, '/api/posts/media/attachment', 400, { method: 'POST', headers: auth(author), body: mismatchedAttachment });
  const safeBlocks = { type: 'doc', content: [
    { type: 'callout', attrs: { tone: 'note' }, content: [{ type: 'text', text: '安全提示' }] },
    { type: 'details', attrs: { summary: '展开说明', body: '折叠内容' } },
    { type: 'embed', attrs: { url: 'https://www.youtube.com/watch?v=abc123' } }
  ] };
  const safeBlocksPost = await expectStatus(baseUrl, '/api/posts', 201, { method: 'POST', headers: { ...auth(author), 'content-type': 'application/json' }, body: JSON.stringify({ title: '安全块审计', contentBlocks: safeBlocks }) });
  const blockAttachment = new FormData();
  blockAttachment.set('postId', String(safeBlocksPost.post.id));
  blockAttachment.set('label', '文章内音频');
  blockAttachment.set('media', new Blob([Buffer.from('ID3')], { type: 'audio/mpeg' }), 'article.mp3');
  const articleAudio = await expectStatus(baseUrl, '/api/posts/media/attachment', 201, { method: 'POST', headers: auth(author), body: blockAttachment });
  const galleryImageForm = new FormData();
  galleryImageForm.set('postId', String(safeBlocksPost.post.id));
  galleryImageForm.set('altText', '图库审计图片');
  galleryImageForm.set('image', new Blob([validPng], { type: 'image/png' }), 'gallery.png');
  const galleryImage = await expectStatus(baseUrl, '/api/posts/media', 201, { method: 'POST', headers: auth(author), body: galleryImageForm });
  await expectStatus(baseUrl, `/api/posts/${safeBlocksPost.post.id}`, 403, { method: 'PUT', headers: { ...auth(author), 'content-type': 'application/json' }, body: JSON.stringify({ contentBlocks: { type: 'doc', content: [...safeBlocks.content, { type: 'audio', attrs: { src: uploadedAttachment.media.url, label: uploadedAttachment.media.label } }] } }) });
  safeBlocks.content.push({ type: 'gallery', attrs: { items: [{ src: galleryImage.media.url, alt: galleryImage.media.altText }] } }, { type: 'audio', attrs: { src: articleAudio.media.url, label: articleAudio.media.label } });
  await expectStatus(baseUrl, `/api/posts/${safeBlocksPost.post.id}`, 200, { method: 'PUT', headers: { ...auth(author), 'content-type': 'application/json' }, body: JSON.stringify({ contentBlocks: safeBlocks }) });
  await expectStatus(baseUrl, `/api/posts/${safeBlocksPost.post.id}`, 200, { headers: auth(author) }).then((body) => { assert.match(body.post.content_html, /data-callout="note"/, '提示卡应生成安全 HTML'); assert.match(body.post.content_html, /data-gallery/, '图库应生成安全 HTML'); assert.match(body.post.content_html, /<audio controls/, '音频块应生成受控播放元素'); });
  const blockDoc = { type: 'doc', content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '结构化内容' }] },
    { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: '列名' }] }] }] }] }
  ] };
  const newBlockPost = await expectStatus(baseUrl, '/api/posts', 201, { method: 'POST', headers: { ...auth(author), 'content-type': 'application/json' }, body: JSON.stringify({ title: '块编辑审计', contentBlocks: blockDoc }) });
  await expectStatus(baseUrl, `/api/posts/${newBlockPost.post.id}`, 200, { headers: auth(author) }).then((body) => {
    assert.equal(body.post.content_format, 'blocks', '块文章应保存内容格式');
    assert.match(body.post.content_html, /<table>/, '块文章应生成安全的表格 HTML');
  });
  await expectStatus(baseUrl, `/api/posts/${posts.private.id}/comments`, 401);
  await expectStatus(baseUrl, `/api/posts/${posts.private.id}/comments`, 200, { headers: auth(author) });
  await expectStatus(baseUrl, `/api/posts/${posts.private.id}/comments`, 403, { headers: auth(stranger) });
  await expectStatus(baseUrl, `/api/posts/${posts.followers.id}/comments`, 200, { headers: auth(follower) });
  await expectStatus(baseUrl, `/api/posts/${posts.followers.id}/comments`, 403, { headers: auth(stranger) });
  await expectStatus(baseUrl, `/api/posts/${posts.unlisted.id}/comments`, 404, { headers: auth(stranger) });
  await expectStatus(baseUrl, `/api/posts/${posts.unlisted.id}/comments?share=${posts.unlisted.shareToken}`, 200);
  await expectStatus(baseUrl, `/api/public/media/${posts.privateMediaId}`, 403, { headers: auth(stranger) });
  await expectStatus(baseUrl, `/api/public/media/${posts.privateMediaId}`, 200, { headers: auth(author) });
  await expectStatus(baseUrl, `/api/public/media/${posts.unlistedMediaId}`, 404, { headers: auth(stranger) });
  await expectStatus(baseUrl, `/api/public/media/${posts.unlistedMediaId}?share=${posts.unlisted.shareToken}`, 200);
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
  form.set('image', new Blob([validPng], { type: 'image/png' }), 'audit.png');
  await expectStatus(baseUrl, '/api/posts/media', 403, { method: 'POST', headers: auth(stranger), body: form });
  console.log('blog-access-smoke: passed');
}

run().then(cleanUp, async (error) => {
  console.error(error.stack || error);
  await cleanUp().catch(() => {});
  process.exitCode = 1;
});
