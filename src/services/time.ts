const DATE_ONLY = /^(\d{4}-\d{2}-\d{2})$/
const UTC_DATE_TIME = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?$/
const CALENDAR_DATE_TIME = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.\d{1,9})?(?:Z|[+-]\d{2}:?\d{2})$/
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:?\d{2})$/

function validCalendar(text: string) {
  const dateTime = UTC_DATE_TIME.exec(text) || CALENDAR_DATE_TIME.exec(text)
  const dateText = DATE_ONLY.exec(text)?.[1] || dateTime?.[1]
  if (!dateText) return true
  const parts = dateText.split('-').map(Number)
  const year = parts[0] ?? Number.NaN
  const month = parts[1] ?? Number.NaN
  const day = parts[2] ?? Number.NaN
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return false
  if (!dateTime) return true
  const timeParts = (dateTime[2] ?? '').split(':').map(Number)
  const hour = timeParts[0] ?? Number.NaN
  const minute = timeParts[1] ?? Number.NaN
  const second = timeParts[2] ?? Number.NaN
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 && second >= 0 && second <= 59
}

export function parseUtcInstant(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : new Date(value.getTime())
  if (typeof value === 'number') return Number.isFinite(value) ? new Date(value) : null
  if (typeof value !== 'string') return null
  const text = value.trim()
  const dateOnly = DATE_ONLY.exec(text)
  const dateTime = UTC_DATE_TIME.exec(text)
  const candidate = dateOnly ? `${dateOnly[1]}T00:00:00.000Z`
    : dateTime ? `${dateTime[1]}T${dateTime[2]}${dateTime[3] ? `.${dateTime[3].padEnd(3, '0').slice(0, 3)}` : ''}Z`
      : ISO_INSTANT.test(text) ? text : null
  if (!candidate || !validCalendar(text)) return null
  const date = new Date(candidate)
  return Number.isNaN(date.getTime()) ? null : date
}

export function toUtcIso(value: unknown) {
  return parseUtcInstant(value)?.toISOString() || null
}
