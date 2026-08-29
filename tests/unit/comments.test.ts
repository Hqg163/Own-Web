import { describe, expect, it } from 'vitest'
import {
  MAX_COMMENT_MEDIA_COUNT,
  normalizeCommentContent,
  normalizeCommentSort,
  normalizeMediaIds,
  parseCommentCursor,
} from '../../api/lib/comments.js'

describe('comment input helpers', () => {
  it('normalizes the public sort aliases and rejects unknown values', () => {
    expect(normalizeCommentSort('newest')).toBe('latest')
    expect(normalizeCommentSort('popular')).toBe('hot')
    expect(normalizeCommentSort('unexpected')).toBe('latest')
  })

  it('keeps comment text plain and bounded', () => {
    expect(normalizeCommentContent('  <b>hello</b>  ')).toBe('<b>hello</b>')
    expect(normalizeCommentContent(' '.repeat(5))).toBeNull()
    expect(normalizeCommentContent('x'.repeat(6000))).toHaveLength(5000)
  })

  it('accepts valid media IDs without accepting duplicates or malformed input', () => {
    expect(normalizeMediaIds([{ id: 2 }, '3'])).toEqual([2, 3])
    expect(normalizeMediaIds(['1', '1'])).toBeNull()
    expect(normalizeMediaIds(Array.from({ length: MAX_COMMENT_MEDIA_COUNT + 1 }, (_, index) => index + 1))).toBeNull()
    expect(normalizeMediaIds(['1', 'x'])).toBeNull()
  })

  it('parses bounded offset cursors for root and reply pagination', () => {
    expect(parseCommentCursor(undefined)).toBe(0)
    expect(parseCommentCursor('20')).toBe(20)
    expect(parseCommentCursor('-1')).toBeNull()
    expect(parseCommentCursor('not-a-cursor')).toBeNull()
  })
})
