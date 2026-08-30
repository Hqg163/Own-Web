import { expect, test } from '@playwright/test'

const origin = 'http://127.0.0.1:5173'
const timezones = ['UTC', 'Asia/Shanghai', 'Asia/Tokyo', 'America/New_York'] as const

test('comment timestamps honor the API instant in four browser timezones', async ({ browser, request }) => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const email = `sixth-pass-time-${suffix}@own-web.test`
  const password = 'OwnWebSixthPassA1!'
  const contentMarkdown = '# 时区时间回归\n\n验证 API 时间字段与浏览器上下文时区。'

  const registration = await request.post('/api/register', { headers: { Origin: origin }, data: { email, password } })
  expect(registration.status()).toBe(201)
  const login = await request.post('/api/login', { headers: { Origin: origin }, data: { email, password } })
  expect(login.status()).toBe(200)

  const created = await request.post('/api/posts', {
    headers: { Origin: origin },
    data: { title: `时区时间 ${suffix}`, contentFormat: 'markdown', contentMarkdown }
  })
  expect(created.status()).toBe(201)
  const post = (await created.json()).post
  const published = await request.put(`/api/posts/${post.id}`, {
    headers: { Origin: origin },
    data: { title: post.title, slug: post.slug, contentFormat: 'markdown', contentMarkdown, status: 'published', visibility: 'public', allowComments: true }
  })
  expect(published.status()).toBe(200)

  const submitted = await request.post(`/api/posts/${post.id}/comments`, { headers: { Origin: origin }, data: { content: '时区时间字段应保持同一瞬间。' } })
  expect(submitted.status()).toBe(201)
  const commentId = (await submitted.json()).comment.id
  const commentsResponse = await request.get(`/api/posts/${post.id}/comments?sort=newest`)
  expect(commentsResponse.status()).toBe(200)
  const comments = await commentsResponse.json()
  const comment = comments.items.find((item: { id: number }) => Number(item.id) === Number(commentId))

  expect(comment).toBeTruthy()
  expect(comment.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  expect(comment.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  expect(Number.isNaN(Date.parse(comment.created_at))).toBe(false)

  const absoluteLabels: string[] = []
  for (const timezoneId of timezones) {
    const context = await browser.newContext({ timezoneId })
    try {
      const page = await context.newPage()
      await page.goto(`/posts/${post.slug}`)
      const time = page.locator('.comment-item time').first()
      await expect(time).toBeVisible()
      await expect(time).toHaveAttribute('datetime', comment.created_at)
      await expect(time).toHaveText('刚刚')

      const expectedLabel = await page.evaluate((value) => new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)), comment.created_at)
      await expect(time).toHaveAttribute('title', expectedLabel)
      absoluteLabels.push(expectedLabel)
    } finally {
      await context.close()
    }
  }

  expect(new Set(absoluteLabels).size).toBe(timezones.length)
})
