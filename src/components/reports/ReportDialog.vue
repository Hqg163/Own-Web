<template>
  <Teleport to="body">
    <div v-if="open" class="report-dialog-backdrop" @mousedown.self="closeDialog">
      <section ref="dialogRef" class="report-dialog card" role="dialog" aria-modal="true" aria-labelledby="report-dialog-title" aria-describedby="report-dialog-target" tabindex="-1" @keydown="handleDialogKeydown">
        <header class="report-dialog__header">
          <div>
            <p class="eyebrow">社区治理</p>
            <h2 id="report-dialog-title">举报{{ targetType === 'post' ? '文章' : '评论' }}</h2>
          </div>
          <button class="report-dialog__close" type="button" aria-label="关闭举报对话框" :disabled="submitting" @click="closeDialog"><AppIcon name="close" :size="18" /></button>
        </header>

        <p id="report-dialog-target" class="report-dialog__target">举报对象：{{ targetLabel }}</p>

        <div v-if="status === 'success'" class="report-dialog__result report-dialog__result--success" role="status">
          <strong>举报已提交</strong>
          <span>感谢你的反馈，我们会按社区规则进行审核。</span>
        </div>

        <form class="report-dialog__form" @submit.prevent="submitReport">
          <fieldset class="report-dialog__reasons" :disabled="submitting || status === 'success'">
            <legend>举报类型 <span aria-hidden="true">*</span></legend>
            <label v-for="option in reasonOptions" :key="option.code" class="report-dialog__reason">
              <input v-model="reasonCode" type="radio" name="report-reason" :value="option.code">
              <span>{{ option.label }}</span>
            </label>
          </fieldset>

          <div class="field">
            <label for="report-dialog-details">详细说明<span class="report-dialog__optional">（可选，选择“其他”时必填）</span></label>
            <textarea id="report-dialog-details" v-model="details" :disabled="submitting || status === 'success'" maxlength="2000" rows="5" placeholder="请描述你发现的问题，帮助我们更快处理。"></textarea>
            <div class="report-dialog__field-meta"><span>请勿填写密码、联系方式等敏感信息。</span><span>{{ details.length }}/2000</span></div>
          </div>

          <ReportMediaPicker :items="mediaItems" :disabled="submitting || status === 'success'" @files-selected="handleFilesSelected" @remove="removeMedia" />

          <p v-if="validationMessage" class="report-dialog__message" role="alert">{{ validationMessage }}</p>
          <p v-if="status === 'failure' && statusMessage" class="report-dialog__message" role="alert">{{ statusMessage }}</p>

          <div class="report-dialog__actions">
            <button class="button" type="button" :disabled="submitting" @click="closeDialog">取消</button>
            <button class="button button-primary" type="submit" :disabled="submitting || status === 'success'">
              {{ submitting ? '提交中…' : status === 'success' ? '已提交' : '提交举报' }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import http from '@/services/http'
import { isAllowedReportFile, MAX_REPORT_DETAILS_LENGTH, MAX_REPORT_MEDIA_COUNT, REPORT_REASON_OPTIONS, type ReportReasonCode } from './constants'
import ReportMediaPicker from './ReportMediaPicker.vue'
import { buildReportPayload, isReportDetailsValid, type ReportId, type ReportMediaDraft, type ReportSubmittedPayload, type ReportTargetType } from './types'

const props = defineProps<{
  open: boolean
  targetType: ReportTargetType
  targetId: ReportId
  postId: ReportId
  targetLabel: string
}>()

const emit = defineEmits<{
  close: []
  submitted: [payload: ReportSubmittedPayload]
}>()

const reasonOptions = REPORT_REASON_OPTIONS
const dialogRef = ref<HTMLElement | null>(null)
const reasonCode = ref<ReportReasonCode | ''>('')
const details = ref('')
const mediaItems = ref<ReportMediaDraft[]>([])
const validationMessage = ref('')
const statusMessage = ref('')
const status = ref<'idle' | 'failure' | 'success'>('idle')
const submitting = ref(false)
const lastFocusedElement = ref<HTMLElement | null>(null)
const uploadControllers = new Map<string, AbortController>()
let lifecycleToken = 0

function resetForm() {
  reasonCode.value = ''
  details.value = ''
  validationMessage.value = ''
  statusMessage.value = ''
  status.value = 'idle'
  mediaItems.value = []
}

function captureFocus() {
  const activeElement = document.activeElement
  lastFocusedElement.value = activeElement instanceof HTMLElement ? activeElement : null
}

function restoreFocus() {
  const element = lastFocusedElement.value
  lastFocusedElement.value = null
  if (element?.isConnected) nextTick(() => element.focus())
}

function revokePreview(item: ReportMediaDraft) {
  if (item.previewUrl.startsWith('blob:')) URL.revokeObjectURL(item.previewUrl)
}

function deletePendingMedia(id: number) {
  return http.delete(`/api/report-media/${id}`).catch(() => undefined)
}

function cleanupPendingMedia() {
  lifecycleToken += 1
  for (const controller of uploadControllers.values()) controller.abort()
  uploadControllers.clear()
  const items = mediaItems.value.splice(0)
  for (const item of items) {
    revokePreview(item)
    if (item.id && item.status !== 'bound') void deletePendingMedia(item.id)
  }
}

function closeDialog() {
  if (submitting.value) return
  cleanupPendingMedia()
  emit('close')
  restoreFocus()
}

function handleDialogKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    closeDialog()
    return
  }
  if (event.key !== 'Tab') return
  const focusable = Array.from(dialogRef.value?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])') || [])
  if (!focusable.length) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (!first || !last) return
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

function apiErrorMessage(error: unknown) {
  const response = (error as { response?: { data?: { error?: { message?: string }, message?: string } } }).response
  return response?.data?.error?.message || response?.data?.message || '举报提交失败，请稍后重试。'
}

async function handleFilesSelected(files: File[]) {
  if (submitting.value || status.value === 'success') return
  const available = Math.max(0, MAX_REPORT_MEDIA_COUNT - mediaItems.value.length)
  const accepted = files.filter(isAllowedReportFile).slice(0, available)
  if (!accepted.length) return
  const token = lifecycleToken
  const drafts = accepted.map<ReportMediaDraft>((file, index) => ({
    key: `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
    file,
    previewUrl: URL.createObjectURL(file),
    status: 'pending',
  }))
  mediaItems.value = [...mediaItems.value, ...drafts]
  await Promise.all(drafts.map((item) => uploadMedia(item, token)))
}

async function uploadMedia(item: ReportMediaDraft, token: number) {
  item.status = 'uploading'
  const controller = new AbortController()
  uploadControllers.set(item.key, controller)
  try {
    const formData = new FormData()
    formData.append('images', item.file)
    const response = await http.post('/api/reports/media', formData, { signal: controller.signal })
    const items = Array.isArray(response.data?.items) ? response.data.items : response.data?.item ? [response.data.item] : []
    const id = Number(items[0]?.id)
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error('图片上传响应无效。')
    if (token !== lifecycleToken || !props.open) {
      revokePreview(item)
      void deletePendingMedia(id)
      return
    }
    item.id = id
    item.status = 'uploaded'
  } catch (error) {
    if (controller.signal.aborted || token !== lifecycleToken || !props.open) return
    item.status = 'error'
    item.error = apiErrorMessage(error)
  } finally {
    uploadControllers.delete(item.key)
  }
}

function removeMedia(item: ReportMediaDraft) {
  mediaItems.value = mediaItems.value.filter((candidate) => candidate.key !== item.key)
  const controller = uploadControllers.get(item.key)
  controller?.abort()
  uploadControllers.delete(item.key)
  revokePreview(item)
  if (item.id && item.status !== 'bound') void deletePendingMedia(item.id)
}

async function submitReport() {
  validationMessage.value = ''
  statusMessage.value = ''
  status.value = 'idle'
  if (!reasonCode.value) {
    validationMessage.value = '请选择举报类型。'
    return
  }
  if (!isReportDetailsValid(reasonCode.value, details.value) || details.value.length > MAX_REPORT_DETAILS_LENGTH) {
    validationMessage.value = reasonCode.value === 'other' ? '选择“其他”时请填写详细说明（最多 2000 字）。' : '详细说明不能超过 2000 字。'
    return
  }
  const pending = mediaItems.value.find((item) => item.status === 'pending' || item.status === 'uploading')
  if (pending) {
    validationMessage.value = '请等待证据图片上传完成。'
    return
  }
  if (mediaItems.value.some((item) => item.status === 'error' || !item.id)) {
    validationMessage.value = '有证据图片上传失败，请删除后重试。'
    return
  }
  let payload: ReportSubmittedPayload
  try {
    payload = buildReportPayload({
      targetType: props.targetType,
      targetId: props.targetId,
      postId: props.postId,
      reasonCode: reasonCode.value,
      details: details.value,
      mediaIds: mediaItems.value.flatMap((item) => item.id ? [item.id] : []),
    })
  } catch (error) {
    validationMessage.value = error instanceof Error ? error.message : '举报目标无效。'
    return
  }
  submitting.value = true
  try {
    const response = await http.post('/api/reports', payload)
    for (const item of mediaItems.value) item.status = 'bound'
    status.value = 'success'
    emit('submitted', { ...payload, report: response.data?.report })
  } catch (error) {
    status.value = 'failure'
    statusMessage.value = apiErrorMessage(error)
  } finally {
    submitting.value = false
  }
}

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    captureFocus()
    resetForm()
    nextTick(() => dialogRef.value?.querySelector<HTMLInputElement>('input[name="report-reason"]')?.focus() || dialogRef.value?.focus())
  } else {
    cleanupPendingMedia()
    restoreFocus()
  }
}, { immediate: true })

onMounted(() => document.addEventListener('keydown', handleGlobalKeydown))
onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleGlobalKeydown)
  cleanupPendingMedia()
})

function handleGlobalKeydown(event: KeyboardEvent) {
  if (props.open && event.key === 'Escape') {
    event.preventDefault()
    closeDialog()
  }
}
</script>

<style scoped>
.report-dialog-backdrop { position: fixed; z-index: 1000; inset: 0; display: grid; place-items: center; overflow-y: auto; padding: var(--space-5); background: var(--scrim); }
.report-dialog { width: min(100%, 560px); max-height: min(760px, calc(100vh - 40px)); overflow-y: auto; padding: var(--space-5); }
.report-dialog__header { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-3); }
.report-dialog__header .eyebrow { margin: 0 0 var(--space-1); }
.report-dialog__header h2 { margin: 0; font-size: 1.35rem; }
.report-dialog__close { display: grid; width: 36px; height: 36px; flex: none; place-items: center; padding: 0; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); color: var(--muted); }
.report-dialog__close:hover:not(:disabled) { color: var(--accent); }
.report-dialog__target { margin: var(--space-3) 0 var(--space-5); padding: var(--space-3); overflow-wrap: anywhere; border-left: 3px solid var(--accent); background: var(--accent-soft); color: var(--muted); font-size: .88rem; }
.report-dialog__form { display: grid; gap: var(--space-4); }
.report-dialog__reasons { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-2); margin: 0; padding: 0; border: 0; }
.report-dialog__reasons legend { width: 100%; margin-bottom: var(--space-2); color: var(--text); font-size: .92rem; font-weight: 650; }
.report-dialog__reasons legend span { color: var(--danger); }
.report-dialog__reason { display: flex; align-items: center; gap: var(--space-2); min-width: 0; padding: var(--space-2); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); font-size: .86rem; cursor: pointer; }
.report-dialog__reason:has(input:checked) { border-color: var(--accent); background: var(--accent-soft); }
.report-dialog__reason input { accent-color: var(--accent); }
.report-dialog__optional { color: var(--muted); font-size: .8rem; font-weight: 400; }
.report-dialog__field-meta { display: flex; justify-content: space-between; gap: var(--space-2); color: var(--muted); font-size: .75rem; }
.report-dialog__message { margin: 0; padding: var(--space-3); border: 1px solid color-mix(in srgb, var(--danger), transparent 55%); border-radius: var(--radius-sm); background: color-mix(in srgb, var(--danger), transparent 92%); color: var(--danger); font-size: .86rem; }
.report-dialog__result { display: grid; gap: var(--space-1); margin-bottom: var(--space-4); padding: var(--space-3); border: 1px solid color-mix(in srgb, var(--accent), transparent 55%); border-radius: var(--radius-sm); background: var(--accent-soft); color: var(--accent-strong); }
.report-dialog__result span { color: var(--muted); font-size: .85rem; }
.report-dialog__actions { display: flex; justify-content: flex-end; gap: var(--space-2); padding-top: var(--space-2); border-top: 1px solid var(--border); }
@media (max-width: 520px) { .report-dialog-backdrop { align-items: start; padding: var(--space-3); }.report-dialog { max-height: calc(100vh - 24px); padding: var(--space-4); }.report-dialog__reasons { grid-template-columns: 1fr; }.report-dialog__actions { flex-direction: column-reverse; }.report-dialog__actions .button { width: 100%; } }
</style>
