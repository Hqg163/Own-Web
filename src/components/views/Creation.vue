<template>
  <main class="container page-section creation-page">
    <div class="heading">
      <div>
        <p class="eyebrow">Creation</p>
        <h1 class="page-title">创作中心</h1>
        <p class="muted">管理文章、草稿和发布状态。</p>
      </div>
      <div class="heading-actions"><RouterLink class="button" to="/creation/series">系列管理</RouterLink><RouterLink class="button button-secondary" to="/creation/projects">项目管理</RouterLink><RouterLink class="button button-primary" to="/write">写文章</RouterLink></div>
    </div>

    <p v-if="deleteMessage" class="success-state" role="status">{{ deleteMessage }}</p>
    <div class="stats">
      <div class="card"><b>{{ stats.total || 0 }}</b><span>全部文章</span></div>
      <div class="card"><b>{{ stats.drafts || 0 }}</b><span>草稿</span></div>
      <div class="card"><b>{{ stats.published || 0 }}</b><span>已发布</span></div>
      <div class="card"><b>{{ stats.views || 0 }}</b><span>累计阅读</span></div>
    </div>

    <div class="filters">
      <div class="tabs" role="tablist">
        <button v-for="item in tabs" :key="item.value" class="button" :class="{ active: filter === item.value }" type="button" @click="setFilter(item.value)">{{ item.label }}</button>
      </div>
      <div class="filter-row">
        <input v-model="search" type="search" placeholder="搜索标题、摘要或正文" @keyup.enter="apply" />
        <select v-model="sort" @change="apply">
          <option value="updated">最近更新</option>
          <option value="views">阅读量</option>
          <option value="title">标题</option>
        </select>
        <button class="button button-secondary" type="button" @click="apply">搜索</button>
      </div>
    </div>

    <div v-if="loading" class="empty">正在载入文章…</div>
    <div v-else-if="loadError" class="empty error-state" role="alert">
      {{ loadError }}
      <button class="button button-secondary" type="button" @click="load">重试</button>
    </div>
    <div v-else-if="!items.length" class="empty">没有匹配的文章。</div>
    <div v-else class="articles">
      <article v-for="post in items" :key="post.id" class="card">
        <div>
          <small>{{ label(post) }} · 更新于 {{ date(post.updated_at) }}</small>
          <h2>{{ post.title || '未命名草稿' }}</h2>
          <p class="muted">{{ post.excerpt || String(post.content_markdown || '').slice(0, 120) }}</p>
          <div class="post-stats">{{ post.view_count || 0 }} 阅读 · {{ post.like_count || 0 }} 喜欢 · {{ post.comment_count || 0 }} 评论</div>
        </div>
        <div class="row">
          <RouterLink class="button" :to="`/posts/${post.id}/edit`">编辑</RouterLink>
          <RouterLink v-if="post.status === 'published'" class="button" :to="`/posts/${post.slug}`">查看</RouterLink>
          <button v-if="post.status === 'draft' || post.status === 'scheduled'" class="button button-danger" type="button" :disabled="deletingId === post.id" @click="openDelete(post)">{{ deletingId === post.id ? '删除中…' : '删除草稿' }}</button>
        </div>
      </article>
    </div>

    <div v-if="totalPages > 1" class="pagination">
      <button class="button button-secondary" :disabled="page <= 1" @click="go(page - 1)">上一页</button>
      <span>{{ page }} / {{ totalPages }}</span>
      <button class="button button-secondary" :disabled="page >= totalPages" @click="go(page + 1)">下一页</button>
    </div>

    <div v-if="deleteTarget" class="confirm-backdrop" @click.self="closeDelete">
      <form class="confirm-dialog card" role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title" @keydown.esc.stop.prevent="closeDelete" @submit.prevent="confirmDelete">
        <div class="dialog-head">
          <h2 id="delete-dialog-title">删除草稿</h2>
          <button class="icon-button" type="button" aria-label="关闭删除确认" @click="closeDelete">×</button>
        </div>
        <p>此操作会删除文章及其修订，且无法从创作中心恢复。确定删除“{{ deleteTarget.title || '未命名草稿' }}”吗？</p>
        <p v-if="deleteError" class="error" role="alert">{{ deleteError }}</p>
        <div class="dialog-actions">
          <button class="button button-secondary" type="button" :disabled="deletingId !== null" @click="closeDelete">取消</button>
          <button class="button button-danger" type="submit" :disabled="deletingId !== null">{{ deletingId !== null ? '删除中…' : '删除草稿' }}</button>
        </div>
      </form>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import http from '@/services/http'

const route = useRoute()
const router = useRouter()
const items = ref<any[]>([])
const stats = ref<any>({})
const loading = ref(true)
const loadError = ref('')
const deleteMessage = ref('')
const deleteError = ref('')
const deleteTarget = ref<any | null>(null)
const deletingId = ref<number | null>(null)
const total = ref(0)
const page = ref(1)
const pageSize = ref(12)
const search = ref(String(route.query.q || ''))
const sort = ref(String(route.query.sort || 'updated'))
const tabs = [{ value: 'all', label: '全部' }, { value: 'draft', label: '草稿' }, { value: 'scheduled', label: '定时' }, { value: 'published', label: '已发布' }, { value: 'private', label: '私密' }]
const filter = computed(() => {
  const value = String(route.query.filter || route.query.status || 'all')
  return ['all', 'draft', 'scheduled', 'published', 'private'].includes(value) ? value : 'all'
})
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const date = (value: string) => value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(new Date(value)) : '刚刚'
const label = (post: any) => post.status === 'published' ? '已发布' : post.status === 'scheduled' ? '定时发布' : post.visibility === 'private' ? '私密' : '草稿'

function query(nextPage = 1, nextFilter = filter.value) {
  const next: Record<string, string | number | undefined> = { page: nextPage, sort: sort.value, q: search.value || undefined, filter: nextFilter }
  if (['draft', 'scheduled', 'published'].includes(nextFilter)) next.status = nextFilter
  if (nextFilter === 'private') next.visibility = 'private'
  return next
}

function setFilter(value: string) { deleteMessage.value = ''; router.push({ path: '/creation', query: query(1, value) as any }) }
function apply() { deleteMessage.value = ''; router.push({ path: '/creation', query: query(1) as any }) }
function go(nextPage: number) { if (nextPage >= 1 && nextPage <= totalPages.value) router.push({ path: '/creation', query: query(nextPage) as any }) }
function openDelete(post: any) { deleteTarget.value = post; deleteError.value = ''; deleteMessage.value = '' }
function closeDelete() { if (deletingId.value === null) { deleteTarget.value = null; deleteError.value = '' } }

async function confirmDelete() {
  const post = deleteTarget.value
  if (!post || deletingId.value !== null) return
  deletingId.value = Number(post.id)
  deleteError.value = ''
  try {
    await http.delete(`/api/posts/${post.id}`)
    const shouldGoBack = items.value.length === 1 && page.value > 1
    deleteTarget.value = null
    if (shouldGoBack) await router.push({ path: '/creation', query: query(page.value - 1) as any })
    else {
      items.value = items.value.filter((item) => item.id !== post.id)
      total.value = Math.max(0, total.value - 1)
      await load()
    }
    deleteMessage.value = '草稿已删除。'
  } catch (error: any) {
    deleteError.value = error.response?.data?.error?.message || '删除草稿失败，请稍后重试'
  } finally {
    deletingId.value = null
  }
}

async function load() {
  loading.value = true
  loadError.value = ''
  page.value = Number(route.query.page) || 1
  search.value = String(route.query.q || '')
  sort.value = String(route.query.sort || 'updated')
  try {
    const params: Record<string, string | number | undefined> = { page: page.value, sort: sort.value, q: search.value || undefined }
    if (['draft', 'scheduled', 'published'].includes(filter.value)) params.status = filter.value
    if (filter.value === 'private') params.visibility = 'private'
    const [posts, overview] = await Promise.all([http.get('/api/posts', { params }), http.get('/api/dashboard/overview')])
    items.value = posts.data.items || []
    total.value = Number(posts.data.total ?? items.value.length)
    pageSize.value = Number(posts.data.pageSize || 12)
    stats.value = overview.data.stats || {}
  } catch (error: any) {
    loadError.value = error.response?.data?.error?.message || '文章暂时无法载入'
  } finally {
    loading.value = false
  }
}

watch(() => route.fullPath, load)
onMounted(load)
</script>

<style scoped>
.creation-page{max-width:1100px}.heading,.row,.heading-actions{display:flex;justify-content:space-between;align-items:center;gap:12px}.heading-actions{flex-wrap:wrap;justify-content:flex-end}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:28px 0}.stats div{padding:18px;display:grid;gap:4px}.stats b{font-size:1.7rem}.stats span,small{color:var(--muted)}.filters{display:grid;gap:var(--space-3);margin-bottom:var(--space-4)}.tabs{display:flex;gap:var(--space-1);flex-wrap:wrap}.tabs .active{border-color:var(--accent);background:var(--accent-soft);color:var(--accent)}.filter-row{display:grid;grid-template-columns:minmax(0,1fr) 160px auto;gap:var(--space-2)}.filter-row input,.filter-row select{min-height:40px;padding:0 var(--space-3);color:var(--text);background:var(--surface-raised);border:1px solid var(--border);border-radius:var(--radius-sm);font:inherit}.articles{display:grid;gap:10px}.articles article{padding:18px;display:flex;justify-content:space-between;gap:20px}.articles h2{font-size:1.15rem;margin:4px 0}.post-stats{margin-top:var(--space-2);color:var(--subtle);font-size:.82rem}.empty{display:grid;justify-items:center;gap:var(--space-2);padding:var(--space-6);color:var(--muted)}.error-state{border:1px solid var(--border);border-radius:var(--radius)}.success-state{padding:var(--space-2) var(--space-3);border:1px solid var(--accent);border-radius:var(--radius-sm);color:var(--accent);background:var(--accent-soft)}.confirm-backdrop{position:fixed;z-index:20;inset:0;display:grid;place-items:center;padding:var(--space-4);background:var(--scrim)}.confirm-dialog{width:min(560px,100%);padding:var(--space-5);background:var(--surface)}.dialog-head{display:flex;align-items:center;justify-content:space-between;gap:var(--space-3)}.dialog-head h2{margin:0;font-size:1.2rem}.dialog-actions{display:flex;justify-content:flex-end;gap:var(--space-2);margin-top:var(--space-4)}.error{color:var(--danger)}.pagination{display:flex;justify-content:center;align-items:center;gap:var(--space-3);margin-top:var(--space-5);color:var(--muted)}@media(max-width:640px){.stats{grid-template-columns:repeat(2,1fr)}.heading{align-items:start;flex-direction:column}.heading-actions{width:100%;justify-content:stretch}.heading-actions .button{flex:1}.articles article{display:block}.row{margin-top:12px;justify-content:start;flex-wrap:wrap}.filter-row{grid-template-columns:1fr}.filter-row .button{width:100%}}
</style>
