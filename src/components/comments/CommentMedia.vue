<template>
  <ol v-if="items.length" class="comment-media" aria-label="评论图片">
    <li v-for="(item, index) in items" :key="item.id ?? item.url" class="comment-media__item" :draggable="editable" @dragstart="dragStart(index, $event)" @dragover.prevent @drop="drop(index)">
      <button class="comment-media__preview" type="button" :data-media-id="item.id || undefined" :aria-label="`预览图片 ${index + 1}`" @click="$emit('preview', item, index)">
        <img :src="item.url" :alt="item.alt || item.name || `评论图片 ${index + 1}`" width="160" height="160" loading="lazy" decoding="async">
      </button>
      <span class="comment-media__position">{{ index + 1 }}</span>
      <div v-if="editable" class="comment-media__actions">
        <button class="comment-media__action" type="button" :disabled="index === 0" :aria-label="`图片 ${index + 1} 上移`" @click="$emit('move', { from: index, to: index - 1 })"><AppIcon class="comment-media__up" name="arrow-down" :size="14" /></button>
        <button class="comment-media__action" type="button" :disabled="index === items.length - 1" :aria-label="`图片 ${index + 1} 下移`" @click="$emit('move', { from: index, to: index + 1 })"><AppIcon name="arrow-down" :size="14" /></button>
        <button class="comment-media__action comment-media__remove" type="button" :aria-label="`删除图片 ${index + 1}`" @click="$emit('remove', item, index)"><AppIcon name="close" :size="14" /></button>
      </div>
    </li>
  </ol>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import type { CommentMediaItem } from './types'

withDefaults(defineProps<{ items: CommentMediaItem[]; editable?: boolean }>(), { editable: false })
const emit = defineEmits<{
  preview: [item: CommentMediaItem, index: number]
  remove: [item: CommentMediaItem, index: number]
  move: [payload: { from: number; to: number }]
}>()
const draggedIndex = ref<number | null>(null)

function dragStart(index: number, event: DragEvent) {
  draggedIndex.value = index
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function drop(index: number) {
  if (draggedIndex.value == null || draggedIndex.value === index) return
  emit('move', { from: draggedIndex.value, to: index })
  draggedIndex.value = null
}
</script>

<style scoped>
.comment-media { display: grid; grid-template-columns: repeat(auto-fill, minmax(88px, 1fr)); gap: var(--space-2); max-width: 100%; margin: var(--space-3) 0 0; padding: 0; list-style: none; }
.comment-media__item { position: relative; min-width: 0; overflow: hidden; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); }
.comment-media__preview { display: block; width: 100%; aspect-ratio: 1; padding: 0; border: 0; background: transparent; color: inherit; }
.comment-media__preview img { display: block; width: 100%; height: 100%; object-fit: cover; }
.comment-media__position { position: absolute; top: 4px; left: 4px; min-width: 20px; padding: 1px 5px; border-radius: 999px; background: var(--scrim); color: #fff; font-size: .72rem; text-align: center; }
.comment-media__actions { display: flex; gap: 2px; justify-content: flex-end; padding: 3px; border-top: 1px solid var(--border); }
.comment-media__action { display: inline-grid; place-items: center; width: 24px; height: 24px; padding: 0; border: 0; border-radius: 4px; background: transparent; color: var(--muted); }
.comment-media__action:hover:not(:disabled) { background: var(--accent-soft); color: var(--accent); }
.comment-media__up { transform: rotate(180deg); }
.comment-media__remove:hover:not(:disabled) { color: var(--danger); }
@media (max-width: 390px) { .comment-media { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
</style>
