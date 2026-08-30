<template>
  <main class="container page-section project-detail-page">
    <div v-if="loading" class="empty" role="status">正在载入项目…</div>
    <section v-else-if="error" class="empty error-state" role="alert"><AppIcon name="info" :size="22" /><h1>项目不存在</h1><p>{{ error }}</p><RouterLink class="button button-secondary" to="/projects">返回项目</RouterLink></section>
    <article v-else-if="project" class="project-detail">
      <RouterLink class="back-link" to="/projects">← 全部项目</RouterLink>
      <header class="detail-head"><div><p v-if="project.year || project.role" class="eyebrow">{{ [project.year, project.role].filter(Boolean).join(' · ') }}</p><h1 class="page-title">{{ project.title }}</h1><p class="lead">{{ project.summary }}</p></div><div class="detail-links"><a v-if="project.github_url" class="button" :href="project.github_url" target="_blank" rel="noreferrer noopener"><AppIcon name="github" :size="16" />GitHub</a><a v-if="project.demo_url" class="button button-primary" :href="project.demo_url" target="_blank" rel="noreferrer noopener">查看演示 <AppIcon name="external-link" :size="16" /></a></div></header>
      <img v-if="project.cover" class="detail-cover" :src="project.cover" :alt="`${project.title}封面`" width="1280" height="720" fetchpriority="high" />
      <div class="detail-grid"><div class="detail-description article-typography" v-html="description"></div><aside class="card detail-aside"><h2>技术栈</h2><ul v-if="project.tech_stack?.length" class="stack-list"><li v-for="tech in project.tech_stack" :key="tech">{{ tech }}</li></ul><p v-else class="muted">未单独列出技术栈。</p></aside></div>
    </article>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import DOMPurify from 'dompurify'
import { RouterLink, useRoute } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import http from '@/services/http'

const route = useRoute()
const project = ref<any>()
const loading = ref(true)
const error = ref('')
const description = computed(() => DOMPurify.sanitize(String(project.value?.description || '').replace(/\n/g, '<br>')))
async function load() { loading.value = true; error.value = ''; try { project.value = (await http.get(`/api/public/projects/${route.params.slug}`)).data.project } catch (e: any) { error.value = e.response?.data?.error?.message || '项目暂时无法载入。' } finally { loading.value = false } }
watch(() => route.params.slug, load)
onMounted(load)
</script>

<style scoped>
.project-detail-page { max-width: 1040px; }.back-link { color: var(--accent); text-decoration: none; }.detail-head { display: flex; align-items: end; justify-content: space-between; gap: var(--space-5); margin-top: var(--space-5); }.detail-head h1 { margin: var(--space-2) 0; }.lead { max-width: 680px; margin: 0; color: var(--muted); font-size: 1.15rem; line-height: 1.7; }.detail-links { display: flex; flex-wrap: wrap; gap: var(--space-2); flex: none; }.detail-cover { display: block; width: 100%; max-height: 560px; margin: var(--space-6) 0; border-radius: var(--radius); object-fit: cover; }.detail-grid { display: grid; grid-template-columns: minmax(0, 1fr) 260px; gap: var(--space-6); align-items: start; }.detail-description { min-height: 120px; white-space: normal; }.detail-aside { padding: var(--space-4); }.detail-aside h2 { margin-top: 0; font-size: 1rem; }.stack-list { display: flex; flex-wrap: wrap; gap: var(--space-1); margin: 0; padding: 0; list-style: none; }.stack-list li { padding: 4px 9px; border: 1px solid var(--border); border-radius: 999px; color: var(--accent); font-size: .84rem; }.empty { display: grid; justify-items: center; gap: var(--space-2); padding: var(--space-8) var(--space-5); }.empty h1, .empty p { margin: 0; }.error-state { color: var(--danger); }@media (max-width: 760px) { .detail-head, .detail-grid { grid-template-columns: 1fr; display: grid; align-items: start; }.detail-links .button { flex: 1; }.detail-cover { margin: var(--space-5) 0; } }
</style>
