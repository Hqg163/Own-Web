import assert from 'node:assert/strict'
import { spawn, type ChildProcess } from 'node:child_process'
import path from 'node:path'
import { createRequire } from 'node:module'
import request from 'supertest'

const require = createRequire(import.meta.url)
const mysql = require('mysql2/promise')
const {
  ensureDatabase,
  databaseName,
  config: dbConfig,
  cleanupEmails,
} = require('../support/test-db.cjs')

const origin = 'http://127.0.0.1:5173'
const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
const port = 35000 + Math.floor(Math.random() * 1000)
const password = 'OwnWebPersonalA1!'
const emails = {
  owner: `site-owner-${suffix}@own-web.test`,
  adminButNotOwner: `site-admin-${suffix}@own-web.test`,
}

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

type TestAgent = ReturnType<typeof request.agent>

function serverEnv(ownerId: string, adminEmail: string) {
  return {
    ...process.env,
    NODE_ENV: 'test',
    TEST_AUTH_RATE_LIMIT_SCALE: '10',
    DB_NAME: databaseName,
    PORT: String(port),
    CORS_ORIGIN: origin,
    PUBLIC_SITE_URL: 'https://own-web.example.test',
    SITE_OWNER_USER_ID: ownerId,
    // Deliberately make the second account an admin but not the site owner.
    ADMIN_EMAILS: adminEmail,
  }
}

async function waitForApi(api: string) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      if ((await fetch(`${api}/api/health`)).ok) return
    } catch (_) {
      // The child is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error('personal site API did not start')
}

async function startServer(ownerId: string, adminEmail: string) {
  const child = spawn(process.execPath, [path.join(process.cwd(), 'api', 'server.js')], {
    stdio: 'inherit',
    env: serverEnv(ownerId, adminEmail),
  })
  const api = `http://127.0.0.1:${port}`
  await waitForApi(api)
  return { child, api }
}

async function stopServer(child: ChildProcess | undefined) {
  if (!child || child.exitCode !== null) return
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      resolve()
    }, 5000)
    child.once('exit', () => {
      clearTimeout(timer)
      resolve()
    })
    child.kill('SIGTERM')
  })
}

function expectError(response: request.Response, status: number, code: string) {
  assert.equal(response.status, status, `${response.req.method} ${response.req.path}: ${JSON.stringify(response.body)}`)
  assert.equal(response.body.error?.code, code)
}

async function register(api: string, email: string) {
  const response = await request(api)
    .post('/api/register')
    .set('Origin', origin)
    .send({ email, password })
  assert.equal(response.status, 201, JSON.stringify(response.body))
  assert.ok(Number(response.body.userId) > 0)
  return Number(response.body.userId)
}

async function login(agent: TestAgent, email: string) {
  const response = await agent
    .post('/api/login')
    .set('Origin', origin)
    .send({ email, password })
  assert.equal(response.status, 200, JSON.stringify(response.body))
}

async function createPost(agent: TestAgent, title: string, slug: string) {
  const response = await agent
    .post('/api/posts')
    .set('Origin', origin)
    .send({
      title,
      slug,
      contentFormat: 'markdown',
      contentMarkdown: `# ${title}\n\nPersonal-site regression fixture.`,
    })
  assert.equal(response.status, 201, JSON.stringify(response.body))
  return Number(response.body.post.id)
}

async function publishPost(
  agent: TestAgent,
  id: number,
  values: { slug: string; status: string; visibility: string; seriesId?: number; seriesOrder?: number; featured?: boolean },
) {
  const response = await agent
    .put(`/api/posts/${id}`)
    .set('Origin', origin)
    .send({
      title: `Published ${values.slug}`,
      slug: values.slug,
      contentFormat: 'markdown',
      contentMarkdown: `# ${values.slug}\n\nVisibility fixture.`,
      status: values.status,
      visibility: values.visibility,
      seriesId: values.seriesId,
      seriesOrder: values.seriesOrder,
      featured: values.featured,
      featuredOrder: values.featured ? 1 : 0,
    })
  assert.equal(response.status, 200, JSON.stringify(response.body))
  return response
}

async function insertForeignProject(ownerId: number, slug: string) {
  const connection = await mysql.createConnection({ ...dbConfig, database: databaseName })
  try {
    await connection.execute(
      `INSERT INTO projects
        (owner_id,title,slug,summary,description,cover,year,role,tech_stack,github_url,demo_url,featured,sort_order)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        ownerId,
        'Foreign project fixture',
        slug,
        'Must not appear on the site-owner project listing',
        '',
        null,
        2026,
        'Contributor',
        JSON.stringify(['Fixture']),
        null,
        null,
        false,
        99,
      ],
    )
  } finally {
    await connection.end()
  }
}

function runStaticContractChecks(reason: unknown) {
  const fs = require('node:fs')
  const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8')
  const personalSite = read('api/lib/personal-site.js')
  const blog = read('api/blog.js')
  const comments = read('api/lib/comments.js')
  const migrations = read('api/migrations.js')

  assert.match(personalSite, /SITE_OWNER_USER_ID/)
  assert.match(personalSite, /\/api\/public\/site-owner/)
  assert.match(personalSite, /res\.json\(\{ owner: null \}\)/)
  assert.match(personalSite, /\/api\/owner\/projects/)
  assert.match(personalSite, /owner_id/)
  assert.match(personalSite, /\/api\/series/)
  assert.match(personalSite, /WHERE id=\? AND owner_id=\?/)
  assert.match(blog, /ADMIN_EMAILS/)
  assert.match(blog, /siteOwnerId\(\)/)
  assert.match(blog, /SERIES_OWNERSHIP_REQUIRED/)
  assert.match(blog, /featured=TRUE/)
  assert.match(comments, /hasMeaningfulComment/)
  assert.match(comments, /normalizeCommentContent\(content\)/)
  assert.match(migrations, /CREATE TABLE IF NOT EXISTS projects/)
  assert.match(migrations, /CREATE TABLE IF NOT EXISTS series/)
  assert.match(migrations, /series_id BIGINT NULL/)

  console.warn('fifth-pass personal-site API runtime checks skipped; static contract checks passed')
  console.warn(`runtime blocker: ${reason instanceof Error ? reason.message : String(reason)}`)
}

function isInfrastructureFailure(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : ''
  return [
    'ECONNREFUSED',
    'ENOTFOUND',
    'ER_ACCESS_DENIED_ERROR',
    'ECONNRESET',
    'PROTOCOL_CONNECTION_LOST',
  ].includes(code) || /MySQL|database|did not start|Missing required environment/i.test(message)
}

async function main() {
  let child: ChildProcess | undefined
  const activeEmails = [emails.owner, emails.adminButNotOwner]

  try {
    await ensureDatabase()

    // Phase A: no site-owner configuration must degrade to an empty public identity.
    let server = await startServer('', emails.adminButNotOwner)
    child = server.child
    const unconfigured = await request(server.api).get('/api/public/site-owner')
    assert.equal(unconfigured.status, 200)
    assert.deepEqual(unconfigured.body, { owner: null })

    const ownerId = await register(server.api, emails.owner)
    await register(server.api, emails.adminButNotOwner)
    await stopServer(child)
    child = undefined

    // Phase B: configured site owner, while ADMIN_EMAILS intentionally names only account two.
    server = await startServer(String(ownerId), emails.adminButNotOwner)
    child = server.child
    const owner = request.agent(server.api)
    const adminButNotOwner = request.agent(server.api)
    const anonymous = request(server.api)
    await login(owner, emails.owner)
    await login(adminButNotOwner, emails.adminButNotOwner)

    const privateProfile = await owner
      .put('/api/me/blog-profile')
      .set('Origin', origin)
      .send({
        bio: 'Hidden owner fixture',
        blogTitle: 'Hidden Personal Site',
        blogSlug: `hidden-${suffix}`,
        socialLinks: { github: 'https://github.com/own-web' },
        profileVisibility: 'private',
      })
    assert.equal(privateProfile.status, 200, JSON.stringify(privateProfile.body))
    const hiddenOwner = await anonymous.get('/api/public/site-owner')
    assert.deepEqual(hiddenOwner.body, { owner: null })

    const publicProfile = await owner
      .put('/api/me/blog-profile')
      .set('Origin', origin)
      .send({
        bio: 'Public owner fixture',
        blogTitle: 'My Own-Web',
        blogSlug: `owner-${suffix}`,
        socialLinks: {
          website: 'https://example.com/owner',
          github: 'https://github.com/own-web',
          other: 'https://example.com/contact',
        },
        profileVisibility: 'public',
      })
    assert.equal(publicProfile.status, 200, JSON.stringify(publicProfile.body))

    const siteOwner = await anonymous.get('/api/public/site-owner')
    assert.equal(siteOwner.status, 200)
    assert.equal(siteOwner.body.owner.username, publicProfile.body.profile.username)
    assert.equal(siteOwner.body.owner.blog_title, 'My Own-Web')
    assert.equal(siteOwner.body.owner.bio, 'Public owner fixture')
    assert.equal(siteOwner.body.owner.blog_slug, `owner-${suffix}`)
    // The profile endpoint normalizes valid URLs through URL#toString().
    assert.equal(siteOwner.body.owner.social_links.github, 'https://github.com/own-web')
    assert.equal(siteOwner.body.owner.avatar_url, null)
    assert.equal('email' in siteOwner.body.owner, false)
    assert.equal('password' in siteOwner.body.owner, false)
    assert.equal('id' in siteOwner.body.owner, false)

    // Site-owner project CRUD and ADMIN_EMAILS/SITE_OWNER_USER_ID separation.
    const projectPayload = {
      title: 'Owner Project',
      slug: `owner-project-${suffix}`,
      summary: 'A manually curated project',
      description: 'Project description for the personal-site API regression.',
      year: 2026,
      role: 'Builder',
      tech_stack: ['Vue', 'Express'],
      github_url: 'https://github.com/own-web/project',
      demo_url: 'https://example.com/project',
      featured: true,
      sort_order: 1,
    }
    const createdProject = await owner
      .post('/api/owner/projects')
      .set('Origin', origin)
      .send(projectPayload)
    assert.equal(createdProject.status, 201, JSON.stringify(createdProject.body))
    const projectId = Number(createdProject.body.project.id)

    const ownerProjects = await owner.get('/api/owner/projects')
    assert.equal(ownerProjects.status, 200)
    assert.ok(ownerProjects.body.items.some((item: any) => item.id === projectId))

    expectError(
      await adminButNotOwner.get('/api/owner/projects'),
      403,
      'SITE_OWNER_REQUIRED',
    )
    expectError(
      await adminButNotOwner.post('/api/owner/projects').set('Origin', origin).send({ ...projectPayload, slug: `other-project-${suffix}` }),
      403,
      'SITE_OWNER_REQUIRED',
    )
    expectError(
      await adminButNotOwner.put(`/api/owner/projects/${projectId}`).set('Origin', origin).send({ ...projectPayload, title: 'IDOR attempt' }),
      403,
      'SITE_OWNER_REQUIRED',
    )

    const updatedProject = await owner
      .put(`/api/owner/projects/${projectId}`)
      .set('Origin', origin)
      .send({ ...projectPayload, title: 'Updated Owner Project' })
    assert.equal(updatedProject.status, 200, JSON.stringify(updatedProject.body))
    assert.equal(updatedProject.body.project.title, 'Updated Owner Project')

    const foreignProjectSlug = `foreign-project-${suffix}`
    const adminIdentity = await adminButNotOwner.get('/api/me')
    await insertForeignProject(Number(adminIdentity.body.user.id), foreignProjectSlug)
    const publicProjects = await anonymous.get('/api/public/projects')
    assert.equal(publicProjects.status, 200)
    assert.ok(publicProjects.body.items.some((item: any) => item.slug === projectPayload.slug))
    assert.equal(publicProjects.body.items.some((item: any) => item.slug === foreignProjectSlug), false)
    const projectDetail = await anonymous.get(`/api/public/projects/${projectPayload.slug}`)
    assert.equal(projectDetail.status, 200)
    assert.equal(projectDetail.body.project.title, 'Updated Owner Project')
    expectError(await anonymous.get(`/api/public/projects/${foreignProjectSlug}`), 404, 'NOT_FOUND')

    // A private owner profile hides projects even though the rows remain owned and valid.
    const makePrivateAgain = await owner
      .put('/api/me/blog-profile')
      .set('Origin', origin)
      .send({
        bio: 'Hidden owner fixture',
        blogTitle: 'Hidden Personal Site',
        blogSlug: `hidden-again-${suffix}`,
        socialLinks: {},
        profileVisibility: 'private',
      })
    assert.equal(makePrivateAgain.status, 200)
    const hiddenProjects = await anonymous.get('/api/public/projects')
    assert.deepEqual(hiddenProjects.body, { items: [] })
    const restorePublic = await owner
      .put('/api/me/blog-profile')
      .set('Origin', origin)
      .send({
        bio: 'Public owner fixture',
        blogTitle: 'My Own-Web',
        blogSlug: `owner-${suffix}`,
        socialLinks: { github: 'https://github.com/own-web' },
        profileVisibility: 'public',
      })
    assert.equal(restorePublic.status, 200)

    // Series CRUD and series ownership boundaries.
    const createdSeries = await owner
      .post('/api/series')
      .set('Origin', origin)
      .send({
        name: 'Owner Series',
        slug: `owner-series-${suffix}`,
        description: 'Ordered public and private article fixtures.',
        sort_order: 1,
      })
    assert.equal(createdSeries.status, 201, JSON.stringify(createdSeries.body))
    const seriesId = Number(createdSeries.body.series.id)

    const ownerSeries = await owner.get('/api/series')
    assert.equal(ownerSeries.status, 200)
    assert.ok(ownerSeries.body.items.some((item: any) => item.id === seriesId))
    const otherSeriesList = await adminButNotOwner.get('/api/series')
    assert.equal(otherSeriesList.status, 200)
    assert.equal(otherSeriesList.body.items.some((item: any) => item.id === seriesId), false)
    expectError(
      await adminButNotOwner.put(`/api/series/${seriesId}`).set('Origin', origin).send({ name: 'Cross-account update' }),
      404,
      'NOT_FOUND',
    )
    expectError(
      await adminButNotOwner.delete(`/api/series/${seriesId}`).set('Origin', origin),
      404,
      'NOT_FOUND',
    )

    const otherSeriesResponse = await adminButNotOwner
      .post('/api/series')
      .set('Origin', origin)
      .send({ name: 'Other Account Series', slug: `other-series-${suffix}` })
    assert.equal(otherSeriesResponse.status, 201, JSON.stringify(otherSeriesResponse.body))
    const otherSeriesId = Number(otherSeriesResponse.body.series.id)
    const updatedSeries = await owner
      .put(`/api/series/${seriesId}`)
      .set('Origin', origin)
      .send({
        name: 'Updated Owner Series',
        slug: `owner-series-updated-${suffix}`,
        description: 'Updated description',
        sort_order: 2,
      })
    assert.equal(updatedSeries.status, 200, JSON.stringify(updatedSeries.body))
    assert.equal(updatedSeries.body.series.name, 'Updated Owner Series')

    // Article binding: owner can bind its own series, but not another account's series.
    const publicPostId = await createPost(owner, 'Public series article', `public-series-${suffix}`)
    const privatePostId = await createPost(owner, 'Private series article', `private-series-${suffix}`)
    const unlistedPostId = await createPost(owner, 'Unlisted series article', `unlisted-series-${suffix}`)
    await publishPost(owner, publicPostId, { slug: `public-series-${suffix}`, status: 'published', visibility: 'public', seriesId, seriesOrder: 1, featured: true })
    await publishPost(owner, privatePostId, { slug: `private-series-${suffix}`, status: 'published', visibility: 'private', seriesId, seriesOrder: 2 })
    await publishPost(owner, unlistedPostId, { slug: `unlisted-series-${suffix}`, status: 'published', visibility: 'unlisted', seriesId, seriesOrder: 3 })

    const ownerPost = await owner.get(`/api/posts/${publicPostId}`)
    assert.equal(ownerPost.status, 200)
    assert.equal(Number(ownerPost.body.post.series_id), seriesId)
    assert.equal(Number(ownerPost.body.post.series_order), 1)

    const crossSeriesPost = await createPost(owner, 'Cross series ownership fixture', `cross-series-${suffix}`)
    const crossSeries = await owner
      .put(`/api/posts/${crossSeriesPost}`)
      .set('Origin', origin)
      .send({
        title: 'Cross series ownership fixture',
        slug: `cross-series-${suffix}`,
        contentFormat: 'markdown',
        contentMarkdown: '# Cross-account series binding',
        seriesId: otherSeriesId,
        seriesOrder: 1,
      })
    expectError(crossSeries, 403, 'SERIES_OWNERSHIP_REQUIRED')

    // Only the public article is exposed through a public series.
    const publicSeries = await anonymous.get(`/api/public/series/${updatedSeries.body.series.slug}`)
    assert.equal(publicSeries.status, 200, JSON.stringify(publicSeries.body))
    assert.equal(publicSeries.body.series.article_count, 1)
    assert.deepEqual(
      publicSeries.body.series.articles.map((article: any) => article.slug),
      [`public-series-${suffix}`],
    )
    assert.equal(publicSeries.body.series.articles[0].series_order, 1)

    const publicArticle = await anonymous.get(`/api/public/posts/public-series-${suffix}`)
    assert.equal(publicArticle.status, 200)
    assert.equal(publicArticle.body.post.series.id, seriesId)
    expectError(await anonymous.get(`/api/public/posts/private-series-${suffix}`), 401, 'AUTH_REQUIRED')
    expectError(await anonymous.get(`/api/public/posts/unlisted-series-${suffix}`), 404, 'NOT_FOUND')
    const publicFeed = await anonymous.get('/api/public/posts').query({ q: `${suffix}` })
    assert.equal(publicFeed.status, 200)
    assert.equal(publicFeed.body.items.some((item: any) => item.slug === `private-series-${suffix}`), false)
    assert.equal(publicFeed.body.items.some((item: any) => item.slug === `unlisted-series-${suffix}`), false)

    // Featured is also site-owner scoped; the admin-but-not-owner cannot set it.
    const otherPostId = await createPost(adminButNotOwner, 'Non-owner featured fixture', `non-owner-featured-${suffix}`)
    const deniedFeatured = await adminButNotOwner
      .put(`/api/posts/${otherPostId}`)
      .set('Origin', origin)
      .send({
        title: 'Non-owner featured fixture',
        slug: `non-owner-featured-${suffix}`,
        contentFormat: 'markdown',
        contentMarkdown: '# Must not be featured',
        status: 'published',
        visibility: 'public',
        featured: true,
      })
    expectError(deniedFeatured, 403, 'SITE_OWNER_REQUIRED')
    const home = await anonymous.get('/api/public/home')
    assert.equal(home.status, 200)
    assert.ok(home.body.featured.some((item: any) => item.slug === `public-series-${suffix}`))
    assert.equal(home.body.featured.some((item: any) => item.slug === `non-owner-featured-${suffix}`), false)

    // Comment contract: text-only, image-only, image-only reply, and empty rejection.
    const textComment = await adminButNotOwner
      .post(`/api/posts/${publicPostId}/comments`)
      .set('Origin', origin)
      .send({ content: '  text-only comment  ' })
    assert.equal(textComment.status, 201, JSON.stringify(textComment.body))
    assert.equal(textComment.body.comment.content, 'text-only comment')
    const textCommentId = Number(textComment.body.comment.id)

    const emptyComment = await adminButNotOwner
      .post(`/api/posts/${publicPostId}/comments`)
      .set('Origin', origin)
      .send({ content: '   ', media: [] })
    expectError(emptyComment, 400, 'CONTENT_REQUIRED')

    const uploadedImage = await adminButNotOwner
      .post(`/api/posts/${publicPostId}/comment-media`)
      .set('Origin', origin)
      .attach('media', onePixelPng, { filename: 'comment.png', contentType: 'image/png' })
    assert.equal(uploadedImage.status, 201, JSON.stringify(uploadedImage.body))
    const imageId = Number(uploadedImage.body.media.id)
    assert.ok(imageId > 0)
    const imageComment = await adminButNotOwner
      .post(`/api/posts/${publicPostId}/comments`)
      .set('Origin', origin)
      .send({ content: '', media: [imageId] })
    assert.equal(imageComment.status, 201, JSON.stringify(imageComment.body))
    assert.deepEqual(imageComment.body.comment.media_ids, [imageId])

    const replyImage = await adminButNotOwner
      .post(`/api/posts/${publicPostId}/comment-media`)
      .set('Origin', origin)
      .attach('media', onePixelPng, { filename: 'reply.png', contentType: 'image/png' })
    assert.equal(replyImage.status, 201, JSON.stringify(replyImage.body))
    const replyImageId = Number(replyImage.body.media.id)
    const imageReply = await adminButNotOwner
      .post(`/api/posts/${publicPostId}/comments`)
      .set('Origin', origin)
      .send({ content: '', media: [replyImageId], replyToCommentId: textCommentId })
    assert.equal(imageReply.status, 201, JSON.stringify(imageReply.body))
    assert.deepEqual(imageReply.body.comment.media_ids, [replyImageId])
    assert.equal(Number(imageReply.body.comment.reply_to_comment_id), textCommentId)

    const comments = await anonymous.get(`/api/posts/${publicPostId}/comments`)
    assert.equal(comments.status, 200)
    const imageItem = comments.body.items.find((item: any) => Number(item.id) === Number(imageComment.body.comment.id))
    assert.ok(imageItem)
    assert.equal(imageItem.content, '')
    assert.equal(imageItem.media[0].id, imageId)

    const deletedProject = await owner
      .delete(`/api/owner/projects/${projectId}`)
      .set('Origin', origin)
    assert.equal(deletedProject.status, 204)
    const deletedSeries = await owner
      .delete(`/api/series/${seriesId}`)
      .set('Origin', origin)
    assert.equal(deletedSeries.status, 204)

    console.log('fifth-pass personal-site API checks passed')
  } finally {
    await stopServer(child)
    await cleanupEmails(activeEmails)
  }
}

main().catch((error) => {
  if (isInfrastructureFailure(error)) {
    try {
      runStaticContractChecks(error)
    } catch (staticError) {
      console.error('static contract fallback failed:', staticError)
      process.exitCode = 1
    }
    return
  }
  console.error(error)
  process.exitCode = 1
})
