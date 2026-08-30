<template>
  <main class="container page-section home-page">
    <section class="owner-hero" aria-labelledby="home-title">
      <div v-if="owner" class="owner-identity">
        <UserAvatar :src="owner.avatar_url" :name="displayName" :size="88" />
        <div class="owner-copy">
          <p class="eyebrow">{{ owner.blog_title || '个人网站' }}</p>
          <h1 id="home-title" class="page-title">{{ displayName }}</h1>
          <p class="owner-handle">@{{ owner.username }}</p>
          <p v-if="owner.bio" class="owner-bio">{{ owner.bio }}</p>
          <ul v-if="socialLinks.length" class="social-links" aria-label="站主社交链接">
            <li v-for="link in socialLinks" :key="link.url">
              <a :href="link.url" target="_blank" rel="noreferrer noopener">
                {{ link.label }}
                <AppIcon name="external-link" :size="14" />
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div v-else class="owner-empty" role="status">
        <span class="owner-empty-icon"><AppIcon name="user" :size="24" /></span>
        <div>
          <p class="eyebrow">Own-Web</p>
          <h1 id="home-title" class="page-title">一个安静的个人写作空间</h1>
          <p class="muted">站主资料尚未公开配置。你仍然可以阅读公开文章和探索内容。</p>
        </div>
      </div>

      <div class="hero-actions">
        <RouterLink class="button button-primary" to="/explore"><AppIcon name="book" :size="17" />阅读文章</RouterLink>
        <RouterLink class="button" to="/projects"><AppIcon name="grid" :size="17" />查看项目</RouterLink>
        <RouterLink v-if="loggedIn" class="button button-ghost" to="/write"><AppIcon name="pen" :size="17" />继续写作</RouterLink>
      </div>
    </section>

    <section class="content-section" aria-labelledby="featured-title">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Selected writing</p>
          <h2 id="featured-title">精选文章</h2>
        </div>
        <RouterLink to="/explore?feed=latest">浏览全部</RouterLink>
      </div>
      <div v-if="loading" class="empty" role="status">正在载入文章…</div>
      <div v-else-if="loadError" class="empty error-state" role="alert">
        <p>{{ loadError }}</p>
        <button class="button" type="button" @click="load">重试</button>
      </div>
      <div v-else-if="!featured.length" class="empty">
        <AppIcon name="book" :size="24" />
        <p>还没有手工精选的文章。</p>
        <RouterLink class="button button-ghost" to="/explore">探索公开文章</RouterLink>
      </div>
      <div v-else class="post-grid featured-grid">
        <article v-for="post in featured" :key="post.id" class="card post">
          <RouterLink v-if="post.cover_image" class="post-cover-link" :to="`/posts/${post.slug}`" tabindex="-1" aria-hidden="true">
            <img class="post-cover" :src="post.cover_image" :alt="post.cover_alt_text || ''" width="640" height="360" loading="lazy" decoding="async" />
          </RouterLink>
          <div class="post-body">
            <p class="post-meta">{{ post.username || '公开作者' }} · {{ date(post.published_at) }} · {{ post.reading_minutes || 1 }} 分钟</p>
            <h3><RouterLink :to="`/posts/${post.slug}`">{{ post.title }}</RouterLink></h3>
            <p class="muted post-excerpt">{{ post.excerpt || excerpt(post.content_markdown) }}</p>
            <div class="post-stats"><span>{{ post.view_count || 0 }} 阅读</span><span>{{ post.like_count || 0 }} 喜欢</span><span>{{ post.comment_count || 0 }} 评论</span></div>
            <div v-if="post.categories?.length" class="tags" aria-label="文章分类">
              <span v-for="category in post.categories" :key="category.slug">{{ category.name }}</span>
            </div>
          </div>
        </article>
      </div>
    </section>

    <section class="content-section" aria-labelledby="latest-title">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Latest</p>
          <h2 id="latest-title">最新文章</h2>
        </div>
        <RouterLink to="/explore?feed=latest">查看全部</RouterLink>
      </div>
      <div v-if="!loading && !loadError && !latest.length" class="empty">
        <p>还没有公开文章。</p>
      </div>
      <div v-else-if="!loading && !loadError" class="latest-list">
        <RouterLink v-for="post in latest" :key="post.id" class="latest-item card" :to="`/posts/${post.slug}`">
          <div>
            <p class="post-meta">{{ date(post.published_at) }} · {{ post.reading_minutes || 1 }} 分钟阅读</p>
            <h3>{{ post.title }}</h3>
            <p class="muted">{{ post.excerpt || excerpt(post.content_markdown) }}</p>
          </div>
          <AppIcon name="arrow-right" :size="18" />
        </RouterLink>
      </div>
    </section>

    <section class="content-section projects-section" aria-labelledby="projects-title">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Selected projects</p>
          <h2 id="projects-title">精选项目</h2>
        </div>
        <RouterLink to="/projects">查看全部</RouterLink>
      </div>
      <div v-if="projectsLoading" class="empty" role="status">正在载入项目…</div>
      <div v-else-if="projectsError" class="empty error-state" role="alert">{{ projectsError }}</div>
      <div v-else-if="!featuredProjects.length" class="empty">
        <AppIcon name="grid" :size="24" />
        <p>{{ projects.length ? '站主还没有精选项目。' : '还没有公开项目。' }}</p>
        <RouterLink class="button button-ghost" to="/projects">浏览项目页</RouterLink>
      </div>
      <div v-else class="project-grid">
        <RouterLink v-for="project in featuredProjects" :key="project.id" class="card project-card" :to="`/projects/${project.slug}`">
          <img v-if="project.cover" class="project-cover" :src="project.cover" :alt="`${project.title} 项目封面`" width="640" height="360" loading="lazy" decoding="async" />
          <div class="project-body">
            <p v-if="project.year" class="post-meta">{{ project.year }}{{ project.role ? ` · ${project.role}` : '' }}</p>
            <h3>{{ project.title }}</h3>
            <p class="muted">{{ project.summary || '查看项目详情。' }}</p>
            <div v-if="project.tech_stack?.length" class="tags" aria-label="技术栈"><span v-for="tech in project.tech_stack.slice(0, 4)" :key="tech">{{ tech }}</span></div>
          </div>
        </RouterLink>
      </div>
    </section>

    <section class="workbench card" aria-labelledby="workspace-title">
      <div>
        <p class="eyebrow">Private workspace</p>
        <h2 id="workspace-title">写作之外，资料仍归你管理</h2>
        <p class="muted">Markdown、学习文件和图片、视频、音乐管理继续在私人工具台中可用。</p>
      </div>
      <RouterLink class="button" :to="loggedIn ? '/dashboard' : '/login?redirect=/dashboard'">{{ loggedIn ? '进入工作台' : '登录后进入工作台' }}</RouterLink>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import http from '@/services/http'

type SocialLink = { label: string; url: string }
type Owner = { username: string; blog_title?: string | null; bio?: string | null; avatar_url?: string | null; social_links?: Record<string, unknown> | null }
type Post = { id: number; slug: string; title: string; username?: string; published_at?: string | null; reading_minutes?: number; cover_image?: string | null; cover_alt_text?: string | null; excerpt?: string | null; content_markdown?: string | null; view_count?: number; like_count?: number; comment_count?: number; categories?: Array<{ slug: string; name: string }> }
type Project = { id: number; slug: string; title: string; summary?: string; cover?: string | null; year?: number | null; role?: string; tech_stack?: string[]; featured?: boolean }

const owner = ref<Owner | null>(null)
const latest = ref<Post[]>([])
const featured = ref<Post[]>([])
const projects = ref<Project[]>([])
const loading = ref(true)
const projectsLoading = ref(true)
const loadError = ref('')
const projectsError = ref('')
const loggedIn = ref(localStorage.getItem('isLoggedIn') === 'true')

const displayName = computed(() => owner.value?.username || owner.value?.blog_title || 'Own-Web')
const featuredProjects = computed(() => projects.value.filter(project => project.featured).slice(0, 3))

const socialLinks = computed<SocialLink[]>(() => {
  const values = owner.value?.social_links || {}
  const labels: Record<string, string> = { website: '个人网站', github: 'GitHub', other: '其他链接', email: '联系' }
  return Object.entries(values).filter(([, value]) => typeof value === 'string' && /^https:\/\//i.test(value)).map(([key, value]) => ({ label: labels[key] || '链接', url: value as string }))
})

const date = (value?: string | null) => value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(new Date(value)) : '刚刚'
const excerpt = (value?: string | null) => String(value || '').replace(/[#*_>`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120)

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const { data } = await http.get('/api/public/home')
    latest.value = data.latest || []
    featured.value = data.featured || []
  } catch (error: any) {
    loadError.value = error.response?.data?.error?.message || '公开文章暂时无法载入，请稍后重试。'
  } finally {
    loading.value = false
  }
}

async function loadOwner() {
  try {
    const { data } = await http.get('/api/public/site-owner')
    owner.value = data.owner || null
  } catch {
    owner.value = null
  }
}

async function loadProjects() {
  projectsLoading.value = true
  projectsError.value = ''
  try {
    const { data } = await http.get('/api/public/projects')
    projects.value = data.items || []
  } catch (error: any) {
    projectsError.value = error.response?.data?.error?.message || '项目暂时无法载入。'
  } finally {
    projectsLoading.value = false
  }
}

onMounted(() => { void Promise.all([load(), loadOwner(), loadProjects()]) })
</script>

<style scoped>
.home-page { max-width: 1120px; }
.owner-hero { padding: var(--space-6) 0 var(--space-7); }
.owner-identity, .owner-empty { display: flex; align-items: flex-start; gap: var(--space-5); max-width: 760px; }
.owner-copy { min-width: 0; }
.owner-copy .eyebrow { margin: 0 0 var(--space-2); }
.owner-copy .page-title, .owner-empty .page-title { margin: 0; font-size: clamp(2.2rem, 5vw, 4.2rem); line-height: 1.12; }
.owner-handle { margin: var(--space-2) 0 0; color: var(--muted); }
.owner-bio { max-width: 62ch; margin: var(--space-4) 0 0; color: var(--muted); font-size: 1.05rem; line-height: 1.8; }
.social-links { display: flex; flex-wrap: wrap; gap: var(--space-3); margin: var(--space-4) 0 0; padding: 0; list-style: none; }
.social-links a { display: inline-flex; align-items: center; gap: 5px; color: var(--accent); text-underline-offset: 3px; }
.hero-actions { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-6); }
.owner-empty { align-items: center; padding: var(--space-5); border: 1px dashed var(--border); border-radius: var(--radius); background: var(--surface); }
.owner-empty-icon { display: grid; flex: none; width: 48px; height: 48px; place-items: center; border-radius: 50%; color: var(--accent); background: var(--accent-soft); }
.owner-empty .eyebrow { margin: 0 0 var(--space-2); }
.owner-empty .muted { margin: var(--space-3) 0 0; }
.content-section { margin-top: var(--space-7); }
.section-heading { display: flex; align-items: end; justify-content: space-between; gap: var(--space-3); margin-bottom: var(--space-4); }
.section-heading h2 { margin: var(--space-1) 0 0; font-size: 1.55rem; }
.section-heading a { color: var(--accent); font-weight: 650; text-underline-offset: 3px; }
.post-grid, .project-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-3); }
.post, .project-card { min-width: 0; overflow: hidden; }
.post { display: flex; flex-direction: column; padding: 0; }
.post-cover-link, .project-cover { display: block; }
.post-cover, .project-cover { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; }
.post-body, .project-body { display: flex; min-width: 0; flex: 1; flex-direction: column; padding: var(--space-4); }
.post-meta { margin: 0; color: var(--subtle); font-size: .8rem; }
.post h3, .project-card h3 { margin: var(--space-2) 0; font-size: 1.12rem; line-height: 1.4; }
.post h3 a, .project-card { text-decoration: none; }
.post h3 a:hover, .project-card:hover h3 { color: var(--accent); }
.post-excerpt, .project-body > .muted { margin: 0; line-height: 1.65; }
.post-stats { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: auto; padding-top: var(--space-3); color: var(--subtle); font-size: .78rem; }
.tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: var(--space-3); }
.tags span { padding: 3px 7px; border-radius: 20px; background: var(--accent-soft); color: var(--accent); font-size: .78rem; }
.latest-list { display: grid; gap: var(--space-2); }
.latest-item { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); padding: var(--space-4); text-decoration: none; }
.latest-item:hover { border-color: var(--accent); }
.latest-item h3 { margin: var(--space-1) 0; font-size: 1.05rem; }
.latest-item p:last-child { margin: 0; line-height: 1.6; }
.latest-item > .app-icon { color: var(--accent); }
.project-card { display: flex; flex-direction: column; }
.project-body { min-height: 170px; }
.project-body h3 { margin-top: var(--space-1); }
.empty { display: grid; justify-items: center; gap: var(--space-2); padding: var(--space-6); color: var(--muted); text-align: center; }
.empty p { margin: 0; }
.error-state { border: 1px solid var(--border); border-radius: var(--radius); }
.workbench { display: flex; align-items: center; justify-content: space-between; gap: var(--space-5); margin-top: var(--space-8); padding: var(--space-5); }
.workbench h2 { margin: var(--space-1) 0 var(--space-2); font-size: 1.2rem; }
.workbench p { margin: 0; }
@media (max-width: 900px) { .post-grid, .project-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 640px) {
  .owner-identity, .owner-empty { gap: var(--space-3); }
  .owner-identity { flex-direction: column; }
  .owner-copy .page-title, .owner-empty .page-title { font-size: clamp(2rem, 12vw, 3.2rem); }
  .owner-empty { align-items: flex-start; }
  .owner-empty-icon { width: 40px; height: 40px; }
  .post-grid, .project-grid { grid-template-columns: 1fr; }
  .section-heading { align-items: flex-start; flex-direction: column; }
  .workbench { align-items: flex-start; flex-direction: column; }
  .workbench .button { width: 100%; }
}
</style>
