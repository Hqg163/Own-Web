import { describe, expect, it } from 'vitest'
import { blocksToMarkdown, blocksToSafeHtml, renderMarkdown, validateBlocks } from '../../api/lib/content.js'

describe('canonical blog content', () => {
  it('rejects unsafe links, embeds, macros and unsupported languages', () => {
    expect(() => validateBlocks({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }] })).toThrow()
    expect(() => validateBlocks({ type: 'doc', content: [{ type: 'embed', attrs: { url: 'http://127.0.0.1:3301/admin' } }] })).toThrow()
    expect(() => validateBlocks({ type: 'doc', content: [{ type: 'codeBlock', attrs: { language: 'evil' }, content: [{ type: 'text', text: 'x' }] }] })).toThrow()
    expect(() => validateBlocks({ type: 'doc', content: [{ type: 'mathBlock', attrs: { value: '\\htmlClass{evil}{x}' } }] })).toThrow()
  })

  it('preserves safe blocks and derives markdown/html without executing input HTML', () => {
    const source = validateBlocks({ type: 'doc', content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '标题' }] },
      { type: 'paragraph', content: [{ type: 'text', text: '<script>alert(1)</script>' }] },
      { type: 'mathBlock', attrs: { value: 'x^2 + y^2' } },
      { type: 'mermaid', attrs: { value: 'flowchart TD\nA-->B' } },
      { type: 'bookmarkCard', attrs: { url: 'https://www.youtube.com/watch?v=abc', title: '视频', description: '说明' } }
    ] })
    const html = blocksToSafeHtml(source)
    expect(html).not.toContain('<script>')
    expect(html).toContain('data-math')
    expect(html).toContain('data-mermaid')
    expect(html).toContain('data-bookmark-card')
    expect(blocksToMarkdown(source)).toContain('```mermaid')
  })

  it('renders markdown tables, code languages and math markers safely', () => {
    const html = renderMarkdown('# H1\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n```typescript\nconst answer = 42\n```\n\n$$x^2$$')
    expect(html).toContain('<h1>')
    expect(html).toContain('table-wrap')
    expect(html).toContain('data-language="typescript"')
    expect(html).toContain('data-math=')
    expect(html).not.toContain('<script')
  })

  it('renders safe markdown extensions without accepting unsafe embeds', () => {
    const html = renderMarkdown(':::callout warning\n注意内容\n:::\n\n:::details 说明\n折叠内容\n:::\n\n@[bookmark](https://www.youtube.com/watch?v=abc) 视频\n\n@[embed](https://example.com/nope)\n\n[^adam]: 参考说明')
    expect(html).toContain('data-callout="warning"')
    expect(html).toContain('<details>')
    expect(html).toContain('data-bookmark-card')
    expect(html).toContain('data-footnote')
    expect(html).not.toContain('href="https://example.com/nope"')
  })
})
