const { createChunks, hash } = require('./chunker');

function parseJson(value, fallback) {
  if (Array.isArray(value) || (value && typeof value === 'object')) return value;
  try { return value ? JSON.parse(value) : fallback; } catch (_) { return fallback; }
}

function createIndexer({ db, config, qdrant, embeddingProvider }) {
  const query = db.promise().query.bind(db.promise());

  async function loadPost(postId) {
    const [posts] = await query('SELECT * FROM posts WHERE id = ?', [Number(postId)]);
    const post = posts[0];
    if (!post) return null;
    const [categories] = await query('SELECT c.name,c.slug FROM post_categories pc JOIN categories c ON c.id=pc.category_id WHERE pc.post_id=?', [post.id]);
    const [tags] = await query('SELECT t.name,t.slug FROM post_tags pt JOIN tags t ON t.id=pt.tag_id WHERE pt.post_id=?', [post.id]);
    return { ...post, categories, tags };
  }

  function payloadFor(post, chunk) {
    return {
      source_type: 'post', post_id: Number(post.id), title: post.title, slug: post.slug, author_id: Number(post.author_id),
      status: post.status, visibility: post.visibility, series_id: post.series_id == null ? null : Number(post.series_id),
      category: post.categories.map((category) => category.slug), tags: post.tags.map((tag) => tag.slug),
      heading: chunk.heading, heading_path: chunk.headingPath, heading_anchor: chunk.headingAnchor, chunk_index: chunk.chunkIndex,
      content_hash: chunk.contentHash, published_at: post.published_at || null, updated_at: post.updated_at || null,
    };
  }

  async function removePost(postId) {
    const [stored] = await query('SELECT chunk_id FROM ai_index_chunks WHERE post_id=?', [Number(postId)]);
    if (qdrant.client && stored.length) await qdrant.client.delete(qdrant.collection, { wait: true, points: stored.map((row) => row.chunk_id) });
    await query('DELETE FROM ai_index_chunks WHERE post_id=?', [Number(postId)]);
    await query('UPDATE ai_index_state SET version=version+1 WHERE id=1');
    return { deleted: stored.length };
  }

  async function indexPost(postId) {
    if (!config.enabled) return { skipped: 'disabled' };
    const post = await loadPost(postId);
    if (!post) return removePost(postId);
    if (!qdrant.client) throw Object.assign(new Error('Qdrant 未配置'), { code: 'QDRANT_UNAVAILABLE' });
    await qdrant.ensureCollection();
    const chunks = createChunks(post);
    const vectors = await embeddingProvider.embed(chunks.map((chunk) => chunk.content));
    const [oldRows] = await query('SELECT chunk_id FROM ai_index_chunks WHERE post_id=?', [post.id]);
    const oldIds = new Set(oldRows.map((row) => row.chunk_id));
    const points = chunks.map((chunk, index) => ({
      id: chunk.chunkId,
      vector: {
        dense: vectors[index],
        bm25: { text: chunk.content, model: 'Qdrant/bm25', options: { tokenizer: 'multilingual' } },
      },
      payload: payloadFor(post, chunk),
    }));
    if (points.length) await qdrant.client.upsert(qdrant.collection, { wait: true, points });

    await query('DELETE FROM ai_index_chunks WHERE post_id=?', [post.id]);
    for (const chunk of chunks) {
      const metadata = payloadFor(post, chunk);
      await query(
        'INSERT INTO ai_index_chunks (chunk_id,post_id,content_hash,heading,heading_path,heading_anchor,chunk_index,content,metadata) VALUES (?,?,?,?,?,?,?,?,?)',
        [chunk.chunkId, post.id, chunk.contentHash, chunk.heading, chunk.headingPath, chunk.headingAnchor, chunk.chunkIndex, chunk.content, JSON.stringify(metadata)],
      );
    }
    const newIds = new Set(chunks.map((chunk) => chunk.chunkId));
    const stale = [...oldIds].filter((id) => !newIds.has(id));
    if (stale.length) await qdrant.client.delete(qdrant.collection, { wait: true, points: stale });
    await query('UPDATE ai_index_state SET version=version+1 WHERE id=1');
    return { indexed: chunks.length, contentHash: hash(post.content_markdown) };
  }

  async function backfill() {
    const [posts] = await query('SELECT id FROM posts ORDER BY id');
    const summary = { scanned: posts.length, indexed: 0, errors: [] };
    for (const post of posts) {
      try { summary.indexed += Number((await indexPost(post.id)).indexed || 0); } catch (error) { summary.errors.push({ postId: post.id, code: error.code || 'INDEX_FAILED' }); }
    }
    return summary;
  }

  return { loadPost, indexPost, removePost, backfill };
}

function createIndexQueue({ db, config, indexer }) {
  const query = db.promise().query.bind(db.promise());
  let running = false;
  async function processNext() {
    if (running || !config.enabled) return;
    running = true;
    let handledJob = false;
    try {
      const [jobs] = await query("SELECT * FROM ai_index_jobs WHERE status='pending' ORDER BY id LIMIT 1");
      const job = jobs[0];
      if (!job) return;
      handledJob = true;
      await query("UPDATE ai_index_jobs SET status='running',error=NULL WHERE id=?", [job.id]);
      try {
        const result = await indexer.indexPost(job.source_id);
        await query("UPDATE ai_index_jobs SET status='completed',indexed_at=NOW(),error=NULL WHERE id=?", [job.id]);
        return result;
      } catch (error) {
        await query("UPDATE ai_index_jobs SET status='failed',error=? WHERE id=?", [String(error.message || 'Index failed').slice(0, 4000), job.id]);
      }
    } finally {
      running = false;
      if (handledJob) setImmediate(() => { processNext().catch(() => {}); });
    }
  }
  async function enqueue(postId, contentHash = null) {
    if (!config.enabled) return null;
    const [result] = await query('INSERT INTO ai_index_jobs (source_type,source_id,content_hash,embedding_model,status) VALUES (\'post\',?,?,?,\'pending\')', [Number(postId), contentHash, config.embedding.model]);
    setImmediate(() => { processNext().catch(() => {}); });
    return result.insertId;
  }
  async function retryFailed() {
    if (!config.enabled) return 0;
    const [result] = await query("UPDATE ai_index_jobs SET status='pending',error=NULL WHERE status='failed'");
    if (result.affectedRows) setImmediate(() => { processNext().catch(() => {}); });
    return result.affectedRows;
  }
  return { enqueue, processNext, retryFailed };
}

module.exports = { createIndexer, createIndexQueue, parseJson };
