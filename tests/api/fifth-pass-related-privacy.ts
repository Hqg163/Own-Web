import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { createRequire } from 'node:module'
import request from 'supertest'

const require = createRequire(import.meta.url)
const { ensureDatabase, databaseName, cleanupEmails } = require('../support/test-db.cjs')

const origin = 'http://127.0.0.1:5173'
const port = 34000 + Math.floor(Math.random() * 1000)
const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
const emails = [
  `related-author-${suffix}@own-web.test`,
  `related-follower-${suffix}@own-web.test`,
  `related-stranger-${suffix}@own-web.test`,
]
const password = 'OwnWebRelatedA1!'

async function waitForApi(api: string) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      if ((await fetch(`${api}/api/health`)).ok) return
    } catch (_) { /* starting */ }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error('related privacy API did not start')
}

async function registerAndLogin(agent: request.SuperAgentTest, email: string) {
  assert.equal((await agent.post('/api/register').set('Origin', origin).send({ email, password })).status, 201)
  assert.equal((await agent.post('/api/login').set('Origin', origin).send({ email, password })).status, 200)
}

async function expectDenied(agent: request.SuperAgentTest | typeof request, pathname: string, status: number, code: string) {
  const response = await agent.get(pathname)
  assert.equal(response.status, status, `${pathname} 应返回 ${status}，实际为 ${response.status}: ${JSON.stringify(response.body)}`)
  assert.equal(response.body.error?.code, code)
  assert.equal('related' in response.body, false)
  assert.equal('previous' in response.body, false)
  assert.equal('next' in response.body, false)
}

async function main() {
  await ensureDatabase()
  const child = spawn(process.execPath, [path.join(process.cwd(), 'api', 'server.js')], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      TEST_AUTH_RATE_LIMIT_SCALE: '10',
      DB_NAME: databaseName,
      PORT: String(port),
      CORS_ORIGIN: origin,
      TEST_UPLOAD_ROOT: 'api/test-uploads',
    },
  })
  const api = `http://127.0.0.1:${port}`
  const author = request.agent(api)
  const follower = request.agent(api)
  const stranger = request.agent(api)
  const anonymous = request(api)

  try {
    await waitForApi(api)
    await registerAndLogin(author, emails[0])
    await registerAndLogin(follower, emails[1])
    await registerAndLogin(stranger, emails[2])

    async function createPost(name: string, visibility: string, status = 'published') {
      const slug = `related-${name}-${suffix}`
      const created = await author.post('/api/posts').set('Origin', origin).send({
        title: `Related ${name}`,
        contentFormat: 'markdown',
        contentMarkdown: `# ${name} metadata must stay protected`,
      })
      assert.equal(created.status, 201)
      const postId = created.body.post.id
      const updated = await author.put(`/api/posts/${postId}`).set('Origin', origin).send({
        title: `Related ${name}`,
        slug,
        contentFormat: 'markdown',
        contentMarkdown: `# ${name} metadata must stay protected`,
        status,
        visibility,
      })
      assert.equal(updated.status, 200)
      const ownerView = await author.get(`/api/posts/${postId}`)
      assert.equal(ownerView.status, 200)
      return { id: postId, slug, shareToken: ownerView.body.post.share_token }
    }

    const publicPost = await createPost('public', 'public')
    await createPost('public-sibling', 'public')
    const privatePost = await createPost('private', 'private')
    const followersPost = await createPost('followers', 'followers')
    const unlistedPost = await createPost('unlisted', 'unlisted')
    const draftPost = await createPost('draft', 'private', 'draft')
    const authorProfile = await author.get('/api/me')
    assert.equal(authorProfile.status, 200)
    const authorBlogSlug = authorProfile.body.user.blog_slug
    assert.ok(authorBlogSlug)

    const publicRelated = await anonymous.get(`/api/public/posts/${publicPost.slug}/related`)
    assert.equal(publicRelated.status, 200)
    assert.deepEqual(Object.keys(publicRelated.body).sort(), ['next', 'previous', 'related'])
    assert.ok(Array.isArray(publicRelated.body.related))
    assert.ok(publicRelated.body.related.every((item: any) => item.visibility === undefined && item.share_token === undefined))

    const authorPublicRelated = await author.get(`/api/public/posts/${publicPost.slug}/related`)
    assert.equal(authorPublicRelated.status, 200)

    await expectDenied(anonymous, `/api/public/posts/${privatePost.slug}/related`, 401, 'AUTH_REQUIRED')
    const authorPrivateRelated = await author.get(`/api/public/posts/${privatePost.slug}/related`)
    assert.equal(authorPrivateRelated.status, 200)
    await expectDenied(follower, `/api/public/posts/${privatePost.slug}/related`, 403, 'FORBIDDEN')
    await expectDenied(stranger, `/api/public/posts/${privatePost.slug}/related`, 403, 'FORBIDDEN')

    await expectDenied(anonymous, `/api/public/posts/${followersPost.slug}/related`, 401, 'AUTH_REQUIRED')
    const authorFollowersRelated = await author.get(`/api/public/posts/${followersPost.slug}/related`)
    assert.equal(authorFollowersRelated.status, 200)
    await expectDenied(stranger, `/api/public/posts/${followersPost.slug}/related`, 403, 'FORBIDDEN')
    const follow = await follower.post(`/api/users/${encodeURIComponent(authorBlogSlug)}/follow`).set('Origin', origin)
    assert.equal(follow.status, 200)
    const followerRelated = await follower.get(`/api/public/posts/${followersPost.slug}/related`)
    assert.equal(followerRelated.status, 200)

    await expectDenied(anonymous, `/api/public/posts/${unlistedPost.slug}/related`, 404, 'NOT_FOUND')
    await expectDenied(follower, `/api/public/posts/${unlistedPost.slug}/related`, 404, 'NOT_FOUND')
    await expectDenied(stranger, `/api/public/posts/${unlistedPost.slug}/related`, 404, 'NOT_FOUND')
    const authorUnlistedRelated = await author.get(`/api/public/posts/${unlistedPost.slug}/related`)
    assert.equal(authorUnlistedRelated.status, 200)
    const sharedRelated = await anonymous.get(`/api/public/posts/${unlistedPost.slug}/related`).query({ share: unlistedPost.shareToken })
    assert.equal(sharedRelated.status, 200)
    const invalidSharedRelated = await anonymous.get(`/api/public/posts/${unlistedPost.slug}/related`).query({ share: 'invalid-share-token' })
    assert.equal(invalidSharedRelated.status, 404)

    await expectDenied(anonymous, `/api/public/posts/${draftPost.slug}/related`, 401, 'AUTH_REQUIRED')
    const authorDraftRelated = await author.get(`/api/public/posts/${draftPost.slug}/related`)
    assert.equal(authorDraftRelated.status, 200)
    await expectDenied(stranger, `/api/public/posts/${draftPost.slug}/related`, 403, 'FORBIDDEN')

    const missing = await anonymous.get('/api/public/posts/related-does-not-exist/related')
    assert.equal(missing.status, 404)
    assert.equal(missing.body.error?.code, 'NOT_FOUND')

    console.log('fifth-pass related privacy API checks passed')
  } finally {
    child.kill('SIGTERM')
    await cleanupEmails(emails)
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
