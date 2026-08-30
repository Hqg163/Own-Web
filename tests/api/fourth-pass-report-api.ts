import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { createRequire } from 'node:module'
import request from 'supertest'

const require = createRequire(import.meta.url)
const { ensureDatabase, databaseName, cleanupEmails } = require('../support/test-db.cjs')

const origin = 'http://127.0.0.1:5173'
const port = 3305
const suffix = Date.now()
const emails = [
  `report-author-${suffix}@own-web.test`,
  `report-user-${suffix}@own-web.test`,
  `report-admin-${suffix}@own-web.test`,
  `report-other-${suffix}@own-web.test`,
]
const password = 'OwnWebReportA1!'
const image = path.join(process.cwd(), 'tests/fixtures/showcase/images/kyoto-door.png')

async function waitForApi(api: string) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { if ((await fetch(`${api}/api/health`)).ok) return } catch (_) { /* starting */ }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error('report API did not start')
}

async function registerAndLogin(agent: request.SuperAgentTest, email: string) {
  assert.equal((await agent.post('/api/register').set('Origin', origin).send({ email, password })).status, 201)
  assert.equal((await agent.post('/api/login').set('Origin', origin).send({ email, password })).status, 200)
}

async function main() {
  await ensureDatabase()
  const child = spawn(process.execPath, ['api/server.js'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      TEST_AUTH_RATE_LIMIT_SCALE: '10',
      DB_NAME: databaseName,
      PORT: String(port),
      CORS_ORIGIN: origin,
      ADMIN_EMAILS: emails[2],
      TEST_UPLOAD_ROOT: 'api/test-uploads',
    },
  })
  const api = `http://127.0.0.1:${port}`
  try {
    await waitForApi(api)
    const author = request.agent(api)
    const reporter = request.agent(api)
    const admin = request.agent(api)
    const other = request.agent(api)
    await registerAndLogin(author, emails[0])
    await registerAndLogin(reporter, emails[1])
    await registerAndLogin(admin, emails[2])
    await registerAndLogin(other, emails[3])

    const created = await author.post('/api/posts').set('Origin', origin).send({
      title: '举报 API 文章',
      contentFormat: 'markdown',
      contentMarkdown: '# private source that must not become a snapshot',
    })
    assert.equal(created.status, 201)
    const postId = created.body.post.id
    const published = await author.put(`/api/posts/${postId}`).set('Origin', origin).send({
      title: '举报 API 文章',
      slug: `report-api-${suffix}`,
      contentFormat: 'markdown',
      contentMarkdown: '# private source that must not become a snapshot',
      status: 'published',
      visibility: 'public',
    })
    assert.equal(published.status, 200)

    const comment = await author.post(`/api/posts/${postId}/comments`).set('Origin', origin).send({ content: '需要审核的评论' })
    assert.equal(comment.status, 201)
    const commentReport = await reporter.post('/api/reports').set('Origin', origin).send({
      commentId: comment.body.comment.id,
      reason_code: 'harassment',
      details: '评论举报说明',
    })
    assert.equal(commentReport.status, 201)

    const media = await reporter.post('/api/reports/media').set('Origin', origin).attach('images', image)
    assert.equal(media.status, 201)
    assert.equal(media.body.items.length, 1)
    const mediaId = media.body.items[0].id

    const reportResponse = await reporter.post('/api/reports').set('Origin', origin).send({
      postId,
      reason_code: 'spam',
      details: '<script>alert(1)</script>说明',
      mediaIds: [mediaId],
    })
    assert.equal(reportResponse.status, 201)
    assert.equal(reportResponse.body.report.reason_code, 'spam')
    assert.equal(reportResponse.body.report.status, 'pending')
    const reportId = reportResponse.body.report.id

    const changedAfterReport = await author.put(`/api/posts/${postId}`).set('Origin', origin).send({
      title: '举报 API 文章（已修改）',
      slug: `report-api-${suffix}`,
      contentFormat: 'markdown',
      contentMarkdown: '# changed source after report',
      status: 'published',
      visibility: 'public',
    })
    assert.equal(changedAfterReport.status, 200)

    const ownReports = await reporter.get('/api/reports')
    assert.equal(ownReports.status, 200)
    const ownReport = ownReports.body.items.find((item: any) => Number(item.id) === Number(reportId))
    assert.ok(ownReport)
    assert.equal('internal_note' in ownReport, false)
    assert.equal(ownReport.target_snapshot.comment_excerpt, undefined)
    assert.match(JSON.stringify(ownReport.target_snapshot), /举报 API 文章/)
    assert.doesNotMatch(JSON.stringify(ownReport.target_snapshot), /已修改/)
    assert.doesNotMatch(JSON.stringify(ownReport.target_snapshot), /private source/)

    const ownDetail = await reporter.get(`/api/reports/${reportId}`)
    assert.equal(ownDetail.status, 200)
    assert.equal('internal_note' in ownDetail.body.report, false)
    assert.equal(ownDetail.body.report.media.length, 1)
    assert.equal((await reporter.get(`/api/public/report-media/${mediaId}`)).status, 200)
    assert.equal((await other.get(`/api/public/report-media/${mediaId}`)).status, 404)

    const duplicate = await reporter.post('/api/reports').set('Origin', origin).send({ postId, reason: '旧客户端原因' })
    assert.equal(duplicate.status, 409)
    assert.equal(duplicate.body.error.code, 'DUPLICATE_REPORT')

    assert.equal((await other.get(`/api/reports/${reportId}`)).status, 404)
    assert.equal((await other.get('/api/admin/reports')).status, 403)
    assert.equal((await other.get(`/api/admin/reports/${reportId}`)).status, 403)

    const adminList = await admin.get('/api/admin/reports').query({ status: 'pending' })
    assert.equal(adminList.status, 200)
    assert.ok(adminList.body.items.some((item: any) => Number(item.id) === Number(reportId)))
    const adminDetail = await admin.get(`/api/admin/reports/${reportId}`)
    assert.equal(adminDetail.status, 200)
    assert.equal('internal_note' in adminDetail.body.report, true)

    const reviewing = await admin.put(`/api/admin/reports/${reportId}`).set('Origin', origin).send({ status: 'reviewing', internal_note: '管理员内部判断' })
    assert.equal(reviewing.status, 200)
    const resolved = await admin.put(`/api/admin/reports/${reportId}`).set('Origin', origin).send({ status: 'resolved', public_response: '感谢反馈，已完成审核。', internal_note: '内部备注不可外泄' })
    assert.equal(resolved.status, 200)
    assert.equal(resolved.body.report.status, 'resolved')
    assert.ok(resolved.body.report.reviewed_at)
    assert.ok(resolved.body.report.resolved_at)

    const notification = await reporter.get('/api/notifications')
    assert.equal(notification.status, 200)
    assert.ok(notification.body.items.some((item: any) => item.type === 'report_update' && Number(item.report_id) === Number(reportId)))
    const resolvedDetail = await reporter.get(`/api/reports/${reportId}`)
    assert.equal(resolvedDetail.status, 200)
    assert.equal(resolvedDetail.body.report.public_response, '感谢反馈，已完成审核。')
    assert.equal('internal_note' in resolvedDetail.body.report, false)

    console.log('fourth-pass report API checks passed')
  } finally {
    child.kill('SIGTERM')
    await cleanupEmails(emails)
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
