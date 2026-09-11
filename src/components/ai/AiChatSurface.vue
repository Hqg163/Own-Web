<template>
  <section class="ai-chat-surface" :class="{ compact }" aria-label="AI 对话">
    <div class="ai-chat-surface__status" aria-live="polite">
      <span v-if="ai.state.status">{{ ai.state.status }}</span>
      <span v-else-if="ai.isStreaming.value">正在生成回答…</span>
    </div>
    <div ref="messagesRef" class="ai-chat-surface__messages" role="log" aria-live="polite" aria-relevant="additions text">
      <div v-if="!ai.state.messages.length" class="ai-chat-surface__empty"><AppIcon name="sparkles" :size="21" /><p>可以直接聊天，或询问已授权的站内文章。</p><small v-if="ai.state.pageContext?.selectedText">当前已附加一段文章选文。</small></div>
      <article v-for="message in ai.state.messages" :key="message.id" class="ai-message" :class="`ai-message--${message.role}`">
        <p v-if="message.role === 'user'" class="ai-message__plain">{{ message.content }}</p>
        <div v-else class="ai-message__answer" v-html="markdown(message.content)"></div>
        <p v-if="message.status === 'streaming'" class="ai-message__state" role="status">正在生成…</p>
        <p v-if="message.status === 'aborted'" class="ai-message__state">生成已停止。</p>
        <p v-if="message.error" class="ai-message__error" role="alert">{{ message.error }}</p>
        <div v-if="message.citations?.length" class="ai-message__sources" aria-label="回答来源">
          <a v-for="citation in message.citations" :key="`${message.id}-${citation.id}`" class="ai-source-card" :href="citationUrl(citation)"><span>{{ citation.id }} · {{ citation.title }}</span><small>{{ citation.heading || '文章内容' }}：{{ citation.excerpt }}</small></a>
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
      <label class="visually-hidden" :for="id">输入给 AI 的消息</label>
      <textarea :id="id" ref="composer" v-model="draft" rows="3" maxlength="8000" placeholder="问问文章内容，或直接开始聊天…" :disabled="ai.isStreaming.value || ai.state.availability !== 'available'" @keydown.enter.exact.prevent="submit"></textarea>
      <div class="ai-chat-surface__compose-footer"><span>{{ draft.length }}/8000</span><div><button v-if="ai.isStreaming.value" class="button button-ghost" type="button" @click="ai.stop"><AppIcon name="stop" :size="16" />停止</button><button v-else class="button button-primary" type="submit" :disabled="!draft.trim() || ai.state.availability !== 'available'"><AppIcon name="send" :size="16" />发送</button></div></div>
    </form>
  </section>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import { renderAiMarkdown, useAi, type AiCitation } from '@/services/ai'

const props = withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })
const ai = useAi()
const draft = ref('')
const composer = ref<HTMLTextAreaElement | null>(null)
const messagesRef = ref<HTMLElement | null>(null)
const id = `ai-compose-${Math.random().toString(36).slice(2)}`
function markdown(value: string) { return renderAiMarkdown(value) }
function citationUrl(citation: AiCitation) { return citation.slug ? `/posts/${encodeURIComponent(citation.slug)}${citation.headingAnchor ? `#${encodeURIComponent(citation.headingAnchor)}` : ''}` : '/explore' }
async function submit() { const value = draft.value; if (!value.trim()) return; draft.value = ''; await ai.send(value); await nextTick(); messagesRef.value?.scrollTo({ top: messagesRef.value.scrollHeight, behavior: 'smooth' }) }
async function regenerate(id: string) { await ai.send('', { regenerateMessageId: id }) }
async function copy(value: string) { try { await navigator.clipboard.writeText(value) } catch (_) {} }
watch(() => ai.state.open, (open) => { if (open) nextTick(() => composer.value?.focus()) })
watch(() => ai.state.messages.length, () => nextTick(() => messagesRef.value?.scrollTo({ top: messagesRef.value.scrollHeight, behavior: 'smooth' })))
defineExpose({ focusComposer: () => composer.value?.focus() })
</script>

<style scoped>
.ai-chat-surface { display: grid; min-height: 0; grid-template-rows: auto minmax(180px, 1fr) auto; gap: var(--space-2); }.ai-chat-surface__status { min-height: 20px; color: var(--muted); font-size: .82rem; }.ai-chat-surface__messages { display: grid; align-content: start; gap: var(--space-3); min-height: 220px; max-height: min(52vh, 560px); overflow: auto; padding: var(--space-1) var(--space-1) var(--space-2); }.ai-chat-surface.compact .ai-chat-surface__messages { max-height: min(54vh, 430px); }.ai-chat-surface__empty { display: grid; justify-items: start; gap: var(--space-2); padding: var(--space-4); border: 1px dashed var(--border); border-radius: var(--radius-sm); color: var(--muted); }.ai-chat-surface__empty p { margin: 0; }.ai-chat-surface__empty small { color: var(--accent); }.ai-message { max-width: 92%; padding: var(--space-3); border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); }.ai-message--user { justify-self: end; border-color: color-mix(in srgb, var(--accent), transparent 55%); background: var(--accent-soft); }.ai-message__plain { margin: 0; white-space: pre-wrap; }.ai-message__answer :deep(p:first-child) { margin-top: 0; }.ai-message__answer :deep(p:last-child) { margin-bottom: 0; }.ai-message__answer :deep(pre) { overflow: auto; padding: var(--space-2); border-radius: 6px; background: var(--code-surface); }.ai-message__answer :deep(a) { color: var(--accent); }.ai-message__state { margin: var(--space-2) 0 0; color: var(--muted); font-size: .8rem; }.ai-message__error { margin: var(--space-2) 0 0; color: var(--danger); font-size: .86rem; }.ai-message__sources { display: grid; gap: var(--space-2); margin-top: var(--space-3); }.ai-source-card { display: grid; gap: 2px; padding: var(--space-2); border-left: 3px solid var(--accent); background: var(--accent-soft); color: var(--text); text-decoration: none; }.ai-source-card span { color: var(--accent-strong); font-size: .82rem; font-weight: 700; }.ai-source-card small { display: -webkit-box; overflow: hidden; color: var(--muted); font-size: .78rem; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }.ai-message__actions { display: flex; flex-wrap: wrap; gap: var(--space-1); margin-top: var(--space-3); }.ai-mini-button { display: inline-flex; align-items: center; gap: 4px; min-height: 28px; padding: 0 7px; border: 1px solid var(--border); border-radius: 6px; background: transparent; color: var(--muted); font-size: .76rem; }.ai-mini-button:hover, .ai-mini-button.selected { color: var(--accent-strong); border-color: var(--accent); background: var(--accent-soft); }.ai-chat-surface__composer { display: grid; gap: var(--space-2); padding-top: var(--space-2); border-top: 1px solid var(--border); }.ai-chat-surface__composer textarea { width: 100%; min-height: 76px; padding: var(--space-2) var(--space-3); resize: vertical; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); color: var(--text); }.ai-chat-surface__compose-footer { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); color: var(--muted); font-size: .75rem; }.ai-chat-surface__compose-footer > div { display: flex; gap: var(--space-2); }.ai-chat-surface__compose-footer .button { min-height: 34px; padding: 0 10px; font-size: .84rem; } @media (max-width: 640px) { .ai-chat-surface__messages { max-height: none; min-height: 180px; }.ai-message { max-width: 96%; } }
</style>
