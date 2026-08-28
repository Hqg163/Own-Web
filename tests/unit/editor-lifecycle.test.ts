import { describe, expect, it } from 'vitest'
import { hasMeaningfulDraftContent } from '../../src/utils/editorLifecycle'

describe('editor draft lifecycle', () => {
  it('does not treat empty or deleted content as meaningful', () => {
    expect(hasMeaningfulDraftContent({ title: '', excerpt: '', content: '' })).toBe(false)
    expect(hasMeaningfulDraftContent({ title: 'x', excerpt: '', content: '' })).toBe(false)
    expect(hasMeaningfulDraftContent({ title: '', excerpt: '', content: '   ' })).toBe(false)
  })

  it('requires a meaningful title or body threshold before creating a draft', () => {
    expect(hasMeaningfulDraftContent({ title: '短标题', excerpt: '', content: '' })).toBe(true)
    expect(hasMeaningfulDraftContent({ title: '', excerpt: '', content: '有内容' })).toBe(true)
  })
})
