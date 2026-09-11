function truncate(value, maximum) { return String(value || '').slice(0, maximum); }

function noEvidenceResponse() {
  return '我没有找到足够可信的已授权站内资料来回答这个问题，因此不会猜测。你可以换一种说法，或提供具体文章链接。';
}

function compose({ content, retrieval = null, fallbackFrom = null }) {
  const valid = retrieval?.citations || [];
  return {
    content: truncate(content, 16000),
    citations: valid.map((citation) => ({
      id: citation.id, postId: citation.postId, chunkId: citation.chunkId, title: citation.title, slug: citation.slug,
      heading: citation.heading, headingAnchor: citation.headingAnchor, excerpt: truncate(citation.excerpt, 420), score: citation.rerankScore ?? citation.score,
    })),
    degraded: Boolean(retrieval?.degraded || fallbackFrom),
    fallbackFrom: fallbackFrom || null,
  };
}

module.exports = { compose, noEvidenceResponse };
