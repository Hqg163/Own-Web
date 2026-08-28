import { describe, expect, it } from 'vitest'
import { blocksToSafeHtml, renderMarkdown, validateBlocks } from '../../api/lib/content.js'

const richBlocks = {
  type:'doc',
  content:[
    { type:'heading', attrs:{ level:2 }, content:[{ type:'text', text:'标题' }] },
    { type:'paragraph', content:[{ type:'text', text:'正文', marks:[{ type:'bold' }, { type:'link', attrs:{ href:'https://example.com/' } }] }] },
    { type:'blockquote', content:[{ type:'paragraph', content:[{ type:'text', text:'引用' }] }] },
    { type:'bulletList', content:[{ type:'listItem', content:[{ type:'paragraph', content:[{ type:'text', text:'列表' }] }] }] },
    { type:'orderedList', content:[{ type:'listItem', content:[{ type:'paragraph', content:[{ type:'text', text:'编号' }] }] }] },
    { type:'codeBlock', attrs:{ language:'typescript' }, content:[{ type:'text', text:'const answer = 42' }] },
    { type:'table', content:[{ type:'tableRow', content:[{ type:'tableHeader', content:[{ type:'text', text:'A' }] }, { type:'tableCell', content:[{ type:'text', text:'B' }] }] }] },
    { type:'image', attrs:{ src:'/api/public/media/1', alt:'图片', caption:'说明', width:80, align:'center' } },
    { type:'gallery', attrs:{ items:[{ src:'/api/public/media/2', alt:'图库一', caption:'图注' }] } },
    { type:'callout', attrs:{ tone:'info' }, content:[{ type:'text', text:'提示' }] },
    { type:'details', attrs:{ summary:'详情', body:'折叠' } },
    { type:'bookmarkCard', attrs:{ url:'https://www.youtube.com/watch?v=abc', title:'书签', description:'描述' } },
    { type:'embed', attrs:{ url:'https://www.youtube.com/watch?v=abc', title:'嵌入' } },
    { type:'mathInline', attrs:{ value:'x^2' } },
    { type:'mathBlock', attrs:{ value:'y^2' } },
    { type:'mermaid', attrs:{ value:'flowchart TD\nA --> B' } },
    { type:'footnote', attrs:{ label:'note', text:'脚注' } }
  ]
}

describe('Preview/Published content contract', () => {
  it('keeps every rich node represented in the canonical server HTML', () => {
    const html = blocksToSafeHtml(validateBlocks(richBlocks))
    for (const marker of ['<h2', '<p', '<strong', '<a ', '<blockquote', '<ul', '<ol', '<pre', '<table', '<figure', 'data-gallery', 'data-callout', '<details', 'data-bookmark-card', 'data-math', 'data-mermaid', 'data-footnote']) expect(html).toContain(marker)
  })

  it('keeps Markdown extensions aligned with the same semantic markers', () => {
    const html = renderMarkdown('# 标题\n\n:::callout\n提示\n:::\n\n:::details 详情\n折叠\n:::\n\n```mermaid\nflowchart TD\nA --> B\n```\n\n\\(x^2\\)\n\n[^note]: 脚注\n\n@[bookmark](https://www.youtube.com/watch?v=abc)')
    for (const marker of ['<h1', 'data-callout', '<details', 'data-mermaid', 'data-math', 'data-footnote', 'data-bookmark-card']) expect(html).toContain(marker)
  })
})

