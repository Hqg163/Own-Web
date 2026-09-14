<template>
  <main class="container ai-page">
    <h1 class="visually-hidden">Own-Web AI 对话</h1>
    <section v-if="!canChat" class="ai-page__availability card" aria-live="polite">
      <AppIcon name="info" :size="22" />
      <div>
        <h2>{{ unavailableTitle }}</h2>
        <p>{{ unavailableMessage }}</p>
      </div>
    </section>

    <div v-else class="ai-page__workspace">
      <aside id="ai-history" class="ai-page__history" :class="{ 'is-open': historyOpen, 'is-collapsed': sidebarCollapsed }" aria-label="AI 会话历史">
        <div class="ai-page__history-head">
          <strong><AppIcon name="history" :size="17" /><span>会话</span></strong>
          <div class="ai-page__history-actions">
            <button class="ai-history-new" type="button" :disabled="!canChat" @click="newConversation"><AppIcon name="plus" :size="16" /><span>新对话</span></button>
            <button class="ai-history-icon" type="button" :disabled="ai.loadingHistory.value" aria-label="刷新会话" @click="ai.loadConversations"><AppIcon name="rotate-cw" :size="16" /></button>
            <button class="ai-history-icon ai-history-collapse" type="button" :aria-label="sidebarCollapsed ? '展开会话栏' : '收起会话栏'" :aria-expanded="!sidebarCollapsed" @click="sidebarCollapsed = !sidebarCollapsed"><AppIcon name="panel-right" :size="16" /></button>
          </div>
        </div>
        <p v-if="!ai.loggedIn()" class="ai-page__guest-note">访客会话仅在当前浏览器会话中保留。</p>
        <p v-if="ai.loggedIn() && ai.loadingHistory.value" class="ai-page__guest-note" role="status">正在读取历史…</p>
        <p v-else-if="ai.loggedIn() && !ai.conversations.value.length && !currentConversation" class="ai-page__guest-note">还没有历史对话。</p>
        <div v-if="(!ai.loggedIn() || !ai.loadingHistory.value) && (currentConversation || ai.conversations.value.length)" class="ai-history-list">
          <div v-if="currentConversation && !ai.conversations.value.length" class="ai-history-item active">
            <button type="button" @click="openConversation(currentConversation.id)">{{ currentConversation.title }}</button>
            <span>
              <button class="ai-history-icon" type="button" :aria-label="`重命名 ${currentConversation.title}`" @click="startRename(currentConversation)"><AppIcon name="pen" :size="14" /></button>
              <button class="ai-history-icon" type="button" :aria-label="`删除 ${currentConversation.title}`" @click="confirmDelete(currentConversation)"><AppIcon name="trash" :size="14" /></button>
            </span>
          </div>
          <div v-for="conversation in ai.conversations.value" :key="conversation.id" class="ai-history-item" :class="{ active: ai.state.conversationId === conversation.id }">
            <button type="button" @click="openConversation(conversation.id)">{{ conversation.title || '新对话' }}</button>
            <span>
              <button class="ai-history-icon" type="button" :aria-label="`重命名 ${conversation.title || '新对话'}`" @click="startRename(conversation)"><AppIcon name="pen" :size="14" /></button>
              <button class="ai-history-icon" type="button" :aria-label="`删除 ${conversation.title || '新对话'}`" @click="confirmDelete(conversation)"><AppIcon name="trash" :size="14" /></button>
            </span>
          </div>
        </div>
      </aside>

      <section class="ai-page__chat" aria-label="当前 AI 对话">
        <header class="ai-page__chat-head">
          <button class="ai-history-toggle ai-history-icon" type="button" aria-controls="ai-history" :aria-expanded="historyOpen" aria-label="打开会话历史" @click="historyOpen = !historyOpen"><AppIcon name="history" :size="17" /></button>
          <div><strong>{{ activeTitle }}</strong><small v-if="!ai.loggedIn()">当前浏览器会话</small></div>
        </header>
        <AiChatSurface variant="workspace" />
      </section>
    </div>

    <div v-if="renameTarget" class="ai-confirm-backdrop" @click.self="closeRename">
      <form ref="renameDialog" class="ai-confirm card" role="dialog" aria-modal="true" aria-labelledby="ai-rename-title" @keydown.esc.prevent="closeRename" @keydown.tab="trapFocus($event, renameDialog)" @submit.prevent="submitRename">
        <h2 id="ai-rename-title">重命名会话</h2>
        <label class="field"><span>标题</span><input ref="renameInput" v-model.trim="renameValue" maxlength="180" /></label>
        <div><button class="button" type="button" @click="closeRename">取消</button><button class="button button-primary" type="submit">保存</button></div>
      </form>
    </div>
    <div v-if="deleteTarget" class="ai-confirm-backdrop" @click.self="closeDelete">
      <section ref="deleteDialog" class="ai-confirm card" role="dialog" aria-modal="true" aria-labelledby="ai-delete-title" @keydown.esc.prevent="closeDelete" @keydown.tab="trapFocus($event, deleteDialog)">
        <h2 id="ai-delete-title">删除会话？</h2>
        <p>将删除该会话及其消息，且无法恢复。</p>
        <div><button class="button" type="button" @click="closeDelete">取消</button><button ref="deleteConfirm" class="button button-danger" type="button" @click="deleteConversation">删除</button></div>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import AiChatSurface from '@/components/ai/AiChatSurface.vue'
import { useAi, type AiConversation } from '@/services/ai'

const ai = useAi()
const historyOpen = ref(false)
const sidebarCollapsed = ref(false)
const renameTarget = ref<AiConversation | null>(null)
const deleteTarget = ref<AiConversation | null>(null)
const renameValue = ref('')
const renameInput = ref<HTMLInputElement | null>(null)
const renameDialog = ref<HTMLElement | null>(null)
const deleteDialog = ref<HTMLElement | null>(null)
const deleteConfirm = ref<HTMLButtonElement | null>(null)
const returnFocus = ref<HTMLElement | null>(null)
const canChat = computed(() => ai.state.availability === 'available')
const activeTitle = computed(() => ai.state.conversationTitle || ai.conversations.value.find((item) => item.id === ai.state.conversationId)?.title || '新对话')
const currentConversation = computed<AiConversation | null>(() => ai.state.conversationId ? {
  id: ai.state.conversationId, title: ai.state.conversationTitle || '新对话', selectedModel: ai.state.selectedModel,
} : null)
const unavailableTitle = computed(() => ai.state.availability === 'unknown' ? '正在检查 AI 服务' : 'AI 助手暂不可用')
const unavailableMessage = computed(() => ai.state.error || (ai.state.availability === 'unknown' ? '正在读取服务状态，请稍候。' : '服务尚未完成配置。你可以稍后再试。'))

onMounted(async () => {
  if (ai.state.availability === 'unknown') await ai.refreshAvailability()
  if (!canChat.value) return
  await ai.loadConversations()
  if (!ai.state.conversationId && ai.conversations.value[0]) await ai.openConversation(ai.conversations.value[0].id)
})
async function newConversation() { await ai.createConversation(); historyOpen.value = false }
async function openConversation(id: string) { await ai.openConversation(id); historyOpen.value = false }
function startRename(conversation: AiConversation) {
  returnFocus.value = document.activeElement instanceof HTMLElement ? document.activeElement : null
  renameTarget.value = conversation
  renameValue.value = conversation.title
  nextTick(() => renameInput.value?.focus())
}
function confirmDelete(conversation: AiConversation) {
  returnFocus.value = document.activeElement instanceof HTMLElement ? document.activeElement : null
  deleteTarget.value = conversation
  nextTick(() => deleteConfirm.value?.focus())
}
function restoreFocus() { const target = returnFocus.value; returnFocus.value = null; nextTick(() => target?.isConnected && target.focus({ preventScroll: true })) }
function closeRename() { renameTarget.value = null; restoreFocus() }
function closeDelete() { deleteTarget.value = null; restoreFocus() }
async function submitRename() { if (!renameTarget.value) return; if (await ai.renameConversation(renameTarget.value.id, renameValue.value)) closeRename() }
async function deleteConversation() { if (!deleteTarget.value) return; await ai.removeConversation(deleteTarget.value.id); closeDelete() }
function trapFocus(event: KeyboardEvent, dialog: HTMLElement | null) {
  const targets = Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])') || [])
  if (!targets.length) return
  const first = targets[0]!
  const last = targets[targets.length - 1]!
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}
</script>

<style scoped>
.ai-page.container { box-sizing: border-box; display: flex; flex: 1 1 auto; flex-direction: column; width: min(calc(100% - 32px), 1540px); max-width: none; min-height: 0; height: 100%; padding: var(--space-3) 0 0; overflow: hidden; }
.ai-page__availability { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: var(--space-3); align-self: center; width: min(680px, 100%); margin: auto; padding: var(--space-5); color: var(--muted); }.ai-page__availability > svg { color: var(--accent); }.ai-page__availability h2 { margin: 0; color: var(--text); font-size: 1.05rem; }.ai-page__availability p { margin: var(--space-1) 0 0; line-height: 1.6; }
.ai-page__workspace { display: grid; flex: 1 1 auto; grid-template-columns: 224px minmax(0, 1fr); gap: var(--space-4); min-width: 0; min-height: 0; }.ai-page__history { min-width: 0; min-height: 0; overflow: auto; overscroll-behavior: contain; padding-right: var(--space-3); border-right: 1px solid var(--border); transition: inline-size .18s ease, opacity .18s ease; }.ai-page__history-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-1); min-height: 40px; padding-bottom: var(--space-2); border-bottom: 1px solid var(--border); }.ai-page__history-head strong { display: inline-flex; align-items: center; gap: 6px; min-width: 0; font-size: .9rem; }.ai-page__history-actions { display: flex; align-items: center; gap: 2px; }.ai-history-new { display: inline-flex; align-items: center; gap: 5px; min-height: 30px; padding: 0 7px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface-raised); color: var(--text); font-size: .78rem; font-weight: 700; }.ai-history-new:hover { border-color: var(--accent); color: var(--accent-strong); }.ai-history-icon { display: inline-grid; place-items: center; flex: 0 0 auto; width: 30px; height: 30px; padding: 0; border: 0; border-radius: 6px; color: var(--muted); background: transparent; }.ai-history-icon:hover { color: var(--accent); background: var(--accent-soft); }.ai-page__guest-note { margin: var(--space-3) 0 0; color: var(--muted); font-size: .8rem; }.ai-history-list { display: grid; gap: 2px; margin-top: var(--space-3); }.ai-history-item { display: flex; align-items: center; gap: 2px; border-radius: 6px; }.ai-history-item.active { background: var(--accent-soft); }.ai-history-item > button { min-width: 0; flex: 1; overflow: hidden; padding: 8px; border: 0; border-radius: 6px; background: transparent; color: var(--text); text-align: left; text-overflow: ellipsis; white-space: nowrap; }.ai-history-item > span { display: flex; }.ai-page__history.is-collapsed { overflow: visible; padding-right: 0; }.ai-page__history.is-collapsed .ai-page__history-head { justify-content: center; }.ai-page__history.is-collapsed .ai-page__history-head strong span, .ai-page__history.is-collapsed .ai-history-new, .ai-page__history.is-collapsed .ai-page__guest-note, .ai-page__history.is-collapsed .ai-history-list, .ai-page__history.is-collapsed .ai-history-icon:not(.ai-history-collapse) { display: none; }.ai-page__history.is-collapsed .ai-history-collapse { transform: rotate(180deg); }
.ai-page__chat { display: grid; grid-template-rows: auto minmax(0, 1fr); min-width: 0; min-height: 0; padding: 0; }.ai-page__chat-head { display: flex; align-items: center; gap: var(--space-2); min-height: 40px; padding: 0 max(var(--space-2), calc((100% - 920px) / 2)) var(--space-2); border-bottom: 1px solid var(--border); }.ai-page__chat-head > div { display: grid; min-width: 0; gap: 1px; }.ai-page__chat-head strong { overflow: hidden; font-size: .96rem; text-overflow: ellipsis; white-space: nowrap; }.ai-page__chat-head small { color: var(--muted); font-size: .76rem; }.ai-history-toggle { display: none; }.ai-page__chat :deep(.ai-chat-surface) { min-height: 0; }
.ai-confirm-backdrop { position: fixed; z-index: 40; inset: 0; display: grid; place-items: center; padding: var(--space-4); background: var(--scrim); }.ai-confirm { display: grid; gap: var(--space-4); width: min(440px, 100%); padding: var(--space-5); }.ai-confirm h2, .ai-confirm p { margin: 0; }.ai-confirm > div { display: flex; justify-content: end; gap: var(--space-2); }.ai-confirm .field { margin: 0; }
@media (min-width: 761px) { .ai-page__workspace:has(.ai-page__history.is-collapsed) { grid-template-columns: 40px minmax(0, 1fr); gap: var(--space-3); } }
@media (max-width: 760px) { .ai-page.container { width: 100%; padding: var(--space-2) var(--space-3) 0; }.ai-history-toggle { display: inline-grid; }.ai-page__workspace { display: block; min-height: 0; }.ai-page__history { position: fixed; z-index: 35; top: 0; bottom: 0; left: 0; display: none; width: min(300px, 88vw); padding: var(--space-4) var(--space-3) max(var(--space-4), env(safe-area-inset-bottom)); border: 0; border-right: 1px solid var(--border); background: var(--surface); box-shadow: var(--shadow); }.ai-page__history.is-open { display: block; }.ai-page__history.is-collapsed { width: min(300px, 88vw); padding: var(--space-4) var(--space-3) max(var(--space-4), env(safe-area-inset-bottom)); }.ai-page__history.is-collapsed .ai-page__history-head { justify-content: space-between; }.ai-page__history.is-collapsed .ai-page__history-head strong span, .ai-page__history.is-collapsed .ai-history-new, .ai-page__history.is-collapsed .ai-page__guest-note, .ai-page__history.is-collapsed .ai-history-list, .ai-page__history.is-collapsed .ai-history-icon:not(.ai-history-collapse) { display: initial; }.ai-page__history.is-collapsed .ai-history-new { display: inline-flex; }.ai-page__history.is-collapsed .ai-history-icon { display: inline-grid; }.ai-page__chat { height: 100%; min-height: 0; }.ai-page__chat-head { padding-inline: var(--space-2); }.ai-page__availability { margin: auto var(--space-1); } }
</style>
