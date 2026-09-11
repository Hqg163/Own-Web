function headingSlug(value) {
  return String(value || '')
    .replace(/\$\$([\s\S]*?)\$\$/g, '$1')
    .replace(/\\\(([\s\S]*?)\\\)/g, '$1')
    .replace(/(^|[^\\])\$([^$\n]+)\$/g, '$1$2')
    .replace(/\\([a-zA-Z]+)/g, '$1')
    .replace(/[{}_^]/g, '-')
    .replace(/[^\p{L}\p{N}\u4e00-\u9fff]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
    .toLowerCase();
}

function createHeadingId(text, used, fallbackIndex = 1) {
  const base = headingSlug(text) || `section-${fallbackIndex}`;
  let id = base;
  let suffix = 2;
  while (used.has(id)) id = `${base}-${suffix++}`;
  used.add(id);
  return id;
}

module.exports = { headingSlug, createHeadingId };
