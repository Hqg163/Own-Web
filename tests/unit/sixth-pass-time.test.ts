import { describe, expect, it } from 'vitest'
import { parseUtcInstant, toUtcIso, withUtcTimestamps } from '../../api/lib/time.js'
import { commentCreatedAt, relativeTime } from '../../src/components/comments/format'

const NOW = Date.parse('2026-08-30T00:00:00.000Z')

describe('sixth-pass time contract', () => {
  it('parses UTC ISO and serializes it without changing the instant', () => {
    const parsed = parseUtcInstant('2026-08-30T00:00:00.123Z')

    expect(parsed?.toISOString()).toBe('2026-08-30T00:00:00.123Z')
    expect(toUtcIso('2026-08-30T00:00:00.123Z')).toBe('2026-08-30T00:00:00.123Z')
  })

  it('converts offset ISO and database UTC strings to canonical UTC ISO', () => {
    expect(toUtcIso('2026-08-30T08:00:00+08:00')).toBe('2026-08-30T00:00:00.000Z')
    expect(toUtcIso('2026-08-30 00:00:00.456')).toBe('2026-08-30T00:00:00.456Z')
    expect(toUtcIso('2026-08-30')).toBe('2026-08-30T00:00:00.000Z')
  })

  it('returns null for missing, malformed, and impossible timestamps', () => {
    for (const value of ['', null, undefined, 'not-a-time', '2026-02-30T00:00:00Z', '2026-08-30T25:00:00Z']) {
      expect(parseUtcInstant(value)).toBeNull()
      expect(toUtcIso(value)).toBeNull()
    }
  })

  it('serializes only the selected API fields and does not mutate the record', () => {
    const record = { created_at: '2026-08-30T08:00:00+08:00', label: 'keep', untouched: '2026-08-30T08:00:00+08:00' }
    const serialized = withUtcTimestamps(record, ['created_at', 'missing'])

    expect(serialized).toEqual({ ...record, created_at: '2026-08-30T00:00:00.000Z' })
    expect(record.created_at).toBe('2026-08-30T08:00:00+08:00')
  })

  it('normalizes comment timestamps before they reach datetime attributes', () => {
    expect(commentCreatedAt({ createdAt: '2026-08-30T08:00:00+08:00' } as any)).toBe('2026-08-30T00:00:00.000Z')
    expect(commentCreatedAt({ created_at: 'invalid' } as any)).toBe('')
  })

  it('keeps clock skew within a minute as just now', () => {
    expect(relativeTime(new Date(NOW + 45_000).toISOString(), NOW)).toBe('刚刚')
    expect(relativeTime(new Date(NOW - 45_000).toISOString(), NOW)).toBe('刚刚')
  })

  it('uses hour-level labels for future and past instants', () => {
    expect(relativeTime(new Date(NOW + 2 * 60 * 60 * 1000).toISOString(), NOW)).toBe('2小时后')
    expect(relativeTime(new Date(NOW - 2 * 60 * 60 * 1000).toISOString(), NOW)).toBe('2小时前')
  })

  it('falls back safely for invalid relative-time values', () => {
    expect(relativeTime('invalid', NOW)).toBe('刚刚')
  })
})
