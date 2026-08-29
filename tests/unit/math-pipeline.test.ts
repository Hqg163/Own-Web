import { describe, expect, it } from 'vitest'
import { blocksToSafeHtml, renderMarkdown, validateBlocks } from '../../api/lib/content.js'

describe('markdown math serialization', () => {
  it('keeps block math as a canonical math node', () => {
    const html = renderMarkdown('$$x^2$$')
    expect(html).toContain('class="math-block"')
    expect(html).toContain('data-math-block="true"')
    expect(html).toContain('data-math="x^2"')
  })

  it('keeps inline math as a canonical math node', () => {
    const html = renderMarkdown(String.raw`能量为 \(E=mc^2\)。`)
    expect(html).toContain('class="math-inline"')
    expect(html).toContain('data-math-inline="true"')
    expect(html).toContain('data-math="E=mc^2"')
  })

  it('renders multiline display math as one canonical node', () => {
    const html = renderMarkdown(String.raw`$$
\frac{a}{b}
x + y
$$`)
    expect(html.match(/data-math-block="true"/g)).toHaveLength(1)
    expect(html).toContain('data-math="\\frac{a}{b}\nx + y"')
  })

  it('does not create a math node for blocked KaTeX HTML commands', () => {
    expect(renderMarkdown(String.raw`\(\htmlClass{evil}{x}\)`)).not.toContain('data-math')
  })

  it('serializes Blocks math with the same canonical markers', () => {
    const html = blocksToSafeHtml(validateBlocks({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'mathInline', attrs: { value: 'x^2' } }] },
        { type: 'mathBlock', attrs: { value: String.raw`\frac{1}{2}` } },
      ],
    }))
    expect(html).toContain('data-math-inline="true"')
    expect(html).toContain('data-math-block="true"')
    expect(html).toContain('data-math="\\frac{1}{2}"')
  })

  it('does not treat a plain currency value as math', () => {
    expect(renderMarkdown('价格 $100，折后价仍为 $100。')).not.toContain('class="math-inline"')
  })
})
