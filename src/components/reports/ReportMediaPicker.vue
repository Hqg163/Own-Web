<template>
  <section class="report-media-picker" aria-labelledby="report-media-title">
    <div class="report-media-picker__heading">
      <h3 id="report-media-title">证据图片</h3>
      <span>可选，最多 {{ maxCount }} 张 PNG、JPEG 或 WebP</span>
    </div>

    <button
      class="report-media-picker__dropzone"
      :class="{ 'is-dragging': dragActive }"
      type="button"
      :disabled="disabled || items.length >= maxCount"
      @click="fileInput?.click()"
      @dragenter.prevent="dragActive = true"
      @dragover.prevent="dragActive = true"
      @dragleave.prevent="dragActive = false"
      @drop.prevent="handleDrop"
    >
      <AppIcon name="upload" :size="18" />
      <span>{{ items.length >= maxCount ? '已达到图片上限' : '选择图片、拖入或粘贴' }}</span>
    </button>
    <input ref="fileInput" class="visually-hidden" type="file" :accept="accept" multiple :disabled="disabled || items.length >= maxCount" @change="handleFileChange">

    <p v-if="validationMessage" class="report-media-picker__message" role="alert">{{ validationMessage }}</p>
    <ul v-if="items.length" class="report-media-picker__list" aria-label="已选择的证据图片">
      <li v-for="(item, index) in items" :key="item.key" class="report-media-picker__item">
        <button class="report-media-picker__preview" type="button" :aria-label="`预览证据图片 ${index + 1}`" @click="openPreview(item)">
          <img :src="item.previewUrl" :alt="`证据图片 ${index + 1}：${item.file.name}`">
        </button>
        <div class="report-media-picker__meta">
          <span class="report-media-picker__name" :title="item.file.name">{{ item.file.name }}</span>
          <span v-if="item.status === 'uploading'" class="report-media-picker__status">上传中…</span>
          <span v-else-if="item.status === 'pending'" class="report-media-picker__status">准备中…</span>
          <span v-else-if="item.status === 'uploaded' || item.status === 'bound'" class="report-media-picker__status">已准备</span>
          <span v-else-if="item.error" class="report-media-picker__error" role="alert">{{ item.error }}</span>
        </div>
        <button class="report-media-picker__remove" type="button" :disabled="disabled" :aria-label="`删除证据图片 ${index + 1}`" @click="$emit('remove', item)">
          <AppIcon name="close" :size="16" />
        </button>
      </li>
    </ul>

    <div v-if="previewItem" class="report-media-picker__lightbox" role="dialog" aria-modal="true" aria-label="证据图片预览" @click.self="closePreview" @keydown.esc.prevent.stop="closePreview">
      <button class="report-media-picker__lightbox-close" type="button" aria-label="关闭图片预览" @click="closePreview"><AppIcon name="close" :size="18" /></button>
      <img :src="previewItem.previewUrl" :alt="`证据图片预览：${previewItem.file.name}`">
    </div>
  </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import { isAllowedReportFile, MAX_REPORT_MEDIA_COUNT, REPORT_MEDIA_ACCEPT } from './constants'
import type { ReportMediaDraft } from './types'

const props = withDefaults(defineProps<{
  items: ReportMediaDraft[]
  disabled?: boolean
  maxCount?: number
  accept?: string
}>(), {
  disabled: false,
  maxCount: MAX_REPORT_MEDIA_COUNT,
  accept: REPORT_MEDIA_ACCEPT,
})

const emit = defineEmits<{
  'files-selected': [files: File[]]
  remove: [item: ReportMediaDraft]
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const dragActive = ref(false)
const validationMessage = ref('')
const previewItem = ref<ReportMediaDraft | null>(null)

function acceptFiles(files: File[]) {
  validationMessage.value = ''
  const available = Math.max(0, props.maxCount - props.items.length)
  const accepted: File[] = []
  let rejected = 0
  for (const file of files) {
    if (accepted.length >= available) {
      rejected += 1
      continue
    }
    if (!isAllowedReportFile(file)) {
      rejected += 1
      continue
    }
    accepted.push(file)
  }
  if (rejected) validationMessage.value = available === 0 ? `最多只能添加 ${props.maxCount} 张证据图片。` : '仅支持不超过 5 MB 的 PNG、JPEG 或 WebP 图片，且最多 3 张。'
  if (accepted.length) emitFiles(accepted)
}

function emitFiles(files: File[]) {
  emit('files-selected', files)
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  acceptFiles(Array.from(input.files || []))
  input.value = ''
}

function handleDrop(event: DragEvent) {
  dragActive.value = false
  if (!props.disabled) acceptFiles(Array.from(event.dataTransfer?.files || []))
}

function handleDocumentPaste(event: ClipboardEvent) {
  if (props.disabled || previewItem.value) return
  const files = Array.from(event.clipboardData?.files || []).filter((file) => file.type.startsWith('image/'))
  if (files.length) {
    event.preventDefault()
    acceptFiles(files)
  }
}

function openPreview(item: ReportMediaDraft) {
  previewItem.value = item
}

function closePreview() {
  previewItem.value = null
}

onMounted(() => document.addEventListener('paste', handleDocumentPaste))
onBeforeUnmount(() => document.removeEventListener('paste', handleDocumentPaste))
</script>

<style scoped>
.report-media-picker { display: grid; gap: var(--space-3); min-width: 0; }
.report-media-picker__heading { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-2); }
.report-media-picker__heading h3 { margin: 0; color: var(--text); font-size: .92rem; }
.report-media-picker__heading span { color: var(--muted); font-size: .78rem; }
.report-media-picker__dropzone { display: flex; align-items: center; justify-content: center; gap: var(--space-2); min-height: 72px; padding: var(--space-3); border: 1px dashed var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); color: var(--muted); }
.report-media-picker__dropzone:hover:not(:disabled), .report-media-picker__dropzone:focus-visible, .report-media-picker__dropzone.is-dragging { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }
.report-media-picker__list { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-2); margin: 0; padding: 0; list-style: none; }
.report-media-picker__item { position: relative; min-width: 0; overflow: hidden; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); }
.report-media-picker__preview { display: block; width: 100%; aspect-ratio: 1; padding: 0; border: 0; background: transparent; }
.report-media-picker__preview img { display: block; width: 100%; height: 100%; object-fit: cover; }
.report-media-picker__meta { display: grid; gap: 2px; min-width: 0; padding: var(--space-2); border-top: 1px solid var(--border); }
.report-media-picker__name { overflow: hidden; color: var(--text); font-size: .76rem; text-overflow: ellipsis; white-space: nowrap; }
.report-media-picker__status, .report-media-picker__error { color: var(--muted); font-size: .72rem; }
.report-media-picker__error, .report-media-picker__message { color: var(--danger); }
.report-media-picker__remove { position: absolute; top: 4px; right: 4px; display: grid; width: 28px; height: 28px; place-items: center; padding: 0; border: 1px solid var(--border); border-radius: 50%; background: var(--surface-raised); color: var(--muted); }
.report-media-picker__remove:hover:not(:disabled) { color: var(--danger); }
.report-media-picker__message { margin: 0; font-size: .8rem; }
.report-media-picker__lightbox { position: fixed; z-index: 1001; inset: 0; display: grid; place-items: center; padding: var(--space-6); background: var(--scrim); }
.report-media-picker__lightbox img { display: block; max-width: min(90vw, 900px); max-height: 82vh; object-fit: contain; border-radius: var(--radius-sm); background: var(--surface); }
.report-media-picker__lightbox-close { position: fixed; top: var(--space-4); right: var(--space-4); display: grid; width: 40px; height: 40px; place-items: center; border: 1px solid var(--border); border-radius: 50%; background: var(--surface-raised); color: var(--text); }
@media (max-width: 480px) { .report-media-picker__heading { align-items: flex-start; flex-direction: column; }.report-media-picker__list { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
</style>
