const { parseSections, uuidFromHash, hash } = require('./chunker');

function compact(value, maximum) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maximum);
}

// A discovery point describes an article as a whole. It is intentionally not
// used as a factual citation: precise answers still cite rehydrated chunks.
function createArticleDocument(post) {
  const headings = parseSections(post.content_markdown || '').map((section) => section.headingPath).filter(Boolean);
  const categories = (post.categories || []).map((item) => item.name || item.slug).filter(Boolean);
  const tags = (post.tags || []).map((item) => item.name || item.slug).filter(Boolean);
  const body = compact(post.content_markdown, 3200);
  const text = [
    `标题：${compact(post.title, 300)}`,
    post.excerpt ? `摘要：${compact(post.excerpt, 900)}` : '',
    categories.length ? `分类：${categories.join('、')}` : '',
    tags.length ? `标签：${tags.join('、')}` : '',
    post.series_name ? `专栏：${compact(post.series_name, 200)}` : '',
    headings.length ? `章节：${headings.slice(0, 30).join('；')}` : '',
    body ? `正文概览：${body}` : '',
  ].filter(Boolean).join('\n');
  const contentHash = hash(text);
  return { pointId: uuidFromHash(`article\u0000${post.id}\u0000${contentHash}`), contentHash, content: text, headings };
}

module.exports = { createArticleDocument };
