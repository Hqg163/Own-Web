import { describe, expect, it } from 'vitest'
import { createChunks, parseSections } from '../../api/ai/retrieval/chunker.js'
import { createHeadingId } from '../../api/ai/retrieval/heading.js'
import { evaluateConfidence } from '../../api/ai/retrieval/confidence.js'
import { deterministicEmbedding } from '../../api/ai/providers/embedding-provider.js'
import { createIndexer } from '../../api/ai/retrieval/indexer.js'
import { createRetriever } from '../../api/ai/retrieval/retriever.js'

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

  it('marks absent or weak evidence as low confidence', () => {
    expect(evaluateConfidence([])).toMatchObject({ level: 'LOW', reason: 'no_evidence' })
    expect(evaluateConfidence([{ postId: 1, score: 0.1 }])).toMatchObject({ level: 'LOW', reason: 'weak_evidence' })
    expect(evaluateConfidence([{ postId: 1, score: 0.8 }, { postId: 2, score: 0.5 }])).toMatchObject({ level: 'HIGH' })
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
    const result = await retriever.retrieve('问题', null, {})
    expect(qdrantBody.prefetch).toHaveLength(2)
    expect(qdrantBody.prefetch[1].query.options).toEqual({ tokenizer: 'multilingual', stemmer: { type: 'none' }, stopwords: {} })
    expect(qdrantBody.query).toEqual({ rrf: { k: 60 } })
    expect(result.degraded).toBe(true)
    expect(result.citations[0]).toMatchObject({ slug: 'post' })
    expect(result.citations[0].excerpt).toContain('授权的站内证据')
  })
})
