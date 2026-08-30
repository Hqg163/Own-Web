<template>
  <main class="container page-section not-found-page">
    <section class="card not-found-card" aria-labelledby="not-found-title">
      <p class="eyebrow">404 · Not found</p>
      <h1 id="not-found-title" class="page-title">这页暂时不存在</h1>
      <p class="muted">链接可能已经改变，或者内容没有公开。你可以回到首页，搜索文章，或继续探索公开内容。</p>
      <div class="not-found-actions">
        <RouterLink class="button button-primary" to="/"><AppIcon name="home" :size="17" />返回首页</RouterLink>
        <RouterLink class="button" to="/explore"><AppIcon name="search" :size="17" />搜索文章</RouterLink>
        <RouterLink class="button button-ghost" to="/explore">探索内容</RouterLink>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
</script>

<style scoped>
.not-found-page { display: grid; min-height: min(620px, calc(100vh - 160px)); place-items: center; }
.not-found-card { width: min(100%, 680px); padding: clamp(var(--space-5), 7vw, var(--space-8)); text-align: center; }
.not-found-card .eyebrow { margin: 0; }
.not-found-card .page-title { margin: var(--space-2) 0; }
.not-found-card > p:not(.eyebrow) { max-width: 48ch; margin: 0 auto; line-height: 1.8; }
.not-found-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--space-2); margin-top: var(--space-5); }
@media (max-width: 440px) { .not-found-actions { align-items: stretch; flex-direction: column; } }
</style>
