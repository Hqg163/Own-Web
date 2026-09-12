import { describe, expect, it } from 'vitest'
import { createChunks, parseSections } from '../../api/ai/retrieval/chunker.js'
import { createHeadingId } from '../../api/ai/retrieval/heading.js'
import { evaluateConfidence } from '../../api/ai/retrieval/confidence.js'
import { deterministicEmbedding } from '../../api/ai/providers/embedding-provider.js'
import { createIndexer, createIndexQueue, normalizeAction } from '../../api/ai/retrieval/indexer.js'
import { createRetriever, hasLexicalSupport, selectSupportedCandidates } from '../../api/ai/retrieval/retriever.js'
import { createArticleDocument } from '../../api/ai/retrieval/article-document.js'
import { createArticleDiscovery } from '../../api/ai/retrieval/article-discovery.js'
import { createRetrievalQueries } from '../../api/ai/retrieval/query-rewriter.js'

describe('AI RAG document preparation', () => {
  it('uses the same stable heading anchor contract as the article renderer', () => {
    const used = new Set<string>()
    expect(createHeadingId('公式 $\\theta_{t+1}$：推导', used, 1)).toBe('公式-theta-t-1-推导')
    expect(createHeadingId('公式 $\\theta_{t+1}$：推导', used, 2)).toBe('公式-theta-t-1-推导-2')
  })

  it('keeps fenced code and display math intact without emitting an overlap-only duplicate', () => {
    const markdown = [
      '# RAG 设计', '',
      '第一段 ' + '内容 '.repeat(160), '',
      '```mermaid', 'flowchart TD', 'A-->B', '```', '',
      '$$', 'E = mc^2', '$$', '',
      '第二段 ' + '说明 '.repeat(160),
    ].join('\n')
    const chunks = createChunks({ id: 42, content_markdown: markdown }, { targetTokens: 120, maxTokens: 180, overlapTokens: 30 })
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((chunk) => chunk.tokenEstimate <= 180 || chunk.content.includes('```mermaid'))).toBe(true)
    expect(chunks.filter((chunk) => chunk.content.includes('```mermaid'))).toHaveLength(1)
    expect(chunks.filter((chunk) => chunk.content.includes('E = mc^2'))).toHaveLength(1)
    expect(new Set(chunks.map((chunk) => chunk.chunkId)).size).toBe(chunks.length)
    expect(chunks.map((chunk) => chunk.content)).toEqual(expect.arrayContaining([expect.stringContaining('# RAG 设计')]))
  })

  it('keeps section paths and chunk IDs deterministic across re-indexing', () => {
    const post = { id: 8, content_markdown: '# 介绍\n\n正文\n\n## 细节\n\n更多正文' }
    const first = createChunks(post)
    const second = createChunks(post)
    expect(parseSections(post.content_markdown)[1]).toMatchObject({ headingPath: '介绍 → 细节', headingAnchor: '细节' })
    expect(first.map((chunk) => chunk.chunkId)).toEqual(second.map((chunk) => chunk.chunkId))
  })

  it('uses a deterministic normalized 1024-dimensional mock embedding', () => {
    const first = deterministicEmbedding('Own-Web RAG 检索', 1024)
    expect(first).toHaveLength(1024)
    expect(first).toEqual(deterministicEmbedding('Own-Web RAG 检索', 1024))
    expect(Math.hypot(...first)).toBeCloseTo(1, 10)
  })

  it('builds one stable whole-article discovery document without changing chunk evidence', () => {
    const post = { id: 18, title: 'YOLOv8 跟踪', excerpt: '检测与 DeepSORT', content_markdown: '# 介绍\n\nYOLOv8\n\n## Kalman Filter\n\n轨迹预测', categories: [{ name: '视觉', slug: 'vision' }], tags: [{ name: 'DeepSORT', slug: 'deepsort' }], series_name: 'CV' }
    const first = createArticleDocument(post)
    expect(first).toEqual(createArticleDocument(post))
    expect(first.content).toContain('章节：介绍；介绍 → Kalman Filter')
    expect(first.content).toContain('DeepSORT')
  })

  it('keeps semantic query rewrite bounded and contextualized by authorized selection only', () => {
    const queries = createRetrievalQueries('帮我找目标检测相关文章', { selectedText: 'DeepSORT 使用 Kalman Filter' })
    expect(queries).toHaveLength(3)
    expect(queries[0]).toBe('帮我找目标检测相关文章')
    expect(queries.at(-1)).toContain('DeepSORT')
  })

  it('marks absent or weak evidence as low confidence', () => {
    expect(evaluateConfidence([])).toMatchObject({ level: 'LOW', reason: 'no_evidence' })
    expect(evaluateConfidence([{ postId: 1, score: 0.1 }])).toMatchObject({ level: 'LOW', reason: 'weak_evidence' })
    expect(evaluateConfidence([{ postId: 1, score: 0.8 }, { postId: 2, score: 0.5 }])).toMatchObject({ level: 'HIGH' })
  })

  it('does not present weak cross-article candidates as evidence', () => {
    const candidates = selectSupportedCandidates([
      { chunkId: 'strong', rerankScore: 0.9 },
      { chunkId: 'supported', rerankScore: 0.5 },
      { chunkId: 'weak', rerankScore: 0.31 },
      { chunkId: 'selection', rerankScore: 0.1, selectionEvidence: true },
    ], { minEvidenceScore: 0.4 })
    expect(candidates.map((item) => item.chunkId)).toEqual(['strong', 'supported', 'selection'])
    expect(selectSupportedCandidates([{ chunkId: 'weak', rerankScore: 0.31 }], { minEvidenceScore: 0.4 })).toEqual([])
  })

  it('requires a meaningful multilingual term overlap before site-wide evidence is presented', () => {
    const vueEvidence = [{ title: 'Vue 调度', heading: '批量写入', content: '多个同步写入会在队列中合并，并在微任务中渲染。' }]
    expect(hasLexicalSupport('Vue 的同步写入为什么会合并渲染？', vueEvidence)).toBe(true)
    expect(hasLexicalSupport('站内文章有没有给出量子计算芯片的价格？', vueEvidence)).toBe(false)
  })

  it('upserts fresh hybrid points before removing obsolete point IDs', async () => {
    const calls: Array<{ sql: string, params?: unknown[] }> = []
    const post = { id: 7, author_id: 3, title: '索引', slug: 'index', status: 'published', visibility: 'public', content_markdown: '# 索引\n\n可检索正文', published_at: null, updated_at: null }
    const query = async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params })
      if (sql.startsWith('SELECT * FROM posts')) return [[post]]
      if (sql.includes('FROM post_categories') || sql.includes('FROM post_tags')) return [[]]
      if (sql.startsWith('SELECT chunk_id FROM ai_index_chunks')) return [[{ chunk_id: 'obsolete-point' }]]
      return [{ affectedRows: 1 }]
    }
    const qdrantCalls: Array<{ kind: string, body?: unknown }> = []
    const indexer = createIndexer({
      db: { promise: () => ({ query }) },
      config: { enabled: true, embedding: { model: 'mock', dimensions: 1024 } },
      qdrant: { collection: 'fixture', ensureCollection: async () => undefined, client: {
        upsert: async (_collection: string, body: unknown) => qdrantCalls.push({ kind: 'upsert', body }),
        delete: async (_collection: string, body: unknown) => qdrantCalls.push({ kind: 'delete', body }),
      } },
      embeddingProvider: { embed: async (texts: string[]) => texts.map(() => deterministicEmbedding('fixture', 1024)) },
    })
    await indexer.indexPost(7)
    expect(qdrantCalls.map((call) => call.kind)).toEqual(['upsert', 'delete'])
    const firstPoint: any = (qdrantCalls[0].body as any).points[0]
    expect(firstPoint.vector.dense).toHaveLength(1024)
    expect(firstPoint.vector.bm25.options).toEqual({ tokenizer: 'multilingual', stemmer: { type: 'none' }, stopwords: {} })
    expect(qdrantCalls[1].body).toMatchObject({ points: ['obsolete-point'] })
    expect(calls.some((call) => call.sql.startsWith('INSERT INTO ai_index_chunks'))).toBe(true)
  })

  it('uses hybrid RRF, rehydrates content from MySQL, and degrades safely when reranking fails', async () => {
    const markdown = '# 资料\n\n授权的站内证据'
    const chunk = createChunks({ id: 5, content_markdown: markdown })[0]!
    const query = async (sql: string) => {
      if (sql.startsWith('SELECT version FROM ai_index_state')) return [[{ version: 4 }]]
      if (sql.includes('FROM ai_index_chunks c JOIN posts p')) return [[{
        chunk_id: chunk.chunkId, post_id: 5, content: chunk.content, content_hash: chunk.contentHash, heading: '资料', heading_path: '资料', heading_anchor: '资料',
        author_id: 2, status: 'published', visibility: 'public', share_token: null, title: '文章', slug: 'post', published_at: null, updated_at: null, content_markdown: markdown,
      }]]
      throw new Error(`Unexpected query: ${sql}`)
    }
    let qdrantBody: any
    const retriever = createRetriever({
      db: { promise: () => ({ query }) },
      config: { confidence: {}, cache: {} },
      qdrant: { collection: 'fixture', client: { query: async (_collection: string, body: unknown) => { qdrantBody = body; return { points: [{ id: chunk.chunkId, score: 0.7, payload: { content_hash: chunk.contentHash } }] } } } },
      embeddingProvider: { embed: async () => [deterministicEmbedding('question', 1024)] },
      rerankerProvider: { rerank: async () => { throw new Error('reranker down') } },
      retrievalCache: { get: () => undefined, set: () => undefined },
    })
    const result = await retriever.retrieve('授权的站内证据是什么？', null, {})
    expect(qdrantBody.prefetch).toHaveLength(2)
    expect(qdrantBody.prefetch[1].query.options).toEqual({ tokenizer: 'multilingual', stemmer: { type: 'none' }, stopwords: {} })
    expect(qdrantBody.query).toEqual({ rrf: { k: 60 } })
    expect(result.degraded).toBe(true)
    expect(result.citations[0]).toMatchObject({ slug: 'post' })
    expect(result.citations[0].excerpt).toContain('授权的站内证据')
  })

  it('runs each exact retrieval access branch as a valid top-level Qdrant filter', async () => {
    const query = async (sql: string) => {
      if (sql.startsWith('SELECT version FROM ai_index_state')) return [[{ version: 4 }]]
      if (sql.startsWith('SELECT following_id FROM follows')) return [[{ following_id: 9 }]]
      throw new Error(`Unexpected query: ${sql}`)
    }
    const qdrantBodies: any[] = []
    const retriever = createRetriever({
      db: { promise: () => ({ query }) }, config: { confidence: {}, cache: {} },
      qdrant: { collection: 'fixture', client: { query: async (_collection: string, body: unknown) => { qdrantBodies.push(body); return { points: [] } } } },
      embeddingProvider: { embed: async () => [deterministicEmbedding('scope', 1024)] },
      rerankerProvider: { rerank: async () => [] }, retrievalCache: { get: () => undefined, set: () => undefined },
    })
    await retriever.retrieve('范围', { id: 2 }, {})
    expect(qdrantBodies).toHaveLength(3)
    expect(qdrantBodies[0].prefetch[0].filter).toEqual({ must: [{ key: 'status', match: { value: 'published' } }, { key: 'visibility', match: { value: 'public' } }, { key: 'source_type', match: { any: ['post', 'chunk'] } }] })
    expect(qdrantBodies[1].prefetch[0].filter).toEqual({ must: [{ key: 'author_id', match: { value: 2 } }, { key: 'source_type', match: { any: ['post', 'chunk'] } }] })
    expect(qdrantBodies[2].prefetch[0].filter).toEqual({ must: [{ key: 'status', match: { value: 'published' } }, { key: 'visibility', match: { value: 'followers' } }, { key: 'author_id', match: { any: [9] } }, { key: 'source_type', match: { any: ['post', 'chunk'] } }] })
  })

  it('removes recorded tombstones and the server-owned post filter before clearing index state', async () => {
    const qdrantCalls: Array<any> = []
    const query = async (sql: string) => {
      if (sql.startsWith('SELECT chunk_id FROM ai_index_chunks')) return [[{ chunk_id: 'stored-point' }]]
      if (sql.startsWith('SELECT chunk_id FROM ai_index_tombstones')) return [[{ chunk_id: 'tombstone-point' }]]
      if (sql.startsWith('SELECT point_id FROM ai_article_index')) return [[]]
      return [{ affectedRows: 1 }]
    }
    const indexer = createIndexer({
      db: { promise: () => ({ query }) }, config: { enabled: true, embedding: { dimensions: 1024 } },
      qdrant: { collection: 'fixture', client: { delete: async (_collection: string, body: unknown) => qdrantCalls.push(body) } },
      embeddingProvider: { embed: async () => [] },
    })
    await expect(indexer.removePost(9)).resolves.toEqual({ deleted: 2 })
    expect(qdrantCalls[0]).toMatchObject({ points: expect.arrayContaining(['stored-point', 'tombstone-point']) })
    expect(qdrantCalls[1]).toEqual({ wait: true, filter: { must: [{ key: 'post_id', match: { value: 9 } }] } })
  })

  it('prunes only orphaned post points after a backfill and preserves other source types', async () => {
    const qdrantCalls: Array<any> = []
    const query = async (sql: string) => {
      if (sql === 'SELECT chunk_id FROM ai_index_chunks') return [[{ chunk_id: 'current-post-point' }]]
      if (sql === 'SELECT point_id FROM ai_article_index') return [[]]
      throw new Error(`Unexpected query: ${sql}`)
    }
    const indexer = createIndexer({
      db: { promise: () => ({ query }) }, config: { enabled: true, embedding: { dimensions: 1024 } },
      qdrant: { collection: 'fixture', client: {
        scroll: async () => ({ points: [
          { id: 'current-post-point', payload: { source_type: 'post' } },
          { id: 'orphaned-post-point', payload: { source_type: 'post' } },
          { id: 'other-source-point', payload: { source_type: 'project' } },
        ], next_page_offset: null }),
        delete: async (_collection: string, body: unknown) => qdrantCalls.push(body),
      } },
      embeddingProvider: { embed: async () => [] },
    })
    await expect(indexer.pruneOrphanedPostPoints()).resolves.toBe(1)
    expect(qdrantCalls).toEqual([{ wait: true, points: ['orphaned-post-point'] }])
  })

  it('queries only article discovery points, rechecks authorization and excludes the seed article', async () => {
    const post = { id: 6, author_id: 2, title: 'DeepSORT 实践', slug: 'deepsort', excerpt: '目标检测跟踪', status: 'published', visibility: 'public', content_markdown: '# DeepSORT\n\nKalman Filter', categories: [], tags: [], series_name: null }
    const document = createArticleDocument(post)
    const query = async (sql: string) => {
      if (sql.startsWith('SELECT version FROM ai_index_state')) return [[{ version: 7 }]]
      if (sql.includes('FROM ai_article_index a')) return [[{ ...post, point_id: document.pointId, content_hash: document.contentHash, discovery_content: document.content }]]
      if (sql.includes('FROM post_categories') || sql.includes('FROM post_tags')) return [[]]
      throw new Error(`Unexpected article discovery query: ${sql}`)
    }
    let body: any
    const discovery = createArticleDiscovery({
      db: { promise: () => ({ query }) }, config: { cache: {} },
      qdrant: { collection: 'fixture', client: { query: async (_collection: string, value: any) => { body = value; return { points: [{ id: document.pointId, score: 0.8, payload: { content_hash: document.contentHash } }] } } }, bm25: undefined },
      embeddingProvider: { embed: async () => [deterministicEmbedding('DeepSORT', 1024)] }, rerankerProvider: { rerank: async (_q: string, items: any[]) => items.map((item) => ({ ...item, rerankScore: 0.9 })) }, retrievalCache: { get: () => undefined, set: () => undefined },
    })
    const result = await discovery.discover('DeepSORT', null, {}, { limit: 5 })
    expect(body.prefetch[0].filter.must.at(-1)).toEqual({ key: 'source_type', match: { value: 'article' } })
    expect(result.citations[0]).toMatchObject({ title: 'DeepSORT 实践', slug: 'deepsort' })
    expect((await discovery.discover('DeepSORT', null, {}, { limit: 5, excludePostId: 6 })).items).toEqual([])
  })

  it('coalesces a post action and claims it with a lease before the worker runs it', async () => {
    const jobs: Array<any> = []
    const query = async (sql: string, params: any[] = []) => {
      if (sql.startsWith('SELECT GET_LOCK')) return [[{ acquired: 1 }]]
      if (sql.startsWith('SELECT RELEASE_LOCK')) return [[{ released: 1 }]]
      if (sql.startsWith('SELECT id FROM ai_index_jobs')) return [jobs.filter((job) => job.source_id === params[0] && job.action === params[1] && ['pending', 'running'].includes(job.status)).slice(-1)]
      if (sql.startsWith('INSERT INTO ai_index_jobs')) {
        const job = { id: jobs.length + 1, source_id: params[0], action: params[1], status: 'pending', attempts: 0 }
        jobs.push(job)
        return [{ insertId: job.id }]
      }
      if (sql.startsWith('UPDATE ai_index_jobs SET content_hash')) return [{ affectedRows: 1 }]
      if (sql.startsWith("UPDATE ai_index_jobs SET status='pending'")) return [{ affectedRows: 0 }]
      if (sql.startsWith("SELECT * FROM ai_index_jobs WHERE status='pending'")) return [jobs.filter((job) => job.status === 'pending').slice(0, 1)]
      if (sql.startsWith("UPDATE ai_index_jobs SET status='running'")) {
        const job = jobs.find((item) => item.id === params[2] && item.status === 'pending')
        if (!job) return [{ affectedRows: 0 }]
        job.status = 'running'; job.lease_token = params[0]; job.attempts += 1
        return [{ affectedRows: 1 }]
      }
      if (sql.startsWith("UPDATE ai_index_jobs SET status='completed'")) {
        const job = jobs.find((item) => item.id === params[0] && item.lease_token === params[1])
        if (job) job.status = 'completed'
        return [{ affectedRows: job ? 1 : 0 }]
      }
      throw new Error(`Unexpected queue query: ${sql}`)
    }
    const indexed: number[] = []
    const queue = createIndexQueue({
      db: { promise: () => ({ query }) }, config: { enabled: true, embedding: { model: 'fixture' } },
      indexer: { indexPost: async (postId: number) => { indexed.push(postId); return { indexed: 1 } }, removePost: async () => ({ deleted: 0 }) },
    })
    await queue.enqueue(12)
    await queue.enqueue(12)
    expect(jobs).toHaveLength(1)
    expect(await queue.drain()).toBe(1)
    expect(jobs[0]).toMatchObject({ status: 'completed', attempts: 1 })
    expect(indexed).toEqual([12])
    expect(normalizeAction('not-allowed')).toBe('upsert')
  })

  it('uses server-authorized selection neighbors as current-article evidence and caps one article at three chunks', async () => {
    const markdown = `# 选区主题\n\n${'解释 '.repeat(900)}`
    const chunks = createChunks({ id: 5, content_markdown: markdown })
    expect(chunks.length).toBeGreaterThanOrEqual(2)
    const rows = chunks.map((chunk) => ({
      chunk_id: chunk.chunkId, post_id: 5, content: chunk.content, content_hash: chunk.contentHash, heading: chunk.heading,
      heading_path: chunk.headingPath, heading_anchor: chunk.headingAnchor, chunk_index: chunk.chunkIndex,
      author_id: 2, status: 'published', visibility: 'public', share_token: null, title: '文章', slug: 'post', published_at: null, updated_at: null, content_markdown: markdown,
    }))
    const query = async (sql: string) => {
      if (sql.startsWith('SELECT version FROM ai_index_state')) return [[{ version: 4 }]]
      if (sql.startsWith('SELECT * FROM posts WHERE id = ?')) return [[rows[0]]]
      if (sql.includes('WHERE c.chunk_id IN')) return [[]]
      if (sql.includes('WHERE c.post_id=? ORDER BY c.chunk_index')) return [rows]
      throw new Error(`Unexpected selection query: ${sql}`)
    }
    const retriever = createRetriever({
      db: { promise: () => ({ query }) }, config: { confidence: {}, cache: {} },
      qdrant: { collection: 'fixture', client: { query: async () => ({ points: [] }) } },
      embeddingProvider: { embed: async () => [deterministicEmbedding('选区', 1024)] },
      rerankerProvider: { rerank: async () => [] }, retrievalCache: { get: () => undefined, set: () => undefined },
    })
    const selected = chunks[Math.floor(chunks.length / 2)]
    const result = await retriever.retrieve('解释这里', null, { articleId: 5, selectedText: selected.content.slice(-100), heading: '选区主题', anchor: selected.headingAnchor })
    expect(result.candidates).toHaveLength(Math.min(3, chunks.length))
    expect(result.candidates.every((candidate) => candidate.postId === 5 && candidate.selectionEvidence)).toBe(true)
    expect(result.confidence.level).not.toBe('LOW')
  })
})
