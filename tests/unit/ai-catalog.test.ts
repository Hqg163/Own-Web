import { describe, expect, it } from 'vitest'
import { articleSearchScore, createArticleCatalog, formatCatalogEvidence, normalizeSearchQuery } from '../../api/ai/agent/article-catalog.js'
import { createSkillRegistry } from '../../api/ai/agent/skills.js'

const posts = [
  { id: 1, author_id: 7, title: 'YOLOv8 与 DeepSORT', slug: 'yolo-deepsort', excerpt: '目标检测与多目标跟踪', content_markdown: 'DeepSORT 使用外观特征和卡尔曼滤波。', status: 'published', visibility: 'public', published_at: '2026-01-04', updated_at: '2026-01-05', series_id: null },
  { id: 2, author_id: 7, title: '作者私有草稿', slug: 'private-draft', excerpt: '不可公开', content_markdown: '仅作者可见', status: 'draft', visibility: 'private', published_at: null, updated_at: '2026-01-06', series_id: null },
]

function fakeDb() {
  return { promise: () => ({ query: async (sql: string) => {
    if (sql.includes('FROM posts p LEFT JOIN series')) return [posts]
    if (sql.includes('FROM post_categories')) return [[{ post_id: 1, name: 'AI', slug: 'ai' }]]
    if (sql.includes('FROM post_tags')) return [[{ post_id: 1, name: '目标检测', slug: 'object-detection' }]]
    throw new Error(`Unexpected query: ${sql}`)
  } }) }
}

describe('AI article catalog', () => {
  it('returns a complete access-scoped catalog instead of inferring it from chunks', async () => {
    const catalog = createArticleCatalog({ db: fakeDb() as any })
    const guest = await catalog.list({ limit: 20, sort: 'published_desc' }, { user: null, shareToken: null })
    expect(guest.total).toBe(1)
    expect(guest.items).toMatchObject([{ id: 1, title: 'YOLOv8 与 DeepSORT', categories: [{ slug: 'ai' }], tags: [{ slug: 'object-detection' }], overview: '目标检测与多目标跟踪' }])
    const owner = await catalog.list({ limit: 20, sort: 'updated_desc' }, { user: { id: 7 }, shareToken: null })
    expect(owner.total).toBe(2)
  })

  it('formats bounded catalog evidence with authorized metadata without splitting an article entry', () => {
    const evidence = formatCatalogEvidence([
      { title: '目标检测', slug: 'vision', categories: [{ name: '视觉' }], tags: [{ name: 'YOLOv8' }], series: { name: 'CV' }, publishedAt: '2026-01-01', updatedAt: '2026-01-02', overview: '检测和追踪实践。' },
      { title: '第二篇', slug: 'second', categories: [], tags: [], series: null, overview: '另一个概览。' },
    ], 100)
    expect(evidence.content).toContain('分类：视觉')
    expect(evidence.content).toContain('标签：YOLOv8')
    expect(evidence.content).toContain('概览：检测和追踪实践。')
    expect(evidence.included).toBe(1)
    expect(evidence.truncated).toBe(true)
  })

  it('normalizes natural-language search and weights metadata before body-only matches', () => {
    const terms = normalizeSearchQuery('帮我找几篇和目标检测相关的文章')
    expect(terms).toContain('目标检测')
    const titleMatch = articleSearchScore({ title: '目标检测实践', excerpt: '', categories: [], tags: [], series: null, contentMarkdown: '' }, ['目标检测'])
    const bodyMatch = articleSearchScore({ title: '随笔', excerpt: '', categories: [], tags: [], series: null, contentMarkdown: '这里提及目标检测。' }, ['目标检测'])
    expect(titleMatch).toBeGreaterThan(bodyMatch)
  })

  it('exposes only a bounded, validated list_articles tool', async () => {
    const skills = createSkillRegistry({ db: fakeDb() as any, config: { limits: { toolResultChars: 6000, toolTimeoutMs: 2500 } } })
    await expect(skills.invoke('list_articles', { limit: 51 }, { user: null, shareToken: null })).rejects.toThrow()
    const result: any = await skills.invoke('list_articles', { limit: 20, sort: 'published_desc', category: null, tag: null, seriesId: null, offset: 0 }, { user: null, shareToken: null })
    expect(result).toMatchObject({ total: 1, items: [{ id: 1, slug: 'yolo-deepsort' }] })
  })
})
