import { expect, test } from '@playwright/test'

const origin = 'http://127.0.0.1:5173'
const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')

test.describe.configure({ mode: 'serial', timeout: 90_000 })

async function createPublishedArticle(page: any) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const email = `phase1-reading-${suffix}@own-web.test`
  const password = 'OwnWebPhase1A1!'
  const registration = await page.request.post('/api/register', { headers: { Origin: origin }, data: { email, password } })
  expect(registration.status()).toBe(201)
  const login = await page.request.post('/api/login', { headers: { Origin: origin }, data: { email, password } })
  expect(login.status()).toBe(200)

  const contentMarkdown = '# 正文一级标题\n\n## 章节标题\n\n这是一段用于验证移动端正文宽度、共享排版和目录层级的文章。\n\n```typescript\nconst longLine = "这是一行用于验证代码块局部滚动的内容"\n```\n\n| 列一 | 列二 |\n| --- | --- |\n| 内容 | 内容 |'
  const created = await page.request.post('/api/posts', {
    headers: { Origin: origin },
    data: { title: `Phase 1 阅读体验 ${suffix}`, contentFormat: 'markdown', contentMarkdown },
  })
  expect(created.status()).toBe(201)
  const post = (await created.json()).post
  const published = await page.request.put(`/api/posts/${post.id}`, {
    headers: { Origin: origin },
    data: { title: post.title, slug: post.slug, contentFormat: 'markdown', contentMarkdown, status: 'published', visibility: 'public', allowComments: true },
  })
  expect(published.status()).toBe(200)
  return post.slug
}

test('published Markdown has one page H1, normalized body headings, and no narrow viewport overflow', async ({ page }) => {
  const slug = await createPublishedArticle(page)
  await page.goto(`/posts/${slug}`)
  await expect(page.locator('.article-typography')).toBeVisible()
  await expect(page.locator('h1')).toHaveCount(1)
  await expect(page.locator('.article h1')).toHaveCount(0)
  await expect(page.locator('.article h2').filter({ hasText: '正文一级标题' })).toBeVisible()
  await expect(page.locator('.article h2').filter({ hasText: '章节标题' })).toBeVisible()

  const width = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: window.innerWidth }))
  expect(width.document).toBeLessThanOrEqual(width.viewport + 1)
  await expect(page.locator('.article pre')).toHaveCSS('overflow-x', 'auto')
})

test('image-only comment can submit and its preview restores keyboard focus', async ({ page }) => {
  const slug = await createPublishedArticle(page)
  await page.goto(`/posts/${slug}`)
  const composer = page.locator('.comment-composer')
  await expect(composer).toBeVisible()
  await composer.locator('input[type="file"]').setInputFiles({ name: 'comment.png', mimeType: 'image/png', buffer: tinyPng })

  const submit = composer.getByRole('button', { name: '发表评论' })
  await expect(submit).toBeEnabled()
  await submit.click()
  const comment = page.locator('.comment-item').first()
  await expect(comment).toBeVisible()
  await expect(comment.locator('.comment-item__text')).toHaveCount(0)
  const preview = comment.getByRole('button', { name: '预览图片 1' })
  await preview.click()
  await expect(page.getByRole('dialog', { name: '评论图片预览' })).toBeVisible()
  await expect(page.getByRole('button', { name: '关闭图片预览' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: '评论图片预览' })).toBeHidden()
  await expect(preview).toBeFocused()
})
