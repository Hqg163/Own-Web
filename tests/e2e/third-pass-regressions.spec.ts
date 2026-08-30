import { expect, test } from '@playwright/test'

test.describe.configure({ mode: 'serial', timeout: 90_000 })

test('clearing search does not restore the old query when switching feed', async ({ page }) => {
  await page.goto('/explore?q=Vue')
  await expect(page.locator('#explore-search')).toHaveValue('Vue')
  await page.locator('#explore-search').fill('')
  await page.getByRole('tab', { name: '热门' }).click()
  await expect(page).toHaveURL(/\/explore\?feed=hot/)
  await expect(page.locator('#explore-search')).toHaveValue('')
  expect(new URL(page.url()).searchParams.has('q')).toBe(false)
})

async function createPublishedArticle(page: any, suffix: string, contentMarkdown: string) {
  const origin = 'http://127.0.0.1:5173'
  const email = `third-pass-${suffix}-${Date.now()}@own-web.test`
  const password = 'OwnWebThirdPassA1!'
  const registration = await page.request.post('/api/register', { headers: { Origin: origin }, data: { email, password } })
  expect(registration.status()).toBe(201)
  const login = await page.request.post('/api/login', { headers: { Origin: origin }, data: { email, password } })
  expect(login.status()).toBe(200)
  const created = await page.request.post('/api/posts', { headers: { Origin: origin }, data: { title: `TOC Math ${suffix}`, contentFormat: 'markdown', contentMarkdown } })
  expect(created.status()).toBe(201)
  const post = (await created.json()).post
  const published = await page.request.put(`/api/posts/${post.id}`, { headers: { Origin: origin }, data: { title: post.title, slug: post.slug, contentFormat: 'markdown', contentMarkdown, status: 'published', visibility: 'public' } })
  expect(published.status()).toBe(200)
  return post.slug
}

test('article TOC scrolls below the sticky header and renders math', async ({ page }) => {
  const body = [
    '# TOC Math Regression',
    '',
    'Intro paragraph.',
    ...Array.from({ length: 16 }, (_, index) => `Filler paragraph ${index + 1}.`),
    '',
    '## 介绍',
    '',
    '第一节内容。',
    ...Array.from({ length: 10 }, (_, index) => `More content ${index + 1}.`),
    '',
    '## 介绍',
    '',
    String.raw`内联公式 \(E=mc^2\)。`,
    '',
    '$$',
    String.raw`\frac{\theta_{t+1}}{\sqrt{v_t}+\epsilon}`,
    '$$',
  ].join('\n')
  const slug = await createPublishedArticle(page, 'toc-math', body)
  await page.goto(`/posts/${slug}`)
  await expect(page.locator('.article')).toBeVisible()
  await expect(page.locator('[data-math] .katex')).toHaveCount(2)
  const headings = page.locator('.article h2')
  await expect(headings).toHaveCount(3)
  const ids = await headings.evaluateAll((nodes) => nodes.map((node) => node.id))
  expect(ids[0]).toBe('toc-math-regression')
  expect(ids[1]).toBe('介绍')
  expect(ids[2]).toBe('介绍-2')
  const desktopTocLink = page.locator('.toc a[href="#介绍"]')
  if (await desktopTocLink.isVisible()) {
    await desktopTocLink.click()
  } else {
    const mobileToc = page.locator('.toc-mobile')
    await mobileToc.locator('summary').click()
    await mobileToc.locator('a[href="#介绍"]').click()
  }
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  const headerHeight = await page.locator('.site-header').evaluate((node) => node.getBoundingClientRect().height)
  await expect.poll(() => headings.nth(1).evaluate((node) => node.getBoundingClientRect().top)).toBeGreaterThanOrEqual(headerHeight)
  const top = await headings.nth(1).evaluate((node) => node.getBoundingClientRect().top)
  expect(top).toBeGreaterThanOrEqual(headerHeight)
  expect(decodeURIComponent(new URL(page.url()).hash)).toBe('#介绍')
})
