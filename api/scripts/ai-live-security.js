const crypto = require('crypto');
const path = require('path');
const dotenv = require('dotenv');
const mysql = require('mysql2');
const { installUtcPool } = require('../lib/utc-pool');
const { loadAiConfig } = require('../ai/config');
const { createQdrantStore } = require('../ai/qdrant');
const { createEmbeddingProvider } = require('../ai/providers/embedding-provider');
const { createRerankerProvider } = require('../ai/providers/reranker-provider');
const { createIndexer } = require('../ai/retrieval/indexer');
const { createRetriever } = require('../ai/retrieval/retriever');
const { createContextBuilder } = require('../ai/agent/context-builder');
const { createSkillRegistry } = require('../ai/agent/skills');
const { TtlLruCache } = require('../ai/cache');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

function fail(code) {
  throw Object.assign(new Error(code), { code });
}

async function rejectsWith(run, code) {
  try {
    await run();
  } catch (error) {
    if (error?.code === code) return;
    throw error;
  }
  fail(`EXPECTED_${code}`);
}

async function main() {
  if (process.env.AI_LIVE_TESTS !== '1') fail('LIVE_TESTS_OPT_IN_REQUIRED');
  const config = loadAiConfig();
  if (!config.enabled || config.providerMode !== 'live') fail('LIVE_PROVIDER_REQUIRED');

  const db = mysql.createPool({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, database: process.env.DB_NAME, timezone: 'Z', connectionLimit: 2,
  });
  installUtcPool(db);
  const query = db.promise().query.bind(db.promise());
  const qdrant = createQdrantStore(config);
  const suffix = crypto.randomUUID().replace(/-/g, '');
  const fixture = { users: [], posts: [] };

  async function createUser(kind) {
    const username = `ai_live_${kind}_${suffix.slice(0, 12)}`;
    const [result] = await query(
      "INSERT INTO users (username,email,password,blog_slug,profile_visibility) VALUES (?,?,?,?, 'private')",
      [username, `${username}@example.invalid`, crypto.randomBytes(24).toString('hex'), `${username}-blog`],
    );
    const id = Number(result.insertId);
    fixture.users.push(id);
    return { id, email: `${username}@example.invalid` };
  }

  async function createPost(authorId, kind, visibility, shareToken = null) {
    const marker = `live-security-${kind}-${suffix}`;
    const [result] = await query(
      `INSERT INTO posts (author_id,title,slug,excerpt,content_markdown,content_html,status,visibility,share_token,published_at)
       VALUES (?,?,?,?,?,?,?, ?, ?, CASE WHEN ?='published' THEN UTC_TIMESTAMP() ELSE NULL END)`,
      [authorId, `AI live security ${kind}`, `ai-live-${kind}-${suffix}`, marker, `# ${kind}\n\n${marker}`, `<p>${marker}</p>`,
        visibility === 'private' ? 'draft' : 'published', visibility, shareToken, visibility === 'private' ? 'draft' : 'published'],
    );
    const post = { id: Number(result.insertId), marker };
    fixture.posts.push(post);
    return post;
  }

  async function cleanup() {
    for (const post of fixture.posts) {
      try {
        await qdrant.client?.delete(qdrant.collection, { wait: true, filter: { must: [{ key: 'post_id', match: { value: post.id } }] } });
      } catch (_) { /* continue MySQL cleanup even if Qdrant is unavailable */ }
    }
    if (fixture.posts.length) await query(`DELETE FROM posts WHERE id IN (${fixture.posts.map(() => '?').join(',')})`, fixture.posts.map((post) => post.id));
    if (fixture.users.length) await query(`DELETE FROM users WHERE id IN (${fixture.users.map(() => '?').join(',')})`, fixture.users);
  }

  try {
    const owner = await createUser('owner');
    const follower = await createUser('follower');
    const outsider = await createUser('outsider');
    const unlistedToken = crypto.randomBytes(32).toString('hex');
    const privatePost = await createPost(owner.id, 'private', 'private');
    const followerPost = await createPost(owner.id, 'followers', 'followers');
    const unlistedPost = await createPost(owner.id, 'unlisted', 'unlisted', unlistedToken);
    await query('INSERT INTO follows (follower_id,following_id) VALUES (?,?)', [follower.id, owner.id]);

    const indexer = createIndexer({ db, config, qdrant, embeddingProvider: createEmbeddingProvider(config) });
    for (const post of fixture.posts) await indexer.indexPost(post.id);
    const pointCounts = [];
    for (const post of fixture.posts) {
      const result = await qdrant.client.count(qdrant.collection, { exact: true, filter: { must: [{ key: 'post_id', match: { value: post.id } }] } });
      pointCounts.push(Number(result.count || 0));
    }
    if (pointCounts.some((count) => count < 1)) fail('FIXTURE_INDEX_FAILED');

    const retriever = createRetriever({
      db, config, qdrant, embeddingProvider: createEmbeddingProvider(config), rerankerProvider: createRerankerProvider(config),
      retrievalCache: new TtlLruCache(config.cache),
    });
    const guestHidden = await retriever.retrieve(suffix, null, {});
    if (guestHidden.candidates.length || guestHidden.citations.length) fail('GUEST_RAG_LEAK');
    const followerVisible = await retriever.retrieve(followerPost.marker, follower, {});
    if (!followerVisible.citations.some((citation) => citation.postId === followerPost.id)) fail('FOLLOWER_RAG_DENIED');
    const unlistedVisible = await retriever.retrieve(unlistedPost.marker, outsider, { articleId: unlistedPost.id, shareToken: unlistedToken });
    if (!unlistedVisible.citations.some((citation) => citation.postId === unlistedPost.id)) fail('UNLISTED_RAG_DENIED');

    const skills = createSkillRegistry({ db, config });
    await rejectsWith(() => skills.invoke('run_sql', { sql: 'SELECT 1' }, { user: null, shareToken: null }), 'TOOL_NOT_ALLOWED');
    await rejectsWith(() => skills.invoke('get_article', { postId: privatePost.id }, { user: null, shareToken: null }), 'FORBIDDEN');
    await rejectsWith(() => skills.invoke('get_article', { postId: followerPost.id }, { user: null, shareToken: null }), 'FORBIDDEN');
    await rejectsWith(() => skills.invoke('get_article', { postId: unlistedPost.id }, { user: outsider, shareToken: '0'.repeat(64) }), 'FORBIDDEN');
    const followedArticle = await skills.invoke('get_article', { postId: followerPost.id }, { user: follower, shareToken: null });
    const sharedArticle = await skills.invoke('get_article', { postId: unlistedPost.id }, { user: outsider, shareToken: unlistedToken });
    if (followedArticle.id !== followerPost.id || sharedArticle.id !== unlistedPost.id) fail('AUTHORIZED_SKILL_DENIED');

    const contextBuilder = createContextBuilder({ db, config });
    const privateContext = await contextBuilder.build({ user: null, pageContext: { articleId: privatePost.id, selectedText: privatePost.marker } });
    const invalidShareContext = await contextBuilder.build({ user: outsider, pageContext: { articleId: unlistedPost.id, selectedText: unlistedPost.marker, shareToken: '0'.repeat(64) } });
    const validShareContext = await contextBuilder.build({ user: outsider, pageContext: { articleId: unlistedPost.id, selectedText: unlistedPost.marker, shareToken: unlistedToken } });
    if (privateContext.article || invalidShareContext.article || validShareContext.article?.id !== unlistedPost.id) fail('CONTEXT_AUTHORIZATION_FAILED');

    console.log(JSON.stringify({
      requestId: crypto.randomUUID(), status: 'PASS',
      checks: [
        { name: 'private_followers_unlisted_rag', status: 'PASS', indexedFixtures: pointCounts.length, guestCitations: 0 },
        { name: 'tool_allowlist_and_server_authorization', status: 'PASS' },
        { name: 'context_share_token_revalidation', status: 'PASS' },
      ],
    }));
  } finally {
    await cleanup();
    await db.promise().end();
  }
}

main().catch((error) => {
  console.error(`[ai:live-security] ${error.code || 'CHECK_FAILED'}`);
  process.exitCode = 1;
});
