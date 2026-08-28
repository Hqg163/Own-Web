import { expect, test } from '@playwright/test'

async function login(page: any, testInfo: any) {
  const suffix = `${Date.now()}-${testInfo.project.name.replace(/[^a-z0-9]/gi, '')}`
  const email = `music-${suffix}@own-web.test`
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

test('fullscreen playlist keeps readable theme states and long-title bounds', async ({ page }, testInfo) => {
  await login(page, testInfo)
  await page.route('**/api/entertainment/music/*', async (route) => {
    await route.fulfill({
      contentType:'application/json',
      body:JSON.stringify({ music:[
        { id:901, title:'短歌', artist:'测试歌手', album:'Demo', duration:'03:20', lyrics:'[00:00.00]第一句歌词\n[00:04.00]第二句歌词' },
        { id:902, title:'This is a deliberately long mixed 中文 title for overflow regression', artist:'另一位歌手', album:'Long Album', duration:'04:10', lyrics:'[00:00.00]长标题测试' },
        { id:903, title:'暂停后的第三首', artist:'测试乐队', duration:'02:40', lyrics:'' },
      ] })
    })
  })
  await page.route('**/api/entertainment/music-file/*', async (route) => {
    await route.fulfill({ status:200, contentType:'audio/mpeg', body:Buffer.alloc(16) })
  })
  await page.goto('/personal/entertainment/music')
  await expect(page.locator('.music-row')).toHaveCount(3)
  await page.locator('.music-row').first().click()
  await page.getByRole('button', { name:'全屏模式' }).click()
  const fullscreen = page.getByRole('dialog', { name:'全屏音乐播放器' })
  await expect(fullscreen).toBeVisible()
  await expect(fullscreen.locator('.fs-playlist-item')).toHaveCount(3)
  await expect(fullscreen.locator('.playlist-title').nth(1)).toContainText('deliberately long')

  const styleState = await fullscreen.locator('.fs-playlist-item').evaluateAll((rows) => rows.map((row) => {
    const title = row.querySelector('.playlist-title')
    return { opacity:getComputedStyle(row).opacity, color:title ? getComputedStyle(title).color : '', overflow:title ? getComputedStyle(title).textOverflow : '' }
  }))
  expect(styleState.every((item) => item.opacity === '1')).toBe(true)
  expect(styleState.every((item) => item.overflow === 'ellipsis')).toBe(true)
  expect(styleState[0]?.color).not.toBe('rgb(255, 255, 255)')
  const theme = testInfo.project.name.includes('dark') ? 'dark' : 'light'
  await expect(fullscreen).toHaveScreenshot(`music-fullscreen-${theme}.png`, { animations:'disabled' })

  await page.keyboard.press('Escape')
  await expect(fullscreen).toHaveCount(0)
})
