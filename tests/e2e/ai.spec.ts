import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function createPublicArticle(page: import('@playwright/test').Page, project: string) {
  const origin = 'http://127.0.0.1:5173'
  const suffix = `${Date.now()}-${project.replace(/[^a-z0-9]/gi, '')}`
  const email = `ai-selection-${suffix}@own-web.test`
  const password = 'OwnWebAiSelectionA1!'
  await expect((await page.request.post('/api/register', { headers: { Origin: origin }, data: { email, password } })).status()).toBe(201)
  await expect((await page.request.post('/api/login', { headers: { Origin: origin }, data: { email, password } })).status()).toBe(200)
  const contentMarkdown = '# 选区测试\n\n## 概念\n\n这是一段已经发布并授权给当前读者的选区证据。'
  const created = await page.request.post('/api/posts', { headers: { Origin: origin }, data: { title: `AI 选区 ${suffix}`, contentFormat: 'markdown', contentMarkdown } })
  expect(created.status()).toBe(201)
  const post = (await created.json()).post
  const published = await page.request.put(`/api/posts/${post.id}`, {
    headers: { Origin: origin },
    data: { title: post.title, slug: post.slug, contentFormat: 'markdown', contentMarkdown, status: 'published', visibility: 'public' },
  })
  expect(published.status()).toBe(200)
  return post.slug as string
}

test.describe('AI guest experience', () => {
  test.skip(process.env.AI_E2E_ENABLED !== '1', 'AI UI is enabled only by the focused Mock-provider runner')

  test('streams a Mock reply and restores launcher focus after Escape', async ({ page }) => {
    await page.goto('/ai')
    const composer = page.getByRole('textbox', { name: '输入给 AI 的消息' })
    await expect(composer).toBeVisible()
    const accessibility = await new AxeBuilder({ page }).analyze()
    expect(accessibility.violations).toEqual([])

    await composer.fill('你好，请简单介绍你能做什么。')
    await composer.press('Enter')
    await expect(page.getByText('这是一个 Mock 模式的直接回复：你好，请简单介绍你能做什么。')).toBeVisible()

    const launcher = page.getByRole('button', { name: '打开 AI 助手' })
    await launcher.click()
    await expect(page.getByRole('dialog', { name: '站内助手' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: '站内助手' })).toBeHidden()
    await expect(launcher).toBeFocused()
  })

  test('sanitizes hostile model-shaped Markdown output before it reaches the document', async ({ page }) => {
    await page.goto('/ai')
    const composer = page.getByRole('textbox', { name: '输入给 AI 的消息' })
    await composer.fill('<img src=x onerror="window.__ownWebAiXss = 1">')
    await composer.press('Enter')
    await expect(page.getByText('这是一个 Mock 模式的直接回复：')).toBeVisible()
    await expect(page.locator('.ai-message--assistant img')).toHaveCount(0)
    await expect(page.evaluate(() => (window as any).__ownWebAiXss)).resolves.toBeUndefined()
  })

  test('passes an article selection into the shared Ask AI panel', async ({ page }, testInfo) => {
    const slug = await createPublicArticle(page, testInfo.project.name)
    await page.goto(`/posts/${slug}`)
    await expect(page.locator('.article')).toContainText('已经发布并授权给当前读者')
    await page.locator('.article').evaluate((article) => {
      const text = [...article.querySelectorAll('p')].find((node) => node.textContent?.includes('已经发布并授权给当前读者'))
      if (!text?.firstChild) throw new Error('selection fixture paragraph was not rendered')
      const range = document.createRange()
      range.selectNodeContents(text)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
      text.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    })
    const selectionMenu = page.getByRole('menu', { name: '针对选文询问 AI' })
    await expect(selectionMenu.getByRole('menuitem', { name: '询问 AI' })).toBeVisible()
    await expect(selectionMenu.getByRole('menuitem', { name: '解释' })).toBeVisible()
    await expect(selectionMenu.getByRole('menuitem', { name: '展开说明' })).toBeVisible()
    await expect(selectionMenu.getByRole('menuitem', { name: '举例' })).toBeVisible()
    await selectionMenu.getByRole('menuitem', { name: '询问 AI' }).click()
    await expect(page.getByRole('dialog', { name: '站内助手' })).toBeVisible()
    await expect(page.getByText('已附加文章选文')).toBeVisible()
  })
})

test.describe('AI unavailable shell', () => {
  test.skip(process.env.AI_E2E_ENABLED === '1', 'The focused AI runner intentionally enables Mock chat')

  test('keeps the launcher discoverable when the service is disabled', async ({ page }) => {
    await page.goto('/')
    const launcher = page.getByRole('button', { name: '打开 AI 助手' })
    await expect(launcher).toBeVisible()
    await launcher.click()
    await expect(page.getByRole('dialog', { name: '站内助手' })).toBeVisible()
    await expect(page.getByText('AI 助手暂不可用')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(launcher).toBeFocused()
  })
})
