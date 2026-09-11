function normalizeMarkdown(value) {
  return String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function estimateTokens(value) {
  const text = String(value || '').trim();
  const cjk = (text.match(/[\u3400-\u9fff\uf900-\ufaff]/g) || []).length;
  const words = (text.replace(/[\u3400-\u9fff\uf900-\ufaff]/g, ' ').match(/[\p{L}\p{N}_./:-]+/gu) || []).length;
  return Math.max(1, cjk + words);
}

module.exports = { normalizeMarkdown, estimateTokens };
