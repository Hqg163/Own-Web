import { describe, expect, it } from 'vitest'
import { renderSafeMermaid } from '../../src/utils/mermaid'

describe('safe mermaid renderer', () => {
  it('renders supported flowcharts as SVG without executable attributes', () => {
    const result = renderSafeMermaid('flowchart TD\nA[开始] --> B[结束]')
    expect(result.ok).toBe(true)
    expect(result.html).toContain('data-mermaid-rendered="true"')
    expect(result.html).not.toMatch(/onclick|<script|javascript:/i)
  })

  it('falls back to escaped source for unsafe or oversized diagrams', () => {
    const unsafe = renderSafeMermaid('flowchart TD\nA --> B\nclick A "javascript:alert(1)"')
    expect(unsafe.ok).toBe(false)
    expect(unsafe.html).toContain('data-mermaid-error="true"')
    expect(unsafe.html).not.toContain('javascript:')
    const oversized = renderSafeMermaid(`flowchart TD\n${'A --> B\n'.repeat(81)}`)
    expect(oversized.ok).toBe(false)
  })
})
