import { strict as assert } from 'node:assert'
import { createRateLimiter, magicType, originGuard, validateUploadedFile } from '../../api/lib/security.js'
import { normalizeCommentContent, normalizeCommentSort, normalizeMediaIds, parsePositiveId, MAX_COMMENT_MEDIA_COUNT, MAX_COMMENT_MEDIA_FILE_BYTES, MAX_COMMENT_MEDIA_TOTAL_BYTES } from '../../api/lib/comments.js'
import { renderSafeMermaid } from '../../src/utils/mermaid'
import { renderMarkdown, validateBlocks } from '../../api/lib/content.js'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import request from 'supertest'

const require = createRequire(import.meta.url)
const { ensureDatabase, databaseName, cleanupEmails } = require('../support/test-db.cjs')

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'own-web-security-'))
const png = path.join(directory, 'safe.png')
fs.writeFileSync(png, Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000000020001e221bc330000000049454e44ae426082', 'hex'))
assert.equal(magicType(png, 'image/png'), 'image/png')
assert.doesNotThrow(() => validateUploadedFile({ path: png, originalname: 'safe.png', mimetype: 'image/png' }, { allowed: new Set(['image/png']), maxBytes: 1024 }))
const polyglot = path.join(directory, 'polyglot.png')
fs.writeFileSync(polyglot, Buffer.concat([fs.readFileSync(png), Buffer.from('<script>alert(1)</script>')]))
assert.throws(() => validateUploadedFile({ path: polyglot, originalname: 'polyglot.png', mimetype: 'image/png' }, { allowed: new Set(['image/png']), maxBytes: 2048 }), (error: any) => error.code === 'FILE_CONTENT_INVALID')
const binaryPolyglot = path.join(directory, 'binary-polyglot.png')
fs.writeFileSync(binaryPolyglot, Buffer.concat([fs.readFileSync(png), Buffer.from('PK\x03\x04binary-payload')]))
assert.throws(() => validateUploadedFile({ path: binaryPolyglot, originalname: 'binary-polyglot.png', mimetype: 'image/png' }, { allowed: new Set(['image/png']), maxBytes: 2048 }), (error: any) => error.code === 'FILE_CONTENT_INVALID')
const corrupt = path.join(directory, 'corrupt.png')
fs.writeFileSync(corrupt, Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489', 'hex'))
assert.throws(() => validateUploadedFile({ path: corrupt, originalname: 'corrupt.png', mimetype: 'image/png' }, { allowed: new Set(['image/png']), maxBytes: 1024 }), (error: any) => error.code === 'FILE_CONTENT_INVALID')
const svg = path.join(directory, 'evil.svg')
fs.writeFileSync(svg, '<svg><script>alert(1)</script></svg>')
assert.throws(() => validateUploadedFile({ path: svg, originalname: 'evil.svg', mimetype: 'image/svg+xml' }, { allowed: new Set(['image/svg+xml']), maxBytes: 1024 }))
const fakePng = path.join(directory, 'fake.png')
fs.writeFileSync(fakePng, '<script>not a png</script>')
assert.throws(() => validateUploadedFile({ path: fakePng, originalname: 'fake.png', mimetype: 'image/png' }, { allowed: new Set(['image/png']), maxBytes: 1024 }), (error: any) => error.code === 'FILE_TYPE_INVALID')
const oversized = path.join(directory, 'oversized.png')
fs.writeFileSync(oversized, Buffer.alloc(1025, 0x41))
assert.throws(() => validateUploadedFile({ path: oversized, originalname: 'oversized.png', mimetype: 'image/png' }, { allowed: new Set(['image/png']), maxBytes: 1024 }), (error: any) => error.code === 'FILE_SIZE_INVALID')
assert.equal(normalizeCommentSort('newest'), 'latest')
assert.equal(normalizeCommentSort('popular'), 'hot')
assert.equal(normalizeCommentSort('invalid'), 'latest')
assert.equal(parsePositiveId("1 OR 1=1"), null)
assert.equal(normalizeCommentContent('<script>alert(1)</script>'), '<script>alert(1)</script>')
assert.deepEqual(normalizeMediaIds([{ id: 4 }, 5]), [4, 5])
assert.equal(normalizeMediaIds(Array.from({ length: MAX_COMMENT_MEDIA_COUNT + 1 }, (_, index) => index + 1)), null)
assert.equal(MAX_COMMENT_MEDIA_FILE_BYTES, 5 * 1024 * 1024)
assert.equal(MAX_COMMENT_MEDIA_TOTAL_BYTES, 30 * 1024 * 1024)
let csrfStatus = 0
originGuard(['https://own-web.test'])({ method: 'POST', get: () => undefined } as any, { status: (status: number) => { csrfStatus = status; return { json: () => undefined } } } as any, () => { throw new Error('CSRF guard bypassed') })
assert.equal(csrfStatus, 403)
const rateLimiter = createRateLimiter({ limit: 1, key: (req: any) => `user:${req.user.id}`, windowMs: 60_000 })
let rateLimited = 0
const rateResponse = { setHeader: () => undefined, status: (status: number) => { rateLimited = status; return { json: () => undefined } } } as any
rateLimiter({ user: { id: 1 }, ip: '10.0.0.1' } as any, rateResponse, () => undefined)
rateLimiter({ user: { id: 1 }, ip: '10.0.0.2' } as any, rateResponse, () => undefined)
assert.equal(rateLimited, 429)
rateLimited = 0
rateLimiter({ user: { id: 2 }, ip: '10.0.0.1' } as any, rateResponse, () => undefined)
assert.equal(rateLimited, 0)
assert.equal(renderSafeMermaid('flowchart TD\nA[安全] --> B[内容]').ok, true)
assert.equal(renderSafeMermaid('flowchart TD\nA --> B\nclick A "javascript:alert(1)"').ok, false)
assert.throws(() => validateBlocks({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'data:text/html,<script>' } }] }] }] }))
assert.match(renderMarkdown('@[embed](https://evil.example/iframe) unsafe'), /&lt;|unsafe/)

async function runApiSecurityRegression() {
  await ensureDatabase()
  const port = 3304
  const origin = 'http://127.0.0.1:5173'
  const suffix = Date.now()
  const emails = [`security-owner-${suffix}@own-web.test`, `security-author-${suffix}@own-web.test`, `security-other-${suffix}@own-web.test`]
  const password = 'OwnWebTestA1!'
  const child = spawn(process.execPath, ['api/server.js'], { stdio: 'inherit', env: { ...process.env, NODE_ENV: 'test', TEST_AUTH_RATE_LIMIT_SCALE: '10', DB_NAME: databaseName, PORT: String(port), CORS_ORIGIN: origin } })
  const api = `http://127.0.0.1:${port}`
  try {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      try { if ((await fetch(`${api}/api/health`)).ok) break } catch (_) { /* startup */ }
      await new Promise(resolve => setTimeout(resolve, 250))
    }
    const owner = request.agent(api), author = request.agent(api), other = request.agent(api)
    for (const [agent, email] of [[owner, emails[0]], [author, emails[1]], [other, emails[2]]] as const) {
      assert.equal((await agent.post('/api/register').set('Origin', origin).send({ email, password })).status, 201)
      assert.equal((await agent.post('/api/login').set('Origin', origin).send({ email, password })).status, 200)
    }
    const created = await owner.post('/api/posts').set('Origin', origin).send({ title: '安全评论文章', contentFormat: 'markdown', contentMarkdown: '# security' })
    assert.equal(created.status, 201)
    const postId = created.body.post.id
    const published = await owner.put(`/api/posts/${postId}`).set('Origin', origin).send({ title: '安全评论文章', slug: `security-${suffix}`, contentFormat: 'markdown', contentMarkdown: '# security', status: 'published', visibility: 'public' })
    assert.equal(published.status, 200)
    const comment = await author.post(`/api/posts/${postId}/comments`).set('Origin', origin).send({ content: 'owned comment' })
    assert.equal(comment.status, 201)
    const commentId = comment.body.comment.id
    assert.equal((await other.delete(`/api/comments/${commentId}`).set('Origin', origin)).status, 404)
    const image = path.join(process.cwd(), 'tests/fixtures/showcase/images/kyoto-door.png')
    const upload = await author.post(`/api/posts/${postId}/comment-media`).set('Origin', origin).attach('images', image)
    assert.equal(upload.status, 201)
    const mediaId = upload.body.items[0].id
    assert.equal((await other.get(`/api/public/comment-media/${mediaId}`)).status, 404)
    assert.equal((await author.get(`/api/public/comment-media/${mediaId}`)).status, 200)
    const withMedia = await author.post(`/api/posts/${postId}/comments`).set('Origin', origin).send({ content: 'media comment', media: upload.body.items })
    assert.equal(withMedia.status, 201)
    const boundMediaId = upload.body.items[0].id
    assert.equal((await owner.get(`/api/public/comment-media/${boundMediaId}`)).status, 200)
    assert.equal((await author.delete(`/api/comments/${withMedia.body.comment.id}`).set('Origin', origin)).status, 204)
    assert.equal((await owner.get(`/api/public/comment-media/${boundMediaId}`)).status, 404)
  } finally {
    child.kill('SIGTERM')
    await cleanupEmails(emails)
  }
}

runApiSecurityRegression().then(() => {
  fs.rmSync(directory, { recursive: true, force: true })
  console.log('security regression checks passed')
}).catch(error => {
  fs.rmSync(directory, { recursive: true, force: true })
  console.error(error)
  process.exitCode = 1
})
