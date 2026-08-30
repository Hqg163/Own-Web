<template>
  <main class="container page-section projects-page">
    <header class="page-intro">
      <p class="eyebrow">Selected work</p>
      <h1 class="page-title">项目与作品</h1>
      <p class="muted">这里记录站主公开展示的项目、职责和技术选择。</p>
    </header>
    <div v-if="loading" class="empty" role="status">正在载入项目…</div>
    <section v-else-if="error" class="empty error-state" role="alert"><AppIcon name="info" :size="22" /><p>{{ error }}</p><button class="button button-secondary" type="button" @click="load">重试</button></section>
    <section v-else-if="!projects.length" class="empty" aria-label="项目为空"><AppIcon name="archive" :size="24" /><h2>还没有公开项目</h2><p>站主正在整理可公开展示的作品。</p></section>
    <section v-else class="project-grid" aria-label="公开项目">
      <RouterLink v-for="project in projects" :key="project.id" class="project-card card" :to="`/projects/${project.slug}`">
        <img v-if="project.cover" :src="project.cover" :alt="`${project.title}封面`" width="640" height="360" loading="lazy" decoding="async" />
        <div class="project-card-body"><p v-if="project.year" class="project-meta">{{ project.year }}<span v-if="project.role"> · {{ project.role }}</span></p><h2>{{ project.title }}</h2><p class="muted">{{ project.summary || '查看项目详情与技术选择。' }}</p><ul v-if="project.tech_stack?.length" class="chips" aria-label="技术栈"><li v-for="tech in project.tech_stack.slice(0, 6)" :key="tech">{{ tech }}</li></ul></div>
      </RouterLink>
    </section>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import http from '@/services/http'

const projects = ref<any[]>([])
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try { projects.value = (await http.get('/api/public/projects')).data.items || [] }
  catch (e: any) { error.value = e.response?.data?.error?.message || '项目暂时无法载入。' }
  finally { loading.value = false }
}

onMounted(load)
</script>

<style scoped>
.projects-page { max-width: 1120px; }.page-intro { max-width: 680px; margin-bottom: var(--space-7); }.page-intro p:last-child { margin-bottom: 0; line-height: 1.7; }.project-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-4); }.project-card { display: flex; min-width: 0; flex-direction: column; overflow: hidden; color: inherit; text-decoration: none; }.project-card:hover { border-color: var(--accent); }.project-card > img { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; }.project-card-body { display: grid; gap: var(--space-2); padding: var(--space-5); }.project-card h2 { margin: 0; font-size: 1.25rem; }.project-card p { margin: 0; line-height: 1.65; }.project-meta { color: var(--subtle); font-size: .84rem; }.chips { display: flex; flex-wrap: wrap; gap: var(--space-1); margin: var(--space-2) 0 0; padding: 0; list-style: none; }.chips li { padding: 3px 8px; border-radius: 999px; background: var(--accent-soft); color: var(--accent); font-size: .78rem; }.empty { display: grid; justify-items: center; gap: var(--space-2); padding: var(--space-8) var(--space-5); }.empty h2, .empty p { margin: 0; }.error-state { color: var(--danger); }.error-state p { color: var(--danger); }@media (max-width: 680px) { .project-grid { grid-template-columns: 1fr; }.project-card-body { padding: var(--space-4); } }
</style>
