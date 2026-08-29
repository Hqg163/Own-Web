<template>
  <div v-if="open" ref="pickerRef" class="emoji-picker" role="dialog" aria-label="选择表情" @keydown="handleGridKeydown">
    <div class="emoji-picker__head">
      <span>选择表情</span>
      <button class="emoji-picker__close" type="button" aria-label="关闭表情选择器" @click="$emit('update:open', false)"><AppIcon name="close" :size="16" /></button>
    </div>
    <div class="emoji-picker__categories" role="tablist" aria-label="表情分类" @keydown="handleCategoryKeydown">
      <button v-for="(category, index) in categories" :key="category.key" :ref="(element) => setCategoryRef(element, index)" class="emoji-picker__category" type="button" role="tab" :aria-selected="activeCategory === index" :tabindex="activeCategory === index ? 0 : -1" @click="selectCategory(index)">
        {{ category.label }}
      </button>
    </div>
    <div class="emoji-picker__grid" role="tabpanel" :aria-label="categories[activeCategory]?.label || '表情'">
      <button v-for="(emoji, index) in activeEmojis" :key="`${emoji}-${index}`" class="emoji-picker__emoji" type="button" :data-emoji-index="index" :aria-label="emoji" @focus="activeEmoji = index" @click="choose(emoji)">{{ emoji }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch, type ComponentPublicInstance } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import { defaultEmojiCategories, type EmojiCategory } from './constants'

const props = withDefaults(defineProps<{ open?: boolean; categories?: EmojiCategory[] }>(), { open: false, categories: () => defaultEmojiCategories })
const emit = defineEmits<{ 'update:open': [open: boolean]; select: [emoji: string] }>()
const pickerRef = ref<HTMLElement | null>(null)
const activeCategory = ref(0)
const activeEmoji = ref(0)
const categoryRefs = ref<HTMLElement[]>([])
const categories = computed(() => props.categories.length ? props.categories : defaultEmojiCategories)
const activeEmojis = computed(() => categories.value[activeCategory.value]?.emojis || [])

function setCategoryRef(element: Element | ComponentPublicInstance | null, index: number) {
  if (element instanceof HTMLElement) categoryRefs.value[index] = element
}

function selectCategory(index: number) {
  activeCategory.value = index
  activeEmoji.value = 0
}

function choose(emoji: string) {
  emit('select', emoji)
}

function handleCategoryKeydown(event: KeyboardEvent) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter', ' '].includes(event.key)) return
  event.preventDefault()
  if (event.key === 'Enter' || event.key === ' ') { selectCategory(activeCategory.value); return }
  const last = categories.value.length - 1
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? last : Math.min(last, Math.max(0, activeCategory.value + (event.key === 'ArrowRight' ? 1 : -1)))
  selectCategory(next)
  nextTick(() => categoryRefs.value[next]?.focus())
}

function handleGridKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') { emit('update:open', false); return }
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter', ' '].includes(event.key)) return
  const target = event.target as HTMLElement
  const current = Number(target.dataset.emojiIndex)
  if (Number.isNaN(current)) return
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); const emoji = activeEmojis.value[current]; if (emoji) choose(emoji); return }
  event.preventDefault()
  const columns = 6
  const last = activeEmojis.value.length - 1
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? last : event.key === 'ArrowLeft' ? Math.max(0, current - 1) : event.key === 'ArrowRight' ? Math.min(last, current + 1) : event.key === 'ArrowUp' ? Math.max(0, current - columns) : Math.min(last, current + columns)
  activeEmoji.value = next
  pickerRef.value?.querySelector<HTMLElement>(`[data-emoji-index="${next}"]`)?.focus()
}

function handleOutside(event: PointerEvent) {
  if (pickerRef.value && !pickerRef.value.contains(event.target as Node)) emit('update:open', false)
}

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    document.addEventListener('pointerdown', handleOutside)
    nextTick(() => pickerRef.value?.querySelector<HTMLElement>('.emoji-picker__emoji')?.focus())
  } else document.removeEventListener('pointerdown', handleOutside)
}, { immediate: true })

onBeforeUnmount(() => document.removeEventListener('pointerdown', handleOutside))
</script>

<style scoped>
.emoji-picker { position: absolute; z-index: 10; right: 0; bottom: calc(100% + var(--space-2)); width: min(300px, calc(100vw - 24px)); padding: var(--space-2); border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface-raised); box-shadow: var(--shadow); }
.emoji-picker__head { display: flex; align-items: center; justify-content: space-between; padding: var(--space-1) var(--space-1) var(--space-2); color: var(--muted); font-size: .82rem; }
.emoji-picker__close { display: inline-grid; place-items: center; width: 28px; height: 28px; padding: 0; border: 0; border-radius: 6px; background: transparent; color: var(--muted); }
.emoji-picker__close:hover { background: var(--accent-soft); color: var(--text); }
.emoji-picker__categories { display: flex; gap: 2px; overflow-x: auto; border-bottom: 1px solid var(--border); }
.emoji-picker__category { flex: 0 0 auto; padding: var(--space-2); border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--muted); font-size: .8rem; }
.emoji-picker__category[aria-selected="true"] { border-bottom-color: var(--accent); color: var(--accent); font-weight: 700; }
.emoji-picker__grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 2px; max-height: 190px; padding-top: var(--space-2); overflow-y: auto; }
.emoji-picker__emoji { display: grid; place-items: center; min-width: 0; min-height: 38px; padding: 2px; border: 0; border-radius: 6px; background: transparent; font-size: 1.3rem; }
.emoji-picker__emoji:hover { background: var(--accent-soft); }
@media (max-width: 390px) { .emoji-picker { right: -4px; } }
</style>
