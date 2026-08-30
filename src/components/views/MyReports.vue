<template>
  <main class="container page-section reports-page" aria-labelledby="my-reports-title">
    <header class="reports-header">
      <div>
        <p class="eyebrow">Moderation</p>
        <h1 id="my-reports-title" class="page-title">我的举报</h1>
        <p class="muted">查看你提交的举报、处理状态和管理员公开回复。</p>
      </div>
      <RouterLink v-if="reportId" class="button button-secondary" to="/dashboard/reports">返回我的举报</RouterLink>
    </header>

    <p v-if="loading" class="empty" role="status">正在载入举报记录…</p>
    <p v-else-if="error" class="empty error-state" role="alert">{{ error }}</p>
    <p v-else-if="!items.length" class="empty">还没有举报记录。</p>
    <section v-else class="reports-list" aria-label="举报记录">
      <article v-for="item in items" :key="item.id" class="report-card card">
        <div class="report-card__topline">
          <span class="report-target-type">{{ item.targetTypeLabel }}</span>
          <span class="status-badge" :data-status="item.status">{{ item.statusLabel }}</span>
        </div>
        <h2>{{ item.targetTitle }}</h2>
        <p class="report-meta">{{ item.reasonLabel }} · 提交于 {{ formatDate(item.createdAt) }}</p>
        <p v-if="item.targetAuthor" class="report-meta">被举报作者：{{ item.targetAuthor }}</p>
        <p v-if="item.snapshotExcerpt" class="snapshot-excerpt">{{ item.snapshotExcerpt }}</p>
        <dl class="report-facts">
          <div><dt>举报类型</dt><dd>{{ item.reasonLabel }}</dd></div>
          <div><dt>提交时间</dt><dd :title="formatDate(item.createdAt)">{{ formatDate(item.createdAt) }}</dd></div>
          <div><dt>状态</dt><dd>{{ item.statusLabel }}</dd></div>
          <div v-if="item.resolvedAt"><dt>处理时间</dt><dd :title="formatDate(item.resolvedAt)">{{ formatDate(item.resolvedAt) }}</dd></div>
        </dl>
        <div v-if="item.publicResponse" class="public-response">
          <strong>管理员公开回复</strong>
          <p>{{ item.publicResponse }}</p>
        </div>
        <div v-if="item.media.length" class="report-media" aria-label="举报证据图片">
          <img v-for="media in item.media" :key="media.id" :src="media.url" :alt="media.alt" loading="lazy" />
        </div>
        <footer class="report-card__actions">
          <RouterLink class="button button-ghost" :to="`/dashboard/reports/${item.id}`">查看举报详情</RouterLink>
          <a v-if="item.currentContentUrl" class="button button-ghost" :href="item.currentContentUrl">查看当前内容</a>
        </footer>
      </article>
    </section>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import http from '@/services/http'

type RawReport = Record<string, any>
type ReportMedia = { id: string | number; url: string; alt: string }
type ReportView = {
  id: string | number
  targetTypeLabel: string
  targetTitle: string
  targetAuthor: string
  reasonLabel: string
  status: string
  statusLabel: string
  createdAt: string
  resolvedAt: string
  publicResponse: string
  snapshotExcerpt: string
  currentContentUrl: string
  media: ReportMedia[]
}

const route = useRoute()
const items = ref<ReportView[]>([])
const loading = ref(true)
const error = ref('')
const reportId = ref(String(route.params.id || ''))

const reasonLabels: Record<string, string> = {
  spam: '垃圾广告',
  harassment: '骚扰 / 辱骂',
  hate: '仇恨 / 歧视',
  sexual: '色情 / 不适内容',
  violence: '暴力 / 危险行为',
  illegal: '违法内容',
  copyright: '侵权 / 抄袭',
  privacy: '隐私泄露',
  misinformation: '虚假 / 误导信息',
  other: '其他',
}
const statusLabels: Record<string, string> = {
  pending: '待处理',
  reviewing: '审核中',
  resolved: '已处理',
  dismissed: '未发现违规',
  reviewed: '已处理',
}

function value(source: RawReport, ...keys: string[]) {
  for (const key of keys) if (source[key] !== undefined && source[key] !== null && source[key] !== '') return source[key]
  return ''
}

function snapshotOf(source: RawReport): RawReport {
  const snapshot = value(source, 'target_snapshot', 'targetSnapshot')
  return snapshot && typeof snapshot === 'object' ? snapshot : {}
}

function reasonLabel(source: RawReport) {
  const code = String(value(source, 'reason_code', 'reasonCode') || '').toLowerCase()
  return reasonLabels[code] || String(value(source, 'reason', 'reason_label', 'reasonLabel') || '其他')
}

function safeInternalUrl(candidate: unknown) {
  const url = String(candidate || '')
  return url.startsWith('/') && !url.startsWith('//') ? url : ''
}

function mediaOf(source: RawReport): ReportMedia[] {
  const media = Array.isArray(source.media) ? source.media : Array.isArray(source.evidence) ? source.evidence : []
  return media.map((item: RawReport, index: number) => {
    const id = value(item, 'id', 'media_id', 'mediaId') || index
    return {
      id,
      url: safeInternalUrl(value(item, 'url', 'file_url', 'fileUrl')) || `/api/public/report-media/${encodeURIComponent(String(id))}`,
      alt: `举报证据 ${index + 1}`,
    }
  })
}

function normalizeReport(source: RawReport): ReportView {
  const snapshot = snapshotOf(source)
  const targetType = String(value(source, 'target_type', 'targetType') || (value(source, 'comment_id', 'commentId') ? 'comment' : 'post'))
  const postTitle = value(source, 'post_title', 'postTitle') || value(snapshot, 'post_title', 'postTitle', 'title')
  const commentExcerpt = value(source, 'comment_excerpt', 'commentExcerpt') || value(snapshot, 'comment_excerpt', 'commentExcerpt', 'excerpt', 'content_excerpt')
  const targetTitle = String(value(source, 'target_title', 'targetTitle') || (targetType === 'comment' ? commentExcerpt || '评论' : postTitle || '文章'))
  const targetAuthor = String(value(source, 'target_author_name', 'targetAuthorName', 'author_name', 'authorName') || value(snapshot, 'post_author', 'postAuthor', 'author_name', 'authorName'))
  const status = String(value(source, 'status') || 'pending').toLowerCase()
  return {
    id: value(source, 'id', 'report_id', 'reportId'),
    targetTypeLabel: targetType === 'comment' ? '评论' : '文章',
    targetTitle,
    targetAuthor,
    reasonLabel: reasonLabel(source),
    status,
    statusLabel: statusLabels[status] || '待处理',
    createdAt: String(value(source, 'created_at', 'createdAt')),
    resolvedAt: String(value(source, 'resolved_at', 'resolvedAt')),
    publicResponse: String(value(source, 'public_response', 'publicResponse')),
    snapshotExcerpt: String(commentExcerpt || value(snapshot, 'summary', 'description')),
    currentContentUrl: safeInternalUrl(value(source, 'current_content_url', 'currentContentUrl')),
    media: mediaOf(source),
  }
}

function formatDate(valueToFormat: string) {
  if (!valueToFormat) return '—'
  const date = new Date(valueToFormat)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function responseItems(data: any): RawReport[] {
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(data?.reports)) return data.reports
  return data?.report ? [data.report] : []
}

function messageFor(errorValue: any) {
  const status = errorValue?.response?.status
  if (status === 401) return '登录状态已失效，请重新登录后查看举报。'
  if (status === 403) return '当前账号没有权限查看这些举报记录。'
  if (status === 404) return '举报记录暂时无法载入。'
  return '举报记录暂时无法载入，请稍后重试。'
}

async function load() {
  loading.value = true
  error.value = ''
  reportId.value = String(route.params.id || '')
  try {
    const response = reportId.value
      ? await http.get(`/api/reports/${encodeURIComponent(reportId.value)}`)
      : await http.get('/api/reports')
    items.value = responseItems(response.data).map(normalizeReport).filter((item) => item.id !== '')
  } catch (requestError: any) {
    items.value = []
    error.value = messageFor(requestError)
  } finally {
    loading.value = false
  }
}

watch(() => route.params.id, load)
onMounted(load)
</script>

<style scoped>
.reports-page { max-width: 920px; }
.reports-header { display: flex; align-items: end; justify-content: space-between; gap: var(--space-4); margin-bottom: var(--space-6); }
.reports-header .page-title { margin-bottom: var(--space-1); }
.reports-header p:last-child { margin: 0; }
.reports-list { display: grid; gap: var(--space-3); }
.report-card { padding: var(--space-5); }
.report-card__topline, .report-card__actions { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
.report-card__topline { justify-content: space-between; }
.report-target-type, .status-badge { color: var(--muted); font-size: .82rem; font-weight: 700; }
.status-badge { padding: 4px 9px; border: 1px solid var(--border); border-radius: 999px; color: var(--accent); background: var(--accent-soft); }
.status-badge[data-status='dismissed'] { color: var(--muted); background: var(--surface-raised); }
.report-card h2 { margin: var(--space-3) 0 var(--space-1); font-size: 1.12rem; overflow-wrap: anywhere; }
.report-meta, .snapshot-excerpt { margin: 0; color: var(--muted); font-size: .9rem; }
.snapshot-excerpt { margin-top: var(--space-3); padding: var(--space-3); border-left: 3px solid var(--border); overflow-wrap: anywhere; }
.report-facts { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-3); margin: var(--space-4) 0 0; padding-top: var(--space-4); border-top: 1px solid var(--border); }
.report-facts div { min-width: 0; }
.report-facts dt { color: var(--muted); font-size: .78rem; }
.report-facts dd { margin: 4px 0 0; color: var(--text); font-size: .9rem; overflow-wrap: anywhere; }
.public-response { margin-top: var(--space-4); padding: var(--space-3); border: 1px solid color-mix(in srgb, var(--accent), transparent 62%); border-radius: var(--radius-sm); background: var(--accent-soft); }
.public-response strong { font-size: .86rem; }
.public-response p { margin: var(--space-1) 0 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.report-media { display: flex; gap: var(--space-2); flex-wrap: wrap; margin-top: var(--space-4); }
.report-media img { width: 96px; height: 72px; object-fit: cover; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); }
.report-card__actions { margin-top: var(--space-4); }
.empty { margin-top: var(--space-5); }
.error-state { color: var(--danger); }
@media (max-width: 680px) {
  .reports-header { align-items: start; flex-direction: column; }
  .report-card { padding: var(--space-4); }
  .report-facts { grid-template-columns: repeat(2, 1fr); }
  .report-card__actions .button { flex: 1 1 180px; }
}
</style>
