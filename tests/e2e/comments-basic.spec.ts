import { expect, test } from '@playwright/test'

test.describe.configure({ mode: 'serial', timeout: 90_000 })

test('comment composer supports root, reply, like and soft delete', async ({ page }) => {
  const suffix = `${Date.now()}`
  const email = `comments-${suffix}@own-web.test`
  const password = 'OwnWebCommentsA1!'
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

  const origin = 'http://127.0.0.1:5173'
  const created = await page.request.post('/api/posts', { headers: { Origin: origin }, data: { title: `评论回归 ${suffix}`, contentFormat: 'markdown', contentMarkdown: '# 评论回归\n\n用于评论闭环测试。' } })
  expect(created.status()).toBe(201)
  const post = (await created.json()).post
  const published = await page.request.put(`/api/posts/${post.id}`, { headers: { Origin: origin }, data: { title: post.title, slug: post.slug, contentFormat: 'markdown', contentMarkdown: '# 评论回归\n\n用于评论闭环测试。', status: 'published', visibility: 'public' } })
  expect(published.status()).toBe(200)

  await page.goto(`/posts/${post.slug}`)
  const composer = page.locator('.comment-composer')
  await expect(composer).toBeVisible()
  await composer.locator('textarea').fill('这是一个根评论。')
  await composer.getByRole('button', { name: '发表评论' }).click()
  await expect(page.locator('.comment-item__text')).toContainText('这是一个根评论。')

  const root = page.locator('.comment-item').filter({ hasText: '这是一个根评论。' }).first()
  await root.getByRole('button', { name: '喜欢' }).click()
  await expect(root.getByRole('button', { name: '喜欢' })).toHaveAttribute('aria-pressed', 'true')
  await root.getByRole('button', { name: '回复' }).click()
  await composer.locator('textarea').fill('这是一个回复。')
  await composer.getByRole('button', { name: '发送回复' }).click()
  await expect(page.getByText('这是一个回复。', { exact: true })).toBeVisible()

  const moreMenu = root.locator('details.comment-item__more')
  await moreMenu.locator('summary').click()
  await moreMenu.getByRole('menuitem', { name: '删除' }).click()
  await expect(page.getByRole('dialog', { name: '删除评论' })).toBeVisible()
  await page.getByRole('dialog', { name: '删除评论' }).getByRole('button', { name: '删除评论' }).click()
  await expect(page.locator('.comment-item__deleted')).toContainText('这条评论已删除。')
})
