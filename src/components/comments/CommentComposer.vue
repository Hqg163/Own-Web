<template>
  <form class="comment-composer" :class="{ 'comment-composer--active': active }" @submit.prevent="submit" @dragover.prevent @drop.prevent="onDrop">
    <div class="comment-composer__row">
      <UserAvatar v-if="user" :src="user.avatarUrl || user.avatar_url" :name="user.name || user.username" :size="32" />
      <label class="comment-composer__field">
        <span class="visually-hidden">{{ replyingTo ? `回复 ${replyingTo}` : '写评论' }}</span>
        <textarea ref="textareaRef" :value="modelValue" :disabled="disabled" :maxlength="maxLength" :placeholder="replyingTo ? `回复 ${replyingTo}…` : placeholder" :rows="active ? 3 : 1" @focus="active = true" @blur="onBlur" @input="onInput" @keydown="handleTextKeydown" @paste="onPaste"></textarea>
      </label>
    </div>
    <div v-if="active || media.length" class="comment-composer__details">
      <CommentMedia :items="media" @preview="(item, index) => $emit('preview', item, index)" @remove="removeMedia" @move="moveMedia" />
      <div class="comment-composer__footer">
        <div class="comment-composer__tools">
          <button class="comment-composer__tool" type="button" :disabled="disabled || media.length >= maxMedia" @click="fileInput?.click()"><AppIcon name="image" :size="16" />添加图片</button>
          <span class="comment-composer__hint">Enter 换行 · {{ modelValue.length }}/{{ maxLength }}</span>
        </div>
        <div class="comment-composer__actions">
          <div class="comment-composer__emoji-wrap">
            <button class="comment-composer__tool" type="button" :disabled="disabled" :aria-expanded="emojiOpen" @click="emojiOpen = !emojiOpen">表情</button>
            <EmojiPicker v-model:open="emojiOpen" :categories="categories" @select="insertEmoji" />
          </div>
          <button v-if="replyingTo" class="button button-ghost comment-composer__cancel" type="button" :disabled="disabled" @click="$emit('cancel')">取消</button>
          <button class="button button-primary comment-composer__submit" type="submit" :disabled="disabled || !modelValue.trim()">{{ submitting ? '发送中…' : replyingTo ? '发送回复' : '发表评论' }}</button>
        </div>
      </div>
    </div>
    <input ref="fileInput" class="visually-hidden" type="file" :accept="accept" multiple :disabled="disabled" @change="onFilesSelected">
  </form>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import CommentMedia from './CommentMedia.vue'
import EmojiPicker from './EmojiPicker.vue'
import type { EmojiCategory } from './constants'
import type { CommentId, CommentMediaItem, CommentSubmitPayload } from './types'

export interface ComposerUser { id?: CommentId; name?: string; username?: string; avatarUrl?: string | null; avatar_url?: string | null }

const props = withDefaults(defineProps<{
  modelValue: string
  media?: CommentMediaItem[]
  user?: ComposerUser | null
  replyingTo?: string | null
  replyingToId?: CommentId | null
  mode?: 'compact' | 'focused'
  placeholder?: string
  maxLength?: number
  maxMedia?: number
  accept?: string
  disabled?: boolean
  submitting?: boolean
  categories?: EmojiCategory[]
}>(), { media: () => [], user: null, replyingTo: null, replyingToId: null, mode: 'compact', placeholder: '写下你的想法…', maxLength: 5000, maxMedia: 9, accept: 'image/png,image/jpeg,image/webp,image/gif', disabled: false, submitting: false, categories: undefined })

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:media': [items: CommentMediaItem[]]
  submit: [payload: CommentSubmitPayload]
  cancel: []
  'media-selected': [files: File[], items: CommentMediaItem[]]
  'media-remove': [item: CommentMediaItem, index: number]
  'media-move': [payload: { from: number; to: number }]
  preview: [item: CommentMediaItem, index: number]
}>()
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const emojiOpen = ref(false)
const focusState = ref(false)
const createdUrls = new Set<string>()
const active = computed({ get: () => props.mode === 'focused' || focusState.value, set: value => { focusState.value = value } })

function onInput(event: Event) { emit('update:modelValue', (event.target as HTMLTextAreaElement).value) }

function onBlur(event: FocusEvent) {
  const next = event.relatedTarget as Node | null
  if (!next || !((event.currentTarget as HTMLTextAreaElement).form)?.contains(next)) focusState.value = Boolean(props.modelValue || props.media.length || props.mode === 'focused')
}

function handleTextKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); submit() }
}

function submit() {
  if (props.disabled || !props.modelValue.trim()) return
  emit('submit', { content: props.modelValue.trim(), media: [...props.media], parentId: props.replyingToId ?? null })
}

function addFiles(files: File[]) {
  const accepted = files.filter(file => ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) && file.size <= 5 * 1024 * 1024).slice(0, Math.max(0, props.maxMedia - props.media.length))
  const items = accepted.map(file => { const url = URL.createObjectURL(file); createdUrls.add(url); return { url, name: file.name, alt: file.name, file } })
  if (items.length) { emit('update:media', [...props.media, ...items]); emit('media-selected', accepted, items) }
}

function onFilesSelected(event: Event) {
  const input = event.target as HTMLInputElement
  addFiles(Array.from(input.files || []))
  input.value = ''
}

function onDrop(event: DragEvent) {
  if (!props.disabled) addFiles(Array.from(event.dataTransfer?.files || []))
}

function onPaste(event: ClipboardEvent) {
  if (props.disabled) return
  const files = Array.from(event.clipboardData?.files || []).filter(file => file.type.startsWith('image/'))
  if (files.length) { event.preventDefault(); addFiles(files) }
}

function removeMedia(item: CommentMediaItem, index: number) {
  emit('update:media', props.media.filter((_, itemIndex) => itemIndex !== index))
  emit('media-remove', item, index)
  revoke(item)
}

function moveMedia(payload: { from: number; to: number }) {
  const next = [...props.media]
  const [item] = next.splice(payload.from, 1)
  if (!item) return
  next.splice(payload.to, 0, item)
  emit('update:media', next)
  emit('media-move', payload)
}

function revoke(item: CommentMediaItem) {
  if (createdUrls.has(item.url)) { URL.revokeObjectURL(item.url); createdUrls.delete(item.url) }
}

function insertEmoji(emoji: string) {
  const textarea = textareaRef.value
  const start = textarea?.selectionStart ?? props.modelValue.length
  const end = textarea?.selectionEnd ?? start
  const nextValue = `${props.modelValue.slice(0, start)}${emoji}${props.modelValue.slice(end)}`.slice(0, props.maxLength)
  emit('update:modelValue', nextValue)
  emojiOpen.value = false
  nextTick(() => { textareaRef.value?.focus(); const position = Math.min(start + emoji.length, nextValue.length); textareaRef.value?.setSelectionRange(position, position) })
}

onBeforeUnmount(() => createdUrls.forEach(url => URL.revokeObjectURL(url)))
</script>

<style scoped>
.comment-composer { position: relative; min-width: 0; margin: var(--space-4) 0; }
.comment-composer__row { display: flex; align-items: flex-start; gap: var(--space-2); min-width: 0; }
.comment-composer__field { min-width: 0; flex: 1; }
.comment-composer textarea { display: block; width: 100%; min-height: 42px; max-height: 220px; padding: 10px 12px; resize: vertical; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); color: var(--text); line-height: 1.5; }
.comment-composer textarea::placeholder { color: var(--subtle); }
.comment-composer textarea:focus { border-color: var(--accent); }
.comment-composer__details { margin-left: 40px; }
.comment-composer__footer { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); margin-top: var(--space-3); }
.comment-composer__tools, .comment-composer__actions { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-2); }
.comment-composer__tool { display: inline-flex; align-items: center; gap: 5px; min-height: 30px; padding: 0; border: 0; background: transparent; color: var(--muted); font-size: .8rem; }
.comment-composer__tool:hover:not(:disabled) { color: var(--accent); }
.comment-composer__hint { color: var(--subtle); font-size: .76rem; }
.comment-composer__emoji-wrap { position: relative; }
.comment-composer__submit { min-height: 36px; padding: 0 12px; }
.comment-composer__cancel { min-height: 36px; padding: 0 10px; }
@media (max-width: 640px) { .comment-composer__footer { align-items: stretch; flex-direction: column; } .comment-composer__actions { justify-content: flex-end; } }
@media (max-width: 390px) { .comment-composer__details { margin-left: 0; } .comment-composer__actions { width: 100%; } .comment-composer__submit { flex: 1; } }
</style>
