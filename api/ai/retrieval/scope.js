const crypto = require('crypto');
const { canAccessPost, followedAuthorIds } = require('../../lib/post-access');

const condition = (key, value) => ({ key, match: { value } });
const any = (key, values) => ({ key, match: { any: values } });

async function buildRetrievalScope(query, user, context = {}) {
  const branches = [
    { must: [condition('status', 'published'), condition('visibility', 'public')] },
  ];
  const explicitPostIds = [];
  if (user?.id) {
    branches.push({ must: [condition('author_id', Number(user.id))] });
    const followed = await followedAuthorIds(query, user.id);
    if (followed.length) branches.push({ must: [condition('status', 'published'), condition('visibility', 'followers'), any('author_id', followed)] });
  }
  if (context.articleId) {
    const [rows] = await query('SELECT * FROM posts WHERE id = ?', [Number(context.articleId)]);
    if (rows[0] && await canAccessPost(query, rows[0], user, context.shareToken)) {
      explicitPostIds.push(Number(rows[0].id));
      branches.push({ must: [condition('post_id', Number(rows[0].id))] });
    }
  }
  const scope = { userId: user?.id ? Number(user.id) : null, explicitPostIds, branches };
  // Qdrant 1.19 accepts a Filter as the query filter, but does not accept a
  // nested Filter as an item in `should`. Keep each access branch as a valid
  // top-level filter; the retriever merges their bounded hybrid results.
  scope.filters = branches;
  scope.filter = branches[0];
  scope.hash = crypto.createHash('sha256').update(JSON.stringify({ userId: scope.userId, explicitPostIds, branches })).digest('hex');
  return scope;
}

module.exports = { buildRetrievalScope };
