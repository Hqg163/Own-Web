import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const publicRoutes = [
  { path: '/', name: 'Home' },
  { path: '/explore', name: 'Explore' },
  { path: '/about', name: 'About' },
  { path: '/about/site', name: 'About Site' },
  { path: '/projects', name: 'Projects' },
  { path: '/projects/does-not-exist', name: 'Project Detail empty state' },
  { path: '/series/does-not-exist', name: 'Series empty state' },
  { path: '/this-route-does-not-exist', name: '404' },
]

test.describe('fifth-pass public accessibility', () => {
  for (const route of publicRoutes) {
    test(`${route.name} has no axe violations and a visible focus path`, async ({ page }) => {
      await page.goto(route.path)
      await expect(page.locator('main')).toBeVisible()

      const accessibility = await new AxeBuilder({ page }).analyze()
      expect(accessibility.violations).toEqual([])

      const focused = page.locator('a, button, input, select, textarea').first()
      await focused.focus()
      await expect(focused).toBeVisible()
      await expect(focused).toBeFocused()
    })
  }
})
