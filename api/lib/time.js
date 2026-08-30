const DATE_ONLY = /^(\d{4}-\d{2}-\d{2})$/;
const UTC_DATE_TIME = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?$/;
const CALENDAR_DATE_TIME = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:?\d{2})$/;

function hasValidCalendarParts(source) {
  const dateOnly = DATE_ONLY.exec(source);
  const dateTime = UTC_DATE_TIME.exec(source) || CALENDAR_DATE_TIME.exec(source);
  const dateText = dateOnly?.[1] || dateTime?.[1];
  if (!dateText) return true;

  const [year, month, day] = dateText.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return false;
  if (!dateTime) return true;

  const [hour, minute, second] = dateTime[2].split(':').map(Number);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 && second >= 0 && second <= 59;
}

/**
 * Parse an API/database timestamp as an absolute instant.
 *
 * MySQL DATETIME/TIMESTAMP strings without an explicit zone are part of the
 * server UTC contract. ISO strings carrying Z or an offset retain their
 * declared instant. Invalid values are deliberately represented as null.
 */
function parseUtcInstant(value) {
  if (value instanceof Date) {
    const milliseconds = value.getTime();
    return Number.isNaN(milliseconds) ? null : new Date(milliseconds);
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? new Date(value) : null;
  }
  if (typeof value !== 'string') return null;

  const text = value.trim();
  if (!text) return null;

  const dateOnly = DATE_ONLY.exec(text);
  const utcDateTime = UTC_DATE_TIME.exec(text);
  const candidate = dateOnly
    ? `${dateOnly[1]}T00:00:00.000Z`
    : utcDateTime
      ? `${utcDateTime[1]}T${utcDateTime[2]}${utcDateTime[3] ? `.${utcDateTime[3].padEnd(3, '0').slice(0, 3)}` : ''}Z`
      : ISO_INSTANT.test(text)
        ? text
        : null;
  if (!candidate) return null;

  const date = new Date(candidate);
  if (Number.isNaN(date.getTime()) || !hasValidCalendarParts(text)) return null;
  return date;
}

function toUtcIso(value) {
  const date = parseUtcInstant(value);
  return date ? date.toISOString() : null;
}

function withUtcTimestamps(record, fields = []) {
  const result = { ...record };
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(result, field)) result[field] = toUtcIso(result[field]);
  }
  return result;
}

module.exports = {
  parseUtcInstant,
  toUtcIso,
  withUtcTimestamps,
  parseStoredTime: parseUtcInstant,
  serializeTime: toUtcIso,
  serializeStoredTime: toUtcIso
};
