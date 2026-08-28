import { expect, test, type Page } from '@playwright/test'
import fs from 'node:fs'

const publicRoutes = ['/', '/explore', '/about', '/login', '/register']
const authenticatedRoutes = [
  '/creation',
  '/write',
  '/settings',
  '/dashboard',
  '/dashboard/bookmarks',
  '/dashboard/notifications',
  '/personal/info',
  '/personal/study',
  '/personal/entertainment',
  '/personal/entertainment/images',
  '/personal/entertainment/videos',
  '/personal/entertainment/music',
]

function artifactName(project: string, route: string) {
  const suffix = route === '/' ? 'home' : route.replaceAll('/', '-').replace(/^-/, '')
  return `audit-artifacts/screenshots/${project}-${suffix}.png`
}

async function loginVisualUser(page: Page, project: string) {
  const suffix = `${Date.now()}-${project.replace(/[^a-z0-9]/gi, '')}`
  const email = `visual-${suffix}@own-web.test`
  const password = 'OwnWebVisualA1!'
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

test.describe('risk-based visual routes', () => {
  test('public routes have no horizontal overflow and preserve visual baselines', async ({ page }, testInfo) => {
    fs.mkdirSync('audit-artifacts/screenshots', { recursive: true })
    for (const route of publicRoutes) {
      await page.goto(route)
      await page.waitForLoadState('networkidle')
      await expect(page.locator('body')).toBeVisible()
      const dimensions = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: window.innerWidth }))
      expect(dimensions.width, `${route} overflows horizontally`).toBeLessThanOrEqual(dimensions.viewport)
      await page.screenshot({ path: artifactName(testInfo.project.name, route), fullPage: true })
      if (route === '/' || route === '/explore' || route === '/login' || route === '/register') {
        await expect(page).toHaveScreenshot(`${route === '/' ? 'home' : route.slice(1)}.png`, { fullPage: true, animations:'disabled' })
      }
    }
  })

  test('authenticated workspace routes remain visible and bounded', async ({ page }, testInfo) => {
    await loginVisualUser(page, testInfo.project.name)
    fs.mkdirSync('audit-artifacts/screenshots', { recursive: true })
    for (const route of authenticatedRoutes) {
      await page.goto(route)
      await page.waitForLoadState('networkidle')
      await expect(page.locator('body')).toBeVisible()
      const dimensions = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: window.innerWidth }))
      expect(dimensions.width, `${route} overflows horizontally`).toBeLessThanOrEqual(dimensions.viewport)
      await page.screenshot({ path: artifactName(testInfo.project.name, route), fullPage: true })
      if (route === '/creation' || route === '/write' || route === '/settings' || route === '/dashboard') {
        const dynamicFields = [page.locator('.user-menu')]
        if (route === '/settings') dynamicFields.push(page.locator('#blog-slug'))
        if (route === '/dashboard') dynamicFields.push(page.locator('.dashboard-intro'))
        await expect(page).toHaveScreenshot(`${route.slice(1)}.png`, { fullPage: true, animations:'disabled', mask:dynamicFields })
      }
    }
  })
})
