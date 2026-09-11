const { parseSections } = require('../retrieval/chunker');

function summarizeInput(article, contextChars) {
  const markdown = String(article?.contentMarkdown || '');
  if (markdown.length <= contextChars) return { mode: 'direct', content: markdown, sections: 1 };
  // This is a deterministic map stage over the complete, already-authorized
  // article. It deliberately avoids similarity retrieval for summaries.
  const sections = parseSections(markdown);
  const perSection = Math.max(500, Math.floor(contextChars / Math.max(sections.length, 1)));
  const map = sections.map((section) => {
    const text = section.lines.join('\n').trim();
    return `## ${section.headingPath}\n${text.slice(0, perSection)}`;
  }).join('\n\n');
  return { mode: 'section-map', content: map.slice(0, contextChars), sections: sections.length };
}

module.exports = { summarizeInput };
