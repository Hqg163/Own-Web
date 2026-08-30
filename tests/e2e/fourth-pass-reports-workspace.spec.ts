import fs from 'node:fs'
import { expect, test } from '@playwright/test'

test.describe.configure({ mode: 'serial', timeout: 90_000 })

async function login(page: any, label: string) {
  const suffix = `${Date.now()}-${label}-${Math.random().toString(36).slice(2, 8)}`
  const email = `reports-${suffix}@own-web.test`
  const password = 'OwnWebReportsA1!'

  await page.goto('/register')
  await page.getByLabel('邮箱').fill(email)
  await page.getByLabel('密码', { exact: true }).fill(password)
  await page.getByLabel('确认密码').fill(password)
  await page.getByRole('button', { name: '创建账户' }).click()
  await expect(page).toHaveURL(/\/login/)
  await page.locator('#login-email').fill(email)
  await page.locator('#login-password').fill(password)
  await page.getByRole('button', { name: '登录' }).click()
  await expect(page).toHaveURL(/\/dashboard/)
}

const report = {
  id: 701,
  post_id: 42,
  reporter_id: 9,
  reason_code: 'privacy',
  reason: '隐私泄露',
  details: '举报时的补充说明',
  status: 'resolved',
  created_at: '2026-08-29T10:00:00.000Z',
  resolved_at: '2026-08-30T10:00:00.000Z',
  public_response: '感谢反馈，已经完成审核。',
  internal_note: '内部备注不应返回给普通用户',
  target_snapshot: {
    target_type: 'post',
    target_id: 42,
    post_title: '被举报的文章',
    post_author: '文章作者',
    excerpt: '举报时保留的简短快照。',
  },
  media: [{ id: 31, url: '/api/public/report-media/31', mime_type: 'image/png', width: 1, height: 1 }],
}

const adminReport = {
  ...report,
  status: 'pending',
  public_response: null,
  resolved_at: null,
  reporter: { id: 9, username: '举报人' },
  target_author: { id: 8, username: '文章作者' },
  current_content_url: '/posts/被举报的文章',
}

test('my reports keeps the user view private and links report updates', async ({ page }) => {
  await login(page, 'mine')

  await page.route(/\/api\/reports(?:\/|\?|$)/, async (route) => {
    const pathname = new URL(route.request().url()).pathname
    if (route.request().method() === 'GET' && pathname.endsWith('/701')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ report }) })
      return
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [report] }) })
  })
  await page.route('**/api/public/report-media/31', async (route) => {
    await route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64') })
  })

  await page.goto('/dashboard/reports')
  await expect(page).toHaveURL(/\/dashboard\/reports$/)
  await expect(page.getByRole('heading', { name: '我的举报' })).toBeVisible()
  await expect(page.getByText('隐私泄露', { exact: true })).toBeVisible()
  await expect(page.locator('.status-badge').filter({ hasText: '已处理' })).toBeVisible()
  await expect(page.getByText('感谢反馈，已经完成审核。')).toBeVisible()
  await expect(page.getByText('内部备注不应返回给普通用户')).toHaveCount(0)
  await expect(page.getByRole('link', { name: /查看举报详情/ })).toHaveAttribute('href', '/dashboard/reports/701')

  await page.goto('/dashboard/notifications')
  await page.route('**/api/notifications', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [{ id: 91, type: 'report_update', report_id: 701, is_read: false, created_at: report.resolved_at }] }) })
  })
  await page.reload()
  await expect(page.getByText('你的举报已有处理结果')).toBeVisible()
  await page.getByRole('link', { name: '查看举报详情' }).click()
  await expect(page).toHaveURL(/\/dashboard\/reports\/701$/)
})

test('admin reports shows a safe forbidden state for ordinary users and renders the review workspace from the protected API response', async ({ page }, testInfo) => {
  await login(page, 'admin-workspace')

  await page.goto('/admin/reports')
  await expect(page).toHaveURL(/\/admin\/reports$/)
  await expect(page.getByRole('heading', { name: '举报审核' })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('无权访问')
  await expect(page.getByText('管理员权限由服务端 API 校验')).toBeVisible()

  await page.route(/\/api\/admin\/reports(?:\/|\?|$)/, async (route) => {
    const pathname = new URL(route.request().url()).pathname
    if (route.request().method() === 'GET' && pathname.endsWith('/701')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ report: adminReport }) })
      return
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [adminReport] }) })
  })
  await page.reload()
  await expect(page.getByRole('heading', { name: '举报审核' })).toBeVisible()
  await expect(page.locator('.status-badge').filter({ hasText: '待处理' })).toBeVisible()
  await expect(page.getByText('举报人')).toBeVisible()
  await page.getByRole('link', { name: /查看详情/ }).click()
  await expect(page).toHaveURL(/\/admin\/reports\/701$/)
  await expect(page.getByText('举报时保留的简短快照。')).toBeVisible()
  await expect(page.getByRole('link', { name: '打开当前内容' })).toHaveAttribute('href', '/posts/被举报的文章')
  await expect(page.getByLabel('管理员内部备注')).toBeVisible()
  await expect(page.getByRole('button', { name: '开始审核' })).toBeVisible()
  await expect(page.getByRole('button', { name: '确认违规并处理' })).toBeVisible()
  await expect(page.getByRole('button', { name: '驳回举报' })).toBeVisible()
  fs.mkdirSync('audit-artifacts/screenshots', { recursive: true })
  await page.screenshot({ path: `audit-artifacts/screenshots/${testInfo.project.name}-admin-reports.png`, fullPage: false })
})

test('navigation exposes my reports without changing the existing menu destinations', async ({ page }) => {
  await login(page, 'navigation')
  await page.locator('.user-menu-trigger').click()
  await expect(page.getByRole('menuitem', { name: '我的举报' })).toHaveAttribute('href', '/dashboard/reports')
  await page.getByRole('menuitem', { name: '我的举报' }).click()
  await expect(page).toHaveURL(/\/dashboard\/reports$/)
})
