import { expect, test } from '@playwright/test'

test.describe.configure({ mode:'serial' })

async function login(page:any, testInfo:any) {
  const suffix = `${Date.now()}-${testInfo.project.name.replace(/[^a-z0-9]/gi, '')}`
  const email = `menu-${suffix}@own-web.test`
  const password = 'OwnWebMenuA1!'
  await page.goto('/register')
  await page.getByLabel('邮箱').fill(email)
  await page.getByLabel('密码', { exact:true }).fill(password)
  await page.getByLabel('确认密码').fill(password)
  await page.getByRole('button', { name:'创建账户' }).click()
  await page.goto('/login')
  await page.locator('#login-email').fill(email)
  await page.locator('#login-password').fill(password)
  await page.getByRole('button', { name:'登录' }).click()
  await expect(page).toHaveURL(/\/dashboard/)
}

test('controlled user menu closes on outside click and restores focus on Escape', async ({ page }, testInfo) => {
  await login(page, testInfo)
  const trigger = page.locator('.user-menu-trigger')
  await trigger.click()
  await expect(page.getByRole('menu')).toBeVisible()
  await page.locator('main').click({ position:{ x:8, y:8 } })
  await expect(page.getByRole('menu')).toHaveCount(0)

  await trigger.click()
  await expect(page.getByRole('menu')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test('user menu closes before navigation', async ({ page }, testInfo) => {
  await login(page, testInfo)
  await page.locator('.user-menu-trigger').click()
  await page.getByRole('menuitem', { name:'文章管理' }).click()
  await expect(page).toHaveURL(/\/creation/)
  await expect(page.getByRole('menu')).toHaveCount(0)
})
