import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import { mountAiRoutes } from '../../api/ai/routes.js'
import { createAiRateLimiter } from '../../api/ai/rate-limit.js'

const secret = 'ai-api-test-secret'
const limits = { inputChars: 8000, selectedTextChars: 4000, outputTokens: 1200, recentMessages: 8, contextChars: 12000, toolResultChars: 6000, toolRounds: 3, guestDaily: 5, userDaily: 50, ipWindow: 20, ipWindowMs: 3600000, concurrentPerSubject: 2, globalDailyRequests: 1000, globalDailyTokens: 500000 }
const config: any = { enabled: true, defaultModel: 'qwen-fast', limits }

function database() {
  const query = async (sql: string) => {
    if (sql.startsWith('SELECT id,email,session_version FROM users')) return [[{ id: 88, email: 'reader@example.test', session_version: 0 }]]
    if (sql.startsWith('SELECT version FROM ai_index_state')) return [[{ version: 1 }]]
    if (sql.includes('FROM ai_usage WHERE')) return [[{ requests: 0, tokens: 0 }]]
    if (sql.startsWith('INSERT INTO ai_usage')) return [{ affectedRows: 1 }]
    return [[]]
  }
  return { promise: () => ({ query }) }
}

function mount(overrides: any = {}) {
  const app = express(); app.use(express.json())
  mountAiRoutes(app, database(), {
    getAuthToken: (req: any) => String(req.headers.authorization || '').replace(/^Bearer\s+/i, '') || null,
    authSecret: secret, config,
    gateway: { models: () => [{ id: 'qwen-fast', label: 'Mock' }] },
    workflow: { run: async ({ onEvent }: any) => { await onEvent({ type: 'tool_start', tool: 'search_articles' }); await onEvent({ type: 'delta', delta: '回复' }); await onEvent({ type: 'tool_end', tool: 'search_articles' }); return { response: { content: '回复', citations: [], degraded: false }, usage: { inputTokens: 2, outputTokens: 1 }, model: { provider: 'mock', model: 'mock' }, decision: { intent: 'DIRECT_CHAT' } } } },
    conversationStore: { list: async () => [], create: async () => ({ id: crypto.randomUUID() }), get: async () => null, context: async () => null, append: async () => null, updateMessage: async () => true, compact: async () => null, rename: async () => null, remove: async () => false },
    memoryStore: { settings: async () => ({ memoryEnabled: false, defaultModel: 'qwen-fast' }), updateSettings: async () => ({}), list: async () => [], save: async () => ({}), remove: async () => false, clear: async () => 0 },
    ...overrides,
  })
  return app
}

describe('AI HTTP boundary', () => {
  it('exposes only a safe AI readiness contract even when AI is disabled', async () => {
    const disabled = await request(mount({ config: { ...config, enabled: false } })).get('/api/ai/status').expect(200)
    expect(disabled.body).toEqual({ state: 'disabled', featureEnabled: false, chatReady: false, ragReady: false, indexReady: false, message: 'AI 功能尚未启用。' })

    const ready = await request(mount({ qdrant: { health: async () => ({ ready: true }) } })).get('/api/ai/status').expect(200)
    expect(ready.body).toEqual({ state: 'ready', featureEnabled: true, chatReady: true, ragReady: true, indexReady: true, message: 'AI 对话和站内检索已就绪。' })
    expect(JSON.stringify(ready.body)).not.toMatch(/key|secret|url|exception/i)
  })

  it('streams ordered SSE events for a guest without persisting a raw guest identifier', async () => {
    const result = await request(mount()).post('/api/ai/chat').send({ message: '你好' }).expect(200)
    expect(result.headers['content-type']).toContain('text/event-stream')
    expect(result.headers['cache-control']).toContain('no-transform')
    expect(result.headers['x-accel-buffering']).toBe('no')
    expect(result.headers['set-cookie'][0]).toContain('HttpOnly')
    expect(result.text.indexOf('event: start')).toBeLessThan(result.text.indexOf('event: delta'))
    expect(result.text.indexOf('event: delta')).toBeLessThan(result.text.indexOf('event: usage'))
    expect(result.text).toContain('event: done')
  })

  it('uses the persistent atomic turn append boundary for an authenticated chat', async () => {
    const id = '11111111-1111-4111-8111-111111111111'
    const appendTurn = vi.fn(async () => ({ userMessageId: 'u', assistantMessageId: 'a' }))
    const conversation = { id, title: '新对话', selectedModel: 'qwen-fast', messages: [] }
    const app = mount({ conversationStore: {
      list: async () => [], create: async () => conversation, get: async () => conversation, context: async () => ({ conversation, summary: '', recent: [] }),
      append: async () => null, appendTurn, updateMessage: async () => true, compact: async () => null, rename: async () => null, remove: async () => false,
    } })
    const token = jwt.sign({ sub: '88', email: 'reader@example.test', sv: 0 }, secret)
    await request(app).post('/api/ai/chat').set('Authorization', `Bearer ${token}`).send({ conversationId: id, message: '同秒写入也必须稳定排序' }).expect(200)
    expect(appendTurn).toHaveBeenCalledOnce()
    expect(appendTurn.mock.calls[0][0]).toBe(88)
    expect(appendTurn.mock.calls[0][1]).toBe(id)
    expect(appendTurn.mock.calls[0][2]).toMatchObject({ role: 'user', content: '同秒写入也必须稳定排序' })
    expect(appendTurn.mock.calls[0][3]).toMatchObject({ role: 'assistant', status: 'streaming' })
  })

  it('assigns and streams a concise automatic title for the first real user prompt', async () => {
    const id = '11111111-1111-4111-8111-111111111111'
    const setAutomaticTitle = vi.fn(async () => true)
    const conversation = { id, title: '新对话', titleSource: 'auto', selectedModel: 'qwen-fast', messages: [] }
    const app = mount({ conversationStore: {
      list: async () => [], create: async () => conversation, get: async () => conversation, context: async () => ({ conversation, summary: '', recent: [] }),
      append: async () => null, appendTurn: async () => ({}), setAutomaticTitle, updateMessage: async () => true, compact: async () => null, rename: async () => null, remove: async () => false,
    } })
    const token = jwt.sign({ sub: '88', email: 'reader@example.test', sv: 0 }, secret)
    const result = await request(app).post('/api/ai/chat').set('Authorization', `Bearer ${token}`).send({ conversationId: id, message: 'C#主要是用于什么领域？' }).expect(200)
    expect(setAutomaticTitle).toHaveBeenCalledWith(88, id, 'C# 主要应用领域')
    expect(result.text).toContain('"title":"C# 主要应用领域"')
  })

  it('never overwrites a manually named conversation while sending its first prompt', async () => {
    const id = '11111111-1111-4111-8111-111111111111'
    const setAutomaticTitle = vi.fn(async () => true)
    const conversation = { id, title: '我的手动标题', titleSource: 'manual', selectedModel: 'qwen-fast', messages: [] }
    const app = mount({ conversationStore: {
      list: async () => [], create: async () => conversation, get: async () => conversation, context: async () => ({ conversation, summary: '', recent: [] }),
      append: async () => null, appendTurn: async () => ({}), setAutomaticTitle, updateMessage: async () => true, compact: async () => null, rename: async () => null, remove: async () => false,
    } })
    const token = jwt.sign({ sub: '88', email: 'reader@example.test', sv: 0 }, secret)
    const result = await request(app).post('/api/ai/chat').set('Authorization', `Bearer ${token}`).send({ conversationId: id, message: '请根据这段很长的问题生成一个标题，但不能覆盖已有手动标题。' }).expect(200)
    expect(setAutomaticTitle).not.toHaveBeenCalled()
    expect(result.text).not.toContain('event: title')
  })

  it('sends a completed safe workflow response as a delta when no model stream exists', async () => {
    const app = mount({ workflow: { run: async () => ({
      response: { content: '没有足够可信的站内资料，因此不会猜测。', citations: [], degraded: false },
      usage: { inputTokens: 0, outputTokens: 0 }, model: null, decision: { intent: 'SITE_QA' },
    }) } })
    const result = await request(app).post('/api/ai/chat').send({ message: '站内有这个答案吗？' }).expect(200)
    expect(result.text).toContain('event: delta')
    expect(result.text).toContain('没有足够可信的站内资料，因此不会猜测。')
    expect(result.text.indexOf('event: delta')).toBeLessThan(result.text.indexOf('event: done'))
  })

  it('checks conversation ownership through the authenticated user rather than a supplied user id', async () => {
    const get = vi.fn(async (userId: number) => userId === 88 ? null : { id: 'unexpected' })
    const app = mount({ conversationStore: { get, list: async () => [], create: async () => ({}), context: async () => null, append: async () => null, updateMessage: async () => true, compact: async () => null, rename: async () => null, remove: async () => false } })
    const token = jwt.sign({ sub: '88', email: 'reader@example.test', sv: 0 }, secret)
    await request(app).get('/api/ai/conversations/11111111-1111-4111-8111-111111111111').set('Authorization', `Bearer ${token}`).expect(404)
    expect(get).toHaveBeenCalledWith(88, '11111111-1111-4111-8111-111111111111')
  })

  it('maps bounded quick actions server-side and streams only product status values', async () => {
    let received: any = null
    const app = mount({ workflow: { run: async ({ onEvent, ...input }: any) => {
      received = input
      await onEvent({ type: 'status', status: 'retrieving' })
      await onEvent({ type: 'status', status: 'internal_trace' })
      await onEvent({ type: 'delta', delta: '回复' })
      return { response: { content: '回复', citations: [], degraded: false }, usage: { inputTokens: 2, outputTokens: 1 }, model: { provider: 'mock', model: 'mock' }, decision: { intent: 'RELATED_CONTENT' } }
    } } })
    const result = await request(app).post('/api/ai/chat').send({ quickAction: 'related_content', pageContext: { articleId: 9 } }).expect(200)
    expect(received.quickAction).toBe('related_content')
    expect(received.message).toBe('请推荐与当前文章相关的站内文章。')
    expect(result.text).toContain('event: status')
    expect(result.text).toContain('"retrieving"')
    expect(result.text).not.toContain('internal_trace')

    const invalid = await request(app).post('/api/ai/chat').send({ quickAction: 'delete_everything' }).expect(400)
    expect(invalid.body.error.code).toBe('INVALID_REQUEST')
    const missingSelection = await request(app).post('/api/ai/chat').send({ quickAction: 'selection_explain', pageContext: { articleId: 9 } }).expect(400)
    expect(missingSelection.body.error.code).toBe('QUICK_ACTION_SELECTION_REQUIRED')
  })

  it('persists selected models only within the authenticated user or matching guest session', async () => {
    const update = vi.fn(async () => true)
    const token = jwt.sign({ sub: '88', email: 'reader@example.test', sv: 0 }, secret)
    const app = mount({ conversationStore: { update, list: async () => [], create: async () => ({}), get: async () => null, context: async () => null, append: async () => null, updateMessage: async () => true, compact: async () => null, rename: async () => null, remove: async () => false } })
    const id = '11111111-1111-4111-8111-111111111111'
    await request(app).patch(`/api/ai/conversations/${id}`).set('Authorization', `Bearer ${token}`).send({ selectedModel: 'qwen-fast' }).expect(200)
    expect(update).toHaveBeenCalledWith(88, id, { selectedModel: 'qwen-fast' })

    const created = await request(app).post('/api/ai/conversations').send({ modelId: 'qwen-fast' }).expect(201)
    const cookie = created.headers['set-cookie'][0]
    await request(app).patch(`/api/ai/conversations/${created.body.conversation.id}`).set('Cookie', cookie).send({ selectedModel: 'qwen-fast' }).expect(200)
    const guest = await request(app).get(`/api/ai/conversations/${created.body.conversation.id}`).set('Cookie', cookie).expect(200)
    expect(guest.body.conversation.selectedModel).toBe('qwen-fast')
  })

  it('enforces daily quota and per-subject concurrency before generation starts', async () => {
    let calls = 0
    const limiter = createAiRateLimiter({ db: { promise: () => ({ query: async (sql: string) => {
      if (sql.includes('FROM ai_usage WHERE')) return [[{ requests: calls++, tokens: 0 }]]
      return [[{ requests: 0, tokens: 0 }]]
    } }) }, config: { limits: { ...limits, userDaily: 1, concurrentPerSubject: 1 } } })
    await expect(limiter.begin({ userId: 5 }, '127.0.0.1')).resolves.toEqual(expect.any(Function))
    await expect(limiter.begin({ userId: 5 }, '127.0.0.1')).rejects.toMatchObject({ code: 'CONCURRENCY_LIMITED' })
    const quota = createAiRateLimiter({ db: { promise: () => ({ query: async (sql: string) => sql.includes('user_id=?') ? [[{ requests: 1, tokens: 0 }]] : [[{ requests: 0, tokens: 0 }]] }) }, config: { limits: { ...limits, userDaily: 1 } } })
    await expect(quota.begin({ userId: 9 }, '127.0.0.2')).rejects.toMatchObject({ code: 'QUOTA_EXCEEDED' })
  })

  it('reserves database quota atomically before generation and settles that reservation by request id', async () => {
    const queries: Array<{ sql: string, args?: unknown[] }> = []
    const connection: any = {
      beginTransaction: vi.fn(async () => {}), commit: vi.fn(async () => {}), rollback: vi.fn(async () => {}), release: vi.fn(),
      query: vi.fn(async (sql: string, args?: unknown[]) => {
        queries.push({ sql, args })
        if (sql.includes('GET_LOCK')) return [[{ acquired: 1 }]]
        if (sql.includes('SELECT COUNT')) return [[{ requests: 0, tokens: 0 }]]
        return [{ affectedRows: 1 }]
      }),
    }
    const limiter = createAiRateLimiter({ db: { promise: () => ({ getConnection: async () => connection, query: connection.query }) }, config: { limits } })
    const release = await limiter.begin({ userId: 21 }, '127.0.0.1', '11111111-1111-4111-8111-111111111111')
    await limiter.record({ requestId: '11111111-1111-4111-8111-111111111111', subject: { userId: 21 }, inputTokens: 4, outputTokens: 8, latencyMs: 3, status: 'complete' })
    await release()
    expect(connection.beginTransaction).toHaveBeenCalledOnce()
    expect(queries.some(({ sql, args }) => sql.startsWith('INSERT INTO ai_usage') && args?.includes('reserved'))).toBe(true)
    expect(queries.some(({ sql }) => sql.startsWith('UPDATE ai_usage SET'))).toBe(true)
    expect(queries.some(({ sql }) => sql.includes('RELEASE_LOCK'))).toBe(true)
    expect(queries.some(({ sql }) => sql.startsWith('DELETE FROM ai_usage'))).toBe(true)
  })
})
