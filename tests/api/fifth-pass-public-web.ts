import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { spawn, type ChildProcess } from 'node:child_process'
import path from 'node:path'
import { ensureDatabase, databaseName } from '../support/test-db.cjs'

const port = 36000 + Math.floor(Math.random() * 1000)
const origin = `http://127.0.0.1:${port}`

async function waitForApi() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      if ((await fetch(`${origin}/api/health`)).ok) return
    } catch (_) {
      // The production child is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error('public web production API did not start')
}

async function stopServer(child: ChildProcess) {
  if (child.exitCode !== null) return
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      resolve()
    }, 5000)
    child.once('exit', () => {
      clearTimeout(timer)
      resolve()
    })
    child.kill('SIGTERM')
  })
}

async function main() {
  assert.ok(existsSync(path.join(process.cwd(), 'dist', 'index.html')), 'build before running public web production checks')
  await ensureDatabase()
  const child = spawn(process.execPath, [path.join(process.cwd(), 'api', 'server.js')], {
    stdio: 'ignore',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      DB_NAME: databaseName,
      PORT: String(port),
      CORS_ORIGIN: 'http://127.0.0.1:5173',
      PUBLIC_SITE_URL: origin,
      SITE_OWNER_USER_ID: '',
    },
  })

  try {
    await waitForApi()

    const read = async (pathname: string) => {
      const response = await fetch(`${origin}${pathname}`)
      return { response, body: await response.text() }
    }
    for (const pathname of ['/', '/explore', '/about', '/about/site', '/projects']) {
      const { response, body } = await read(pathname)
      assert.equal(response.status, 200, pathname)
      assert.equal((body.match(/<title>/gi) || []).length, 1, `${pathname} has one title`)
      assert.equal((body.match(/name="description"/gi) || []).length, 1, `${pathname} has one description`)
      assert.equal((body.match(/rel="canonical"/gi) || []).length, 1, `${pathname} has one canonical`)
    }

    for (const pathname of ['/posts/does-not-exist', '/not-a-real-route']) {
      const { response, body } = await read(pathname)
      assert.equal(response.status, 404, pathname)
      assert.match(body, /name="robots" content="noindex,follow"/)
      assert.match(body, /页面不存在|文章不存在/)
    }

    const feed = await read('/feed.xml')
    assert.equal(feed.response.status, 200)
    assert.match(feed.body, /^<\?xml/)
    assert.match(feed.body, /<rss\b/)

    const sitemap = await read('/sitemap.xml')
    assert.equal(sitemap.response.status, 200)
    assert.match(sitemap.body, /<urlset\b/)
    assert.match(sitemap.body, new RegExp(`${origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`))

    const robots = await read('/robots.txt')
    assert.equal(robots.response.status, 200)
    assert.match(robots.body, new RegExp(`Sitemap: ${origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/sitemap\\.xml`))

    const owner = await read('/api/public/site-owner')
    assert.equal(owner.response.status, 200)
    assert.deepEqual(JSON.parse(owner.body), { owner: null })
    console.log('fifth-pass public web production checks passed')
  } finally {
    await stopServer(child)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
