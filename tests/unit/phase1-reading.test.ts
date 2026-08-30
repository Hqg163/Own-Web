import { describe, expect, it } from 'vitest'
import { blocksToSafeHtml, renderMarkdown, validateBlocks } from '../../api/lib/content.js'

describe('Phase 1 article reading contract', () => {
  it('keeps Markdown source semantics while rendering body H1 as H2', () => {
    const source = '# 页面文章标题\n\n## 子标题\n\n正文。'
    const html = renderMarkdown(source)

    expect(source).toContain('# 页面文章标题')
    expect(html).toContain('<h2 data-source-heading="h1" class="article-source-h1">页面文章标题</h2>')
    expect(html).toContain('<h2>子标题</h2>')
    expect(html).not.toContain('<h1')
  })

  it('clamps rendered block headings and adds image layout hints without changing block data', () => {
    const blocks = validateBlocks({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: '旧标题' }] },
        { type: 'image', attrs: { src: '/api/public/media/1', alt: '测试图片', width: 80 } },
      ],
    })
    const html = blocksToSafeHtml(blocks)

    expect(blocks.content[0].attrs.level).toBe(1)
    expect(html).toContain('<h2 data-source-heading="h1" class="article-source-h1"')
    expect(html).not.toContain('<h1')
    expect(html).toContain('loading="lazy"')
    expect(html).toContain('decoding="async"')
  })

  it('renders the shared reading feature markers used by preview and published HTML', () => {
    const html = renderMarkdown([
      '正文段落。',
      '',
      '- 外层列表',
      '  - 嵌套列表',
      '',
      '> 引用',
      '',
      '---',
      '',
      '行内 `代码` 和 [链接](https://example.com)。',
      '',
      '| A | B |',
      '| --- | --- |',
      '| 1 | 2 |',
      '',
      ':::callout info',
      '提示',
      ':::',
      '',
      ':::details 详情',
      '折叠内容',
      ':::',
      '',
      '[^note]: 脚注',
    ].join('\n'))

    for (const marker of ['<p', '<ul', '<blockquote', '<hr', '<code', '<a ', 'table-wrap', 'data-callout', '<details', 'data-footnote']) {
      expect(html).toContain(marker)
    }
  })
})
