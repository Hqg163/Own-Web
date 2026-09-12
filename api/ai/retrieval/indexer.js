const crypto = require('crypto');
const { createChunks, hash } = require('./chunker');
const { createArticleDocument } = require('./article-document');

const INDEX_ACTIONS = new Set(['upsert', 'delete']);
const LEASE_SECONDS = 5 * 60;

function parseJson(value, fallback) {
  if (Array.isArray(value) || (value && typeof value === 'object')) return value;
  try { return value ? JSON.parse(value) : fallback; } catch (_) { return fallback; }
}

function normalizeAction(action) {
  return INDEX_ACTIONS.has(action) ? action : 'upsert';
}

function queueLockName(postId, action) {
  return `own_web_ai_index_${normalizeAction(action)}_${Number(postId)}`.slice(0, 64);
}

function createIndexer({ db, config, qdrant, embeddingProvider }) {
  const query = db.promise().query.bind(db.promise());

  async function loadPost(postId) {
    const [posts] = await query('SELECT * FROM posts WHERE id = ?', [Number(postId)]);
    const post = posts[0];
    if (!post) return null;
    if (post.series_id != null) {
      const [series] = await query('SELECT name FROM series WHERE id=?', [post.series_id]);
      post.series_name = series[0]?.name || null;
    }
    const [categories] = await query('SELECT c.name,c.slug FROM post_categories pc JOIN categories c ON c.id=pc.category_id WHERE pc.post_id=?', [post.id]);
    const [tags] = await query('SELECT t.name,t.slug FROM post_tags pt JOIN tags t ON t.id=pt.tag_id WHERE pt.post_id=?', [post.id]);
    return { ...post, categories, tags };
  }

  function payloadFor(post, chunk) {
    return {
      source_type: 'chunk', post_id: Number(post.id), title: post.title, slug: post.slug, author_id: Number(post.author_id),
      status: post.status, visibility: post.visibility, series_id: post.series_id == null ? null : Number(post.series_id),
      category: post.categories.map((category) => category.slug), tags: post.tags.map((tag) => tag.slug),
      heading: chunk.heading, heading_path: chunk.headingPath, heading_anchor: chunk.headingAnchor, chunk_index: chunk.chunkIndex,
      content_hash: chunk.contentHash, published_at: post.published_at || null, updated_at: post.updated_at || null,
    };
  }

  function articlePayloadFor(post, document) {
    return {
      source_type: 'article', post_id: Number(post.id), title: post.title, slug: post.slug, author_id: Number(post.author_id),
      status: post.status, visibility: post.visibility, series_id: post.series_id == null ? null : Number(post.series_id),
      series_name: post.series_name || null, category: post.categories.map((category) => category.slug), tags: post.tags.map((tag) => tag.slug),
      headings: document.headings.slice(0, 30), content_hash: document.contentHash,
      published_at: post.published_at || null, updated_at: post.updated_at || null,
    };
  }

  async function deletePostPoints(postId, pointIds) {
    if (!qdrant.client) throw Object.assign(new Error('Qdrant 未配置'), { code: 'QDRANT_UNAVAILABLE' });
    if (pointIds.length) await qdrant.client.delete(qdrant.collection, { wait: true, points: pointIds });
    // A pre-v1 lifecycle failure may have lost the relational chunk record.
    // The server-owned post_id payload is still safe to use for this cleanup.
    await qdrant.client.delete(qdrant.collection, {
      wait: true,
      filter: { must: [{ key: 'post_id', match: { value: Number(postId) } }] },
    });
  }

  async function removePost(postId) {
    const normalizedPostId = Number(postId);
    const [stored] = await query('SELECT chunk_id FROM ai_index_chunks WHERE post_id=?', [normalizedPostId]);
    const [tombstones] = await query('SELECT chunk_id FROM ai_index_tombstones WHERE post_id=? AND processed_at IS NULL', [normalizedPostId]);
    let articles = [];
    let articleTombstones = [];
    try {
      [articles] = await query('SELECT point_id FROM ai_article_index WHERE post_id=?', [normalizedPostId]);
      [articleTombstones] = await query('SELECT point_id FROM ai_article_index_tombstones WHERE post_id=? AND processed_at IS NULL', [normalizedPostId]);
    } catch (error) {
      // A rolling deployment can process an old delete job before the additive
      // v1.5 migration reaches this connection. The payload filter below still
      // removes every server-owned point for the post.
      if (!/ai_article_index/i.test(String(error?.message || ''))) throw error;
    }
    const pointIds = [...new Set([...stored, ...tombstones, ...articles, ...articleTombstones].map((row) => String(row.chunk_id || row.point_id)))];
    await deletePostPoints(normalizedPostId, pointIds);
    await query('DELETE FROM ai_index_chunks WHERE post_id=?', [normalizedPostId]);
    await query('DELETE FROM ai_index_tombstones WHERE post_id=?', [normalizedPostId]);
    await query('DELETE FROM ai_article_index WHERE post_id=?', [normalizedPostId]).catch(() => {});
    await query('DELETE FROM ai_article_index_tombstones WHERE post_id=?', [normalizedPostId]).catch(() => {});
    await query('UPDATE ai_index_state SET version=version+1 WHERE id=1');
    return { deleted: pointIds.length };
  }

  async function indexPost(postId) {
    if (!config.enabled) return { skipped: 'disabled' };
    const post = await loadPost(postId);
    if (!post) return removePost(postId);
    if (!qdrant.client) throw Object.assign(new Error('Qdrant 未配置'), { code: 'QDRANT_UNAVAILABLE' });
    await qdrant.ensureCollection();
    const chunks = createChunks(post);
    const document = createArticleDocument(post);
    const vectors = await embeddingProvider.embed([...chunks.map((chunk) => chunk.content), document.content]);
    const [oldRows] = await query('SELECT chunk_id FROM ai_index_chunks WHERE post_id=?', [post.id]);
    const oldIds = new Set(oldRows.map((row) => row.chunk_id));
    const points = chunks.map((chunk, index) => ({
      id: chunk.chunkId,
      vector: {
        dense: vectors[index],
        bm25: { text: chunk.content, model: 'Qdrant/bm25', options: qdrant.bm25 || { tokenizer: 'multilingual', stemmer: { type: 'none' }, stopwords: {} } },
      },
      payload: payloadFor(post, chunk),
    }));
    points.push({
      id: document.pointId,
      vector: { dense: vectors[chunks.length], bm25: { text: document.content, model: 'Qdrant/bm25', options: qdrant.bm25 || { tokenizer: 'multilingual', stemmer: { type: 'none' }, stopwords: {} } } },
      payload: articlePayloadFor(post, document),
    });
    if (points.length) await qdrant.client.upsert(qdrant.collection, { wait: true, points });
    const newIds = new Set(chunks.map((chunk) => chunk.chunkId));
    const stale = [...oldIds].filter((id) => !newIds.has(id));
    if (stale.length) await qdrant.client.delete(qdrant.collection, { wait: true, points: stale });

    await query('DELETE FROM ai_index_chunks WHERE post_id=?', [post.id]);
    for (const chunk of chunks) {
      const metadata = payloadFor(post, chunk);
      await query(
        'INSERT INTO ai_index_chunks (chunk_id,post_id,content_hash,heading,heading_path,heading_anchor,chunk_index,content,metadata) VALUES (?,?,?,?,?,?,?,?,?)',
        [chunk.chunkId, post.id, chunk.contentHash, chunk.heading, chunk.headingPath, chunk.headingAnchor, chunk.chunkIndex, chunk.content, JSON.stringify(metadata)],
      );
    }
    await query('DELETE FROM ai_article_index WHERE post_id=?', [post.id]);
    await query(
      'INSERT INTO ai_article_index (post_id,point_id,content_hash,discovery_content,metadata) VALUES (?,?,?,?,?)',
      [post.id, document.pointId, document.contentHash, document.content, JSON.stringify(articlePayloadFor(post, document))],
    );
    await query('UPDATE ai_index_state SET version=version+1 WHERE id=1');
    return { indexed: chunks.length, indexedArticles: 1, contentHash: hash(post.content_markdown) };
  }

  async function pruneOrphanedPostPoints() {
    if (!qdrant.client) return 0;
    const [stored] = await query('SELECT chunk_id FROM ai_index_chunks');
    let articleRows = [];
    try { [articleRows] = await query('SELECT point_id FROM ai_article_index'); } catch (_) { articleRows = []; }
    const validIds = new Set(stored.map((row) => String(row.chunk_id)));
    const validArticleIds = new Set(articleRows.map((row) => String(row.point_id)));
    const orphaned = [];
    let offset;
    do {
      const page = await qdrant.client.scroll(qdrant.collection, {
        limit: 100,
        offset,
        with_payload: ['source_type'],
        with_vector: false,
      });
      for (const point of page.points || []) {
        if (['post', 'chunk'].includes(point.payload?.source_type) && !validIds.has(String(point.id))) orphaned.push(String(point.id));
        if (point.payload?.source_type === 'article' && !validArticleIds.has(String(point.id))) orphaned.push(String(point.id));
      }
      offset = page.next_page_offset;
    } while (offset);
    for (let start = 0; start < orphaned.length; start += 100) {
      await qdrant.client.delete(qdrant.collection, { wait: true, points: orphaned.slice(start, start + 100) });
    }
    return orphaned.length;
  }

  async function backfill() {
    const [posts] = await query('SELECT id FROM posts ORDER BY id');
    const summary = { scannedPosts: posts.length, indexedPosts: 0, indexedChunks: 0, failures: [], qdrantPointCount: null };
    for (const post of posts) {
      try {
        const result = await indexPost(post.id);
        summary.indexedPosts += 1;
        summary.indexedChunks += Number(result.indexed || 0);
      } catch (error) {
        summary.failures.push({ postId: Number(post.id), code: error.code || 'INDEX_FAILED' });
      }
    }
    try { summary.prunedOrphanedPoints = await pruneOrphanedPostPoints(); }
    catch (error) { summary.failures.push({ postId: null, code: error.code || 'ORPHAN_PRUNE_FAILED' }); }
    if (qdrant.client) {
      try { summary.qdrantPointCount = Number((await qdrant.client.count(qdrant.collection, { exact: true })).count || 0); } catch (_) { summary.qdrantPointCount = null; }
    }
    // Keep the initial CLI fields so existing local automation remains readable.
    return { ...summary, scanned: summary.scannedPosts, indexed: summary.indexedChunks, errors: summary.failures };
  }

  return { loadPost, indexPost, removePost, backfill, pruneOrphanedPostPoints };
}

function createIndexQueue({ db, config, indexer }) {
  const query = db.promise().query.bind(db.promise());
  let running = false;

  async function withQueueConnection(operation) {
    const pool = db.promise();
    if (typeof pool.getConnection !== 'function') return operation(query);
    const connection = await pool.getConnection();
    try { return await operation(connection.query.bind(connection)); } finally { connection.release(); }
  }

  async function withQueueLock(postId, action, operation) {
    return withQueueConnection(async (lockedQuery) => {
      const name = queueLockName(postId, action);
      const [rows] = await lockedQuery('SELECT GET_LOCK(?, 2) AS acquired', [name]);
      if (!rows[0]?.acquired) throw Object.assign(new Error('索引队列繁忙'), { code: 'INDEX_QUEUE_BUSY' });
      try { return await operation(lockedQuery); }
      finally { await lockedQuery('SELECT RELEASE_LOCK(?)', [name]).catch(() => {}); }
    });
  }

  async function captureDeleteTombstones(lockedQuery, postId) {
    const [chunks] = await lockedQuery('SELECT chunk_id FROM ai_index_chunks WHERE post_id=?', [Number(postId)]);
    for (const chunk of chunks) {
      await lockedQuery('INSERT IGNORE INTO ai_index_tombstones (chunk_id,post_id) VALUES (?,?)', [String(chunk.chunk_id), Number(postId)]);
    }
    try {
      const [articles] = await lockedQuery('SELECT point_id FROM ai_article_index WHERE post_id=?', [Number(postId)]);
      for (const article of articles) {
        await lockedQuery('INSERT IGNORE INTO ai_article_index_tombstones (post_id,point_id) VALUES (?,?)', [Number(postId), String(article.point_id)]);
      }
    } catch (error) {
      if (!/ai_article_index/i.test(String(error?.message || ''))) throw error;
    }
    return chunks.length;
  }

  async function recoverExpiredLeases() {
    await query("UPDATE ai_index_jobs SET status='pending', lease_token=NULL, lease_expires_at=NULL, error='worker lease expired' WHERE status='running' AND lease_expires_at IS NOT NULL AND lease_expires_at<=UTC_TIMESTAMP()");
  }

  async function processNext({ reschedule = true } = {}) {
    if (running || !config.enabled) return { handled: false };
    running = true;
    let handled = false;
    try {
      await recoverExpiredLeases();
      const [jobs] = await query("SELECT * FROM ai_index_jobs WHERE status='pending' AND (available_at IS NULL OR available_at<=UTC_TIMESTAMP()) ORDER BY id LIMIT 1");
      const job = jobs[0];
      if (!job) return { handled: false };
      const leaseToken = crypto.randomUUID();
      const [claimed] = await query("UPDATE ai_index_jobs SET status='running',lease_token=?,lease_expires_at=DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND),attempts=attempts+1,error=NULL WHERE id=? AND status='pending'", [leaseToken, LEASE_SECONDS, job.id]);
      if (!claimed.affectedRows) return { handled: false };
      handled = true;
      try {
        const action = normalizeAction(job.action);
        const result = action === 'delete' ? await indexer.removePost(job.source_id) : await indexer.indexPost(job.source_id);
        await query("UPDATE ai_index_jobs SET status='completed',indexed_at=UTC_TIMESTAMP(),error=NULL,lease_token=NULL,lease_expires_at=NULL WHERE id=? AND lease_token=?", [job.id, leaseToken]);
        return { handled: true, result };
      } catch (error) {
        await query("UPDATE ai_index_jobs SET status='failed',error=?,lease_token=NULL,lease_expires_at=NULL WHERE id=? AND lease_token=?", [String(error.code || error.message || 'Index failed').slice(0, 4000), job.id, leaseToken]);
        return { handled: true, error: error.code || 'INDEX_FAILED' };
      }
    } finally {
      running = false;
      if (handled && reschedule) setImmediate(() => { processNext().catch(() => {}); });
    }
  }

  async function enqueue(postId, contentHash = null, action = 'upsert') {
    if (!config.enabled) return null;
    const normalizedPostId = Number(postId);
    const normalizedAction = normalizeAction(action);
    const jobId = await withQueueLock(normalizedPostId, normalizedAction, async (lockedQuery) => {
      if (normalizedAction === 'delete') await captureDeleteTombstones(lockedQuery, normalizedPostId);
      const [existing] = await lockedQuery("SELECT id FROM ai_index_jobs WHERE source_type='post' AND source_id=? AND action=? AND status IN ('pending','running') ORDER BY id DESC LIMIT 1", [normalizedPostId, normalizedAction]);
      if (existing[0]) {
        await lockedQuery('UPDATE ai_index_jobs SET content_hash=?,embedding_model=?,updated_at=UTC_TIMESTAMP() WHERE id=?', [contentHash, config.embedding.model, existing[0].id]);
        return Number(existing[0].id);
      }
      const [result] = await lockedQuery("INSERT INTO ai_index_jobs (source_type,source_id,action,content_hash,embedding_model,status,available_at) VALUES ('post',?,?,?,?, 'pending',UTC_TIMESTAMP())", [normalizedPostId, normalizedAction, contentHash, config.embedding.model]);
      return Number(result.insertId);
    });
    setImmediate(() => { processNext().catch(() => {}); });
    return jobId;
  }

  async function retryFailed() {
    if (!config.enabled) return 0;
    const [result] = await query("UPDATE ai_index_jobs SET status='pending',error=NULL,lease_token=NULL,lease_expires_at=NULL,available_at=UTC_TIMESTAMP() WHERE status='failed'");
    if (result.affectedRows) setImmediate(() => { processNext().catch(() => {}); });
    return result.affectedRows;
  }

  async function drain() {
    let handled = 0;
    while (true) {
      const result = await processNext({ reschedule: false });
      if (!result.handled) return handled;
      handled += 1;
    }
  }

  return { enqueue, processNext, retryFailed, drain, captureDeleteTombstones };
}

module.exports = { createIndexer, createIndexQueue, parseJson, normalizeAction, queueLockName };
