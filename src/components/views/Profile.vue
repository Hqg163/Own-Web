<template>
  <main class="container page-section profile-page">
    <div v-if="loading" class="empty" role="status">正在载入主页…</div>
    <section v-else-if="loadError" class="empty error-state" role="alert">
      <AppIcon name="info" :size="22" />
      <h1>无法打开此主页</h1>
      <p>{{ loadError }}</p>
      <RouterLink class="button button-secondary" to="/explore">浏览公开文章</RouterLink>
    </section>
    <template v-else-if="user">
      <section class="profile card">
        <UserAvatar :src="user.avatar_url || user.avatar_path" :name="user.username" :size="72" />
        <div class="profile-summary">
          <p class="eyebrow">个人博客</p>
          <h1 class="page-title">{{ user.blog_title || user.username }}</h1>
          <p class="muted">{{ user.bio || '这个作者暂时还没有留下简介。' }}</p>
          <p class="muted stats">{{ user.post_count }} 篇公开文章 · {{ user.follower_count }} 位关注者</p>
          <ul v-if="socialLinks.length" class="social-links" aria-label="社交链接">
            <li v-for="link in socialLinks" :key="link.url"><a :href="link.url" target="_blank" rel="noreferrer noopener">{{ link.label }}<AppIcon name="external-link" :size="14" /></a></li>
          </ul>
        </div>
        <div v-if="!mine" class="follow-control">
          <button class="button" type="button" :disabled="followPending" :aria-busy="followPending" @click="follow"><AppIcon v-if="user.following" name="check" :size="16" />{{ followPending ? '处理中…' : (user.following ? '已关注' : '关注') }}</button>
          <p v-if="followError" class="interaction-error" role="alert">{{ followError }}</p>
        </div>
      </section>

      <section aria-labelledby="profile-posts-title">
        <div class="section-heading"><h2 id="profile-posts-title">公开文章</h2><RouterLink v-if="!archive" :to="`/u/${route.params.username}/posts`">查看归档</RouterLink></div>
        <form v-if="archive" class="archive-filters" aria-label="归档筛选" @submit.prevent="applyFilters"><input v-model="filters.year" inputmode="numeric" pattern="\d{4}" maxlength="4" placeholder="年份" aria-label="年份" /><input v-model="filters.month" inputmode="numeric" pattern="(?:[1-9]|1[0-2])" maxlength="2" placeholder="月份" aria-label="月份" /><select v-model="filters.category" aria-label="分类"><option value="">全部分类</option><option v-for="item in taxonomy.categories" :key="item.slug" :value="item.slug">{{ item.name }}</option></select><select v-model="filters.tag" aria-label="标签"><option value="">全部标签</option><option v-for="item in taxonomy.tags" :key="item.slug" :value="item.slug">{{ item.name }}</option></select><select v-model="filters.series" aria-label="系列"><option value="">全部系列</option><option v-for="item in user?.series || []" :key="item.slug" :value="item.slug">{{ item.name }}</option></select><button class="button button-secondary" type="submit">筛选</button><button v-if="hasFilters" class="button button-ghost" type="button" @click="clearFilters">清除</button></form>
        <div v-if="archive && archiveGroups.length" class="archive-groups"><section v-for="group in archiveGroups" :key="group.key" class="archive-group"><h3>{{ group.label }}</h3><div class="list"><RouterLink v-for="post in group.items" :key="post.id" class="post card" :to="`/posts/${post.slug}`"><img v-if="post.cover_image" :src="post.cover_image" :alt="post.cover_alt_text || ''" width="140" height="79" loading="lazy" decoding="async" /><div><small>{{ date(post.published_at) }} · {{ post.reading_minutes }} 分钟</small><h4>{{ post.title }}</h4><p>{{ post.excerpt }}</p></div></RouterLink></div></section></div>
        <div v-if="!posts.length" class="empty">尚未发布公开文章。</div>
        <div v-else-if="!archive" class="list"><RouterLink v-for="post in posts" :key="post.id" class="post card" :to="`/posts/${post.slug}`"><img v-if="post.cover_image" :src="post.cover_image" :alt="post.cover_alt_text || ''" width="140" height="79" loading="lazy" decoding="async" /><div><small>{{ date(post.published_at) }} · {{ post.reading_minutes }} 分钟</small><h3>{{ post.title }}</h3><p>{{ post.excerpt }}</p></div></RouterLink></div><div v-if="totalPages>1" class="pagination"><button class="button button-secondary" :disabled="page<=1" @click="go(page-1)">上一页</button><span>{{page}} / {{totalPages}}</span><button class="button button-secondary" :disabled="page>=totalPages" @click="go(page+1)">下一页</button></div>
      </section>
    </template>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, RouterLink, useRouter } from 'vue-router'
import http from '@/services/http'
import UserAvatar from '@/components/UserAvatar.vue'
import AppIcon from '@/components/AppIcon.vue'

const route = useRoute(), router = useRouter()
const user = ref<any>()
const posts = ref<any[]>([])
const total = ref(0), page = ref(1), pageSize = ref(12)
const taxonomy = ref<{ categories: any[]; tags: any[] }>({ categories: [], tags: [] })
const filters = ref({ year: String(route.query.year || ''), month: String(route.query.month || ''), category: String(route.query.category || ''), tag: String(route.query.tag || ''), series: String(route.query.series || '') })
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const loading = ref(true)
const loadError = ref('')
const followPending = ref(false)
const followError = ref('')
const mine = computed(() => JSON.parse(localStorage.getItem('userInfo') || '{}').blog_slug === route.params.username)
const archive = computed(() => route.path.endsWith('/posts'))
const hasFilters = computed(() => Object.values(filters.value).some(Boolean))
const archiveGroups = computed(() => Object.entries((user.value && (user.value as any).archiveGroups) || {}).map(([key, items]) => ({ key, label: key === '未分类' ? key : key.replace('-', ' 年 ') + ' 月', items: items as any[] })))
const date = (value: string) => new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(new Date(value))
const socialLinks = computed(() => {
  let raw = user.value?.social_links
  if (typeof raw === 'string') { try { raw = JSON.parse(raw) } catch (_) { raw = {} } }
  const labels: Record<string, string> = { website: '个人网站', github: 'GitHub', other: '其他链接' }
  return Object.entries(labels).flatMap(([key, label]) => typeof raw?.[key] === 'string' && /^https?:\/\//.test(raw[key]) ? [{ label, url: raw[key] }] : [])
})

async function load() {
  loading.value = true
  loadError.value = ''
  filters.value = { year: String(route.query.year || ''), month: String(route.query.month || ''), category: String(route.query.category || ''), tag: String(route.query.tag || ''), series: String(route.query.series || '') }
  try {
    const [profileResponse, postsResponse, taxonomyResponse] = await Promise.all([
      http.get(`/api/public/users/${route.params.username}`),
      http.get(`/api/public/users/${route.params.username}/posts`, { params: { page: Number(route.query.page) || 1, ...(archive.value ? { year: filters.value.year || undefined, month: filters.value.month || undefined, category: filters.value.category || undefined, tag: filters.value.tag || undefined, series: filters.value.series || undefined } : {}) } }),
      http.get('/api/public/taxonomy')
    ])
    user.value = profileResponse.data.user
    posts.value = postsResponse.data.items
    total.value = Number(postsResponse.data.total || posts.value.length)
    page.value = Number(postsResponse.data.page || 1)
    pageSize.value = Number(postsResponse.data.pageSize || 12)
    ;(user.value as any).archiveGroups = postsResponse.data.groups || {}
    taxonomy.value = taxonomyResponse.data || taxonomy.value
  } catch (error: any) {
    loadError.value = error.response?.status === 404 ? '该主页不存在，或作者已将其设为私密。' : '暂时无法载入主页，请稍后重试。'
  } finally {
    loading.value = false
  }
}

function go(next: number) {
  if (next >= 1 && next <= totalPages.value) router.push({ path: route.path, query: { ...route.query, page: String(next) } })
}
function applyFilters() { const query: Record<string, string> = {}; Object.entries(filters.value).forEach(([key, value]) => { if (value) query[key] = value }); router.push({ path: route.path, query }) }
function clearFilters() { filters.value = { year: '', month: '', category: '', tag: '', series: '' }; applyFilters() }

async function follow() {
  if (!localStorage.getItem('isLoggedIn')) { window.location.assign('/login'); return }
  if (followPending.value) return
  followPending.value = true
  followError.value = ''
  try {
    if (user.value.following) await http.delete(`/api/users/${route.params.username}/follow`)
    else await http.post(`/api/users/${route.params.username}/follow`)
    user.value.following = !user.value.following
    user.value.follower_count += user.value.following ? 1 : -1
  } catch (error: any) {
    followError.value = error.response?.data?.error?.message || '关注状态更新失败，请稍后重试。'
  } finally {
    followPending.value = false
  }
}

watch(() => route.fullPath, load)
onMounted(load)
</script>

<style scoped>
.profile-page { max-width: 960px; }.profile { display: flex; align-items: flex-start; gap: var(--space-4); margin-bottom: var(--space-7); padding: var(--space-5); }.profile-summary { min-width: 0; }.profile-summary .page-title { margin: 0; }.profile-summary > .muted { margin: var(--space-2) 0 0; line-height: 1.7; }.stats { font-size: .9rem; }.follow-control { display: grid; flex: none; gap: var(--space-2); margin-left: auto; }.follow-control .button { display: inline-flex; align-items: center; gap: 6px; justify-content: center; min-width: 88px; }.interaction-error { max-width: 220px; margin: 0; color: var(--danger); font-size: .82rem; line-height: 1.5; }.social-links { display: flex; flex-wrap: wrap; gap: var(--space-2); margin: var(--space-3) 0 0; padding: 0; list-style: none; }.social-links a { display: inline-flex; align-items: center; gap: 4px; color: var(--accent); font-size: .88rem; text-underline-offset: 3px; }.section-heading { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); margin-bottom: var(--space-3); }.section-heading h2 { margin: 0; font-size: 1.25rem; }.section-heading a { color: var(--accent); font-size: .9rem; text-underline-offset: 3px; }.list { display: grid; gap: var(--space-2); }.post { display:flex;align-items:center;gap:var(--space-3);padding: var(--space-4); color: inherit; text-decoration: none; }.post:hover { border-color: var(--accent); transform: translateY(-1px); }.post img{width:140px;aspect-ratio:16/9;object-fit:cover;border-radius:var(--radius-sm)}.post>div{min-width:0}.post h3 { margin: var(--space-1) 0; font-size: 1.08rem; }.post p, .post small { color: var(--muted); }.post p { margin: 0; line-height: 1.65; }.pagination{display:flex;justify-content:center;align-items:center;gap:var(--space-3);margin-top:var(--space-5);color:var(--muted)}.empty { display: grid; justify-items: start; gap: var(--space-2); padding: var(--space-6); border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); color: var(--muted); }.error-state h1, .error-state p { margin: 0; }.error-state h1 { color: var(--text); font-size: 1.15rem; }.error-state .button { margin-top: var(--space-2); }
.archive-filters { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-2); margin-bottom: var(--space-4); }
.archive-filters input, .archive-filters select { min-width: 0; min-height: 40px; padding: 0 var(--space-3); border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); color: var(--text); }
.archive-filters .button { min-height: 40px; }.archive-groups { display: grid; gap: var(--space-6); }.archive-group h3 { margin: 0 0 var(--space-2); font-size: 1.05rem; color: var(--muted); }.archive-group .post h4 { margin: var(--space-1) 0; font-size: 1.08rem; }
@media (max-width: 640px) { .profile { flex-wrap: wrap; padding: var(--space-4); }.follow-control { width: 100%; margin-left: 0; }.follow-control .button { width: 100%; }.interaction-error { max-width: none; }.social-links { gap: var(--space-3); }.post{align-items:start}.post img{width:96px}.pagination{margin-bottom:var(--space-4)} }
</style>
