import { expect, test, type Page } from '@playwright/test'

function parseColor(value: string) {
  const match = value.match(/[\d.]+/g) || []
  const channels = match.slice(0, 3).map(Number)
  return channels.length === 3 ? channels : [0, 0, 0]
}

function relativeLuminance(value: string) {
  return parseColor(value).reduce((sum, channel, index) => {
    const normalized = channel / 255
    const linear = normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
    return sum + linear * [0.2126, 0.7152, 0.0722][index]
  }, 0)
}

function contrastRatio(foreground: string, background: string) {
  const foregroundLuminance = relativeLuminance(foreground)
  const backgroundLuminance = relativeLuminance(background)
  const lighter = Math.max(foregroundLuminance, backgroundLuminance)
  const darker = Math.min(foregroundLuminance, backgroundLuminance)
  return (lighter + 0.05) / (darker + 0.05)
}

test.describe.configure({ mode: 'serial', timeout: 60_000 })

async function seedPublicCategoryArticle(page: Page) {
  const origin = 'http://127.0.0.1:5173'
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const email = `fourth-pass-explore-${suffix}@own-web.test`
  const password = 'OwnWebExploreA1!'
  const registration = await page.request.post('/api/register', { headers: { Origin: origin }, data: { email, password } })
  expect(registration.status()).toBe(201)
  const login = await page.request.post('/api/login', { headers: { Origin: origin }, data: { email, password } })
  expect(login.status()).toBe(200)
  const created = await page.request.post('/api/posts', { headers: { Origin: origin }, data: { title: `Explore listbox ${suffix}`, contentFormat: 'markdown', contentMarkdown: 'A category listbox fixture.' } })
  expect(created.status()).toBe(201)
  const post = (await created.json()).post
  const published = await page.request.put(`/api/posts/${post.id}`, { headers: { Origin: origin }, data: { title: post.title, slug: post.slug, contentFormat: 'markdown', contentMarkdown: 'A category listbox fixture.', status: 'published', visibility: 'public', categorySlugs: ['technology'] } })
  expect(published.status()).toBe(200)
}

test('category listbox preserves keyboard, focus, and applied query behavior', async ({ page }) => {
  await seedPublicCategoryArticle(page)
  await page.goto('/explore?q=Vue&feed=hot&page=3')

  const trigger = page.getByTestId('explore-category-trigger')
  const listbox = page.getByTestId('explore-category-listbox')
  await expect(trigger).toBeVisible()
  await expect(trigger).toBeEnabled()
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')

  await trigger.focus()
  await trigger.press('ArrowDown')
  await expect(listbox).toBeVisible()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')

  const options = listbox.getByRole('option')
  const optionCount = await options.count()
  expect(optionCount).toBeGreaterThan(0)
  await expect(options.first()).toHaveAttribute('aria-selected', 'true')
  await expect(options.first()).toBeFocused()

  if (optionCount > 1) {
    await page.keyboard.press('ArrowDown')
    await expect(options.nth(1)).toBeFocused()
    await expect(options.nth(1)).toHaveAttribute('aria-selected', 'false')
    await page.keyboard.press('ArrowUp')
    await expect(options.first()).toBeFocused()
  }

  await page.keyboard.press('Escape')
  await expect(listbox).toBeHidden()
  await expect(trigger).toBeFocused()

  await trigger.press('Enter')
  await expect(listbox).toBeVisible()
  await page.locator('#explore-search').click()
  await expect(listbox).toBeHidden()
  await expect(page.locator('#explore-search')).toBeFocused()

  await trigger.click()
  const selectableOption = options.nth(optionCount > 1 ? 1 : 0)
  const selectedSlug = await selectableOption.getAttribute('data-value')
  expect(selectedSlug).toBeTruthy()
  await selectableOption.click()
  await expect(listbox).toBeHidden()
  await expect(page).toHaveURL(new RegExp(`[?&]q=Vue(?:&|$)`))
  await expect(page).toHaveURL(new RegExp(`[?&]feed=hot(?:&|$)`))
  expect(new URL(page.url()).searchParams.has('page')).toBe(false)
  expect(new URL(page.url()).searchParams.get('category')).toBe(selectedSlug)
  await expect(page.locator('#explore-search')).toHaveValue('Vue')

  await expect(trigger).toBeEnabled()
  await trigger.focus()
  await trigger.press('ArrowDown')
  await expect(listbox.getByRole('option', { selected: true })).toHaveCount(1)
  await expect(listbox.getByRole('option', { selected: true })).toHaveAttribute('data-value', selectedSlug || '')
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
})

test('category listbox states have readable theme contrast and loading disabled state', async ({ page }, testInfo) => {
  await seedPublicCategoryArticle(page)
  await page.route('**/api/public/posts*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 250))
    await route.continue()
  })
  await page.goto('/explore', { waitUntil: 'domcontentloaded' })

  const trigger = page.getByTestId('explore-category-trigger')
  await expect(trigger).toBeVisible()
  await expect(trigger).toBeDisabled()
  await expect(trigger).toBeEnabled()

  await trigger.click()
  const listbox = page.getByTestId('explore-category-listbox')
  const selectedOption = listbox.getByRole('option', { selected: true })
  await expect(selectedOption).toHaveCount(1)
  const hoverOption = listbox.getByRole('option').last()

  for (const element of [trigger, selectedOption, hoverOption]) {
    const colors = await element.evaluate((node) => {
      const style = getComputedStyle(node)
      return { foreground: style.color, background: style.backgroundColor }
    })
    expect(colors.background).not.toBe('rgba(0, 0, 0, 0)')
    expect(contrastRatio(colors.foreground, colors.background), `${testInfo.project.name} contrast`).toBeGreaterThanOrEqual(4.5)
  }

  await hoverOption.hover()
  const hoverColors = await hoverOption.evaluate((node) => {
    const style = getComputedStyle(node)
    return { foreground: style.color, background: style.backgroundColor }
  })
  expect(contrastRatio(hoverColors.foreground, hoverColors.background), `${testInfo.project.name} hover contrast`).toBeGreaterThanOrEqual(4.5)
  await hoverOption.focus()
  await expect(hoverOption).toBeFocused()
  await expect(selectedOption).toHaveAttribute('aria-selected', 'true')
  await page.screenshot({ path: `audit-artifacts/screenshots/${testInfo.project.name}-explore-category-listbox.png`, fullPage: false })
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
})
