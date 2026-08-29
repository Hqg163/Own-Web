import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const exploreSource = readFileSync(new URL('../../src/components/views/Explore.vue', import.meta.url), 'utf8')

describe('Explore applied-state contract', () => {
  it('applies draft search and category values while resetting pagination', () => {
    expect(exploreSource).toContain('@change="selectCategory(categoryDraft)"')
    expect(exploreSource).toContain('@submit.prevent="applySearch"')
    expect(exploreSource).toMatch(/function selectCategory\(next:string\).*currentUiQuery\(1\)/)
    expect(exploreSource).toMatch(/function applySearch\(\).*currentUiQuery\(1\)/)
    expect(exploreSource).toMatch(/function selectFeed\(next:Feed\).*currentUiQuery\(1\)/)
  })

  it('removes an applied query as soon as its draft is cleared', () => {
    expect(exploreSource).toContain('@input="handleSearchInput"')
    expect(exploreSource).toMatch(/function handleSearchInput\(\).*next\.q=undefined.*updateQuery\(next,true\)/)
  })

  it('synchronizes browser navigation and ignores stale requests', () => {
    expect(exploreSource).toContain('syncDraftsFromRoute()')
    expect(exploreSource).toContain('watch(() => route.fullPath')
    expect(exploreSource).toContain('let requestSequence=0')
    expect(exploreSource).toContain('new AbortController()')
    expect(exploreSource).toContain('if(requestId!==requestSequence)return')
  })

  it('renders only the public preview field in cards', () => {
    expect(exploreSource).toContain('preview_excerpt')
    expect(exploreSource).not.toContain('content_markdown')
  })
})
