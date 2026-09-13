import { describe, expect, it, vi } from 'vitest'
import { createConversationStore } from '../../api/ai/agent/conversation-store.js'
import { generateConversationTitle, localConversationTitle } from '../../api/ai/agent/conversation-title.js'

type StoredMessage = {
  id: string
  conversationId: string
  role: string
  content: string
  model: string | null
  status: string
  messageSeq: number
  createdAt: string
}

function orderedStoreFixture() {
  const messages: StoredMessage[] = []
  const conversation = {
    id: '11111111-1111-4111-8111-111111111111', userId: 7, title: '新对话', selectedModel: 'qwen-fast', nextMessageSeq: 1,
  }
  const sameSecond = '2026-09-13T12:00:00.000Z'
  const query = vi.fn(async (sql: string, args: unknown[] = []) => {
    if (sql.includes('FROM ai_conversations') && sql.includes('FOR UPDATE')) {
      const [conversationId, userId] = args
      return [[conversationId === conversation.id && userId === conversation.userId
        ? { selected_model: conversation.selectedModel, next_message_seq: conversation.nextMessageSeq }
        : undefined].filter(Boolean)]
    }
    if (sql.startsWith('INSERT INTO ai_messages')) {
      const [id, conversationId, role, content, _provider, model, status, _input, _output, _latency, messageSeq] = args as any[]
      messages.push({ id, conversationId, role, content, model, status, messageSeq, createdAt: sameSecond })
      return [{ affectedRows: 1 }]
    }
    if (sql.startsWith('UPDATE ai_conversations SET next_message_seq')) {
      conversation.nextMessageSeq = Number(args[0]); conversation.selectedModel = String(args[1]); return [{ affectedRows: 1 }]
    }
    if (sql.startsWith('SELECT id,title,title_source,selected_model') && sql.includes('FROM ai_conversations')) {
      return [[{ id: conversation.id, title: conversation.title, title_source: 'auto', selected_model: conversation.selectedModel, summary: null, created_at: sameSecond, updated_at: sameSecond, last_message_at: sameSecond }]]
    }
    if (sql.startsWith('SELECT id,role,content') && sql.includes('FROM ai_messages')) {
      // The fixture deliberately stores every row in the same second. A real
      // database query must still return the sequence order, never UUID order.
      return [[...messages].sort((left, right) => left.messageSeq - right.messageSeq).map((message) => ({
        id: message.id, role: message.role, content: message.content, model_provider: null, model_name: message.model, status: message.status,
        input_tokens: null, output_tokens: null, latency_ms: null, message_seq: message.messageSeq, created_at: message.createdAt,
      }))]
    }
    throw new Error(`Unexpected SQL: ${sql}`)
  })
  const connection = { query, beginTransaction: vi.fn(async () => {}), commit: vi.fn(async () => {}), rollback: vi.fn(async () => {}), release: vi.fn() }
  const pool = { query, getConnection: vi.fn(async () => connection) }
  return { store: createConversationStore({ db: { promise: () => pool }, config: { limits: { recentMessages: 8, contextChars: 12000 } } }), messages, conversation, connection }
}

describe('AI conversation persistence order', () => {
  it('allocates user/assistant turns atomically and reads same-second rows by message sequence', async () => {
    const { store, messages, conversation, connection } = orderedStoreFixture()
    await store.appendTurn(7, conversation.id,
      { id: 'f0000000-0000-4000-8000-000000000001', role: 'user', content: '第一问', model: 'qwen-fast' },
      { id: '10000000-0000-4000-8000-000000000001', role: 'assistant', content: '第一答', model: 'qwen-fast', status: 'complete' },
    )
    await store.appendTurn(7, conversation.id,
      { id: 'e0000000-0000-4000-8000-000000000002', role: 'user', content: '第二问', model: 'qwen-fast' },
      { id: '20000000-0000-4000-8000-000000000002', role: 'assistant', content: '第二答', model: 'qwen-fast', status: 'complete' },
    )

    expect(messages.map((message) => message.createdAt)).toEqual([messages[0].createdAt, messages[0].createdAt, messages[0].createdAt, messages[0].createdAt])
    expect(messages.map((message) => message.messageSeq)).toEqual([1, 2, 3, 4])
    expect(connection.beginTransaction).toHaveBeenCalledTimes(2)
    const reread = await store.get(7, conversation.id)
    expect(reread?.messages.map((message: any) => `${message.role}:${message.content}`)).toEqual([
      'user:第一问', 'assistant:第一答', 'user:第二问', 'assistant:第二答',
    ])
  })
})

describe('AI conversation title policy', () => {
  it('normalizes short prompts and asks the configured fast model for a bounded long-prompt refinement', async () => {
    expect(localConversationTitle({ message: 'C#主要是用于什么领域？' })).toBe('C# 主要应用领域')
    expect(localConversationTitle({ quickAction: 'summary_current' })).toBe('总结当前文章')
    const generate = vi.fn(async () => ({ content: '“对比两种缓存策略”' }))
    await expect(generateConversationTitle({
      gateway: { generate },
      message: '请帮我比较这两种缓存策略在高并发场景中的一致性、成本、失效风险以及适用边界。',
    })).resolves.toBe('对比两种缓存策略')
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({ modelId: 'qwen-fast', temperature: 0, maxTokens: 36 }), expect.any(Object))
  })
})
