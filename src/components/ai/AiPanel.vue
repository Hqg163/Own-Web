<template>
  <button
    ref="launcher"
    class="ai-launcher"
    data-testid="ai-launcher"
    type="button"
    :aria-label="ai.state.open ? '关闭 AI 助手' : '打开 AI 助手'"
    :aria-expanded="ai.state.open"
    aria-controls="global-ai-panel"
    @click="toggle"
  >
    <AppIcon name="sparkles" :size="18" />
    <span>AI 助手</span>
  </button>

  <div v-if="ai.state.open" class="ai-panel-backdrop" @click.self="close">
    <aside
      id="global-ai-panel"
      ref="panel"
      class="ai-panel"
      :class="{ 'ai-panel--unavailable': !canChat }"
      role="dialog"
      aria-modal="true"
      aria-labelledby="global-ai-title"
      tabindex="-1"
      @keydown.esc.prevent.stop="close"
      @keydown.tab="trapFocus"
    >
      <header class="ai-panel__header">
        <div>
          <p class="eyebrow">Own-Web AI</p>
          <h2 id="global-ai-title">站内助手</h2>
        </div>
        <div class="ai-panel__header-actions">
          <RouterLink class="ai-panel__full" to="/ai" @click="goFull">
            完整对话
            <AppIcon name="arrow-right" :size="15" />
          </RouterLink>
          <button class="icon-button" type="button" aria-label="关闭 AI 助手" :disabled="ai.isStreaming.value" @click="close">
            <AppIcon name="close" :size="18" />
          </button>
        </div>
      </header>

      <section v-if="!canChat" class="ai-panel__availability" aria-live="polite">
        <AppIcon name="info" :size="20" />
        <div>
          <strong>{{ unavailableTitle }}</strong>
          <p>{{ unavailableMessage }}</p>
        </div>
      </section>

      <template v-else>
        <div class="ai-panel__toolbar">
          <span class="ai-panel__ready"><span aria-hidden="true"></span>可开始对话</span>
          <label for="global-ai-model">
            <span>模型</span>
            <select id="global-ai-model" v-model="ai.state.selectedModel" :disabled="ai.isStreaming.value" @change="persistSelectedModel">
              <option v-for="model in ai.state.models" :key="model.id" :value="model.id">{{ model.label }}</option>
            </select>
          </label>
        </div>
        <AiChatSurface ref="surface" compact />
      </template>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import AiChatSurface from './AiChatSurface.vue'
import { useAi } from '@/services/ai'

const ai = useAi()
const router = useRouter()
const launcher = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const surface = ref<InstanceType<typeof AiChatSurface> | null>(null)
const canChat = computed(() => ai.state.availability === 'available')
const unavailableTitle = computed(() => ai.state.availability === 'unknown' ? '正在检查 AI 服务' : 'AI 助手暂不可用')
const unavailableMessage = computed(() => ai.state.error || (ai.state.availability === 'unknown' ? '正在读取服务状态，请稍候。' : '服务尚未完成配置。你可以稍后再试。'))

function toggle() { ai.state.open ? close() : ai.open(launcher.value) }
function close() { ai.close() }
function goFull() { ai.state.open = false; void router.push('/ai') }
async function persistSelectedModel() {
  if (ai.state.conversationId) await ai.updateConversation(ai.state.conversationId, { selectedModel: ai.state.selectedModel })
}
function handleGlobalKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !ai.state.open) return
  event.preventDefault()
  close()
}
function trapFocus(event: KeyboardEvent) {
  const targets = Array.from(panel.value?.querySelectorAll<HTMLElement>('button:not(:disabled), [href], select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])') || [])
  if (!targets.length) return
  const first = targets[0]!
  const last = targets[targets.length - 1]!
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}

watch(() => ai.state.open, (open) => {
  if (!open) return
  nextTick(() => {
    if (canChat.value) surface.value?.focusComposer()
    else panel.value?.focus()
  })
})
onMounted(() => {
  if (ai.state.availability === 'unknown') void ai.refreshAvailability()
  document.addEventListener('keydown', handleGlobalKeydown)
})
onBeforeUnmount(() => document.removeEventListener('keydown', handleGlobalKeydown))
</script>

<style scoped>
.ai-launcher { position: fixed; z-index: 24; right: var(--space-5); bottom: var(--space-5); display: inline-flex; align-items: center; gap: var(--space-2); min-height: 44px; padding: 0 var(--space-3); border: 1px solid var(--accent); border-radius: 999px; background: var(--accent); color: var(--on-accent); box-shadow: var(--shadow); font-weight: 750; }
.ai-launcher:hover { background: var(--accent-strong); }
.ai-panel-backdrop { position: fixed; z-index: 30; inset: 0; display: grid; align-items: end; justify-items: end; padding: var(--space-5); background: transparent; pointer-events: none; }
.ai-panel-backdrop::before { position: absolute; inset: 0; background: var(--scrim); content: ''; opacity: .36; }
.ai-panel { position: relative; z-index: 1; display: grid; grid-template-rows: auto minmax(0, 1fr); width: min(448px, calc(100vw - (var(--space-5) * 2))); height: min(690px, calc(100vh - (var(--space-5) * 2))); min-height: 390px; padding: var(--space-4); border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); box-shadow: var(--shadow); pointer-events: auto; }
.ai-panel--unavailable { grid-template-rows: auto minmax(0, 1fr); }
.ai-panel__header { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-3); padding-bottom: var(--space-3); border-bottom: 1px solid var(--border); }
.ai-panel__header .eyebrow { margin: 0 0 var(--space-1); }
.ai-panel__header h2 { margin: 0; font-size: 1.2rem; }
.ai-panel__header-actions { display: flex; align-items: center; gap: var(--space-2); }
.ai-panel__full { display: inline-flex; align-items: center; gap: 4px; color: var(--accent); font-size: .82rem; font-weight: 700; }
.ai-panel__availability { display: grid; grid-template-columns: auto minmax(0, 1fr); align-content: center; gap: var(--space-3); padding: var(--space-5) var(--space-2); color: var(--muted); }
.ai-panel__availability > svg { color: var(--accent); }
.ai-panel__availability strong { color: var(--text); }
.ai-panel__availability p { margin: var(--space-1) 0 0; line-height: 1.6; }
.ai-panel__toolbar { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); padding: var(--space-3) 0; }
.ai-panel__ready { display: inline-flex; align-items: center; gap: 6px; color: var(--muted); font-size: .8rem; }
.ai-panel__ready > span { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); }
.ai-panel__toolbar label { display: flex; align-items: center; gap: var(--space-1); color: var(--muted); font-size: .78rem; }
.ai-panel__toolbar select { max-width: 170px; padding: 6px 7px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface-raised); color: var(--text); font: inherit; }
@media (max-width: 640px) { .ai-launcher { right: var(--space-3); bottom: var(--space-3); }.ai-panel-backdrop { align-items: end; padding: 0; }.ai-panel { width: 100%; height: min(82vh, 760px); min-height: 390px; border-width: 1px 0 0; border-radius: var(--radius) var(--radius) 0 0; }.ai-panel__full { display: none; } }
@media (max-width: 420px) { .ai-panel { height: 100%; border: 0; border-radius: 0; }.ai-panel__toolbar { align-items: flex-start; flex-direction: column; }.ai-panel__toolbar label, .ai-panel__toolbar select { width: 100%; max-width: none; }.ai-panel__toolbar label { justify-content: space-between; } }
</style>
