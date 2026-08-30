import { expect, test } from '@playwright/test'

async function login(page: any, testInfo: any) {
  const suffix = `${Date.now()}-${testInfo.project.name.replace(/[^a-z0-9]/gi, '')}`
  const email = `music-volume-${suffix}@own-web.test`
  const password = 'OwnWebMusicA1!'
  await page.goto('/register')
  await page.getByLabel('邮箱').fill(email)
  await page.getByLabel('密码', { exact:true }).fill(password)
  await page.getByLabel('确认密码').fill(password)
  await page.getByRole('button', { name:'创建账户' }).click()
  await expect(page).toHaveURL(/\/login\?registered=1/)
  await page.locator('#login-email').fill(email)
  await page.locator('#login-password').fill(password)
  await page.getByRole('button', { name:'登录' }).click()
  await expect(page).toHaveURL(/\/dashboard/)
}

async function setRangeValue(slider: any, value: number) {
  await slider.evaluate((element: HTMLInputElement, nextValue: number) => {
    element.value = String(nextValue)
    element.dispatchEvent(new Event('input', { bubbles:true }))
  }, value)
}

test('volume sliders expose readable filled tracks across themes and native keyboard states', async ({ page }, testInfo) => {
  const theme = testInfo.project.name.includes('dark') ? 'dark' : 'light'
  await page.addInitScript((selectedTheme) => {
    localStorage.setItem('theme', selectedTheme)
  }, theme)
  await login(page, testInfo)
  await page.route('**/api/entertainment/music/*', async (route) => {
    await route.fulfill({
      contentType:'application/json',
      body:JSON.stringify({ music:[
        { id:951, title:'音量回归曲目', artist:'测试歌手', duration:'03:20', lyrics:'' },
      ] })
    })
  })
  await page.route('**/api/entertainment/music-file/*', async (route) => {
    await route.fulfill({ status:200, contentType:'audio/mpeg', body:Buffer.alloc(16) })
  })

  await page.goto('/personal/entertainment/music')
  await expect(page.locator('.music-row')).toHaveCount(1)
  await page.locator('.music-row').first().click()

  const miniSlider = page.locator('.mini-player .volume-slider')
  if (testInfo.project.name.includes('mobile')) {
    // The compact player intentionally removes the slider at this breakpoint;
    // the full-screen player remains the mobile volume control.
    await expect(miniSlider).toBeHidden()
  } else {
    await expect(miniSlider).toBeVisible()
    await expect(miniSlider).toHaveAttribute('aria-label', '音量')
    const miniTokens = await miniSlider.evaluate((element) => {
      const styles = getComputedStyle(element)
      return {
        track: styles.getPropertyValue('--volume-track').trim(),
        fill: styles.getPropertyValue('--volume-fill').trim(),
        thumb: styles.getPropertyValue('--volume-thumb').trim(),
      }
    })
    expect(miniTokens.track).not.toBe('')
    expect(miniTokens.fill).not.toBe('')
    expect(miniTokens.thumb).not.toBe('')
    expect(miniTokens.fill).not.toBe(miniTokens.track)
    expect(miniTokens.thumb).toBe(miniTokens.fill)

    for (const value of [0, 50, 100]) {
      await setRangeValue(miniSlider, value)
      await expect(miniSlider).toHaveValue(String(value))
      await expect(miniSlider).toHaveAttribute('style', new RegExp(`--volume-percent:\\s*${value}%`))
    }

    await miniSlider.focus()
    await page.keyboard.press('Home')
    await expect(miniSlider).toHaveValue('0')
    await page.keyboard.press('End')
    await expect(miniSlider).toHaveValue('100')
    await page.keyboard.press('ArrowLeft')
    await expect(miniSlider).toHaveValue('99')

    await miniSlider.hover()
    await expect(miniSlider).toBeFocused()
    await page.getByRole('button', { name:'静音' }).click()
    await expect(miniSlider).toHaveValue('0')
    await expect(page.getByRole('button', { name:'取消静音' })).toBeVisible()

    await setRangeValue(miniSlider, 50)
    await expect(page.locator('.mini-player')).toHaveScreenshot(`fourth-pass-music-volume-mini-${theme}.png`, { animations:'disabled' })
  }

  await page.getByRole('button', { name:'全屏模式' }).click()
  const fullscreen = page.getByRole('dialog', { name:'全屏音乐播放器' })
  const fullscreenSlider = fullscreen.locator('.fs-volume-slider')
  await expect(fullscreenSlider).toBeVisible()
  await expect(fullscreenSlider).toHaveAttribute('aria-label', '音量')
  for (const value of [0, 50, 100]) {
    await setRangeValue(fullscreenSlider, value)
    await expect(fullscreenSlider).toHaveValue(String(value))
    await expect(fullscreenSlider).toHaveAttribute('style', new RegExp(`--volume-percent:\\s*${value}%`))
  }
  await fullscreen.getByRole('button', { name:'静音' }).click()
  await expect(fullscreenSlider).toHaveValue('0')
  await expect(fullscreen.getByRole('button', { name:'取消静音' })).toBeVisible()
  await setRangeValue(fullscreenSlider, 50)
  await fullscreenSlider.focus()
  await fullscreenSlider.hover()
  await expect(fullscreenSlider).toBeFocused()

  if (!testInfo.project.name.includes('mobile')) {
    await expect(fullscreen.locator('.fs-volume-control')).toHaveScreenshot(`fourth-pass-music-volume-fullscreen-${theme}.png`, { animations:'disabled' })
  } else {
    await expect(fullscreen.locator('.fs-volume-control')).toBeVisible()
  }
})
