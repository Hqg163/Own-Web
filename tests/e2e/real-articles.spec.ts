import { expect, test } from '@playwright/test'
import fs from 'node:fs'

test.describe.configure({ mode:'serial', timeout:90_000 })

test('creates and republishes four article workflows through the editor UI', async ({ page }, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.project.name.replace(/[^a-z0-9]/gi, '')}`
  const email = `writer-${suffix}@own-web.test`
  const password = 'OwnWebE2eA1!'
  await page.goto('/register')
  await page.locator('#register-email').fill(email)
  await page.locator('#register-password').fill(password)
  await page.locator('#register-confirm-password').fill(password)
  await page.getByRole('button', { name:'创建账户' }).click()
  await expect(page).toHaveURL(/\/login/)
  await page.locator('#login-email').fill(email)
  await page.locator('#login-password').fill(password)
  await page.getByRole('button', { name:'登录' }).click()
  await expect(page).toHaveURL(/\/dashboard/)
  fs.mkdirSync('audit-artifacts/screenshots', { recursive:true })
  const screenshotName = (name:string) => `audit-artifacts/screenshots/${testInfo.project.name}-${name}.png`
  await page.screenshot({ path:screenshotName('dashboard'), fullPage:true })
  const userInfo = await page.evaluate(() => JSON.parse(localStorage.getItem('userInfo') || '{}'))
  await page.goto(`/u/${userInfo.blog_slug || `u-${userInfo.id}`}`)
  await expect(page.locator('main')).toBeVisible()
  await page.screenshot({ path:screenshotName('profile'), fullPage:true })

  const articles = [
    { title:'Vue 3 响应式与调度', mode:'blocks', body:'响应式系统需要稳定的依赖追踪、调度与可观察的更新边界。\n\n这一段通过可视化块编辑器输入。' },
    { title:'从梯度下降到 Adam', mode:'markdown', body:'# 从梯度下降到 Adam\n\n设目标函数为 $f(\\theta)$，更新式为 $\\theta_{t+1}=\\theta_t-\\eta g_t$。\n\n```python\nprint("adam")\n```\n\n| 方法 | 特点 |\n| --- | --- |\n| SGD | 简单 |\n| Adam | 自适应 |' },
    { title:'京都街区观察', mode:'blocks', body:'清晨的街区由声音、光线和步行速度共同组成。\n\n长段落 fixture：在不改变阅读节奏的前提下，让图片、图库和引文拥有清楚的上下文。' },
    { title:'个人知识网站不应只是文件仓库', mode:'markdown', body:'# 个人知识网站不应只是文件仓库\n\n> 信息只有被重新组织，才会产生新的关系。\n\n<details>安全内容块</details>\n\n[Bookmark](https://www.youtube.com/watch?v=demo)' }
  ]

  for (const article of articles) {
    await page.goto('/write')
    await page.getByLabel('标题').fill(article.title)
    if (article.mode === 'markdown') {
      await page.getByRole('tab', { name:'Markdown' }).click()
      await page.getByLabel('Markdown 内容').fill(article.body)
    } else {
      await page.locator('.tiptap').fill(article.body)
    }
    await page.getByRole('button', { name:'保存草稿' }).click()
    await expect(page.getByText(/Saved|已保存/)).toBeVisible()
    await page.reload()
    await expect(page.getByLabel('标题')).toHaveValue(article.title)
    await expect(page.getByRole('heading', { name:'预览' })).toBeVisible()
    if (article.title === 'Vue 3 响应式与调度') await page.screenshot({ path:screenshotName('editor'), fullPage:true })
    await page.getByLabel('标题').fill(`${article.title}（再发布）`)
    await page.getByRole('button', { name:'立即发布' }).click()
    await expect(page).toHaveURL(/\/creation/)
    const row = page.locator('article').filter({ hasText:`${article.title}（再发布）` }).first()
    await expect(row).toBeVisible()
    if (article.title === 'Vue 3 响应式与调度') await page.screenshot({ path:screenshotName('creation'), fullPage:true })
    await row.getByRole('link', { name:'查看' }).click()
    await expect(page).toHaveURL(/\/posts\//)
    await expect(page.locator('.article')).toBeVisible()
    if (article.title === 'Vue 3 响应式与调度') await page.screenshot({ path:screenshotName('technical-article'), fullPage:true })
    if (article.title === '从梯度下降到 Adam') await page.screenshot({ path:screenshotName('mathematical-article'), fullPage:true })
    if (article.title === '京都街区观察') await page.screenshot({ path:screenshotName('visual-article'), fullPage:true })
    await page.goto('/creation')
    const reopened = page.locator('article').filter({ hasText:`${article.title}（再发布）` }).first()
    await reopened.getByRole('link', { name:'编辑' }).click()
    await expect(page.getByLabel('标题')).toHaveValue(`${article.title}（再发布）`)
    await page.getByLabel('标题').fill(`${article.title}（最终版）`)
    await page.getByRole('button', { name:'立即发布' }).click()
    await expect(page).toHaveURL(/\/creation/)
  }
})
