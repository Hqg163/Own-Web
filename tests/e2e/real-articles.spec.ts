import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

type ShowcaseEntry = {
  matchTitle: string
  mode: 'blocks' | 'markdown'
  fixture: string
  publicPostId: number
}

type ShowcaseAsset = { file: string; role: string; alt: string; caption: string }

const showcaseDir = path.resolve(process.cwd(), 'tests/fixtures/showcase')
const showcaseManifest = JSON.parse(fs.readFileSync(path.join(showcaseDir, 'showcase-manifest.json'), 'utf8')) as ShowcaseEntry[]
const assetManifest = JSON.parse(fs.readFileSync(path.join(showcaseDir, 'asset-manifest.json'), 'utf8')) as ShowcaseAsset[]
const showcaseArticles = showcaseManifest.map((entry) => ({
  ...entry,
  content: fs.readFileSync(path.join(showcaseDir, entry.fixture), 'utf8'),
}))

const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')

test.describe.configure({ mode: 'serial', timeout: 120_000 })

async function login(page: any, testInfo: any) {
  const suffix = `${Date.now()}-${testInfo.project.name.replace(/[^a-z0-9]/gi, '')}`
  const email = `showcase-${suffix}@own-web.test`
  const password = 'OwnWebE2eA1!'
  await page.goto('/register')
  await page.getByLabel('邮箱').fill(email)
  await page.getByLabel('密码', { exact: true }).fill(password)
  await page.getByLabel('确认密码').fill(password)
  await page.getByRole('button', { name: '创建账户' }).click()
  await expect(page).toHaveURL(/\/login/)
  await page.locator('#login-email').fill(email)
  await page.locator('#login-password').fill(password)
  await page.getByRole('button', { name: '登录' }).click()
  await expect(page).toHaveURL(/\/dashboard/)
}

async function openMoreTools(page: any) {
  const more = page.locator('.rich-tools .tool-more')
  if ((await more.getAttribute('open')) === null) await more.locator('summary').click()
  return more
}

async function appendEditorLine(page: any, text: string) {
  const editor = page.locator('.tiptap')
  await editor.click()
  await editor.press('Control+End')
  await editor.press('Enter')
  await editor.type(text)
}

async function insertDialogBlock(page: any, buttonName: string, fill: (dialog: any) => Promise<void>) {
  const more = await openMoreTools(page)
  await more.getByRole('button', { name: buttonName, exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await fill(dialog)
  await dialog.getByRole('button', { name: '插入', exact: true }).click()
  await expect(dialog).toBeHidden()
}

async function insertBlockUiCoverage(page: any) {
  await appendEditorLine(page, '真实 Block UI 操作覆盖：调度边界、内容结构与可观察结果。')

  await appendEditorLine(page, 'const blockUiFixture = true')
  await insertDialogBlock(page, '代码', async (dialog) => {
    await dialog.locator('#dialog-language').selectOption('typescript')
  })

  await appendEditorLine(page, '表格前的内容')
  const more = await openMoreTools(page)
  await more.getByRole('button', { name: '表格', exact: true }).click()

  await insertDialogBlock(page, '提示卡', async (dialog) => {
    await dialog.locator('#dialog-tone').selectOption('note')
  })
  await insertDialogBlock(page, '折叠', async (dialog) => {
    await dialog.locator('#dialog-summary').fill('Block UI Details')
    await dialog.locator('#dialog-body').fill('这段内容由真实折叠块控件插入。')
  })
  await insertDialogBlock(page, '数学', async (dialog) => {
    await dialog.locator('#dialog-math').fill('E = mc^2')
  })
  await insertDialogBlock(page, '公式块', async (dialog) => {
    await dialog.locator('#dialog-math').fill(String.raw`\frac{\theta_{t+1}}{\sqrt{v_t}+\epsilon}`)
  })
  await insertDialogBlock(page, 'Mermaid', async (dialog) => {
    await dialog.locator('#dialog-mermaid').fill('flowchart TD\n  A[读取] --> B[渲染]')
  })

  const imageAsset = assetManifest.find((asset) => asset.role === 'cover') || assetManifest[0]
  const galleryAssets = assetManifest.filter((asset) => asset.role === 'body/gallery').slice(0, 2)
  expect(imageAsset).toBeTruthy()
  expect(galleryAssets).toHaveLength(2)

  await page.getByRole('button', { name: '插入图片', exact: true }).click()
  await page.locator('.media-tools input[type="file"]').nth(0).setInputFiles({
    name: imageAsset.file,
    mimeType: 'image/png',
    buffer: tinyPng,
  })
  let dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.locator('#dialog-alt').fill(imageAsset.alt)
  await dialog.locator('#dialog-caption').fill(imageAsset.caption)
  await dialog.getByRole('button', { name: '插入', exact: true }).click()
  await expect(dialog).toBeHidden()

  await page.getByRole('button', { name: '插入图库', exact: true }).click()
  await page.locator('.media-tools input[type="file"]').nth(1).setInputFiles(galleryAssets.map((asset) => ({
    name: asset.file,
    mimeType: 'image/png',
    buffer: tinyPng,
  })))
  dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.locator('#dialog-alt').fill(galleryAssets.map((asset) => asset.alt).join('\n'))
  await dialog.getByRole('button', { name: '插入', exact: true }).click()
  await expect(dialog).toBeHidden()

  const preview = page.locator('.article-preview')
  expect(await preview.locator('pre code').count()).toBeGreaterThanOrEqual(1)
  expect(await preview.locator('table').count()).toBeGreaterThanOrEqual(1)
  await expect(preview.locator('[data-callout]')).toHaveCount(1)
  await expect(preview.locator('details')).toHaveCount(1)
  await expect(preview.locator('[data-math]')).toHaveCount(2)
  await expect(preview.locator('.mermaid-container svg, .safe-mermaid')).toHaveCount(1)
  await expect(preview.getByRole('img', { name: imageAsset.alt, exact: true })).toHaveCount(1)
  await expect(preview.locator('[data-gallery] img')).toHaveCount(2)
}

function fixtureProbe(content: string) {
  return content.split('\n').find((line) => {
    const value = line.trim()
    return value && !/^(#|>|```|\||:::|!\[)/.test(value)
  })?.replace(/`/g, '') || content.split('\n').find((line) => line.trim())?.replace(/`/g, '') || ''
}

async function assertRenderedFeatures(page: any, coverage: Record<string, boolean>) {
  const article = page.locator('.article')
  await expect(article).toBeVisible()
  const featureCounts = {
    Code: await article.locator('pre code').count(),
    Table: await article.locator('table').count(),
    Image: await article.locator('figure img').count(),
    Gallery: await article.locator('[data-gallery] img').count(),
    Math: await article.locator('[data-math] .katex').count(),
    Callout: await article.locator('[data-callout]').count(),
    Details: await article.locator('details').count(),
    Mermaid: await article.locator('.mermaid-container svg, .safe-mermaid').count(),
  }
  for (const [feature, count] of Object.entries(featureCounts)) {
    if (count > 0) coverage[feature] = true
  }
}

test('creates and republishes the four manifest articles through the editor UI', async ({ page }, testInfo) => {
  expect(showcaseManifest).toHaveLength(4)
  expect(showcaseArticles.every((article) => fs.existsSync(path.join(showcaseDir, article.fixture)))).toBe(true)
  expect(showcaseArticles.map((article) => article.mode)).toEqual(['blocks', 'markdown', 'blocks', 'markdown'])

  await login(page, testInfo)
  fs.mkdirSync('audit-artifacts/screenshots', { recursive: true })
  const screenshotName = (name: string) => `audit-artifacts/screenshots/${testInfo.project.name}-${name}.png`
  const coverage: Record<string, boolean> = Object.fromEntries(['Code', 'Table', 'Image', 'Gallery', 'Math', 'Callout', 'Details', 'Mermaid'].map((feature) => [feature, false]))

  await page.screenshot({ path: screenshotName('dashboard'), fullPage: true })

  for (const article of showcaseArticles) {
    await page.goto('/write')
    await page.getByLabel('标题').fill(article.matchTitle)

    if (article.mode === 'markdown') {
      await page.getByRole('tab', { name: 'Markdown', exact: true }).click()
      await page.getByLabel('Markdown 内容').fill(article.content)
    } else {
      await page.getByRole('tab', { name: 'Markdown', exact: true }).click()
      await page.getByLabel('Markdown 内容').fill(article.content)
      await page.getByRole('tab', { name: '可视化块', exact: true }).click()
      await page.getByRole('dialog', { name: '切换内容模式' }).getByRole('button', { name: '继续', exact: true }).click()
      await expect(page.locator('.tiptap')).toContainText(fixtureProbe(article.content))
      await insertBlockUiCoverage(page)
    }

    await page.getByRole('button', { name: '保存草稿', exact: true }).click()
    await expect(page).toHaveURL(/\/posts\/\d+\/edit/)
    await expect(page.locator('.save-state')).toContainText(/Saved|已保存/, { timeout: 15_000 })
    await page.reload()
    await expect(page.getByLabel('标题')).toHaveValue(article.matchTitle)
    await expect(page.getByRole('heading', { name: '预览' })).toBeVisible()

    await page.getByRole('button', { name: '立即发布', exact: true }).click()
    await expect(page).toHaveURL(/\/creation/)
    const row = page.locator('article').filter({ hasText: article.matchTitle }).first()
    await expect(row).toBeVisible()
    const postHref = await row.getByRole('link', { name: '查看', exact: true }).getAttribute('href')
    expect(postHref).toMatch(/^\/posts\//)

    await page.goto(postHref!)
    await assertRenderedFeatures(page, coverage)
    if (article.mode === 'blocks') {
      await expect(page.locator('.article')).toContainText(fixtureProbe(article.content))
    }
    if (article.fixture === 'kyoto-neighborhoods.md') {
      await expect(page.locator('.article')).toContainText('图库节点')
    }
    if (article.fixture === 'knowledge-site.md') {
      await expect(page.locator('[data-callout]')).toContainText('好系统')
      await expect(page.locator('details').filter({ hasText: '细节并不等于次要信息' }).first()).toContainText('细节并不等于次要信息')
    }
    if (article.fixture === 'adam-optimizer.md') {
      expect(await page.locator('[data-math] .katex').count()).toBeGreaterThanOrEqual(6)
      await expect(page.locator('table')).toContainText('Adam')
    }
    await page.screenshot({ path: screenshotName(`article-${article.fixture.replace(/\.md$/, '')}`), fullPage: true })

    await page.goto('/creation')
    await page.locator('article').filter({ hasText: article.matchTitle }).first().getByRole('link', { name: '编辑', exact: true }).click()
    await expect(page.getByLabel('标题')).toHaveValue(article.matchTitle)
    await page.getByRole('button', { name: '立即发布', exact: true }).click()
    await expect(page).toHaveURL(/\/creation/)
  }

  expect(coverage).toEqual({ Code: true, Table: true, Image: true, Gallery: true, Math: true, Callout: true, Details: true, Mermaid: true })
})
