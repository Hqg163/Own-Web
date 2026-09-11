import { describe, expect, it, vi } from 'vitest'
import { canAccessPost } from '../../api/lib/post-access.js'
import { createSkillRegistry } from '../../api/ai/agent/skills.js'
import { createRetriever } from '../../api/ai/retrieval/retriever.js'
import { deterministicEmbedding } from '../../api/ai/providers/embedding-provider.js'
import { createMemoryStore } from '../../api/ai/agent/memory-store.js'
import { createSystemPrompt } from '../../api/ai/agent/system-prompt.js'
import { createMockChatProvider } from '../../api/ai/providers/chat-provider.js'

const limits = { toolResultChars: 6000, selectedTextChars: 4000, toolRounds: 3, recentMessages: 8, contextChars: 12000, outputTokens: 1200 }
const privatePost = { id: 91, author_id: 7, status: 'draft', visibility: 'private', content_markdown: '只允许作者读取的内容' }

describe('AI security boundaries', () => {
  it('does not grant private, follower-only, or unlisted post access from browser-provided context', async () => {
    const query = vi.fn(async () => [[]])
    await expect(canAccessPost(query as any, privatePost, null, null)).resolves.toBe(false)
    await expect(canAccessPost(query as any, { ...privatePost, status: 'published', visibility: 'followers' }, null, null)).resolves.toBe(false)
    const unlisted = { ...privatePost, status: 'published', visibility: 'unlisted', share_token: 'share-token' }
    await expect(canAccessPost(query as any, unlisted, { id: 3 }, 'wrong-token')).resolves.toBe(false)
    await expect(canAccessPost(query as any, unlisted, { id: 3 }, 'share-token')).resolves.toBe(true)
  })

  it('hydrates Qdrant candidates and removes private content before reranking or citation output', async () => {
    const rerank = vi.fn(async (_question: string, candidates: unknown[]) => candidates)
    const query = async (sql: string) => {
      if (sql.startsWith('SELECT version FROM ai_index_state')) return [[{ version: 1 }]]
      if (sql.includes('FROM ai_index_chunks c JOIN posts p')) return [[{
        chunk_id: 'private-point', post_id: 91, content: privatePost.content_markdown, heading: '', heading_path: '', heading_anchor: '',
        author_id: 7, status: 'draft', visibility: 'private', share_token: null, title: '私密文章', slug: 'private', published_at: null, updated_at: null,
      }]]
      return [[]]
    }
    const retriever = createRetriever({
      db: { promise: () => ({ query }) }, config: { confidence: {}, cache: {} },
      qdrant: { collection: 'fixture', client: { query: async () => ({ points: [{ id: 'private-point', score: 0.99 }] }) } },
      embeddingProvider: { embed: async () => [deterministicEmbedding('question', 1024)] }, rerankerProvider: { rerank },
      retrievalCache: { get: () => undefined, set: () => undefined },
    })
    const result = await retriever.retrieve('私密文章是什么？', null, {})
    expect(rerank).toHaveBeenCalledWith('私密文章是什么？', [])
    expect(result.candidates).toEqual([])
    expect(result.citations).toEqual([])
  })

  it('rejects arbitrary tool names and rechecks post permissions inside registered read-only skills', async () => {
    const query = vi.fn(async (sql: string) => sql.startsWith('SELECT * FROM posts WHERE id=?') ? [[privatePost]] : [[]])
    const skills = createSkillRegistry({ db: { promise: () => ({ query }) }, config: { limits } })
    await expect(skills.invoke('run_sql', { sql: 'DROP TABLE posts' }, { user: null })).rejects.toMatchObject({ code: 'TOOL_NOT_ALLOWED' })
    await expect(skills.invoke('get_article', { postId: 91 }, { user: null, shareToken: null })).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('binds all permanent Memory reads and writes to the authenticated user id', async () => {
    const calls: Array<{ sql: string, args: unknown[] }> = []
    const memory = createMemoryStore({ db: { promise: () => ({ query: async (sql: string, args: unknown[] = []) => {
      calls.push({ sql, args })
      if (sql.startsWith('SELECT id,memory_key')) return [[]]
      if (sql.startsWith('SELECT memory_enabled')) return [[{ memory_enabled: true, default_model: 'qwen-fast' }]]
      return [{ affectedRows: 1 }]
    } }) } })
    await memory.list(41)
    await memory.save(41, { key: '语言', value: '中文' })
    await memory.remove(41, '11111111-1111-4111-8111-111111111111')
    expect(calls.filter((call) => call.sql.includes('ai_memories')).every((call) => call.args.includes(41))).toBe(true)
    expect(calls.some((call) => call.args.includes(42))).toBe(false)
  })

  it('keeps prompt-injection, secret, and hidden-reasoning protections in the system contract', () => {
    const prompt = createSystemPrompt()
    expect(prompt).toContain('不可信数据')
    expect(prompt).toContain('不得编造来源')
    expect(prompt).toContain('密钥、Cookie')
    expect(prompt).toContain('不要披露内部推理过程')
  })

  it('honors an upstream abort signal before emitting Mock provider content', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(createMockChatProvider().stream({ mockResponse: '不应输出' }, { signal: controller.signal })).rejects.toMatchObject({ code: 'ABORTED' })
  })
})
