import { expect, test } from '@playwright/test'

test.describe('draft lifecycle', () => {
  test.describe.configure({ mode: 'serial', timeout: 60_000 })

  async function login(page: any, testInfo: any) {
    const email = `draft-${Date.now()}-${testInfo.project.name.replace(/[^a-z0-9]/gi, '')}@own-web.test`
    const password = 'OwnWebDraftA1!'
    await page.goto('/register')
    await page.locator('#register-email').fill(email)
    await page.locator('#register-password').fill(password)
    await page.locator('#register-confirm-password').fill(password)
    await page.getByRole('button', { name: '创建账户' }).click()
    await expect(page).toHaveURL(/\/login/)
    await page.locator('#login-email').fill(email)
    await page.locator('#login-password').fill(password)
    await page.getByRole('button', { name: '登录' }).click()
    await expect(page).toHaveURL(/\/dashboard/)
  }

  test('does not persist an empty or one-character new draft', async ({ page }, testInfo) => {
    await login(page, testInfo)
    const postCreates: string[] = []
    page.on('request', (request: any) => {
      if (request.method() === 'POST' && /\/api\/posts$/.test(request.url())) postCreates.push(request.url())
    })
    await page.goto('/write')
    await page.getByLabel('标题').fill('a')
    await page.getByLabel('标题').fill('')
    await page.getByLabel('标题').blur()
    await page.waitForTimeout(1_600)
    expect(postCreates).toHaveLength(0)
    await page.getByRole('link', { name: '← 创作中心' }).click()
    await expect(page).toHaveURL(/\/creation/)
    await expect(page.getByRole('dialog', { name: '离开编辑器' })).toHaveCount(0)
    expect(postCreates).toHaveLength(0)
  })

  test('deletes an owned draft from Creation after confirmation without resetting list query', async ({ page }, testInfo) => {
    await login(page, testInfo)
    const title = '创作中心删除回归草稿'
    await page.goto('/write')
    await page.getByLabel('标题').fill(title)
    await page.locator('.tiptap').fill('用于验证创作中心删除入口的正文。')
    await page.getByRole('button', { name: '保存草稿' }).click()
    await expect.poll(() => page.url()).toMatch(/\/posts\/\d+\/edit/)

    await page.goto(`/creation?filter=draft&q=${encodeURIComponent(title)}&sort=title&page=1`)
    const row = page.locator('.articles article').filter({ hasText: title })
    await expect(row).toBeVisible()
    await row.getByRole('button', { name: '删除草稿' }).click()
    const dialog = page.getByRole('dialog', { name: '删除草稿' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: '取消' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(row).toBeVisible()

    await row.getByRole('button', { name: '删除草稿' }).click()
    await dialog.getByRole('button', { name: '删除草稿', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(page.getByRole('status')).toContainText('草稿已删除')
    await expect(row).toHaveCount(0)
    await expect.poll(() => {
      const params = new URL(page.url()).searchParams
      return [params.get('filter'), params.get('q'), params.get('sort'), params.get('page')]
    }).toEqual(['draft', title, 'title', '1'])
  })

  test('autosaves meaningful content, keeps it after reload, and discards only an owned draft', async ({ page }, testInfo) => {
    await login(page, testInfo)
    await page.goto('/write')
    await page.getByLabel('标题').fill('生命周期回归草稿')
    await page.locator('.tiptap').fill('这是一段有意义的草稿正文，用来覆盖自动保存和重新加载。')
    await expect(page.getByRole('status')).toContainText(/Saving|Saved|已保存/, { timeout: 10_000 })
    await expect.poll(() => page.url()).toMatch(/\/posts\/\d+\/edit/)
    await page.reload()
    await expect(page.getByLabel('标题')).toHaveValue('生命周期回归草稿')
    await expect(page.locator('.tiptap')).toContainText('有意义的草稿正文')
    await page.getByRole('button', { name: '删除草稿' }).click()
    await expect(page.getByRole('dialog', { name: '删除草稿' })).toBeVisible()
    await page.getByRole('button', { name: '删除草稿', exact: true }).last().click()
    await expect(page).toHaveURL(/\/creation/)
  })

  test('retains editor content when autosave fails and exposes retry state', async ({ page }, testInfo) => {
    await login(page, testInfo)
    await page.goto('/write')
    await page.getByLabel('标题').fill('网络失败保留草稿')
    await page.locator('.tiptap').fill('先保存一份已有文章，再模拟网络故障。')
    await page.getByRole('button', { name: '保存草稿' }).click()
    await expect(page).toHaveURL(/\/posts\/\d+\/edit/)
    await page.route('**/api/posts/*/autosave', async (route: any) => {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'TEST_NETWORK_FAILURE', message: '模拟网络失败' } }) })
    })
    await page.getByLabel('标题').fill('网络失败后仍保留内容')
    await expect(page.getByRole('status')).toContainText(/失败|Failed/, { timeout: 10_000 })
    await expect(page.getByLabel('标题')).toHaveValue('网络失败后仍保留内容')
    await page.unroute('**/api/posts/*/autosave')
    await page.getByRole('button', { name: '删除草稿' }).click()
    await page.getByRole('button', { name: '删除草稿', exact: true }).last().click()
    await expect(page).toHaveURL(/\/creation/)
  })
})
