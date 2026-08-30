<!-- src/layouts/Layout.vue -->
<template>
  <div class="app-shell">
    <NavigationBar />
    <router-view class="page" />
    <footer class="site-footer">
      <div class="container footer-inner">
        <p class="footer-copy">© {{ year }} Own-Web</p>
        <nav class="footer-links" aria-label="页脚导航">
          <a href="/feed.xml">RSS</a>
          <a href="https://github.com/Hqg163/Own-Web" target="_blank" rel="noreferrer noopener">GitHub</a>
          <RouterLink to="/about#contact">联系</RouterLink>
          <RouterLink to="/about">关于我</RouterLink>
          <RouterLink to="/about/site">About Site</RouterLink>
          <RouterLink to="/about/site#rules">隐私 / 内容规则</RouterLink>
        </nav>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import NavigationBar from '../NavigationBar.vue'
const year = new Date().getFullYear()
</script>

<style scoped>
.app-shell { min-height: 100vh; display: flex; flex-direction: column; }
.page { flex: 1; min-width: 0; }
.site-footer { margin-top: var(--space-8); border-top: 1px solid var(--border); background: var(--surface); }
.footer-inner { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); min-height: 72px; padding: var(--space-4) 0; }
.footer-copy { margin: 0; color: var(--muted); font-size: .86rem; }
.footer-links { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: var(--space-3); }
.footer-links a { color: var(--muted); font-size: .86rem; text-underline-offset: 3px; }
.footer-links a:hover { color: var(--text); }
@media (max-width: 640px) {
  .footer-inner { align-items: flex-start; flex-direction: column; }
  .footer-links { justify-content: flex-start; gap: var(--space-2) var(--space-3); }
}
</style>
