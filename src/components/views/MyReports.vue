<template>
  <main class="container page-section reports-page" :data-report-view="reportId ? 'detail' : 'summary'" aria-labelledby="my-reports-title">
    <header class="reports-header">
      <div>
        <p class="eyebrow">Moderation</p>
        <h1 id="my-reports-title" class="page-title">{{ reportId ? '举报详情' : '我的举报' }}</h1>
        <p class="muted">{{ reportId ? '查看这条举报的处理进度、内容快照和管理员公开回复。' : '查看你提交的举报摘要和处理状态。' }}</p>
      </div>
      <RouterLink v-if="reportId" class="button button-secondary" to="/dashboard/reports" aria-label="返回我的举报"><AppIcon name="arrow-left" :size="16" />返回我的举报</RouterLink>
    </header>

    <p v-if="loading" class="empty state-panel" role="status"><AppIcon name="shield" :size="24" />{{ reportId ? '正在载入举报详情…' : '正在载入举报记录…' }}</p>
    <div v-else-if="error" class="empty error-state state-panel" role="alert">
      <AppIcon name="info" :size="24" />
      <p>{{ error }}</p>
      <div class="state-actions">
        <button class="button" type="button" @click="load"><AppIcon name="rotate-cw" :size="16" />重试</button>
        <RouterLink v-if="reportId" class="button button-primary" to="/dashboard/reports"><AppIcon name="arrow-left" :size="16" />返回我的举报</RouterLink>
      </div>
    </div>

    <template v-else-if="reportId && detail">
      <section class="detail-grid" data-testid="report-detail" aria-label="举报详情">
        <article class="card detail-card">
          <div class="detail-heading">
            <div>
              <p class="report-target-type">{{ detail.targetTypeLabel }}</p>
              <h2>{{ detail.targetTitle }}</h2>
            </div>
            <span class="status-badge" :data-status="detail.status">{{ detail.statusLabel }}</span>
          </div>
          <p class="status-explanation" role="status"><strong>{{ detail.statusLabel }}</strong><span>{{ statusHints[detail.status] || statusHints.pending }}</span></p>

          <dl class="detail-facts">
            <div><dt>举报对象</dt><dd>{{ detail.targetTitle }}</dd></div>
            <div><dt>举报类型</dt><dd>{{ detail.reasonLabel }}</dd></div>
            <div><dt>提交时间</dt><dd :title="formatDate(detail.createdAt)">{{ formatDate(detail.createdAt) }}</dd></div>
            <div><dt>被举报作者</dt><dd>{{ detail.targetAuthor || '—' }}</dd></div>
          </dl>

          <section class="detail-section" data-testid="report-details" aria-labelledby="report-details-title">
            <h3 id="report-details-title">举报说明</h3>
            <p class="preserved-text">{{ detail.details || '举报人未填写补充说明。' }}</p>
          </section>

          <section class="detail-section" data-testid="report-snapshot" aria-labelledby="report-snapshot-title">
            <h3 id="report-snapshot-title">举报时内容快照</h3>
            <dl class="snapshot-facts">
              <div v-if="detail.snapshotTitle"><dt>文章标题</dt><dd>{{ detail.snapshotTitle }}</dd></div>
              <div v-if="detail.snapshotAuthor"><dt>当时作者</dt><dd>{{ detail.snapshotAuthor }}</dd></div>
              <div v-if="detail.snapshotTargetId"><dt>目标 ID</dt><dd>{{ detail.snapshotTargetId }}</dd></div>
            </dl>
            <p v-if="detail.snapshotExcerpt" class="snapshot-excerpt">{{ detail.snapshotExcerpt }}</p>
            <p v-else class="muted">没有可展示的内容摘要。</p>
          </section>

          <section class="detail-section" data-testid="report-author" aria-labelledby="reported-author-title">
            <h3 id="reported-author-title">被举报作者</h3>
            <p class="preserved-text">{{ detail.targetAuthor || '作者资料不可用。' }}</p>
          </section>

          <section class="detail-section" data-testid="report-evidence" aria-labelledby="evidence-title">
            <h3 id="evidence-title">举报证据</h3>
            <div v-if="detail.media.length" class="report-media evidence-item">
              <img v-for="media in detail.media" :key="media.id" :src="media.url" :alt="media.alt" loading="lazy" />
            </div>
            <p v-else class="muted evidence-empty">这次举报没有附加图片证据。</p>
          </section>

          <section class="detail-section" data-testid="report-timeline" aria-labelledby="timeline-title">
            <h3 id="timeline-title">处理时间线</h3>
            <ol class="timeline">
              <li class="timeline-item" data-status="pending" :aria-current="detail.status === 'pending' ? 'step' : undefined"><strong>已提交举报</strong><time :datetime="detail.createdAt">{{ formatDate(detail.createdAt) }}</time></li>
              <li v-if="detail.reviewedAt || detail.status === 'reviewing' || detail.status === 'resolved' || detail.status === 'dismissed'" class="timeline-item" data-status="reviewing" :aria-current="detail.status === 'reviewing' ? 'step' : undefined"><strong>审核中</strong><time :datetime="detail.reviewedAt || detail.createdAt">{{ formatDate(detail.reviewedAt || detail.createdAt) }}</time></li>
              <li v-if="detail.status === 'resolved' || detail.status === 'dismissed'" class="timeline-item" :data-status="detail.status" aria-current="step"><strong>{{ detail.statusLabel }}</strong><time :datetime="detail.resolvedAt || detail.createdAt">{{ formatDate(detail.resolvedAt || detail.createdAt) }}</time></li>
            </ol>
          </section>

          <section class="detail-section public-response" data-testid="report-public-response" aria-labelledby="public-response-title">
            <h3 id="public-response-title">管理员公开回复</h3>
            <p v-if="detail.publicResponse" class="preserved-text">{{ detail.publicResponse }}</p>
            <p v-else class="muted">暂未收到公开回复。</p>
          </section>

          <RouterLink v-if="detail.currentContentUrl" class="button button-ghost" :to="detail.currentContentUrl">查看当前内容</RouterLink>
        </article>
      </section>
    </template>

    <p v-else-if="!reportId && !items.length" class="empty">还没有举报记录。</p>
    <p v-else-if="reportId" class="empty error-state" role="alert">举报记录暂时无法载入。</p>
    <section v-else class="reports-list" data-testid="reports-summary" aria-label="举报摘要列表">
      <article v-for="item in items" :key="item.id" class="report-card card">
        <div class="report-card__topline">
          <span class="report-target-type">{{ item.targetTypeLabel }}</span>
          <span class="status-badge" :data-status="item.status">{{ item.statusLabel }}</span>
        </div>
        <h2>{{ item.targetTitle }}</h2>
        <p class="report-meta">{{ item.reasonLabel }} · 提交于 {{ formatDate(item.createdAt) }}</p>
        <p v-if="item.targetAuthor" class="report-meta">被举报作者：{{ item.targetAuthor }}</p>
        <footer class="report-card__actions">
          <RouterLink class="button button-ghost" :to="`/dashboard/reports/${item.id}`">查看举报详情</RouterLink>
        </footer>
      </article>
    </section>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
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
  reviewedAt: string
  resolvedAt: string
  summary: string
  details: string
  publicResponse: string
  snapshotTitle: string
  snapshotAuthor: string
  snapshotTargetId: string
  snapshotExcerpt: string
  currentContentUrl: string
  media: ReportMedia[]
}

const route = useRoute()
const items = ref<ReportView[]>([])
const detail = ref<ReportView>()
const loading = ref(true)
const error = ref('')
const reportId = ref(String(route.params.id || ''))

const reasonLabels: Record<string, string> = {
  spam: '垃圾广告', harassment: '骚扰 / 辱骂', hate: '仇恨 / 歧视', sexual: '色情 / 不适内容',
  violence: '暴力 / 危险行为', illegal: '违法内容', copyright: '侵权 / 抄袭', privacy: '隐私泄露',
  misinformation: '虚假 / 误导信息', other: '其他',
}
const statusLabels: Record<string, string> = { pending: '待管理员审核', reviewing: '审核中', resolved: '已处理', dismissed: '未发现违规', reviewed: '已处理' }
const statusHints: Record<string, string> = {
  pending: '管理员会根据举报说明和内容快照进行核查，处理结果会显示在这里。',
  reviewing: '管理员已经开始核查这条举报，完成后会更新状态。',
  resolved: '管理员已完成处理，公开回复会显示在下方。',
  dismissed: '管理员已完成审核，暂未发现需要处理的违规内容。',
}

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
  const targetType = String(value(source, 'target_type', 'targetType') || (value(source, 'comment_id', 'commentId') ? 'comment' : value(snapshot, 'target_type') || 'post'))
  const snapshotTitle = String(value(snapshot, 'post_title', 'postTitle', 'title') || value(source, 'post_title', 'postTitle'))
  const snapshotAuthor = String(value(snapshot, 'comment_author_name', 'post_author', 'postAuthor', 'author_name', 'authorName') || '')
  const snapshotExcerpt = String(value(snapshot, 'comment_excerpt', 'commentExcerpt', 'excerpt', 'content_excerpt', 'summary', 'description') || value(source, 'summary', 'comment_excerpt', 'commentExcerpt'))
  const targetTitle = String(value(source, 'target_title', 'targetTitle', 'post_title', 'postTitle') || (targetType === 'comment' ? snapshotExcerpt || '评论' : snapshotTitle || '文章'))
  const targetAuthor = String(value(source, 'target_author_name', 'targetAuthorName', 'author_name', 'authorName') || snapshotAuthor)
  const rawStatus = String(value(source, 'status') || 'pending').toLowerCase()
  const status = rawStatus === 'reviewed' ? 'resolved' : rawStatus
  const slug = value(source, 'post_slug', 'postSlug', 'slug') || value(snapshot, 'post_slug', 'postSlug', 'slug')
  return {
    id: value(source, 'id', 'report_id', 'reportId'), targetTypeLabel: targetType === 'comment' ? '评论' : '文章', targetTitle,
    targetAuthor, reasonLabel: reasonLabels[String(value(source, 'reason_code', 'reasonCode') || '').toLowerCase()] || String(value(source, 'reason', 'reason_label', 'reasonLabel') || '其他'),
    status, statusLabel: statusLabels[status] || '待管理员审核', createdAt: String(value(source, 'created_at', 'createdAt')),
    reviewedAt: String(value(source, 'reviewed_at', 'reviewedAt')), resolvedAt: String(value(source, 'resolved_at', 'resolvedAt')),
    summary: String(value(source, 'summary') || snapshotExcerpt || targetTitle), details: String(value(source, 'details')),
    publicResponse: String(value(source, 'public_response', 'publicResponse')), snapshotTitle, snapshotAuthor,
    snapshotTargetId: String(value(snapshot, 'target_id', 'targetId') || value(source, 'post_id', 'postId', 'comment_id', 'commentId')),
    snapshotExcerpt, currentContentUrl: safeInternalUrl(value(source, 'current_content_url', 'currentContentUrl') || (slug ? `/posts/${slug}` : '')), media: mediaOf(source),
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
  if (status === 401) return '登录状态已失效，请重新登录后查看举报。'
  if (status === 403) return '当前账号没有权限查看这条举报。'
  if (status === 404) return '找不到这条举报，它可能已被删除或你无权查看。'
  return '举报记录暂时无法载入，请稍后重试。'
}

async function load() {
  loading.value = true
  error.value = ''
  detail.value = undefined
  reportId.value = String(route.params.id || '')
  try {
    const response = reportId.value ? await http.get(`/api/reports/${encodeURIComponent(reportId.value)}`) : await http.get('/api/reports')
    if (reportId.value) {
      detail.value = responseItems(response.data).map(normalizeReport)[0]
      if (!detail.value || detail.value.id === '') error.value = '找不到这条举报，它可能已被删除或你无权查看。'
    } else items.value = responseItems(response.data).map(normalizeReport).filter((item) => item.id !== '')
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
.state-panel { display: grid; justify-items: center; gap: var(--space-3); }
.state-panel p { margin: 0; }
.state-actions { display: flex; justify-content: center; gap: var(--space-2); flex-wrap: wrap; }
.reports-list { display: grid; gap: var(--space-3); }
.report-card, .detail-card { padding: var(--space-5); }
.report-card__topline, .report-card__actions { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
.report-card__topline { justify-content: space-between; }
.report-target-type, .status-badge { color: var(--muted); font-size: .82rem; font-weight: 700; }
.status-badge { padding: 4px 9px; border: 1px solid var(--border); border-radius: 999px; color: var(--accent); background: var(--accent-soft); }
.status-badge[data-status='dismissed'] { color: var(--muted); background: var(--surface-raised); }
.report-card h2, .detail-heading h2 { margin: var(--space-3) 0 var(--space-1); font-size: 1.12rem; overflow-wrap: anywhere; }
.report-meta, .snapshot-excerpt { margin: 0; color: var(--muted); font-size: .9rem; }
.snapshot-excerpt { margin-top: var(--space-3); padding: var(--space-3); border-left: 3px solid var(--border); overflow-wrap: anywhere; }
.report-card__actions { margin-top: var(--space-4); }
.detail-grid { display: grid; }
.detail-card { border-top: 3px solid var(--accent); }
.detail-heading { display: flex; align-items: start; justify-content: space-between; gap: var(--space-4); }
.detail-heading .status-badge { margin-top: var(--space-2); }
.detail-facts, .snapshot-facts { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-3); margin: var(--space-5) 0 0; padding-top: var(--space-4); border-top: 1px solid var(--border); }
.detail-facts div, .snapshot-facts div { min-width: 0; }
.detail-facts dt, .snapshot-facts dt { color: var(--muted); font-size: .78rem; }
.detail-facts dd, .snapshot-facts dd { margin: 4px 0 0; color: var(--text); overflow-wrap: anywhere; }
.detail-section { margin-top: var(--space-6); padding-top: var(--space-5); border-top: 1px solid var(--border); }
.detail-section h3 { margin: 0 0 var(--space-3); font-size: 1rem; }
.preserved-text { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.75; }
.status-explanation { display: grid; gap: 4px; margin: var(--space-4) 0 0; padding: var(--space-3); border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); }
.status-explanation span { color: var(--muted); font-size: .9rem; }
.report-media { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.report-media img { width: 160px; height: 110px; object-fit: cover; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); }
.evidence-empty { margin: 0; padding: var(--space-4); border: 1px dashed var(--border); border-radius: var(--radius-sm); text-align: center; }
.timeline { display: grid; gap: var(--space-3); margin: 0; padding: 0; list-style: none; }
.timeline-item { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-3); padding-left: var(--space-4); border-left: 3px solid var(--border); }
.timeline-item[data-status='reviewing'] { border-left-color: var(--accent); }
.timeline-item[data-status='resolved'] { border-left-color: var(--accent); }
.timeline-item[data-status='dismissed'] { border-left-color: var(--muted); }
.timeline-item time { color: var(--muted); font-size: .86rem; }
.public-response { padding-bottom: var(--space-1); }
.empty { margin-top: var(--space-5); }
.error-state { color: var(--danger); }
@media (max-width: 680px) {
  .reports-header { align-items: start; flex-direction: column; }
  .report-card, .detail-card { padding: var(--space-4); }
  .detail-facts, .snapshot-facts { grid-template-columns: 1fr; }
  .detail-heading { flex-direction: column; gap: var(--space-2); }
  .report-card__actions .button { flex: 1 1 180px; }
  .timeline-item { align-items: start; flex-direction: column; gap: 2px; }
}
</style>
