function truncate(value, maximum) { return String(value || '').slice(0, maximum); }

function noEvidenceResponse() {
  return '我没有找到足够可信的已授权站内资料来回答这个问题，因此不会猜测。你可以换一种说法，或提供具体文章链接。';
}

function citationKey(citation) {
  return `${String(citation.postId || '')}#${String(citation.headingAnchor || '')}`;
}

function dedupeCitations(citations) {
  const priority = { chunk: 3, catalog: 2, discovery: 1 };
  const byAnchor = new Map();
  for (const citation of citations || []) {
    const key = citationKey(citation);
    const current = byAnchor.get(key);
    if (!current || Number(priority[citation.source] || 0) > Number(priority[current.source] || 0)) byAnchor.set(key, citation);
  }
  const detailedPostIds = new Set([...byAnchor.values()]
    .filter((citation) => citation.source === 'chunk' && citation.postId)
    .map((citation) => String(citation.postId)));
  // A whole-article discovery result adds no useful source context next to a
  // precise chunk from the same post.  Keep precise anchors (including more
  // than one section when the answer genuinely uses them), drop the broad
  // duplicate.
  return [...byAnchor.values()].filter((citation) => citation.headingAnchor || !detailedPostIds.has(String(citation.postId)));
}

function compose({ content, retrieval = null, catalog = null, discovery = null, fallbackFrom = null }) {
  const valid = [...(retrieval?.citations || []).map((citation) => ({ ...citation, source: 'chunk' })), ...(catalog?.items || []).map((article, index) => ({
    id: `C${index + 1}`, postId: article.id, chunkId: null, title: article.title, slug: article.slug,
    heading: '文章目录', headingAnchor: null, excerpt: article.overview || article.excerpt || '', score: null, source: 'catalog',
  }))];
  const discoveryCitations = (discovery?.citations || []).map((article) => ({
    id: article.id, postId: article.articleId, chunkId: null, title: article.title, slug: article.slug,
    heading: '相关文章', headingAnchor: null, excerpt: article.overview || article.excerpt || '', score: article.rerankScore ?? article.score, source: 'discovery',
  }));
  return {
    content: truncate(content, 16000),
    citations: dedupeCitations([...valid, ...discoveryCitations]).map((citation) => ({
      id: citation.id, postId: citation.postId, chunkId: citation.chunkId, title: citation.title, slug: citation.slug,
      heading: citation.heading, headingAnchor: citation.headingAnchor, excerpt: truncate(citation.excerpt, 420), score: citation.rerankScore ?? citation.score,
    })),
    degraded: Boolean(retrieval?.degraded || discovery?.degraded || fallbackFrom),
    fallbackFrom: fallbackFrom || null,
  };
}

module.exports = { compose, noEvidenceResponse, dedupeCitations };
