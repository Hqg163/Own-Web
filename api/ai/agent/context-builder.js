const { z } = require('zod');
const { canAccessPost } = require('../../lib/post-access');

const pageContextSchema = z.object({
  route: z.string().max(300).optional(),
  articleId: z.coerce.number().int().positive().optional(),
  selectedText: z.string().max(4000).optional(),
  heading: z.string().max(500).optional(),
  anchor: z.string().max(255).optional(),
  shareToken: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
}).strict();

function createContextBuilder({ db, config }) {
  const query = db.promise().query.bind(db.promise());

  async function build({ user = null, pageContext = {} }) {
    const parsed = pageContextSchema.parse(pageContext || {});
    const context = {
      user: user ? { id: Number(user.id), email: user.email || null } : null,
      route: parsed.route || null, selectedText: '',
      requestedArticleId: parsed.articleId || null, article: null,
      heading: parsed.heading || null, anchor: parsed.anchor || null,
      shareToken: parsed.shareToken || null,
    };
    if (!parsed.articleId) return context;
    const [rows] = await query('SELECT * FROM posts WHERE id=?', [parsed.articleId]);
    const article = rows[0];
    if (!article || !await canAccessPost(query, article, user, parsed.shareToken)) return context;
    context.article = {
      id: Number(article.id), title: article.title, slug: article.slug, authorId: Number(article.author_id),
      status: article.status, visibility: article.visibility, contentMarkdown: article.content_markdown,
      contentVersion: Number(article.content_version || 0),
    };
    context.selectedText = parsed.selectedText ? parsed.selectedText.slice(0, config.limits.selectedTextChars) : '';
    return context;
  }

  return { build, pageContextSchema };
}

module.exports = { createContextBuilder, pageContextSchema };
