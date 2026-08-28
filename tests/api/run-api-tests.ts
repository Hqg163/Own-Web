import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { createRequire } from 'node:module'
import request from 'supertest'
const require = createRequire(import.meta.url)
const { ensureDatabase, databaseName, cleanupEmails } = require('../support/test-db.cjs')

const origin = 'http://127.0.0.1:5173'
const port = 3302
const emails = [`owner-${Date.now()}@own-web.test`, `reader-${Date.now()}@own-web.test`]
const password = 'OwnWebTestA1!'

async function waitForApi(api: string) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { const response = await fetch(`${api}/api/health`); if (response.ok) return; } catch (_) { /* starting */ }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error('test API did not start')
}

async function main() {
  await ensureDatabase()
  const child = spawn(process.execPath, [path.join(process.cwd(), 'api', 'server.js')], { stdio:'inherit', env:{ ...process.env, NODE_ENV:'test', DB_NAME:databaseName, PORT:String(port), CORS_ORIGIN:origin, TEST_UPLOAD_ROOT:'api/test-uploads' } })
  const api = `http://127.0.0.1:${port}`
  try {
    await waitForApi(api)
    const owner = request.agent(api), reader = request.agent(api)
    const health = await request(api).get('/api/health')
    assert.equal(health.status, 200)
    assert.equal(health.headers['x-content-type-options'], 'nosniff')
    assert.equal(health.headers['x-frame-options'], 'DENY')
    assert.equal(health.headers['referrer-policy'], 'strict-origin-when-cross-origin')
    assert.match(health.headers['content-security-policy'], /object-src 'none'/)
    const missingOrigin = await request(api).post('/api/register').send({ email:`no-origin-${Date.now()}@own-web.test`, password })
    assert.equal(missingOrigin.status, 403); assert.equal(missingOrigin.body.error.code, 'CSRF_ORIGIN_REQUIRED')
    const ownerRegistration = await owner.post('/api/register').set('Origin', origin).send({ email:emails[0], password })
    const readerRegistration = await reader.post('/api/register').set('Origin', origin).send({ email:emails[1], password })
    assert.equal(ownerRegistration.status, 201); assert.equal(readerRegistration.status, 201)
    const weak = await request(api).post('/api/register').set('Origin', origin).send({ email:'weak@own-web.test', password:'123456' })
    assert.equal(weak.status, 400); assert.equal(weak.body.error.code, 'WEAK_PASSWORD')
    const login = await owner.post('/api/login').set('Origin', origin).send({ email:emails[0], password })
    assert.equal(login.status, 200); assert.ok(login.headers['set-cookie'])
    const readerLogin = await reader.post('/api/login').set('Origin', origin).send({ email:emails[1], password })
    assert.equal(readerLogin.status, 200)
    const taxonomy = await owner.get('/api/editor/taxonomy')
    assert.equal(taxonomy.status, 200); assert.ok(Array.isArray(taxonomy.body.categories))
    const created = await owner.post('/api/posts').set('Origin', origin).send({ title:'集成测试文章', contentFormat:'markdown', contentMarkdown:'# Hello' })
    assert.equal(created.status, 201)
    const id = created.body.post.id
    const draft = await owner.put(`/api/posts/${id}`).set('Origin', origin).send({ title:'集成测试文章', contentFormat:'markdown', contentMarkdown:'# Hello', status:'draft', scheduledAt:new Date(Date.now()+86_400_000).toISOString() })
    assert.equal(draft.status, 200); assert.equal(draft.body.status, 'draft'); assert.equal(draft.body.scheduledAt, null)
    const pastSchedule = await owner.put(`/api/posts/${id}`).set('Origin', origin).send({ title:'集成测试文章', contentFormat:'markdown', contentMarkdown:'# Hello', status:'scheduled', scheduledAt:new Date(Date.now()-86_400_000).toISOString() })
    assert.equal(pastSchedule.status, 400); assert.equal(pastSchedule.body.error.code, 'INVALID_SCHEDULE')
    const published = await owner.put(`/api/posts/${id}`).set('Origin', origin).send({ title:'集成测试文章', slug:`integration-${Date.now()}`, contentFormat:'markdown', contentMarkdown:'# Hello', status:'published', visibility:'public' })
    assert.equal(published.status, 200)
    const publicPost = await request(api).get(`/api/public/posts/${published.body.slug}`)
    assert.equal(publicPost.status, 200)
    const publicList = await request(api).get('/api/public/posts').query({ q:'Hello' })
    assert.equal(publicList.status, 200); assert.ok('total' in publicList.body)
    const injection = await request(api).get('/api/public/posts').query({ q:"' OR 1=1 --" })
    assert.equal(injection.status, 200); assert.equal(Array.isArray(injection.body.items), true)
    const forbiddenEdit = await reader.put(`/api/posts/${id}`).set('Origin', origin).send({ title:'越权修改', status:'draft' })
    assert.equal(forbiddenEdit.status, 404)
    await owner.post(`/api/posts/${id}/bookmark`).set('Origin', origin)
    const unbookmark = await owner.delete(`/api/posts/${id}/bookmark`).set('Origin', origin)
    assert.equal(unbookmark.status, 200); assert.equal(unbookmark.body.bookmarked, false)
    const logout = await owner.post('/api/logout').set('Origin', origin)
    assert.equal(logout.status, 200)
    const revoked = await owner.get('/api/editor/taxonomy')
    assert.equal(revoked.status, 401)
    console.log('API integration checks passed')
  } finally {
    await cleanupEmails(emails)
    child.kill('SIGTERM')
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
