import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import request from 'supertest'
import { imageDimensions, magicType, validateUploadedFile } from '../../api/lib/security.js'

const require = createRequire(import.meta.url)
const { ensureDatabase, databaseName, cleanupEmails } = require('../support/test-db.cjs')

const origin = 'http://127.0.0.1:5173'
const port = 3307
const suffix = Date.now()
const emails = [
  `report-security-author-${suffix}@own-web.test`,
  `report-security-user-${suffix}@own-web.test`,
  `report-security-other-${suffix}@own-web.test`,
]
const password = 'OwnWebReportSecurityA1!'
const fixturePng = path.join(process.cwd(), 'tests/fixtures/showcase/images/kyoto-door.png')

function waitForApi(api: string) {
  return (async () => {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      try { if ((await fetch(`${api}/api/health`)).ok) return } catch (_) { /* starting */ }
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    throw new Error('report security API did not start')
  })()
}

function assertRejectedUpload(file: string, options: any, code?: string) {
  assert.throws(() => validateUploadedFile({ path: file, originalname: path.basename(file), mimetype: options.declared }, options), (error: any) => !code || error.code === code)
}

async function login(agent: request.SuperAgentTest, email: string) {
  assert.equal((await agent.post('/api/register').set('Origin', origin).send({ email, password })).status, 201)
  assert.equal((await agent.post('/api/login').set('Origin', origin).send({ email, password })).status, 200)
}

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'own-web-report-security-'))
  const svg = path.join(directory, 'evil.svg')
  const fakePng = path.join(directory, 'fake.png')
  const oversized = path.join(directory, 'oversized.png')
  fs.writeFileSync(svg, '<svg><script>alert(1)</script></svg>')
  fs.writeFileSync(fakePng, '<script>not a png</script>')
  fs.writeFileSync(oversized, Buffer.alloc(6 * 1024 * 1024, 0x41))
  assert.equal(magicType(fixturePng, 'image/png'), 'image/png')
  assert.ok(imageDimensions(fixturePng)?.width)
  assertRejectedUpload(svg, { allowed: new Set(['image/png', 'image/jpeg', 'image/webp']), maxBytes: 5 * 1024 * 1024, declared: 'image/svg+xml' }, 'SVG_NOT_ALLOWED')
  assertRejectedUpload(fakePng, { allowed: new Set(['image/png']), maxBytes: 5 * 1024 * 1024, declared: 'image/png' }, 'FILE_TYPE_INVALID')
  assertRejectedUpload(oversized, { allowed: new Set(['image/png']), maxBytes: 5 * 1024 * 1024, declared: 'image/png' }, 'FILE_SIZE_INVALID')

  await ensureDatabase()
  const child = spawn(process.execPath, ['api/server.js'], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'test', TEST_AUTH_RATE_LIMIT_SCALE: '10', DB_NAME: databaseName, PORT: String(port), CORS_ORIGIN: origin, ADMIN_EMAILS: 'not-this-user@own-web.test' },
  })
  const api = `http://127.0.0.1:${port}`
  try {
    await waitForApi(api)
    const author = request.agent(api)
    const user = request.agent(api)
    const other = request.agent(api)
    await login(author, emails[0]); await login(user, emails[1]); await login(other, emails[2])

    const created = await author.post('/api/posts').set('Origin', origin).send({ title: 'report security', contentFormat: 'markdown', contentMarkdown: 'safe body' })
    assert.equal(created.status, 201)
    const postId = created.body.post.id
    const published = await author.put(`/api/posts/${postId}`).set('Origin', origin).send({ title: 'report security', slug: `report-security-${suffix}`, contentFormat: 'markdown', contentMarkdown: 'safe body', status: 'published', visibility: 'public' })
    assert.equal(published.status, 200)

    const csrf = await user.post('/api/reports').send({ postId, reason_code: 'spam' })
    assert.equal(csrf.status, 403)
    assert.equal(csrf.body.error.code, 'CSRF_ORIGIN_REQUIRED')

    const xss = await user.post('/api/reports').set('Origin', origin).send({ postId, reason_code: 'other', details: '<img src=x onerror=alert(1)>' })
    assert.equal(xss.status, 201)
    const reportId = xss.body.report.id
    const own = await user.get(`/api/reports/${reportId}`)
    assert.equal(own.status, 200)
    assert.match(own.body.report.details, /onerror/)
    assert.equal('internal_note' in own.body.report, false)

    const privatePost = await author.post('/api/posts').set('Origin', origin).send({ title: 'private report target', contentFormat: 'markdown', contentMarkdown: 'private' })
    assert.equal(privatePost.status, 201)
    const privatePublished = await author.put(`/api/posts/${privatePost.body.post.id}`).set('Origin', origin).send({ title: 'private report target', slug: `private-report-${suffix}`, contentFormat: 'markdown', contentMarkdown: 'private', status: 'published', visibility: 'private' })
    assert.equal(privatePublished.status, 200)
    assert.equal((await user.post('/api/reports').set('Origin', origin).send({ postId: privatePost.body.post.id, reason_code: 'spam', details: 'private target' })).status, 403)

    const followerPost = await author.post('/api/posts').set('Origin', origin).send({ title: 'followers report target', contentFormat: 'markdown', contentMarkdown: 'followers' })
    assert.equal(followerPost.status, 201)
    const followerPublished = await author.put(`/api/posts/${followerPost.body.post.id}`).set('Origin', origin).send({ title: 'followers report target', slug: `followers-report-${suffix}`, contentFormat: 'markdown', contentMarkdown: 'followers', status: 'published', visibility: 'followers' })
    assert.equal(followerPublished.status, 200)
    assert.equal((await user.post('/api/reports').set('Origin', origin).send({ postId: followerPost.body.post.id, reason_code: 'spam', details: 'not a follower' })).status, 403)
    const authorProfile = await author.get('/api/me')
    assert.equal(authorProfile.status, 200)
    assert.equal((await user.post(`/api/users/${authorProfile.body.user.blog_slug}/follow`).set('Origin', origin)).status, 200)
    assert.equal((await user.post('/api/reports').set('Origin', origin).send({ postId: followerPost.body.post.id, reason_code: 'spam', details: 'follower target' })).status, 201)

    const unlistedPost = await author.post('/api/posts').set('Origin', origin).send({ title: 'unlisted report target', contentFormat: 'markdown', contentMarkdown: 'unlisted' })
    assert.equal(unlistedPost.status, 201)
    const unlistedPublished = await author.put(`/api/posts/${unlistedPost.body.post.id}`).set('Origin', origin).send({ title: 'unlisted report target', slug: `unlisted-report-${suffix}`, contentFormat: 'markdown', contentMarkdown: 'unlisted', status: 'published', visibility: 'unlisted' })
    assert.equal(unlistedPublished.status, 200)
    assert.equal((await user.post('/api/reports').set('Origin', origin).send({ postId: unlistedPost.body.post.id, reason_code: 'spam', details: 'missing share token' })).status, 404)
    const unlistedOwnerView = await author.get(`/api/posts/${unlistedPost.body.post.id}`)
    assert.equal(unlistedOwnerView.status, 200)
    const shareToken = unlistedOwnerView.body.post.share_token
    assert.ok(shareToken)
    assert.equal((await user.post('/api/reports').query({ share: shareToken }).set('Origin', origin).send({ postId: unlistedPost.body.post.id, reason_code: 'spam', details: 'shared target' })).status, 201)

    const svgUpload = await user.post('/api/reports/media').set('Origin', origin).attach('images', path.join(directory, 'evil.svg'))
    assert.equal(svgUpload.status, 400)
    const fakeUpload = await user.post('/api/reports/media').set('Origin', origin).attach('images', fakePng)
    assert.equal(fakeUpload.status, 400)
    const oversizedUpload = await user.post('/api/reports/media').set('Origin', origin).attach('images', oversized)
    assert.equal(oversizedUpload.status, 400)

    const injected = await other.get('/api/reports/1 OR 1=1')
    assert.equal(injected.status, 404)
    const adminBypass = await other.get('/api/admin/reports').set('X-Is-Admin', 'true')
    assert.equal(adminBypass.status, 403)
    const crossMedia = await other.post('/api/reports/media').set('Origin', origin).attach('images', fixturePng)
    assert.equal(crossMedia.status, 201)
    const otherMediaId = crossMedia.body.items[0].id
    assert.equal((await user.get(`/api/public/report-media/${otherMediaId}`)).status, 404)
    assert.equal((await other.delete(`/api/report-media/${otherMediaId}`).set('Origin', origin)).status, 204)

    // The user/IP limiter must eventually reject bursts even when the target is valid.
    const burstResults = []
    for (let index = 0; index < 20; index += 1) {
      burstResults.push(await user.post('/api/reports').set('Origin', origin).send({ postId, reason_code: 'spam', details: `burst-${index}` }))
    }
    assert.ok(burstResults.some((response) => response.status === 429))

    console.log('fourth-pass report security checks passed')
  } finally {
    child.kill('SIGTERM')
    await cleanupEmails(emails)
    fs.rmSync(directory, { recursive: true, force: true })
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
