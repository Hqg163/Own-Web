import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('guest public routes are usable and preserve the workspace entry point', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /把正在思考的事/ })).toBeVisible()
  await page.getByRole('link', { name: '开始探索' }).click()
  await expect(page).toHaveURL(/\/explore/)
  await expect(page.getByRole('heading', { name: '探索公开文章' })).toBeVisible()
  await expect(page.locator('body')).toHaveCSS('overflow-x', 'hidden')
  const accessibility = await new AxeBuilder({ page }).analyze()
  expect(accessibility.violations).toEqual([])
})

test('keyboard focus can reach the main navigation and search controls', async ({ page }) => {
  await page.goto('/explore')
  const search = page.locator('#explore-search')
  await expect(search).toBeVisible()
  await search.focus()
  await expect(search).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(page.locator('a:focus,button:focus,input:focus,select:focus,textarea:focus').first()).toBeVisible()
})
