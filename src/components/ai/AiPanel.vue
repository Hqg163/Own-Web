<template>
  <button v-if="ai.state.availability !== 'disabled'" ref="launcher" class="ai-launcher" type="button" :aria-label="ai.state.open ? '关闭 AI 助手' : '打开 AI 助手'" :aria-expanded="ai.state.open" aria-controls="global-ai-panel" @click="toggle"><AppIcon name="sparkles" :size="20" /><span>AI</span></button>
  <div v-if="ai.state.open" class="ai-panel-backdrop" @click.self="close">
    <aside id="global-ai-panel" ref="panel" class="ai-panel card" role="dialog" aria-modal="true" aria-labelledby="global-ai-title" tabindex="-1" @keydown.esc.prevent.stop="close" @keydown.tab="trapFocus">
      <header class="ai-panel__header"><div><p class="eyebrow">Own-Web AI</p><h2 id="global-ai-title">站内助手</h2></div><div class="ai-panel__header-actions"><RouterLink class="ai-panel__full" to="/ai" @click="goFull">完整对话</RouterLink><button class="icon-button" type="button" aria-label="关闭 AI 助手" :disabled="ai.isStreaming.value" @click="close"><AppIcon name="close" :size="18" /></button></div></header>
      <p v-if="ai.state.availability === 'disabled'" class="ai-panel__notice" role="status">{{ ai.state.error || 'AI 功能暂未启用。' }}</p>
      <template v-else><div class="ai-panel__controls"><label for="global-ai-model">模型</label><select id="global-ai-model" v-model="ai.state.selectedModel" :disabled="ai.isStreaming.value"><option v-for="model in ai.state.models" :key="model.id" :value="model.id">{{ model.label }}</option></select></div><AiChatSurface ref="surface" compact /></template>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import AiChatSurface from './AiChatSurface.vue'
import { useAi } from '@/services/ai'

const ai = useAi()
const router = useRouter()
const launcher = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const surface = ref<InstanceType<typeof AiChatSurface> | null>(null)
function toggle() { ai.state.open ? close() : ai.open(launcher.value) }
function close() { ai.close() }
function goFull() { ai.state.open = false; void router.push('/ai') }
function trapFocus(event: KeyboardEvent) {
  const targets = Array.from(panel.value?.querySelectorAll<HTMLElement>('button:not(:disabled), [href], select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])') || [])
  if (!targets.length) return
  const first = targets[0]!
  const last = targets[targets.length - 1]!
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}
watch(() => ai.state.open, (open) => { if (open) nextTick(() => surface.value?.focusComposer() || panel.value?.focus()) })
onMounted(() => { if (ai.state.availability === 'unknown') void ai.refreshAvailability() })
</script>

<style scoped>
.ai-launcher { position: fixed; z-index: 24; right: var(--space-5); bottom: var(--space-5); display: inline-flex; align-items: center; gap: var(--space-2); min-height: 44px; padding: 0 var(--space-3); border: 1px solid var(--accent); border-radius: 999px; background: var(--accent); color: var(--on-accent); box-shadow: var(--shadow); font-weight: 750; }.ai-launcher:hover { background: var(--accent-strong); }.ai-panel-backdrop { position: fixed; z-index: 30; inset: 0; display: grid; justify-items: end; background: var(--scrim); }.ai-panel { display: grid; grid-template-rows: auto auto minmax(0, 1fr); width: min(470px, 100vw); height: 100%; padding: var(--space-4); border-radius: 0; border-width: 0 0 0 1px; box-shadow: var(--shadow); }.ai-panel__header { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-3); padding-bottom: var(--space-3); border-bottom: 1px solid var(--border); }.ai-panel__header .eyebrow { margin: 0 0 var(--space-1); }.ai-panel__header h2 { margin: 0; font-size: 1.2rem; }.ai-panel__header-actions { display: flex; align-items: center; gap: var(--space-2); }.ai-panel__full { color: var(--accent); font-size: .85rem; font-weight: 700; }.ai-panel__notice { margin: var(--space-4) 0; padding: var(--space-3); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--muted); background: var(--surface-raised); }.ai-panel__controls { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-3) 0; color: var(--muted); font-size: .84rem; }.ai-panel__controls select { min-width: 0; flex: 1; padding: 7px 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface-raised); color: var(--text); } @media (max-width: 640px) { .ai-launcher { right: var(--space-3); bottom: var(--space-3); }.ai-panel-backdrop { align-items: end; }.ai-panel { width: 100%; height: min(88vh, 760px); border-width: 1px 0 0; border-radius: var(--radius) var(--radius) 0 0; }.ai-panel__full { display: none; } }
</style>
