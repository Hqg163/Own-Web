import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('AI guest experience', () => {
  test.skip(process.env.AI_E2E_ENABLED !== '1', 'AI UI is enabled only by the focused Mock-provider runner')

  test('streams a Mock reply and restores launcher focus after Escape', async ({ page }) => {
    await page.goto('/ai')
    const composer = page.getByRole('textbox', { name: '输入给 AI 的消息' })
    await expect(composer).toBeVisible()
    const accessibility = await new AxeBuilder({ page }).analyze()
    expect(accessibility.violations).toEqual([])

    await composer.fill('你好，请简单介绍你能做什么。')
    await composer.press('Enter')
    await expect(page.getByText('这是一个 Mock 模式的直接回复：你好，请简单介绍你能做什么。')).toBeVisible()

    const launcher = page.getByRole('button', { name: '打开 AI 助手' })
    await launcher.click()
    await expect(page.getByRole('dialog', { name: '站内助手' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: '站内助手' })).toBeHidden()
    await expect(launcher).toBeFocused()
  })

  test('sanitizes hostile model-shaped Markdown output before it reaches the document', async ({ page }) => {
    await page.goto('/ai')
    const composer = page.getByRole('textbox', { name: '输入给 AI 的消息' })
    await composer.fill('<img src=x onerror="window.__ownWebAiXss = 1">')
    await composer.press('Enter')
    await expect(page.getByText('这是一个 Mock 模式的直接回复：')).toBeVisible()
    await expect(page.locator('.ai-message--assistant img')).toHaveCount(0)
    await expect(page.evaluate(() => (window as any).__ownWebAiXss)).resolves.toBeUndefined()
  })
})
