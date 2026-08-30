<template>
  <main class="container page-section admin-reports-page" aria-labelledby="admin-reports-title">
    <header class="reports-header">
      <div>
        <p class="eyebrow">Moderation workspace</p>
        <h1 id="admin-reports-title" class="page-title">举报审核</h1>
        <p class="muted">只显示当前服务端管理员权限允许查看和处理的举报。</p>
      </div>
      <RouterLink v-if="reportId" class="button button-secondary" to="/admin/reports">返回举报列表</RouterLink>
    </header>

    <p v-if="forbidden" class="empty safe-state" role="status">
      <strong>无权访问</strong>
      <span>管理员权限由服务端 API 校验，当前账号没有访问举报审核工作台的权限。</span>
    </p>
    <p v-else-if="loading" class="empty" role="status">正在载入举报审核…</p>
    <p v-else-if="error" class="empty error-state" role="alert">{{ error }}</p>
    <template v-else-if="reportId && detail">
      <section class="detail-grid" aria-label="举报详情">
        <article class="card detail-card">
          <div class="detail-heading">
            <div>
              <p class="report-target-type">{{ detail.targetTypeLabel }}</p>
              <h2>{{ detail.targetTitle }}</h2>
            </div>
            <span class="status-badge" :data-status="detail.status">{{ detail.statusLabel }}</span>
          </div>
          <dl class="detail-facts">
            <div><dt>举报类型</dt><dd>{{ detail.reasonLabel }}</dd></div>
            <div><dt>举报人</dt><dd>{{ detail.reporterName || '—' }}</dd></div>
            <div><dt>被举报作者</dt><dd>{{ detail.targetAuthor || '—' }}</dd></div>
            <div><dt>提交时间</dt><dd :title="formatDate(detail.createdAt)">{{ formatDate(detail.createdAt) }}</dd></div>
            <div v-if="detail.reviewedAt"><dt>开始/完成审核</dt><dd :title="formatDate(detail.reviewedAt)">{{ formatDate(detail.reviewedAt) }}</dd></div>
            <div v-if="detail.resolvedAt"><dt>处理时间</dt><dd :title="formatDate(detail.resolvedAt)">{{ formatDate(detail.resolvedAt) }}</dd></div>
          </dl>

          <section class="detail-section" aria-labelledby="snapshot-title">
            <h3 id="snapshot-title">举报时内容快照</h3>
            <dl class="snapshot-facts">
              <div v-if="detail.snapshotTitle"><dt>文章标题</dt><dd>{{ detail.snapshotTitle }}</dd></div>
              <div v-if="detail.snapshotAuthor"><dt>当时作者</dt><dd>{{ detail.snapshotAuthor }}</dd></div>
              <div v-if="detail.snapshotTargetId"><dt>目标 ID</dt><dd>{{ detail.snapshotTargetId }}</dd></div>
            </dl>
            <p v-if="detail.snapshotExcerpt" class="snapshot-excerpt">{{ detail.snapshotExcerpt }}</p>
            <p v-else class="muted">没有可展示的内容摘要。</p>
          </section>

          <section class="detail-section" aria-labelledby="report-details-title">
            <h3 id="report-details-title">举报说明</h3>
            <p class="preserved-text">{{ detail.details || '举报人未填写补充说明。' }}</p>
          </section>

          <section v-if="detail.media.length" class="detail-section" aria-labelledby="evidence-title">
            <h3 id="evidence-title">证据图片</h3>
            <div class="report-media">
              <img v-for="media in detail.media" :key="media.id" :src="media.url" :alt="media.alt" loading="lazy" />
            </div>
          </section>

          <section class="detail-section current-content" aria-labelledby="current-content-title">
            <h3 id="current-content-title">当前内容</h3>
            <RouterLink v-if="detail.currentContentUrl" class="button button-ghost" :to="detail.currentContentUrl">打开当前内容</RouterLink>
            <p v-else class="muted">当前内容链接不可用，可能已被删除。</p>
          </section>
        </article>

        <aside class="card review-card" aria-labelledby="review-actions-title">
          <h2 id="review-actions-title">审核处理</h2>
          <p v-if="actionMessage" class="form-message" :class="actionError ? 'is-error' : 'is-success'" role="status">{{ actionMessage }}</p>
          <div class="field">
            <label for="public-response">用户可见处理说明</label>
            <textarea id="public-response" v-model="publicResponse" rows="5" maxlength="2000" placeholder="处理后会展示给举报人。"></textarea>
            <small>{{ publicResponse.length }}/2000</small>
          </div>
          <div class="field">
            <label for="internal-note">管理员内部备注</label>
            <textarea id="internal-note" v-model="internalNote" rows="5" maxlength="5000" aria-label="管理员内部备注" placeholder="仅管理员可见，不会返回给普通用户。"></textarea>
          </div>
          <div class="review-actions">
            <button class="button button-secondary" type="button" :disabled="actionPending" @click="updateStatus('reviewing')">{{ actionPending && requestedStatus === 'reviewing' ? '处理中…' : '开始审核' }}</button>
            <button class="button button-primary" type="button" :disabled="actionPending" @click="updateStatus('resolved')">{{ actionPending && requestedStatus === 'resolved' ? '处理中…' : '确认违规并处理' }}</button>
            <button class="button button-ghost" type="button" :disabled="actionPending" @click="updateStatus('dismissed')">{{ actionPending && requestedStatus === 'dismissed' ? '处理中…' : '驳回举报' }}</button>
          </div>
          <p class="review-hint">删除文章、删除评论或封禁用户不属于本工作台的审核动作。</p>
        </aside>
      </section>
    </template>
    <template v-else>
      <section class="filter-bar" aria-label="举报状态筛选">
        <div class="filter-tabs" role="tablist" aria-label="举报状态">
          <button v-for="filter in filters" :key="filter.value" class="filter-tab" :class="{ active: selectedStatus === filter.value }" type="button" role="tab" :aria-selected="selectedStatus === filter.value" @click="selectStatus(filter.value)">{{ filter.label }}</button>
        </div>
      </section>
      <p v-if="!items.length" class="empty">当前筛选下没有举报。</p>
      <section v-else class="reports-list" aria-label="举报列表">
        <article v-for="item in items" :key="item.id" class="report-card card">
          <div class="report-card__topline">
            <span class="report-target-type">{{ item.targetTypeLabel }}</span>
            <span class="status-badge" :data-status="item.status">{{ item.statusLabel }}</span>
          </div>
          <h2>{{ item.targetTitle }}</h2>
          <p class="report-meta">{{ item.reasonLabel }} · {{ item.reporterName || '匿名资料不可用' }} · {{ formatDate(item.createdAt) }}</p>
          <p v-if="item.targetAuthor" class="report-meta">被举报作者：{{ item.targetAuthor }}</p>
          <div class="report-card__actions">
            <RouterLink class="button button-ghost" :to="`/admin/reports/${item.id}`">查看详情</RouterLink>
          </div>
        </article>
      </section>
    </template>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import http from '@/services/http'

type RawReport = Record<string, any>
type ReportMedia = { id: string | number; url: string; alt: string }
type ReportView = {
  id: string | number
  targetTypeLabel: string
  targetTitle: string
  targetAuthor: string
  reporterName: string
  reasonLabel: string
  status: string
  statusLabel: string
  createdAt: string
  reviewedAt: string
  resolvedAt: string
  details: string
  publicResponse: string
  internalNote: string
  snapshotTitle: string
  snapshotAuthor: string
  snapshotTargetId: string
  snapshotExcerpt: string
  currentContentUrl: string
  media: ReportMedia[]
}

const route = useRoute()
const router = useRouter()
const items = ref<ReportView[]>([])
const detail = ref<ReportView>()
const loading = ref(true)
const error = ref('')
const forbidden = ref(false)
const selectedStatus = ref(String(route.query.status || 'pending'))
const reportId = ref(String(route.params.id || ''))
const publicResponse = ref('')
const internalNote = ref('')
const actionPending = ref(false)
const requestedStatus = ref('')
const actionMessage = ref('')
const actionError = ref(false)

const filters = [
  { value: 'pending', label: '待处理' },
  { value: 'reviewing', label: '审核中' },
  { value: 'resolved', label: '已处理' },
  { value: 'dismissed', label: '驳回' },
]
const reasonLabels: Record<string, string> = {
  spam: '垃圾广告', harassment: '骚扰 / 辱骂', hate: '仇恨 / 歧视', sexual: '色情 / 不适内容',
  violence: '暴力 / 危险行为', illegal: '违法内容', copyright: '侵权 / 抄袭', privacy: '隐私泄露',
  misinformation: '虚假 / 误导信息', other: '其他',
}
const statusLabels: Record<string, string> = { pending: '待处理', reviewing: '审核中', resolved: '已处理', dismissed: '驳回', reviewed: '已处理' }

function value(source: RawReport, ...keys: string[]) {
  for (const key of keys) if (source[key] !== undefined && source[key] !== null && source[key] !== '') return source[key]
  return ''
}

function snapshotOf(source: RawReport): RawReport {
  const snapshot = value(source, 'target_snapshot', 'targetSnapshot')
  return snapshot && typeof snapshot === 'object' ? snapshot : {}
}

function safeInternalUrl(candidate: unknown) {
  const url = String(candidate || '')
  return url.startsWith('/') && !url.startsWith('//') ? url : ''
}

function mediaOf(source: RawReport): ReportMedia[] {
  const media = Array.isArray(source.media) ? source.media : Array.isArray(source.evidence) ? source.evidence : []
  return media.map((item: RawReport, index: number) => {
    const id = value(item, 'id', 'media_id', 'mediaId') || index
    return { id, url: safeInternalUrl(value(item, 'url', 'file_url', 'fileUrl')) || `/api/public/report-media/${encodeURIComponent(String(id))}`, alt: `举报证据 ${index + 1}` }
  })
}

function normalizeReport(source: RawReport): ReportView {
  const snapshot = snapshotOf(source)
  const targetType = String(value(source, 'target_type', 'targetType') || (value(source, 'comment_id', 'commentId') ? 'comment' : 'post'))
  const snapshotTitle = String(value(snapshot, 'post_title', 'postTitle', 'title') || value(source, 'post_title', 'postTitle'))
  const snapshotAuthor = String(value(snapshot, 'post_author', 'postAuthor', 'author_name', 'authorName') || '')
  const snapshotExcerpt = String(value(snapshot, 'comment_excerpt', 'commentExcerpt', 'excerpt', 'content_excerpt', 'summary', 'description') || value(source, 'comment_excerpt', 'commentExcerpt', 'excerpt'))
  const targetTitle = String(value(source, 'target_title', 'targetTitle') || (targetType === 'comment' ? snapshotExcerpt || '评论' : snapshotTitle || '文章'))
  const targetAuthor = String(value(source, 'target_author_name', 'targetAuthorName', 'author_name', 'authorName') || value(source.target_author || {}, 'username', 'name') || snapshotAuthor)
  const reporterName = String(value(source, 'reporter_name', 'reporterName') || value(source.reporter || {}, 'username', 'name'))
  const status = String(value(source, 'status') || 'pending').toLowerCase()
  const slug = value(source, 'post_slug', 'postSlug', 'slug') || value(snapshot, 'post_slug', 'postSlug', 'slug')
  return {
    id: value(source, 'id', 'report_id', 'reportId'),
    targetTypeLabel: targetType === 'comment' ? '评论' : '文章',
    targetTitle,
    targetAuthor,
    reporterName,
    reasonLabel: reasonLabels[String(value(source, 'reason_code', 'reasonCode') || '').toLowerCase()] || String(value(source, 'reason', 'reason_label', 'reasonLabel') || '其他'),
    status,
    statusLabel: statusLabels[status] || '待处理',
    createdAt: String(value(source, 'created_at', 'createdAt')),
    reviewedAt: String(value(source, 'reviewed_at', 'reviewedAt')),
    resolvedAt: String(value(source, 'resolved_at', 'resolvedAt')),
    details: String(value(source, 'details')),
    publicResponse: String(value(source, 'public_response', 'publicResponse')),
    internalNote: String(value(source, 'internal_note', 'internalNote')),
    snapshotTitle,
    snapshotAuthor,
    snapshotTargetId: String(value(snapshot, 'target_id', 'targetId') || value(source, 'post_id', 'postId', 'comment_id', 'commentId')),
    snapshotExcerpt,
    currentContentUrl: safeInternalUrl(value(source, 'current_content_url', 'currentContentUrl') || (slug ? `/posts/${slug}` : '')),
    media: mediaOf(source),
  }
}

function responseItems(data: any): RawReport[] {
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(data?.reports)) return data.reports
  return data?.report ? [data.report] : []
}

function formatDate(valueToFormat: string) {
  if (!valueToFormat) return '—'
  const date = new Date(valueToFormat)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function messageFor(errorValue: any) {
  const status = errorValue?.response?.status
  if (status === 401) return '登录状态已失效，请重新登录后继续。'
  if (status === 404) return '举报审核记录暂时无法载入。'
  return '举报审核服务暂时不可用，请稍后重试。'
}

function applyError(errorValue: any) {
  forbidden.value = errorValue?.response?.status === 403
  error.value = forbidden.value ? '' : messageFor(errorValue)
  items.value = []
  detail.value = undefined
}

async function loadList() {
  loading.value = true
  error.value = ''
  forbidden.value = false
  try {
    const response = await http.get('/api/admin/reports', { params: { status: selectedStatus.value } })
    items.value = responseItems(response.data).map(normalizeReport).filter((item) => item.id !== '')
  } catch (requestError: any) {
    applyError(requestError)
  } finally {
    loading.value = false
  }
}

async function loadDetail() {
  loading.value = true
  error.value = ''
  forbidden.value = false
  try {
    const response = await http.get(`/api/admin/reports/${encodeURIComponent(reportId.value)}`)
    const raw = response.data?.report || response.data
    detail.value = normalizeReport(raw)
    publicResponse.value = detail.value.publicResponse
    internalNote.value = detail.value.internalNote
  } catch (requestError: any) {
    applyError(requestError)
  } finally {
    loading.value = false
  }
}

async function selectStatus(status: string) {
  selectedStatus.value = status
  await router.replace({ query: { status } })
}

async function updateStatus(status: 'reviewing' | 'resolved' | 'dismissed') {
  if (!detail.value || actionPending.value) return
  if ((status === 'resolved' || status === 'dismissed') && !publicResponse.value.trim()) {
    actionError.value = true
    actionMessage.value = '请填写用户可见处理说明后再完成审核。'
    return
  }
  actionPending.value = true
  requestedStatus.value = status
  actionMessage.value = ''
  try {
    const response = await http.put(`/api/admin/reports/${encodeURIComponent(String(detail.value.id))}`, {
      status,
      public_response: publicResponse.value.trim(),
      internal_note: internalNote.value.trim(),
    })
    const updated = response.data?.report
    if (updated) {
      detail.value = normalizeReport(updated)
      publicResponse.value = detail.value.publicResponse
      internalNote.value = detail.value.internalNote
    } else {
      await loadDetail()
    }
    actionError.value = false
    actionMessage.value = status === 'reviewing' ? '已开始审核。' : status === 'resolved' ? '举报已标记为已处理。' : '举报已驳回。'
  } catch (requestError: any) {
    actionError.value = true
    actionMessage.value = requestError?.response?.data?.error?.message || '保存审核结果失败，请稍后重试。'
  } finally {
    actionPending.value = false
    requestedStatus.value = ''
  }
}

async function load() {
  reportId.value = String(route.params.id || '')
  selectedStatus.value = String(route.query.status || selectedStatus.value || 'pending')
  if (reportId.value) await loadDetail()
  else await loadList()
}

watch(() => [route.params.id, route.query.status], load)
onMounted(load)
</script>

<style scoped>
.admin-reports-page { max-width: 1120px; }
.reports-header { display: flex; align-items: end; justify-content: space-between; gap: var(--space-4); margin-bottom: var(--space-6); }
.reports-header .page-title { margin-bottom: var(--space-1); }
.reports-header p:last-child { margin: 0; }
.filter-bar { margin-bottom: var(--space-4); overflow-x: auto; }
.filter-tabs { display: flex; gap: var(--space-2); min-width: max-content; padding-bottom: 2px; }
.filter-tab { min-height: 40px; padding: 0 var(--space-3); border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); color: var(--muted); font-weight: 650; }
.filter-tab:hover, .filter-tab:focus-visible { border-color: var(--accent); color: var(--text); }
.filter-tab.active { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }
.reports-list { display: grid; gap: var(--space-3); }
.report-card { padding: var(--space-5); }
.report-card__topline, .report-card__actions, .detail-heading { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
.report-card__topline { justify-content: space-between; }
.report-card h2, .detail-heading h2 { margin: var(--space-3) 0 var(--space-1); font-size: 1.12rem; overflow-wrap: anywhere; }
.detail-heading { justify-content: space-between; align-items: start; }
.detail-heading h2 { margin-top: var(--space-1); }
.report-target-type, .report-meta { color: var(--muted); font-size: .88rem; }
.report-target-type { margin: 0; font-weight: 700; }
.report-meta { margin: 0; }
.status-badge { padding: 4px 9px; border: 1px solid var(--border); border-radius: 999px; color: var(--accent); background: var(--accent-soft); font-size: .82rem; font-weight: 700; white-space: nowrap; }
.status-badge[data-status='dismissed'] { color: var(--muted); background: var(--surface-raised); }
.report-card__actions { margin-top: var(--space-4); }
.detail-grid { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(280px, .75fr); align-items: start; gap: var(--space-4); }
.detail-card, .review-card { padding: var(--space-5); }
.detail-facts, .snapshot-facts { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-3); margin: var(--space-5) 0 0; padding-top: var(--space-4); border-top: 1px solid var(--border); }
.detail-facts div, .snapshot-facts div { min-width: 0; }
.detail-facts dt, .snapshot-facts dt { color: var(--muted); font-size: .78rem; }
.detail-facts dd, .snapshot-facts dd { margin: 4px 0 0; overflow-wrap: anywhere; }
.detail-section { margin-top: var(--space-5); padding-top: var(--space-5); border-top: 1px solid var(--border); }
.detail-section h3, .review-card h2 { margin: 0 0 var(--space-3); font-size: 1rem; }
.snapshot-excerpt, .preserved-text { margin: var(--space-3) 0 0; padding: var(--space-3); border-left: 3px solid var(--border); white-space: pre-wrap; overflow-wrap: anywhere; }
.report-media { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.report-media img { width: 112px; height: 84px; object-fit: cover; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); }
.current-content { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); flex-wrap: wrap; }
.review-card { position: sticky; top: 88px; }
.field { display: grid; gap: 6px; margin-bottom: var(--space-4); }
.field label { font-size: .88rem; font-weight: 650; }
.field textarea { width: 100%; min-height: 100px; resize: vertical; padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); color: var(--text); line-height: 1.6; }
.field textarea:focus { border-color: var(--accent); outline: 3px solid color-mix(in srgb, var(--accent), transparent 70%); outline-offset: 1px; }
.field small { color: var(--muted); font-size: .78rem; }
.review-actions { display: grid; gap: var(--space-2); }
.review-actions .button { width: 100%; }
.review-hint { margin: var(--space-4) 0 0; color: var(--muted); font-size: .82rem; line-height: 1.6; }
.form-message { margin: 0 0 var(--space-4); padding: var(--space-3); border: 1px solid color-mix(in srgb, var(--accent), transparent 58%); border-radius: var(--radius-sm); background: var(--accent-soft); color: var(--accent); font-size: .88rem; }
.form-message.is-error { border-color: color-mix(in srgb, var(--danger), transparent 58%); background: color-mix(in srgb, var(--danger), transparent 92%); color: var(--danger); }
.safe-state { display: grid; justify-items: center; gap: var(--space-2); }
.safe-state strong { color: var(--text); font-size: 1.1rem; }
.safe-state span { max-width: 560px; }
.error-state { color: var(--danger); }
@media (max-width: 760px) {
  .reports-header { align-items: start; flex-direction: column; }
  .detail-grid { grid-template-columns: 1fr; }
  .review-card { position: static; }
  .detail-card, .review-card, .report-card { padding: var(--space-4); }
  .detail-facts, .snapshot-facts { grid-template-columns: repeat(2, 1fr); }
}
</style>
