const crypto = require('crypto');
const { canAccessPost, followedAuthorIds } = require('../../lib/post-access');

const condition = (key, value) => ({ key, match: { value } });
const any = (key, values) => ({ key, match: { any: values } });

async function buildRetrievalScope(query, user, context = {}) {
  const sourceTypes = Array.isArray(context.sourceTypes) && context.sourceTypes.length
    ? [...new Set(context.sourceTypes.map(String))] : ['post', 'chunk'];
  const sourceCondition = sourceTypes.length === 1 ? condition('source_type', sourceTypes[0]) : any('source_type', sourceTypes);
  const branches = [
    { must: [condition('status', 'published'), condition('visibility', 'public'), sourceCondition] },
  ];
  const explicitPostIds = [];
  if (user?.id) {
    branches.push({ must: [condition('author_id', Number(user.id)), sourceCondition] });
    const followed = await followedAuthorIds(query, user.id);
    if (followed.length) branches.push({ must: [condition('status', 'published'), condition('visibility', 'followers'), any('author_id', followed), sourceCondition] });
  }
  if (context.articleId) {
    const [rows] = await query('SELECT * FROM posts WHERE id = ?', [Number(context.articleId)]);
    if (rows[0] && await canAccessPost(query, rows[0], user, context.shareToken)) {
      explicitPostIds.push(Number(rows[0].id));
      branches.push({ must: [condition('post_id', Number(rows[0].id)), sourceCondition] });
    }
  }
  const scope = { userId: user?.id ? Number(user.id) : null, explicitPostIds, sourceTypes, branches };
  // Qdrant 1.19 accepts a Filter as the query filter, but does not accept a
  // nested Filter as an item in `should`. Keep each access branch as a valid
  // top-level filter; the retriever merges their bounded hybrid results.
  scope.filters = branches;
  scope.filter = branches[0];
  scope.hash = crypto.createHash('sha256').update(JSON.stringify({ userId: scope.userId, explicitPostIds, sourceTypes, branches })).digest('hex');
  return scope;
}

module.exports = { buildRetrievalScope };
