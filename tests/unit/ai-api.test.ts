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
  it('streams ordered SSE events for a guest without persisting a raw guest identifier', async () => {
    const result = await request(mount()).post('/api/ai/chat').send({ message: '你好' }).expect(200)
    expect(result.headers['content-type']).toContain('text/event-stream')
    expect(result.headers['set-cookie'][0]).toContain('HttpOnly')
    expect(result.text.indexOf('event: start')).toBeLessThan(result.text.indexOf('event: delta'))
    expect(result.text.indexOf('event: delta')).toBeLessThan(result.text.indexOf('event: usage'))
    expect(result.text).toContain('event: done')
  })

  it('checks conversation ownership through the authenticated user rather than a supplied user id', async () => {
    const get = vi.fn(async (userId: number) => userId === 88 ? null : { id: 'unexpected' })
    const app = mount({ conversationStore: { get, list: async () => [], create: async () => ({}), context: async () => null, append: async () => null, updateMessage: async () => true, compact: async () => null, rename: async () => null, remove: async () => false } })
    const token = jwt.sign({ sub: '88', email: 'reader@example.test', sv: 0 }, secret)
    await request(app).get('/api/ai/conversations/11111111-1111-4111-8111-111111111111').set('Authorization', `Bearer ${token}`).expect(404)
    expect(get).toHaveBeenCalledWith(88, '11111111-1111-4111-8111-111111111111')
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
})
