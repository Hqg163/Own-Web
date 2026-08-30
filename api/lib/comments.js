const COMMENT_SORTS = new Set(['latest', 'newest', 'oldest', 'hot', 'popular']);
const COMMENT_PAGE_SIZE = 20;
const MAX_COMMENT_PAGE_SIZE = 50;
const MAX_COMMENT_LENGTH = 5000;
const MAX_COMMENT_MEDIA_COUNT = 9;
const MAX_COMMENT_MEDIA_FILE_BYTES = 5 * 1024 * 1024;
const MAX_COMMENT_MEDIA_TOTAL_BYTES = 30 * 1024 * 1024;
const COMMENT_MEDIA_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

function parsePositiveId(value) {
  const text = String(value ?? '').trim();
  if (!/^\d+$/.test(text)) return null;
  const id = Number(text);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function parseCommentPage(value) {
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? Math.min(page, 100000) : 1;
}

function parseCommentPageSize(value) {
  const pageSize = Number(value);
  return Number.isSafeInteger(pageSize) && pageSize > 0
    ? Math.min(pageSize, MAX_COMMENT_PAGE_SIZE)
    : COMMENT_PAGE_SIZE;
}

function parseCommentCursor(value) {
  if (value == null || value === '') return 0;
  const cursor = Number(value);
  return Number.isSafeInteger(cursor) && cursor >= 0 ? Math.min(cursor, 1000000) : null;
}

function normalizeCommentSort(value) {
  const sort = String(value || '').toLowerCase();
  return COMMENT_SORTS.has(sort) ? ({ newest: 'latest', popular: 'hot' }[sort] || sort) : 'latest';
}

function normalizeCommentContent(value) {
  const content = String(value ?? '').trim();
  return content ? content.slice(0, MAX_COMMENT_LENGTH) : null;
}

function normalizeMediaIds(value) {
  if (value == null || value === '') return [];
  if (!Array.isArray(value) || value.length > MAX_COMMENT_MEDIA_COUNT) return null;
  const ids = [...new Set(value.map((item) => parsePositiveId(item && typeof item === 'object' ? item.id : item)))];
  return ids.length === value.length && ids.every(Boolean) ? ids : null;
}

function hasMeaningfulComment(content, mediaIds) {
  return Boolean(normalizeCommentContent(content) || (Array.isArray(mediaIds) && mediaIds.length > 0));
}

function mediaUrl(id, shareToken) {
  const base = `/api/public/comment-media/${encodeURIComponent(String(id))}`;
  return shareToken ? `${base}?share=${encodeURIComponent(String(shareToken))}` : base;
}

module.exports = {
  COMMENT_PAGE_SIZE,
  MAX_COMMENT_PAGE_SIZE,
  MAX_COMMENT_LENGTH,
  MAX_COMMENT_MEDIA_COUNT,
  MAX_COMMENT_MEDIA_FILE_BYTES,
  MAX_COMMENT_MEDIA_TOTAL_BYTES,
  COMMENT_MEDIA_TYPES,
  parsePositiveId,
  parseCommentPage,
  parseCommentPageSize,
  parseCommentCursor,
  normalizeCommentSort,
  normalizeCommentContent,
  normalizeMediaIds,
  hasMeaningfulComment,
  mediaUrl
};
