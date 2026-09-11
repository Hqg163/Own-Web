/**
 * Canonical post visibility policy shared by public blog routes and AI services.
 * Callers must load the post from MySQL themselves; the browser never supplies
 * authoritative post metadata to this helper.
 */
async function canAccessPost(query, post, viewer, shareToken) {
  if (!post) return false;
  if (viewer?.id && Number(viewer.id) === Number(post.author_id)) return true;
  if (post.status !== 'published') return false;
  if (post.visibility === 'public') return true;
  if (post.visibility === 'unlisted') return Boolean(shareToken) && shareToken === post.share_token;
  if (post.visibility !== 'followers' || !viewer?.id) return false;

  const [rows] = await query(
    'SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?',
    [Number(viewer.id), Number(post.author_id)],
  );
  return rows.length > 0;
}

async function followedAuthorIds(query, viewerId) {
  if (!viewerId) return [];
  const [rows] = await query('SELECT following_id FROM follows WHERE follower_id = ?', [Number(viewerId)]);
  return rows.map((row) => Number(row.following_id)).filter(Number.isSafeInteger);
}

module.exports = { canAccessPost, followedAuthorIds };
