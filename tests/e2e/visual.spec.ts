import { expect, test } from '@playwright/test'
import fs from 'node:fs'

for (const route of ['/', '/explore', '/about']) {
  test(`visual ${route}`, async ({ page }, testInfo) => {
    await page.goto(route)
    fs.mkdirSync('audit-artifacts/screenshots', { recursive:true })
    await page.screenshot({ path:`audit-artifacts/screenshots/${testInfo.project.name}${route === '/' ? 'home' : route.replaceAll('/', '-')}.png`, fullPage:true })
    const dimensions = await page.evaluate(() => ({ width:document.documentElement.scrollWidth, viewport:window.innerWidth }))
    expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewport)
  })
}
