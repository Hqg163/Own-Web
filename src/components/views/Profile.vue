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
        <div v-if="!posts.length" class="empty">尚未发布公开文章。</div>
        <div v-else class="list"><RouterLink v-for="post in posts" :key="post.id" class="post card" :to="`/posts/${post.slug}`"><small>{{ date(post.published_at) }} · {{ post.reading_minutes }} 分钟</small><h3>{{ post.title }}</h3><p>{{ post.excerpt }}</p></RouterLink></div>
      </section>
    </template>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import http from '@/services/http'
import UserAvatar from '@/components/UserAvatar.vue'
import AppIcon from '@/components/AppIcon.vue'

const route = useRoute()
const user = ref<any>()
const posts = ref<any[]>([])
const loading = ref(true)
const loadError = ref('')
const followPending = ref(false)
const followError = ref('')
const mine = computed(() => JSON.parse(localStorage.getItem('userInfo') || '{}').blog_slug === route.params.username)
const archive = computed(() => route.path.endsWith('/posts'))
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
  try {
    const [profileResponse, postsResponse] = await Promise.all([
      http.get(`/api/public/users/${route.params.username}`),
      http.get(`/api/public/users/${route.params.username}/posts`)
    ])
    user.value = profileResponse.data.user
    posts.value = postsResponse.data.items
  } catch (error: any) {
    loadError.value = error.response?.status === 404 ? '该主页不存在，或作者已将其设为私密。' : '暂时无法载入主页，请稍后重试。'
  } finally {
    loading.value = false
  }
}

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

onMounted(load)
</script>

<style scoped>
.profile-page { max-width: 960px; }.profile { display: flex; align-items: flex-start; gap: var(--space-4); margin-bottom: var(--space-7); padding: var(--space-5); }.profile-summary { min-width: 0; }.profile-summary .page-title { margin: 0; }.profile-summary > .muted { margin: var(--space-2) 0 0; line-height: 1.7; }.stats { font-size: .9rem; }.follow-control { display: grid; flex: none; gap: var(--space-2); margin-left: auto; }.follow-control .button { display: inline-flex; align-items: center; gap: 6px; justify-content: center; min-width: 88px; }.interaction-error { max-width: 220px; margin: 0; color: var(--danger); font-size: .82rem; line-height: 1.5; }.social-links { display: flex; flex-wrap: wrap; gap: var(--space-2); margin: var(--space-3) 0 0; padding: 0; list-style: none; }.social-links a { display: inline-flex; align-items: center; gap: 4px; color: var(--accent); font-size: .88rem; text-underline-offset: 3px; }.section-heading { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); margin-bottom: var(--space-3); }.section-heading h2 { margin: 0; font-size: 1.25rem; }.section-heading a { color: var(--accent); font-size: .9rem; text-underline-offset: 3px; }.list { display: grid; gap: var(--space-2); }.post { display: block; padding: var(--space-4); color: inherit; text-decoration: none; }.post:hover { border-color: var(--accent); transform: translateY(-1px); }.post h3 { margin: var(--space-1) 0; font-size: 1.08rem; }.post p, .post small { color: var(--muted); }.post p { margin: 0; line-height: 1.65; }.empty { display: grid; justify-items: start; gap: var(--space-2); padding: var(--space-6); border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); color: var(--muted); }.error-state h1, .error-state p { margin: 0; }.error-state h1 { color: var(--text); font-size: 1.15rem; }.error-state .button { margin-top: var(--space-2); }
@media (max-width: 640px) { .profile { flex-wrap: wrap; padding: var(--space-4); }.follow-control { width: 100%; margin-left: 0; }.follow-control .button { width: 100%; }.interaction-error { max-width: none; }.social-links { gap: var(--space-3); } }
</style>
