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

async function stabilizeVisual(page: Page) {
  await page.addStyleTag({ content: `
    *, *::before, *::after {
      animation: none !important;
      transition: none !important;
      caret-color: transparent !important;
    }
  ` })
  await page.waitForFunction(() => document.readyState === 'complete')
  await page.evaluate(async () => {
    await document.fonts?.ready
    await Promise.all([...document.images].map(async (image) => {
      if (!image.complete) await new Promise<void>((resolve) => {
        image.addEventListener('load', () => resolve(), { once: true })
        image.addEventListener('error', () => resolve(), { once: true })
      })
      await image.decode?.().catch(() => {})
    }))
  })
}

async function expectViewportBounds(page: Page, route: string) {
  const bounds = await page.evaluate(() => {
    const viewport = window.innerWidth
    const offenders = [...document.querySelectorAll<HTMLElement>('body *')].flatMap((element) => {
      const style = window.getComputedStyle(element)
      if (style.display === 'none' || style.visibility === 'hidden' || element.closest('details:not([open])') || element.getClientRects().length === 0) return []
      const rect = element.getBoundingClientRect()
      if (rect.right <= -2 || rect.left >= viewport + 2) return []
      let ancestor = element.parentElement
      while (ancestor) {
        const overflowX = window.getComputedStyle(ancestor).overflowX
        const isHorizontalScroller = ['auto', 'scroll'].includes(overflowX) && ancestor.scrollWidth > ancestor.clientWidth + 1
        if (isHorizontalScroller || ['hidden', 'clip'].includes(overflowX)) {
          const clip = ancestor.getBoundingClientRect()
          const clipLeft = Math.max(clip.left, 0)
          const clipRight = Math.min(clip.right, viewport)
          if (rect.right <= clipLeft || rect.left >= clipRight) return []
          if (isHorizontalScroller && (rect.left < clipLeft || rect.right > clipRight)) return []
        }
        ancestor = ancestor.parentElement
      }
      return rect.left < -2 || rect.right > viewport + 2
        ? [{ tag: element.tagName.toLowerCase(), className: element.className, left: Math.round(rect.left), right: Math.round(rect.right) }]
        : []
    }).slice(0, 5)
    return { scrollWidth: document.documentElement.scrollWidth, viewport, offenders }
  })
  expect(bounds.scrollWidth, `${route} overflows horizontally`).toBeLessThanOrEqual(bounds.viewport + 2)
  expect(bounds.offenders, `${route} has visible elements outside the viewport`).toEqual([])
}

function dynamicMasks(page: Page) {
  return [
    page.locator('.user-menu'),
    page.locator('.dashboard-intro'),
    page.locator('#blog-slug'),
    page.locator('.save-state'),
    page.locator('.reading-progress'),
  ]
}

function screenshotOptions(page: Page) {
  return {
    fullPage: true,
    animations: 'disabled' as const,
    caret: 'hide' as const,
    mask: dynamicMasks(page),
    maxDiffPixelRatio: 0.01,
    maxDiffPixels: 150,
  }
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
      await stabilizeVisual(page)
      await expectViewportBounds(page, route)
      await page.screenshot({ path: artifactName(testInfo.project.name, route), fullPage: true })
      if (route === '/' || route === '/explore' || route === '/login' || route === '/register') {
        await expect(page).toHaveScreenshot(`${route === '/' ? 'home' : route.slice(1)}.png`, screenshotOptions(page))
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
      await stabilizeVisual(page)
      await expectViewportBounds(page, route)
      await page.screenshot({ path: artifactName(testInfo.project.name, route), fullPage: true })
      if (route === '/creation' || route === '/write' || route === '/settings' || route === '/dashboard') {
        await expect(page).toHaveScreenshot(`${route.slice(1)}.png`, screenshotOptions(page))
      }
    }
  })
})
