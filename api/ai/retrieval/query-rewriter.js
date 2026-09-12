const { normalizeSearchQuery } = require('../agent/article-catalog');

// This is a bounded, explainable rewrite—not an extra model call. It preserves
// the original question and only adds authorized article/selection terms.
function createRetrievalQueries(question, context = {}) {
  const original = String(question || '').trim().slice(0, 800);
  const queries = [original];
  const terms = normalizeSearchQuery(original).slice(0, 8).join(' ');
  if (terms && terms !== original) queries.push(terms);
  const local = String(context.selectedText || context.heading || '').replace(/\s+/g, ' ').trim().slice(0, 360);
  if (local && original) queries.push(`${local}\n${original}`.slice(0, 1200));
  return [...new Set(queries.filter(Boolean))].slice(0, 3);
}

module.exports = { createRetrievalQueries };
