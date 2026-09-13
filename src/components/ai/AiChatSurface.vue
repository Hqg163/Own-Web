<template>
  <section class="ai-chat-surface" :class="[{ compact }, `ai-chat-surface--${variant}`]" aria-label="AI 对话">
    <div class="ai-chat-surface__status" aria-live="polite">
      <span v-if="statusLabel"><AppIcon name="sparkles" :size="14" />{{ statusLabel }}</span>
    </div>

    <div ref="messagesRef" class="ai-chat-surface__messages" role="log" aria-live="polite" aria-relevant="additions text" @scroll.passive="onMessagesScroll">
      <div v-if="!ai.state.messages.length" class="ai-chat-surface__empty">
        <AppIcon name="message-square" :size="22" />
        <div>
          <strong>从一个问题开始</strong>
          <p>站内问题会标注已授权来源；普通聊天不会假装检索过资料。</p>
        </div>
        <div class="ai-quick-actions" aria-label="快捷提问">
          <button v-for="action in quickActions" :key="action.id" type="button" :disabled="!canChat || ai.isStreaming.value" @click="runQuickAction(action.id)">
            {{ action.label }}
          </button>
        </div>
      </div>

      <article v-for="message in ai.state.messages" :key="message.id" class="ai-message" :class="`ai-message--${message.role}`">
        <p v-if="message.role === 'user'" class="ai-message__plain">{{ message.content }}</p>
        <div v-else class="ai-message__answer" v-html="message.status === 'streaming' ? streamPreview(message.content) : markdown(message.content)"></div>
        <p v-if="message.status === 'streaming'" class="ai-message__state" role="status">正在生成…</p>
        <p v-if="message.status === 'aborted'" class="ai-message__state">生成已停止。</p>
        <p v-if="message.error" class="ai-message__error" role="alert">{{ message.error }}</p>
        <div v-if="message.citations?.length" class="ai-message__sources" aria-label="回答来源">
          <p class="ai-message__sources-title"><AppIcon name="book" :size="14" />已授权来源</p>
          <section v-for="group in citationGroups(message)" :key="group.key" class="ai-source-group">
            <a class="ai-source-card" :href="citationUrl(group.primary)">
              <span>{{ group.primary.id }} · {{ group.title }}</span>
              <small>{{ group.primary.heading || '文章内容' }}：{{ group.primary.excerpt }}</small>
            </a>
            <button v-if="group.details.length" class="ai-source-expand" type="button" :aria-expanded="isSourcesExpanded(group.key)" @click="toggleSources(group.key)">
              <AppIcon name="chevron-down" :size="14" />{{ isSourcesExpanded(group.key) ? '收起章节' : `展开 ${group.details.length} 条章节` }}
            </button>
            <div v-if="isSourcesExpanded(group.key)" class="ai-source-group__details">
              <a v-for="citation in group.details" :key="`${group.key}-${citation.id}-${citation.headingAnchor || citation.heading || ''}`" class="ai-source-card ai-source-card--detail" :href="citationUrl(citation)">
                <span>{{ citation.heading || '文章内容' }}</span>
                <small>{{ citation.excerpt }}</small>
              </a>
            </div>
          </section>
        </div>
        <div v-if="message.role === 'assistant' && message.status !== 'streaming'" class="ai-message__actions">
          <button class="ai-mini-button" type="button" @click="copy(message.content)"><AppIcon name="copy" :size="15" />复制</button>
          <button v-if="ai.loggedIn()" class="ai-mini-button" :class="{ selected: message.feedback === 1 }" type="button" :aria-label="'有帮助'" @click="ai.feedback(message, 1)"><AppIcon name="thumb-up" :size="15" /></button>
          <button v-if="ai.loggedIn()" class="ai-mini-button" :class="{ selected: message.feedback === -1 }" type="button" :aria-label="'没有帮助'" @click="ai.feedback(message, -1)"><AppIcon name="thumb-down" :size="15" /></button>
          <button class="ai-mini-button" type="button" :disabled="ai.isStreaming.value" @click="regenerate(message.id)"><AppIcon name="rotate-cw" :size="15" />重新生成</button>
        </div>
      </article>
    </div>

    <form class="ai-chat-surface__composer" @submit.prevent="submit">
      <button v-if="showBackToLatest" class="ai-back-to-latest" type="button" @click="returnToLatest"><AppIcon name="arrow-down" :size="15" />回到最新</button>
      <div v-if="contextLabel" class="ai-context-chip" aria-label="当前 AI 上下文">
        <AppIcon name="book" :size="15" />
        <span v-if="ai.state.pageContext?.selectedText" class="visually-hidden">已附加文章选文</span>
        <span :title="contextLabel">{{ contextLabel }}</span>
        <button type="button" aria-label="移除当前上下文" @click="ai.setContext(null)"><AppIcon name="close" :size="14" /></button>
      </div>
      <label class="visually-hidden" :for="id">输入给 AI 的消息</label>
      <textarea :id="id" ref="composer" v-model="draft" rows="1" maxlength="8000" placeholder="问问文章内容，或直接开始聊天…" :disabled="ai.isStreaming.value || !canChat" @input="resizeComposer" @keydown.enter.exact.prevent="submit"></textarea>
      <div class="ai-chat-surface__compose-footer">
        <div class="ai-chat-surface__compose-meta">
          <span v-if="draft.length >= 6000" :class="{ warning: draft.length >= 7600 }">{{ draft.length }}/8000</span>
          <label v-if="variant === 'workspace'" class="ai-composer-model" :for="`${id}-model`">
            <span>模型</span>
            <select :id="`${id}-model`" v-model="ai.state.selectedModel" :disabled="ai.isStreaming.value" @change="persistSelectedModel">
              <option v-for="model in ai.state.models" :key="model.id" :value="model.id">{{ model.label }}</option>
            </select>
          </label>
        </div>
        <div>
          <button v-if="ai.isStreaming.value" class="button button-ghost" type="button" @click="ai.stop"><AppIcon name="stop" :size="16" />停止</button>
          <button v-else class="button button-primary" type="submit" :disabled="!draft.trim() || !canChat"><AppIcon name="send" :size="16" />发送</button>
        </div>
      </div>
    </form>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import { renderAiMarkdown, useAi, type AiCitation, type AiMessage, type AiQuickAction } from '@/services/ai'

type CitationGroup = { key: string; title: string; primary: AiCitation; details: AiCitation[] }

const props = withDefaults(defineProps<{ compact?: boolean; variant?: 'panel' | 'workspace' }>(), { compact: false, variant: 'panel' })
const ai = useAi()
const draft = ref('')
const composer = ref<HTMLTextAreaElement | null>(null)
const messagesRef = ref<HTMLElement | null>(null)
const showBackToLatest = ref(false)
const followingLatest = ref(true)
const expandedSources = ref(new Set<string>())
const id = `ai-compose-${Math.random().toString(36).slice(2)}`
const followThreshold = 96
let followFrame = 0
const quickActions = computed<Array<{ id: AiQuickAction; label: string }>>(() => {
  const context = ai.state.pageContext
  if (context?.selectedText) return [
    { id: 'selection_explain', label: '解释选文' },
    { id: 'selection_expand', label: '展开说明' },
    { id: 'selection_example', label: '举例说明' },
  ]
  if (context?.articleId) return [
    { id: 'summary_current', label: '总结当前内容' },
    { id: 'explain_concept', label: '解释核心概念' },
    { id: 'related_content', label: '推荐相关内容' },
  ]
  return [{ id: 'explain_concept', label: '解释核心概念' }]
})
const canChat = computed(() => ai.state.availability === 'available')
const contextLabel = computed(() => {
  const context = ai.state.pageContext
  if (!context) return ''
  if (context.selectedText) return `选文 · ${clipText(context.selectedText, 72)}`
  if (context.articleId) return context.displayTitle || documentArticleTitle() || '当前文章'
  return ''
})
const statusLabel = computed(() => {
  const value = String(ai.state.status || '')
  return ai.statusLabel(value) || value || (ai.isStreaming.value ? '正在生成回答…' : '')
})

function clipText(value: string, length: number) { const normalized = value.replace(/\s+/g, ' ').trim(); return normalized.length > length ? `${normalized.slice(0, length - 1)}…` : normalized }
function documentArticleTitle() {
  if (typeof document === 'undefined') return ''
  const title = document.title.replace(/\s*[·|]\s*Own-Web\s*$/i, '').trim()
  return title === 'Own-Web' ? '' : title
}
function markdown(value: string) { return renderAiMarkdown(value) }
function streamPreview(value: string) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character)).replace(/\n/g, '<br>')
}
function citationUrl(citation: AiCitation) { return citation.slug ? `/posts/${encodeURIComponent(citation.slug)}${citation.headingAnchor ? `#${encodeURIComponent(citation.headingAnchor)}` : ''}` : '/explore' }
function citationGroups(message: AiMessage): CitationGroup[] {
  const byArticle = new Map<string, { title: string; citations: AiCitation[]; seen: Set<string> }>()
  for (const citation of message.citations || []) {
    const articleKey = String(citation.postId || citation.slug || citation.title)
    const sectionKey = `${articleKey}:${citation.headingAnchor || citation.heading || ''}`
    const group = byArticle.get(articleKey) || { title: citation.title, citations: [], seen: new Set<string>() }
    if (!group.seen.has(sectionKey)) { group.seen.add(sectionKey); group.citations.push(citation) }
    byArticle.set(articleKey, group)
  }
  return Array.from(byArticle.entries()).map(([articleKey, group]) => ({ key: `${message.id}:${articleKey}`, title: group.title, primary: group.citations[0]!, details: group.citations.slice(1) }))
}
function isSourcesExpanded(key: string) { return expandedSources.value.has(key) }
function toggleSources(key: string) {
  const next = new Set(expandedSources.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expandedSources.value = next
}
function onMessagesScroll() {
  const element = messagesRef.value
  if (!element) return
  const distance = element.scrollHeight - element.scrollTop - element.clientHeight
  followingLatest.value = distance <= followThreshold
  showBackToLatest.value = !followingLatest.value && Boolean(ai.state.messages.length)
}
function scheduleFollow() {
  if (!followingLatest.value) { showBackToLatest.value = Boolean(ai.state.messages.length); return }
  if (followFrame) cancelAnimationFrame(followFrame)
  followFrame = requestAnimationFrame(() => {
    followFrame = 0
    const element = messagesRef.value
    if (element) element.scrollTop = element.scrollHeight
  })
}
function returnToLatest() {
  followingLatest.value = true
  showBackToLatest.value = false
  void nextTick(scheduleFollow)
}
async function submit() {
  const value = draft.value
  if (!value.trim()) return
  draft.value = ''
  returnToLatest()
  await nextTick(); resizeComposer()
  await ai.send(value)
}
function resizeComposer() {
  const element = composer.value
  if (!element) return
  element.style.height = 'auto'
  element.style.height = `${Math.min(210, Math.max(50, element.scrollHeight))}px`
}
async function runQuickAction(action: AiQuickAction) { if (canChat.value && !ai.isStreaming.value) { returnToLatest(); await ai.send('', { quickAction: action }) } }
async function regenerate(messageId: string) { returnToLatest(); await ai.send('', { regenerateMessageId: messageId }) }
async function persistSelectedModel() { if (ai.state.conversationId) await ai.updateConversation(ai.state.conversationId, { selectedModel: ai.state.selectedModel }) }
async function copy(value: string) { try { await navigator.clipboard.writeText(value) } catch (_) {} }
watch(() => ai.state.open, (open) => { if (open) nextTick(() => { resizeComposer(); composer.value?.focus() }) })
watch(() => ai.state.messages.map((message) => `${message.id}:${message.content.length}:${message.status || ''}`).join('|'), () => nextTick(scheduleFollow))
onBeforeUnmount(() => { if (followFrame) cancelAnimationFrame(followFrame) })
defineExpose({ focusComposer: () => composer.value?.focus() })
</script>

<style scoped>
.ai-chat-surface { position: relative; display: grid; min-height: 0; grid-template-rows: auto minmax(180px, 1fr) auto; gap: var(--space-2); }
.ai-chat-surface--workspace { height: 100%; grid-template-rows: auto minmax(0, 1fr) auto; }
.ai-chat-surface__status { min-height: 20px; color: var(--muted); font-size: .82rem; }.ai-chat-surface__status span { display: inline-flex; align-items: center; gap: 5px; }
.ai-chat-surface__messages { display: grid; align-content: start; gap: var(--space-3); min-height: 220px; overflow: auto; overscroll-behavior: contain; padding: var(--space-1) var(--space-1) var(--space-2); scroll-padding-bottom: var(--space-4); }.ai-chat-surface--workspace .ai-chat-surface__messages { gap: var(--space-4); min-height: 0; padding: var(--space-3) max(var(--space-2), calc((100% - 920px) / 2)) var(--space-4); }.ai-chat-surface.compact .ai-chat-surface__messages { min-height: 180px; }
.ai-chat-surface__empty { display: grid; justify-items: start; gap: var(--space-2); padding: var(--space-4); border: 1px dashed var(--border); border-radius: var(--radius-sm); color: var(--muted); }.ai-chat-surface__empty > svg { color: var(--accent); }.ai-chat-surface__empty strong { color: var(--text); }.ai-chat-surface__empty p { margin: 0; line-height: 1.6; }
.ai-quick-actions { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-1); }.ai-quick-actions button { min-height: 30px; padding: 0 9px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface-raised); color: var(--text); font-size: .78rem; }.ai-quick-actions button:hover:not(:disabled) { border-color: var(--accent); color: var(--accent-strong); background: var(--accent-soft); }
.ai-message { max-width: 92%; padding: var(--space-3); border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); }.ai-chat-surface--workspace .ai-message--assistant { width: 100%; max-width: none; padding: var(--space-2) 0 var(--space-3); border: 0; border-radius: 0; background: transparent; }.ai-chat-surface--workspace .ai-message--user { max-width: min(78%, 620px); }.ai-message--user { justify-self: end; border-color: color-mix(in srgb, var(--accent), transparent 55%); background: var(--accent-soft); }.ai-message__plain { margin: 0; white-space: pre-wrap; }
.ai-message__answer :deep(p:first-child) { margin-top: 0; }.ai-message__answer :deep(p:last-child) { margin-bottom: 0; }.ai-message__answer :deep(pre) { overflow: auto; padding: var(--space-2); border-radius: 6px; background: var(--code-surface); }.ai-message__answer :deep(a) { color: var(--accent); }.ai-message__state { margin: var(--space-2) 0 0; color: var(--muted); font-size: .8rem; }.ai-message__error { margin: var(--space-2) 0 0; color: var(--danger); font-size: .86rem; }
.ai-message__sources { display: grid; gap: var(--space-2); margin-top: var(--space-3); }.ai-message__sources-title { display: inline-flex; align-items: center; gap: 5px; margin: 0; color: var(--muted); font-size: .75rem; font-weight: 700; }.ai-source-group { display: grid; gap: var(--space-1); }.ai-source-card { display: grid; gap: 2px; padding: var(--space-2); border-left: 3px solid var(--accent); background: var(--accent-soft); color: var(--text); text-decoration: none; }.ai-source-card:hover { background: color-mix(in srgb, var(--accent), transparent 88%); }.ai-source-card span { color: var(--accent-strong); font-size: .82rem; font-weight: 700; }.ai-source-card small { display: -webkit-box; overflow: hidden; color: var(--muted); font-size: .78rem; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }.ai-source-card--detail { margin-left: var(--space-3); border-left-width: 1px; }.ai-source-expand { display: inline-flex; align-items: center; justify-self: start; gap: 3px; min-height: 26px; padding: 0 5px; border: 0; background: transparent; color: var(--accent-strong); font-size: .76rem; }.ai-source-group__details { display: grid; gap: var(--space-1); }
.ai-message__actions { display: flex; flex-wrap: wrap; gap: var(--space-1); margin-top: var(--space-3); }.ai-mini-button { display: inline-flex; align-items: center; gap: 4px; min-height: 28px; padding: 0 7px; border: 1px solid var(--border); border-radius: 6px; background: transparent; color: var(--muted); font-size: .76rem; }.ai-mini-button:hover, .ai-mini-button.selected { color: var(--accent-strong); border-color: var(--accent); background: var(--accent-soft); }
.ai-chat-surface__composer { display: grid; gap: var(--space-2); padding: var(--space-2) 0 0; border-top: 1px solid var(--border); }.ai-context-chip { display: inline-flex; align-items: center; justify-self: start; gap: 6px; max-width: 100%; padding: 5px 8px; border: 1px solid var(--border); border-radius: 999px; background: var(--accent-soft); color: var(--accent-strong); font-size: .78rem; font-weight: 650; }.ai-context-chip > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.ai-context-chip button { display: inline-grid; place-items: center; width: 20px; height: 20px; padding: 0; border: 0; border-radius: 50%; background: transparent; color: inherit; }.ai-context-chip button:hover { background: color-mix(in srgb, var(--accent), transparent 80%); }
.ai-chat-surface__composer textarea { box-sizing: border-box; width: 100%; min-height: 50px; max-height: 210px; padding: 13px var(--space-3); resize: none; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); color: var(--text); line-height: 1.45; }.ai-chat-surface__composer textarea:focus { border-color: var(--accent); outline: 3px solid color-mix(in srgb, var(--accent), transparent 72%); outline-offset: 1px; }.ai-chat-surface--workspace .ai-chat-surface__composer { width: min(920px, 100%); justify-self: center; padding: var(--space-3) var(--space-2) max(var(--space-3), env(safe-area-inset-bottom)); }.ai-chat-surface__compose-footer { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); color: var(--muted); font-size: .75rem; }.ai-chat-surface__compose-meta { display: flex; align-items: center; gap: var(--space-2); min-width: 0; }.ai-chat-surface__compose-meta .warning { color: var(--danger); }.ai-composer-model { display: inline-flex; align-items: center; gap: 5px; min-width: 0; }.ai-composer-model select { max-width: 180px; padding: 5px 7px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface-raised); color: var(--text); font: inherit; }.ai-chat-surface__compose-footer > div:last-child { display: flex; gap: var(--space-2); }.ai-chat-surface__compose-footer .button { min-height: 34px; padding: 0 10px; font-size: .84rem; }.ai-back-to-latest { display: inline-flex; align-items: center; justify-self: end; gap: 4px; min-height: 28px; padding: 0 8px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface-raised); color: var(--accent-strong); font-size: .76rem; }
@media (max-width: 640px) { .ai-chat-surface__messages { min-height: 180px; }.ai-chat-surface--workspace .ai-chat-surface__messages { padding-inline: var(--space-3); }.ai-message { max-width: 96%; }.ai-chat-surface--workspace .ai-message--user { max-width: 90%; }.ai-composer-model select { max-width: 145px; } }
</style>
