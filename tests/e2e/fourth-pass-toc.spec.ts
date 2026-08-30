import fs from 'node:fs'
import { expect, test } from '@playwright/test'

test.describe.configure({ mode: 'serial', timeout: 90_000 })

async function createLongArticle(page: any) {
  const origin = 'http://127.0.0.1:5173'
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const email = `fourth-pass-toc-${suffix}@own-web.test`
  const password = 'OwnWebFourthPassA1!'
  const registration = await page.request.post('/api/register', {
    headers: { Origin: origin },
    data: { email, password },
  })
  expect(registration.status()).toBe(201)
  const login = await page.request.post('/api/login', {
    headers: { Origin: origin },
    data: { email, password },
  })
  expect(login.status()).toBe(200)

  const sections = Array.from({ length: 22 }, (_, index) => {
    const title = index < 2 ? '重复标题' : `第 ${index + 1} 节`
    return [
      `## ${title}`,
      '',
      `这一节用于验证长文章阅读时目录仍然可见。段落 ${index + 1}。`,
      '',
      `### 子章节 ${index + 1}`,
      '',
      ...Array.from({ length: 4 }, (_, paragraph) => `阅读内容 ${index + 1}-${paragraph + 1}，用于撑开文章高度。`),
      '',
    ].join('\n')
  })
  const contentMarkdown = ['# Sticky TOC 回归文章', '', '目录与阅读区域回归测试。', '', ...sections].join('\n')
  const created = await page.request.post('/api/posts', {
    headers: { Origin: origin },
    data: { title: `Sticky TOC ${suffix}`, contentFormat: 'markdown', contentMarkdown },
  })
  expect(created.status()).toBe(201)
  const post = (await created.json()).post
  const published = await page.request.put(`/api/posts/${post.id}`, {
    headers: { Origin: origin },
    data: {
      title: post.title,
      slug: post.slug,
      contentFormat: 'markdown',
      contentMarkdown,
      status: 'published',
      visibility: 'public',
    },
  })
  expect(published.status()).toBe(200)
  return post.slug
}

async function assertTocFitsViewport(page: any) {
  const result = await page.locator('.toc-wrap').evaluate((node: HTMLElement) => {
    const rect = node.getBoundingClientRect()
    const article = node.closest('.article-layout')?.querySelector('article')?.getBoundingClientRect()
    return {
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
      viewportHeight: window.innerHeight,
      articleLeft: article?.left ?? 0,
      articleRight: article?.right ?? 0,
    }
  })
  expect(result.top).toBeGreaterThanOrEqual(0)
  expect(result.bottom).toBeLessThanOrEqual(result.viewportHeight + 1)
  expect(result.right <= result.articleLeft || result.left >= result.articleRight).toBe(true)
}

async function expectHash(page: any, expected: string) {
  await expect.poll(() => decodeURIComponent(new URL(page.url()).hash)).toBe(expected)
}

test('desktop TOC remains sticky through the article and keeps its own long-list scroll', async ({ page }, testInfo) => {
  const slug = await createLongArticle(page)
  const isMobile = testInfo.project.name.includes('mobile')
  const widths = isMobile ? [390] : [1440, 1280, 1024]

  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(`/posts/${slug}`)
    await expect(page.locator('.article')).toBeVisible()

    if (isMobile) {
      await expect(page.locator('.toc-mobile')).toBeVisible()
      await expect(page.locator('.toc')).toBeHidden()
      continue
    }

    const tocWrap = page.locator('.toc-wrap')
    const toc = page.locator('.toc')
    await expect(tocWrap).toBeVisible()
    await expect(toc).toBeVisible()
    const styles = await tocWrap.evaluate((node) => {
      const wrap = getComputedStyle(node)
      const inner = getComputedStyle(node.querySelector('.toc') as Element)
      return {
        wrapPosition: wrap.position,
        top: wrap.top,
        maxHeight: wrap.maxHeight,
        overflowY: wrap.overflowY,
        innerPosition: inner.position,
      }
    })
    expect(styles.wrapPosition).toBe('sticky')
    expect(parseFloat(styles.top)).toBeGreaterThanOrEqual(64)
    expect(styles.maxHeight).not.toBe('none')
    expect(['auto', 'scroll']).toContain(styles.overflowY)
    expect(styles.innerPosition).not.toBe('sticky')

    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }))
    await assertTocFitsViewport(page)
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight / 2, behavior: 'instant' as ScrollBehavior }))
    await assertTocFitsViewport(page)
    fs.mkdirSync('audit-artifacts/screenshots', { recursive: true })
    await page.screenshot({
      path: `audit-artifacts/screenshots/${testInfo.project.name}-sticky-toc-${width}.png`,
      fullPage: false,
    })
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' as ScrollBehavior }))
    await assertTocFitsViewport(page)

    const listMetrics = await tocWrap.evaluate((node: HTMLElement) => ({ clientHeight: node.clientHeight, scrollHeight: node.scrollHeight }))
    expect(listMetrics.scrollHeight).toBeGreaterThan(listMetrics.clientHeight)

    const headings = page.locator('.article h2:not([data-source-heading="h1"])')
    const ids = await headings.evaluateAll((nodes) => nodes.map((node) => node.id))
    expect(ids[0]).toBe('重复标题')
    expect(ids[1]).toBe('重复标题-2')
    const lastId = ids.at(-1)
    expect(lastId).toBeTruthy()
    await page.evaluate((id) => document.getElementById(id as string)?.scrollIntoView({ block: 'start', behavior: 'instant' as ScrollBehavior }), lastId)
    await expect.poll(() => page.locator('.toc a.active').getAttribute('href')).toBe(`#${lastId}`)
    await expect.poll(() => tocWrap.evaluate((node: HTMLElement) => node.scrollTop)).toBeGreaterThan(0)

    await page.locator('.toc a[href="#重复标题"]').first().click()
    await expectHash(page, '#重复标题')
    const headerHeight = await page.locator('.site-header').evaluate((node) => node.getBoundingClientRect().height)
    await expect.poll(() => headings.first().evaluate((node) => node.getBoundingClientRect().top)).toBeGreaterThanOrEqual(headerHeight)

    await page.locator('.toc a[href="#重复标题-2"]').click()
    await expectHash(page, '#重复标题-2')
    await page.goBack()
    await expectHash(page, '#重复标题')
    await page.goForward()
    await expectHash(page, '#重复标题-2')

    await page.goto(`/posts/${slug}#重复标题-2`)
    await expect.poll(() => headings.nth(1).evaluate((node) => node.getBoundingClientRect().top)).toBeGreaterThanOrEqual(headerHeight)
  }
})

test('article report opens the shared dialog instead of submitting a fixed reason immediately', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    localStorage.setItem('isLoggedIn', 'true')
    localStorage.setItem('userInfo', JSON.stringify({ id: 1 }))
  })
  const slug = await createLongArticle(page)
  let reportRequests = 0
  await page.on('request', (request) => {
    if (request.url().includes('/api/reports') && request.method() === 'POST') reportRequests += 1
  })
  await page.goto(`/posts/${slug}`)
  await expect(page.locator('.article-actions')).toBeVisible()
  const reportButton = page.getByRole('button', { name: '举报' })
  await expect(reportButton).toBeVisible()
  await reportButton.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  fs.mkdirSync('audit-artifacts/screenshots', { recursive: true })
  await page.screenshot({ path: `audit-artifacts/screenshots/${testInfo.project.name}-report-dialog.png`, fullPage: false })
  expect(reportRequests).toBe(0)
})
