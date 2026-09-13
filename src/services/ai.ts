import { computed, reactive, ref } from 'vue'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import http from './http'

export type AiCitation = { id: string; postId?: number; chunkId?: string; title: string; slug?: string; heading?: string; headingAnchor?: string; excerpt?: string; score?: number }
export type AiMessage = { id: string; role: 'user' | 'assistant'; content: string; status?: 'complete' | 'streaming' | 'aborted' | 'error'; citations?: AiCitation[]; model?: string; error?: string; feedback?: number | null }
export type AiModel = { id: string; label: string }
// `displayTitle` is client-only presentation state. pageContext() deliberately
// excludes it from outbound requests so the server remains authoritative for post data.
export type AiPageContext = { route?: string; articleId?: number; selectedText?: string; heading?: string; anchor?: string; shareToken?: string; displayTitle?: string }
export type AiConversation = { id: string; title: string; selectedModel?: string; summary?: string | null; messages?: AiMessage[]; persistent?: boolean }
export type AiQuickAction = 'summary_current' | 'explain_concept' | 'related_content' | 'selection_explain' | 'selection_expand' | 'selection_example'
export type AiReadiness = { state: 'disabled' | 'unconfigured' | 'degraded' | 'ready'; featureEnabled: boolean; chatReady: boolean; ragReady: boolean; indexReady: boolean; message: string }

const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
const state = reactive({ open: false, availability: 'unknown' as 'unknown' | 'available' | 'disabled', error: '', readiness: null as AiReadiness | null, status: '', models: [] as AiModel[], defaultModel: 'qwen-fast', selectedModel: 'qwen-fast', conversationId: '', persistent: false, messages: [] as AiMessage[], pageContext: null as AiPageContext | null })
const conversations = ref<AiConversation[]>([])
const loadingHistory = ref(false)
const controller = ref<AbortController | null>(null)
let returnFocus: HTMLElement | null = null

function loggedIn() { return localStorage.getItem('isLoggedIn') === 'true' }
function parseEventBlock(block: string) {
  let type = 'message'; let data = ''
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith('event:')) type = line.slice(6).trim()
    if (line.startsWith('data:')) data += line.slice(5).trim()
  }
  if (!data) return null
  try { return { type, data: JSON.parse(data) } } catch { return null }
}
function aiError(error: any, fallback: string) {
  const safeMessage = error?.response?.data?.error?.message
  return typeof safeMessage === 'string' && safeMessage.trim() ? safeMessage : fallback
}
function pageContext(context: AiPageContext | null | undefined): AiPageContext | undefined {
  if (!context) return undefined
  const { route, articleId, selectedText, heading, anchor, shareToken } = context
  return { ...(route ? { route } : {}), ...(articleId ? { articleId } : {}), ...(selectedText ? { selectedText } : {}), ...(heading ? { heading } : {}), ...(anchor ? { anchor } : {}), ...(shareToken ? { shareToken } : {}) }
}
function localPageContext(context: AiPageContext | null | undefined): AiPageContext | null {
  const requestContext = pageContext(context)
  if (!requestContext) return null
  const title = String(context?.displayTitle || (requestContext.articleId && typeof document !== 'undefined' ? document.title.replace(/\s*[·|]\s*Own-Web\s*$/i, '').trim() : '') || '')
  return { ...requestContext, ...(title && title !== 'Own-Web' ? { displayTitle: title } : {}) }
}
function statusLabel(status: string) {
  return ({ analyzing: '正在分析问题…', retrieving: '正在搜索本站…', reading: '正在读取文章…', tool: '正在调用站内工具…', generating: '正在生成回答…' } as Record<string, string>)[status] || ''
}

export function renderAiMarkdown(value: string) {
  const html = marked.parse(String(value || ''), { async: false, breaks: true }) as string
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'code', 'pre', 'ul', 'ol', 'li', 'blockquote', 'a', 'h2', 'h3', 'h4'], ALLOWED_ATTR: ['href', 'target', 'rel'] })
}

export function useAi() {
  const isStreaming = computed(() => Boolean(controller.value))

  async function refreshAvailability() {
    try {
      const response = await http.get('/api/ai/status', { headers: { 'Cache-Control': 'no-store' } })
      const readiness = response.data as AiReadiness
      state.readiness = readiness
      if (!readiness?.chatReady) {
        state.models = []; state.availability = 'disabled'; state.error = String(readiness?.message || 'AI 服务尚未完成配置。')
        return false
      }
      const modelsResponse = await http.get('/api/ai/models')
      state.models = Array.isArray(modelsResponse.data?.models) ? modelsResponse.data.models : []
      state.defaultModel = String(modelsResponse.data?.defaultModel || state.models[0]?.id || 'qwen-fast')
      if (!state.models.length) throw new Error('AI 服务尚未返回可用模型。')
      if (!state.models.some((model) => model.id === state.selectedModel)) state.selectedModel = state.defaultModel
      state.availability = 'available'; state.error = ''
      return true
    } catch (error: any) {
      state.availability = 'disabled'; state.error = aiError(error, 'AI 功能暂不可用。')
      return false
    }
  }

  async function loadConversations() {
    if (state.availability !== 'available') return
    loadingHistory.value = true
    try { const response = await http.get('/api/ai/conversations'); conversations.value = Array.isArray(response.data?.items) ? response.data.items : [] }
    catch (error: any) { state.error = aiError(error, '无法读取会话记录。') }
    finally { loadingHistory.value = false }
  }

  async function createConversation() {
    if (state.availability !== 'available') return null
    try {
      const response = await http.post('/api/ai/conversations', { modelId: state.selectedModel })
      const conversation = response.data?.conversation as AiConversation
      if (!conversation?.id) return null
      state.conversationId = conversation.id; state.messages = []; state.persistent = Boolean(response.data?.persistent)
      await loadConversations(); return conversation
    } catch (error: any) { state.error = aiError(error, '无法创建新会话。'); return null }
  }

  async function openConversation(id: string) {
    if (!id || state.availability !== 'available') return
    try {
      const response = await http.get(`/api/ai/conversations/${encodeURIComponent(id)}`)
      const conversation = response.data?.conversation as AiConversation
      if (!conversation) return
      state.conversationId = conversation.id; state.selectedModel = conversation.selectedModel || state.selectedModel
      state.messages = Array.isArray(conversation.messages) ? conversation.messages : []; state.persistent = Boolean(response.data?.persistent); state.error = ''
    } catch (error: any) { state.error = aiError(error, '无法打开会话。') }
  }

  async function removeConversation(id: string) {
    try {
      await http.delete(`/api/ai/conversations/${encodeURIComponent(id)}`)
      conversations.value = conversations.value.filter((item) => item.id !== id)
      if (state.conversationId === id) { state.conversationId = ''; state.messages = [] }
    } catch (error: any) { state.error = aiError(error, '删除会话失败。') }
  }

  async function renameConversation(id: string, title: string) {
    const value = title.trim(); if (!value) return false
    try { await http.patch(`/api/ai/conversations/${encodeURIComponent(id)}`, { title: value }); const item = conversations.value.find((entry) => entry.id === id); if (item) item.title = value; return true }
    catch (error: any) { state.error = aiError(error, '重命名会话失败。'); return false }
  }

  async function updateConversation(id: string, patch: { title?: string; selectedModel?: string }) {
    try {
      const response = await http.patch(`/api/ai/conversations/${encodeURIComponent(id)}`, patch)
      const item = conversations.value.find((entry) => entry.id === id)
      if (item?.id === state.conversationId && response.data?.selectedModel) state.selectedModel = String(response.data.selectedModel)
      if (item && response.data?.selectedModel) item.selectedModel = String(response.data.selectedModel)
      if (item && response.data?.title) item.title = String(response.data.title)
      return true
    } catch (error: any) { state.error = aiError(error, '更新会话失败。'); return false }
  }

  function open(trigger?: HTMLElement | null, context?: AiPageContext | null) {
    returnFocus = trigger || (document.activeElement instanceof HTMLElement ? document.activeElement : null)
    state.open = true; state.error = ''; if (context) state.pageContext = localPageContext(context)
    if (state.availability === 'unknown') void refreshAvailability()
  }
  function close() { if (isStreaming.value) return; state.open = false; window.setTimeout(() => returnFocus?.focus({ preventScroll: true }), 0) }
  function setContext(context: AiPageContext | null) { state.pageContext = localPageContext(context) }
  function stop() { controller.value?.abort() }

  async function send(message: string, options: { regenerateMessageId?: string; quickAction?: AiQuickAction } = {}) {
    const value = message.trim()
    if ((!value && !options.regenerateMessageId && !options.quickAction) || controller.value || state.availability !== 'available') return
    state.error = ''; state.status = 'analyzing'
    const userMessage: AiMessage | null = options.regenerateMessageId || options.quickAction ? null : { id: `local-user-${Date.now()}`, role: 'user', content: value, status: 'complete' }
    if (userMessage) state.messages.push(userMessage)
    const assistant: AiMessage = { id: `local-assistant-${Date.now()}`, role: 'assistant', content: '', status: 'streaming', citations: [] }
    state.messages.push(assistant)
    controller.value = new AbortController()
    let pendingDelta = ''
    let deltaFrame: number | null = null
    let deltaTimeout: number | null = null
    const flushDelta = () => {
      if (deltaFrame !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(deltaFrame)
      if (deltaTimeout !== null) window.clearTimeout(deltaTimeout)
      deltaFrame = null
      deltaTimeout = null
      if (!pendingDelta) return
      assistant.content += pendingDelta
      pendingDelta = ''
    }
    const queueDelta = (text: string) => {
      pendingDelta += text
      if (deltaFrame !== null || deltaTimeout !== null) return
      if (typeof requestAnimationFrame === 'function') {
        deltaFrame = requestAnimationFrame(() => { deltaFrame = null; flushDelta() })
      } else {
        deltaTimeout = window.setTimeout(() => { deltaTimeout = null; flushDelta() }, 16)
      }
    }
    try {
      const response = await fetch(`${baseUrl}/api/ai/chat`, {
        method: 'POST', credentials: 'include', signal: controller.value.signal,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ conversationId: state.conversationId || undefined, ...(options.quickAction ? { quickAction: options.quickAction } : { message: value || undefined }), pageContext: pageContext(state.pageContext), modelId: state.selectedModel, ...(options.regenerateMessageId ? { regenerate: { assistantMessageId: options.regenerateMessageId } } : {}) }),
      })
      if (!response.ok || !response.body) { const payload = await response.json().catch(() => ({})); throw new Error(payload?.error?.message || 'AI 请求未能开始。') }
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ''
      while (true) {
        const { done, value: chunk } = await reader.read(); if (done) break
        buffer += decoder.decode(chunk, { stream: true })
        const blocks = buffer.split(/\r?\n\r?\n/); buffer = blocks.pop() || ''
        for (const block of blocks) {
          const event = parseEventBlock(block); if (!event) continue
          if (event.type === 'start') { state.conversationId = String(event.data.conversationId || state.conversationId); assistant.id = String(event.data.messageId || assistant.id) }
          if (event.type === 'status') state.status = String(event.data.status || '')
          if (event.type === 'delta') queueDelta(String(event.data.text || ''))
          if (event.type === 'citation') assistant.citations?.push(event.data as AiCitation)
          if (event.type === 'tool_start') state.status = event.data.tool === 'search_articles' ? 'retrieving' : 'tool'
          if (event.type === 'usage') state.status = event.data.degraded ? '已使用降级路径完成回答。' : ''
          if (event.type === 'error') { assistant.error = String(event.data.message || 'AI 请求失败'); state.error = assistant.error }
          if (event.type === 'done') assistant.status = event.data.status === 'aborted' ? 'aborted' : event.data.status === 'error' ? 'error' : 'complete'
        }
      }
      flushDelta()
      if (assistant.status === 'streaming') assistant.status = 'complete'
      if (assistant.status === 'complete' && !state.status.includes('降级')) state.status = ''
      await loadConversations()
    } catch (error: any) {
      flushDelta()
      assistant.status = error?.name === 'AbortError' ? 'aborted' : 'error'
      if (assistant.status === 'aborted') { state.status = '已停止生成。'; if (!assistant.content) assistant.content = '已停止生成。' }
      else { const detail = aiError(error, 'AI 请求失败。'); assistant.error = detail; state.error = detail }
    } finally { flushDelta(); controller.value = null }
  }

  async function feedback(message: AiMessage, rating: number) {
    if (!loggedIn() || !message.id || message.id.startsWith('local-')) return
    try { await http.post('/api/ai/feedback', { messageId: message.id, rating }); message.feedback = rating }
    catch (error: any) { state.error = aiError(error, '反馈未保存。') }
  }

  return { state, conversations, loadingHistory, isStreaming, loggedIn, refreshAvailability, loadConversations, createConversation, openConversation, removeConversation, renameConversation, updateConversation, open, close, setContext, stop, send, feedback, statusLabel }
}
