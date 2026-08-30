import { expect, test } from '@playwright/test'

test.describe.configure({ mode: 'serial', timeout: 120_000 })

const origin = 'http://127.0.0.1:5173'
const password = 'OwnWebPhaseDE2eA1!'
const onePixelPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
const configuredAdminEmails = String(process.env.ADMIN_EMAILS || '').split(',').map((email) => email.trim()).filter(Boolean)
const adminEmail = String(process.env.E2E_REPORT_ADMIN_EMAIL || configuredAdminEmails[0] || '').trim()
const adminPassword = String(process.env.E2E_REPORT_ADMIN_PASSWORD || password)
const adminFixtureGap = 'Admin 真实接口场景已跳过：当前 tests/support/start-test-server.cjs 未提供 ADMIN_EMAILS 管理员 fixture。主线程接入点：让测试服务器透传一个一次性管理员邮箱（ADMIN_EMAILS 与 E2E_REPORT_ADMIN_EMAIL 匹配），并提供 E2E_REPORT_ADMIN_PASSWORD 后再启用该场景。'

async function registerAndLogin(page: any, email: string, loginPassword = password) {
  const registration = await page.request.post('/api/register', {
    headers: { Origin: origin },
    data: { email, password: loginPassword },
  })
  expect([201, 409], `register ${email}: ${registration.status()}`).toContain(registration.status())

  const login = await page.request.post('/api/login', {
    headers: { Origin: origin },
    data: { email, password: loginPassword },
  })
  expect(login.status(), `login ${email}: ${await login.text()}`).toBe(200)
}

async function createPublishedPost(page: any, label: string) {
  const isSharedReporterFixture = label === 'reporter'
  const title = isSharedReporterFixture ? 'Phase D 举报详情真实文章' : `Phase D 举报详情真实文章（${label}）`
  const slug = isSharedReporterFixture ? 'phase-d-report-real' : `phase-d-report-${label}-${Date.now()}`
  const contentMarkdown = '# 快照来源\n\n这段正文只用于通过真实接口创建可举报文章。'
  const created = await page.request.post('/api/posts', {
    headers: { Origin: origin },
    data: { title, contentFormat: 'markdown', contentMarkdown },
  })
  expect(created.status(), await created.text()).toBe(201)
  const post = (await created.json()).post

  const published = await page.request.put(`/api/posts/${post.id}`, {
    headers: { Origin: origin },
    data: {
      title,
      slug,
      contentFormat: 'markdown',
      contentMarkdown,
      status: 'published',
      visibility: 'public',
      allowComments: true,
    },
  })
  expect(published.status(), await published.text()).toBe(200)
  return { id: post.id, title, slug }
}

async function submitReport(page: any, postId: number, details: string, withEvidence = true) {
  let mediaIds: number[] = []
  if (withEvidence) {
    const media = await page.request.post('/api/reports/media', {
      headers: { Origin: origin },
      multipart: {
        images: { name: 'phase-d-evidence.png', mimeType: 'image/png', buffer: onePixelPng },
      },
    })
    expect(media.status(), await media.text()).toBe(201)
    mediaIds = ((await media.json()).items || []).map((item: any) => Number(item.id))
    expect(mediaIds).toHaveLength(1)
  }

  const response = await page.request.post('/api/reports', {
    headers: { Origin: origin },
    data: { postId, reason_code: 'privacy', details, mediaIds },
  })
  expect(response.status(), await response.text()).toBe(201)
  const report = (await response.json()).report
  expect(report.status).toBe('pending')
  return report
}

async function createReporterScenario(page: any, label: string, withEvidence = true) {
  const authorEmail = 'phase-d-author@own-web.test'
  const reporterEmail = 'phase-d-reporter@own-web.test'
  const details = `Phase D 真实接口举报说明（${label}）`

  await registerAndLogin(page, reporterEmail)
  const existing = await page.request.get('/api/reports')
  expect(existing.status(), await existing.text()).toBe(200)
  const existingPayload = await existing.json()
  const existingReport = (existingPayload.items || []).find((item: any) => item.post_title === 'Phase D 举报详情真实文章'
    || item.post_slug === 'phase-d-report-real'
    || item.target_snapshot?.post_title === 'Phase D 举报详情真实文章'
    || item.target_snapshot?.post_slug === 'phase-d-report-real')
  if (existingReport) {
    expect('internal_note' in existingReport).toBe(false)
    return {
      reporterEmail,
      post: { id: existingReport.post_id, title: existingReport.post_title || existingReport.target_snapshot.post_title },
      report: existingReport,
      details: String(existingReport.details || details),
    }
  }

  await registerAndLogin(page, authorEmail)
  const post = await createPublishedPost(page, label)
  await registerAndLogin(page, reporterEmail)
  const report = await submitReport(page, post.id, details, withEvidence)
  expect('internal_note' in report).toBe(false)
  return { reporterEmail, post, report, details }
}

test('Reporter sees a concise list and an independent real-detail view', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop' && process.env.E2E_RUN_ALL !== '1', '真实 Reporter 接口场景默认只在 desktop 项目运行一次以遵守后端报告请求限流；设置 E2E_RUN_ALL=1 可单独验证其他 viewport。')
  const scenario = await createReporterScenario(page, 'reporter')

  await page.goto('/dashboard/reports')
  await expect(page).toHaveURL(/\/dashboard\/reports$/)
  await expect(page.getByRole('heading', { name: '我的举报' })).toBeVisible()
  const summary = page.locator('article.report-card').filter({ hasText: scenario.post.title })
  await expect(summary).toHaveCount(1)
  await expect(summary.locator('.status-badge')).toHaveAttribute('data-status', 'pending')
  await expect(summary).toContainText('隐私泄露')
  await expect(summary).toContainText('被举报作者：')
  await expect(summary).not.toContainText(scenario.details)
  await expect(page.locator('[aria-label="举报摘要列表"]')).toBeVisible()

  await summary.getByRole('link', { name: /查看举报详情/ }).click()
  await expect(page).toHaveURL(new RegExp(`/dashboard/reports/${scenario.report.id}$`))
  await expect(page.getByRole('heading', { name: '举报详情', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '举报说明' })).toBeVisible()
  await expect(page.getByText('Phase D 真实接口举报说明', { exact: false })).toBeVisible()
  await expect(page.getByRole('heading', { name: '举报时内容快照' })).toBeVisible()
  await expect(page.locator('section[aria-labelledby="report-snapshot-title"]').getByText(scenario.post.title, { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '被举报作者' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '举报证据' })).toBeVisible()
  await expect(page.locator('.evidence-item img')).toHaveCount(1)
  await expect(page.getByRole('heading', { name: '处理时间线' })).toBeVisible()
  await expect(page.locator('.timeline-item[data-status="pending"]')).toHaveCount(1)
  await expect(page.getByText('已提交举报', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '管理员公开回复' })).toBeVisible()
  await expect(page.getByText('暂未收到公开回复。', { exact: false })).toBeVisible()
  await expect(page.locator('body')).not.toContainText('internal_note')
  await expect(page.getByRole('link', { name: '返回我的举报' }).first()).toHaveAttribute('href', '/dashboard/reports')

  await page.goto('/dashboard/reports/999999999')
  await expect(page.getByRole('alert')).toContainText('找不到这条举报')
  await expect(page.getByRole('link', { name: '返回我的举报' }).first()).toBeVisible()
})

test('Admin uses the protected real interface and reporter receives the public result', async ({ page }, testInfo) => {
  test.skip(!adminEmail, adminFixtureGap)
  test.skip(testInfo.project.name !== 'desktop', 'Admin 真实接口场景只在 desktop 项目运行一次；其他项目由 Reporter 场景覆盖响应式详情布局。')

  const scenario = await createReporterScenario(page, 'admin', false)
  await registerAndLogin(page, adminEmail, adminPassword)

  const adminList = await page.request.get('/api/admin/reports', { params: { status: 'pending' } })
  expect(adminList.status(), await adminList.text()).toBe(200)
  const adminPayload = await adminList.json()
  expect(adminPayload.items.some((item: any) => Number(item.id) === Number(scenario.report.id))).toBe(true)

  await page.goto('/admin/reports')
  await expect(page.getByRole('heading', { name: '举报审核' })).toBeVisible()
  const adminSummary = page.locator('article.report-card').filter({ hasText: scenario.post.title })
  await expect(adminSummary).toHaveCount(1)
  await adminSummary.getByRole('link', { name: '查看详情' }).click()
  await expect(page).toHaveURL(new RegExp(`/admin/reports/${scenario.report.id}$`))
  await expect(page.getByRole('heading', { name: '举报审核' })).toBeVisible()
  await expect(page.getByLabel('管理员内部备注')).toBeVisible()

  await page.getByLabel('管理员内部备注').fill('Phase D admin-only note')
  await page.getByLabel('用户可见处理说明').fill('Phase D 公开处理结果')
  await page.getByRole('button', { name: '开始审核' }).click()
  await expect(page.getByText('已开始审核。', { exact: true })).toBeVisible()
  await expect(page.locator('.status-badge')).toHaveAttribute('data-status', 'reviewing')
  await page.getByRole('button', { name: '确认违规并处理' }).click()
  await expect(page.getByText('举报已标记为已处理。', { exact: true })).toBeVisible()
  await expect(page.locator('.status-badge')).toHaveAttribute('data-status', 'resolved')

  const reporterDetail = await page.request.get(`/api/admin/reports/${scenario.report.id}`)
  expect(reporterDetail.status()).toBe(200)
  expect((await reporterDetail.json()).report.internal_note).toBe('Phase D admin-only note')

  await registerAndLogin(page, scenario.reporterEmail)
  const ownDetail = await page.request.get(`/api/reports/${scenario.report.id}`)
  expect(ownDetail.status()).toBe(200)
  const ownReport = (await ownDetail.json()).report
  expect(ownReport.public_response).toBe('Phase D 公开处理结果')
  expect('internal_note' in ownReport).toBe(false)

  await page.goto(`/dashboard/reports/${scenario.report.id}`)
  await expect(page.getByRole('heading', { name: '举报详情', exact: true })).toBeVisible()
  await expect(page.locator('.status-badge')).toHaveAttribute('data-status', 'resolved')
  await expect(page.getByText('Phase D 公开处理结果', { exact: true })).toBeVisible()
  await expect(page.locator('.timeline-item[data-status="reviewing"]')).toHaveCount(1)
  await expect(page.locator('.timeline-item[data-status="resolved"]')).toHaveCount(1)
  await expect(page.locator('body')).not.toContainText('Phase D admin-only note')

  const dismissedReport = await submitReport(page, scenario.post.id, 'Phase D dismissed 真实接口说明', false)
  await registerAndLogin(page, adminEmail, adminPassword)
  await page.goto(`/admin/reports/${dismissedReport.id}`)
  await expect(page.getByRole('heading', { name: '举报审核' })).toBeVisible()
  await page.getByLabel('用户可见处理说明').fill('Phase D 驳回处理结果')
  await page.getByRole('button', { name: '驳回举报' }).click()
  await expect(page.getByText('举报已驳回。', { exact: true })).toBeVisible()
  await expect(page.locator('.status-badge')).toHaveAttribute('data-status', 'dismissed')

  await registerAndLogin(page, scenario.reporterEmail)
  await page.goto(`/dashboard/reports/${dismissedReport.id}`)
  await expect(page.locator('.status-badge')).toHaveAttribute('data-status', 'dismissed')
  await expect(page.getByText('Phase D 驳回处理结果', { exact: true })).toBeVisible()
  await expect(page.locator('.timeline-item[data-status="dismissed"]')).toHaveCount(1)
})
