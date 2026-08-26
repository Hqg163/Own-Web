<template>
  <main class="dashboard page-section">
    <header class="dashboard-header">
      <div>
        <p class="eyebrow">Private workspace</p>
        <h1 class="page-title">工作台</h1>
        <p class="muted">把个人资料、资料管理与创作放在同一个安静的工作入口。</p>
      </div>
      <RouterLink class="button button-primary" to="/write"><AppIcon name="pen" :size="17" />写文章</RouterLink>
    </header>

    <section class="dashboard-intro card" aria-label="账户概览">
      <UserAvatar :src="user.avatar_url" :name="user.username" :size="56" />
      <div>
        <strong>{{ user.username || '正在载入工作台…' }}</strong>
        <p class="muted">{{ user.email || '你的私有资料和创作内容只对当前会话可见。' }}</p>
      </div>
      <RouterLink class="button button-ghost" to="/personal/info">管理资料<AppIcon name="chevron-right" :size="16" /></RouterLink>
    </section>

    <section class="dashboard-layout">
      <div class="dashboard-main">
        <section aria-labelledby="workspace-links-title">
          <div class="section-heading"><div><p class="eyebrow">Workspace</p><h2 id="workspace-links-title">继续处理</h2></div></div>
          <div class="workspace-list">
            <RouterLink v-for="item in workspaceItems" :key="item.to" class="workspace-entry card" :to="item.to">
              <span class="workspace-entry__icon"><AppIcon :name="item.icon" :size="20" /></span>
              <span><strong>{{ item.title }}</strong><small>{{ item.description }}</small></span>
              <AppIcon class="workspace-entry__chevron" name="chevron-right" :size="18" />
            </RouterLink>
          </div>
        </section>
      </div>

      <aside class="dashboard-side">
        <section class="dashboard-panel card" aria-labelledby="writing-summary-title">
          <div class="section-heading"><div><p class="eyebrow">Writing</p><h2 id="writing-summary-title">创作概览</h2></div><RouterLink to="/creation">查看全部</RouterLink></div>
          <div v-if="loading" class="summary-loading">正在读取创作数据…</div>
          <p v-else-if="loadError" class="summary-loading">创作数据暂时不可用，其他工作台入口仍可使用。</p>
          <template v-else>
            <div class="summary-grid"><div><strong>{{ stats.published || 0 }}</strong><span>已发布</span></div><div><strong>{{ stats.drafts || 0 }}</strong><span>草稿</span></div><div><strong>{{ stats.views || 0 }}</strong><span>阅读</span></div></div>
            <div class="recent-list"><p>最近编辑</p><RouterLink v-for="post in recent" :key="post.id" :to="`/posts/${post.id}/edit`">{{ post.title || '未命名草稿' }}<small>{{ statusLabel(post.status) }} · {{ date(post.updated_at) }}</small></RouterLink><p v-if="!recent.length" class="muted">还没有文章。可以从一篇草稿开始。</p></div>
          </template>
        </section>
      </aside>
    </section>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import http from '@/services/http'
import AppIcon from '@/components/AppIcon.vue'
import UserAvatar from '@/components/UserAvatar.vue'

const user = ref<any>({})
const stats = ref<any>({})
const recent = ref<any[]>([])
const loading = ref(true)
const loadError = ref(false)
const workspaceItems = [
  { to: '/personal/info', icon: 'user', title: '个人资料', description: '更新基本资料、密码与账户信息。' },
  { to: '/personal/study', icon: 'book', title: '学习资料', description: '整理文件、Markdown、站内邮件与分类。' },
  { to: '/personal/entertainment', icon: 'folder', title: '媒体库', description: '管理图片、视频、音乐与播放内容。' },
  { to: '/creation', icon: 'pen', title: '创作中心', description: '继续写作、管理草稿和发布内容。' }
]
const date = (value: string) => new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(new Date(value))
const statusLabel = (status: string) => ({ draft: '草稿', published: '已发布', scheduled: '待发布', archived: '已归档' }[status] || '文章')

onMounted(async () => {
  const [profile, overview] = await Promise.allSettled([http.get('/api/me'), http.get('/api/dashboard/overview')])
  if (profile.status === 'fulfilled') user.value = profile.value.data.user
  if (overview.status === 'fulfilled') {
    stats.value = overview.value.data.stats || {}
    recent.value = overview.value.data.recent || []
  } else loadError.value = true
  loading.value = false
})
</script>

<style scoped>
.dashboard { width: min(1200px, calc(100% - 32px)); margin: 0 auto; }.dashboard-header, .dashboard-intro, .section-heading, .workspace-entry, .recent-list a { display: flex; align-items: center; }.dashboard-header { justify-content: space-between; gap: var(--space-4); }.dashboard-header .page-title { margin-bottom: var(--space-1); }.dashboard-intro { gap: var(--space-3); margin-top: var(--space-6); padding: var(--space-4); }.dashboard-intro > div { min-width: 0; }.dashboard-intro strong { font-size: 1.05rem; }.dashboard-intro p { margin: var(--space-1) 0 0; }.dashboard-intro .button { margin-left: auto; white-space: nowrap; }.dashboard-layout { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(280px, .85fr); gap: var(--space-5); margin-top: var(--space-6); }.section-heading { justify-content: space-between; gap: var(--space-3); margin-bottom: var(--space-3); }.section-heading h2 { margin: var(--space-1) 0 0; font-size: 1.15rem; }.section-heading a { color: var(--accent); font-size: .9rem; }.workspace-list { display: grid; gap: var(--space-2); }.workspace-entry { gap: var(--space-3); min-height: 84px; padding: var(--space-3); color: var(--text); text-decoration: none; }.workspace-entry:hover { border-color: var(--accent); }.workspace-entry__icon { display: grid; width: 40px; height: 40px; place-items: center; border-radius: var(--radius-sm); color: var(--accent); background: var(--accent-soft); }.workspace-entry span:nth-child(2) { display: grid; gap: var(--space-1); }.workspace-entry small, .recent-list small { color: var(--muted); }.workspace-entry__chevron { margin-left: auto; color: var(--subtle); }.dashboard-panel { padding: var(--space-4); }.summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-2); padding: var(--space-3) 0 var(--space-4); border-bottom: 1px solid var(--border); }.summary-grid div { display: grid; gap: var(--space-1); }.summary-grid strong { font-size: 1.45rem; letter-spacing: -.03em; }.summary-grid span, .recent-list > p { color: var(--muted); font-size: .82rem; }.recent-list { display: grid; gap: var(--space-2); margin-top: var(--space-4); }.recent-list > p { margin: 0; }.recent-list a { justify-content: space-between; gap: var(--space-2); color: var(--text); font-size: .9rem; text-decoration: none; }.recent-list a:hover { color: var(--accent); }.recent-list a small { white-space: nowrap; font-size: .75rem; }.summary-loading { margin: 0; color: var(--muted); font-size: .9rem; }.dashboard-side { min-width: 0; }
@media (max-width: 760px) { .dashboard { width: min(100% - 24px, 1200px); }.dashboard-header { align-items: flex-start; }.dashboard-header .button { flex: none; }.dashboard-intro { align-items: flex-start; flex-wrap: wrap; }.dashboard-intro .button { width: 100%; margin-left: 0; }.dashboard-layout { grid-template-columns: 1fr; }.workspace-entry { min-height: 76px; }.recent-list a { align-items: flex-start; flex-direction: column; gap: var(--space-1); } }
</style>
