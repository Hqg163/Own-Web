import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'

const fixture = readFileSync(resolve(process.cwd(), 'tests/fixtures/extreme-article.md'), 'utf8')

test('extreme article fixture covers long-form layout boundaries', () => {
  expect(fixture.length).toBeGreaterThan(10_000)
  expect((fixture.match(/^#{1,6} /gm) || []).length).toBeGreaterThanOrEqual(100)
  expect((fixture.match(/!\[[^\]]*\]\(\/api\/public\/media\/\d+\)/g) || []).length).toBe(20)
  expect(fixture).toContain('fixtureLine120')
  expect(fixture).toContain('列20')
  expect(fixture).toContain('中文 English')
  expect(fixture).toContain('long-path-segment-')
})
