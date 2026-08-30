<template>
  <main class="container page-section series-page">
    <div v-if="loading" class="empty" role="status">正在载入系列…</div>
    <section v-else-if="error" class="empty error-state" role="alert"><AppIcon name="info" :size="22" /><h1>系列不存在</h1><p>{{ error }}</p><RouterLink class="button button-secondary" to="/explore">返回探索</RouterLink></section>
    <article v-else-if="series">
      <header class="series-head"><img v-if="series.cover" :src="series.cover" :alt="`${series.name}封面`" width="480" height="270" /><div><p class="eyebrow">Series · {{ series.article_count }} 篇文章 · 约 {{ series.total_reading_minutes }} 分钟</p><h1 class="page-title">{{ series.name }}</h1><p class="muted">{{ series.description || '按顺序阅读这个系列。' }}</p><RouterLink :to="`/u/${series.blog_slug}`" class="author-link">{{ series.username }} 的系列</RouterLink></div></header>
      <ol class="article-list" aria-label="系列文章"><li v-for="(article, index) in series.articles" :key="article.id" class="card"><span class="article-number">{{ String(Number(article.series_order || (Number(index) + 1))).padStart(2, '0') }}</span><div><RouterLink :to="`/posts/${article.slug}`"><h2>{{ article.title }}</h2></RouterLink><p class="muted">{{ article.excerpt || '打开文章阅读正文。' }}</p><small class="muted">{{ article.reading_minutes }} 分钟阅读 · {{ date(article.published_at) }}</small></div></li></ol>
    </article>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import http from '@/services/http'

const route = useRoute(); const series = ref<any>(); const loading = ref(true); const error = ref('')
const date = (value: string | null) => value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(new Date(value)) : '刚刚'
async function load() { loading.value = true; error.value = ''; try { series.value = (await http.get(`/api/public/series/${route.params.slug}`)).data.series } catch (e: any) { error.value = e.response?.data?.error?.message || '系列暂时无法载入。' } finally { loading.value = false } }
watch(() => route.params.slug, load); onMounted(load)
</script>

<style scoped>
.series-page { max-width: 940px; }.series-head { display: grid; grid-template-columns: 180px minmax(0, 1fr); gap: var(--space-5); align-items: center; margin-bottom: var(--space-7); }.series-head img { width: 100%; aspect-ratio: 16 / 9; border-radius: var(--radius); object-fit: cover; }.series-head h1 { margin: var(--space-2) 0; }.series-head p { line-height: 1.7; }.author-link { color: var(--accent); text-underline-offset: 3px; }.article-list { display: grid; gap: var(--space-2); margin: 0; padding: 0; list-style: none; }.article-list li { display: grid; grid-template-columns: 56px minmax(0, 1fr); gap: var(--space-3); padding: var(--space-4); }.article-number { color: var(--accent); font-family: ui-monospace, monospace; font-size: 1.1rem; }.article-list h2 { margin: 0; font-size: 1.15rem; }.article-list a { color: inherit; text-decoration: none; }.article-list a:hover { color: var(--accent); }.article-list p { margin: var(--space-1) 0; line-height: 1.6; }.empty { display: grid; justify-items: center; gap: var(--space-2); padding: var(--space-8) var(--space-5); }.empty h1, .empty p { margin: 0; }.error-state { color: var(--danger); }@media (max-width: 620px) { .series-head { grid-template-columns: 1fr; }.series-head img { max-width: 320px; } }
</style>
