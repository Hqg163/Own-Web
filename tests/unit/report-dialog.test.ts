import { describe, expect, it } from 'vitest'
import {
  MAX_REPORT_MEDIA_COUNT,
  MAX_REPORT_MEDIA_SIZE,
  REPORT_MEDIA_ACCEPT,
  REPORT_REASON_OPTIONS,
  isAllowedReportFile,
} from '../../src/components/reports/constants'
import { buildReportPayload, isReportDetailsValid } from '../../src/components/reports/types'

describe('report dialog contract', () => {
  it('exposes stable reason codes instead of using translated labels as the protocol', () => {
    expect(REPORT_REASON_OPTIONS.map((option) => option.code)).toEqual([
      'spam',
      'harassment',
      'hate',
      'sexual',
      'violence',
      'illegal',
      'copyright',
      'privacy',
      'misinformation',
      'other',
    ])
    expect(REPORT_REASON_OPTIONS.find((option) => option.code === 'other')?.label).toBe('其他')
  })

  it('requires details only for the other reason and trims the submitted value', () => {
    expect(isReportDetailsValid('spam', '')).toBe(true)
    expect(isReportDetailsValid('other', '   ')).toBe(false)
    expect(isReportDetailsValid('other', '  请说明原因  ')).toBe(true)
    expect(isReportDetailsValid('other', 'x'.repeat(2001))).toBe(false)
  })

  it('builds a post or comment payload with bounded plain-text details and media ids', () => {
    expect(buildReportPayload({ targetType: 'post', targetId: 12, postId: 12, reasonCode: 'spam', details: '  广告  ', mediaIds: [3, 4] })).toEqual({
      postId: 12,
      reason_code: 'spam',
      details: '广告',
      mediaIds: [3, 4],
    })
    expect(buildReportPayload({ targetType: 'comment', targetId: '8', postId: 12, reasonCode: 'other', details: '说明', mediaIds: [] })).toEqual({
      postId: 12,
      commentId: 8,
      reason_code: 'other',
      details: '说明',
      mediaIds: [],
    })
  })

  it('accepts only PNG, JPEG and WebP evidence within the client limits', () => {
    expect(REPORT_MEDIA_ACCEPT).toBe('image/png,image/jpeg,image/webp')
    expect(MAX_REPORT_MEDIA_COUNT).toBe(3)
    expect(MAX_REPORT_MEDIA_SIZE).toBe(5 * 1024 * 1024)
    expect(isAllowedReportFile(new File(['png'], 'evidence.png', { type: 'image/png' }))).toBe(true)
    expect(isAllowedReportFile(new File(['svg'], 'evidence.svg', { type: 'image/svg+xml' }))).toBe(false)
    expect(isAllowedReportFile(new File(['jpeg'], 'evidence.jpg', { type: 'image/jpeg' }))).toBe(true)
    expect(isAllowedReportFile(new File(['webp'], 'evidence.webp', { type: 'image/webp' }))).toBe(true)
    const oversized = new File(['large'], 'large.png', { type: 'image/png' })
    Object.defineProperty(oversized, 'size', { value: MAX_REPORT_MEDIA_SIZE + 1 })
    expect(isAllowedReportFile(oversized)).toBe(false)
  })
})
