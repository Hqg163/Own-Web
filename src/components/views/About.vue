<template>
  <main class="container page-section about-page">
    <header class="about-hero">
      <p class="eyebrow">关于 Own-Web</p>
      <h1 class="page-title">写作、资料与媒体，归于一处。</h1>
      <p>Own-Web 是一个以长期写作与个人资料管理为核心的个人网站。它把公开文章、私有学习资料和个人媒体库放在清晰的权限边界内，而不是把它们混成一个公开空间。</p>
    </header>

    <section class="about-grid" aria-label="项目说明">
      <article class="card about-card"><span class="about-icon"><AppIcon name="pen" :size="21" /></span><h2>公开写作</h2><p>注册用户拥有独立博客主页，可发布公开、私密、关注者可见和仅链接可见的文章。公开内容可以在首页与探索页阅读。</p></article>
      <article class="card about-card"><span class="about-icon"><AppIcon name="archive" :size="21" /></span><h2>私有工作台</h2><p>学习文件、Markdown、站内邮件和媒体库仅在登录后的工作台中使用。资源读取和修改均由当前会话在服务端校验。</p></article>
      <article class="card about-card"><span class="about-icon"><AppIcon name="heart" :size="21" /></span><h2>克制社区</h2><p>平台提供关注、点赞、收藏、评论、通知与举报；不包含支付、等级或实时聊天等会干扰阅读和创作的功能。</p></article>
    </section>

    <section class="about-columns">
      <article class="card about-panel"><h2><AppIcon name="shield" :size="20" />隐私与可见性</h2><ul><li>私有文章只对作者本人开放。</li><li>关注者文章仅对作者及已关注该作者的用户开放。</li><li>仅链接文章不出现在首页、搜索、探索和公开归档中。</li><li>工作台中的学习资料和媒体不会被公开博客接口读取。</li></ul></article>
      <article class="card about-panel"><h2><AppIcon name="info" :size="20" />内容规范与反馈</h2><ul><li>请只发布自己拥有权利或获授权使用的内容。</li><li>公开内容支持举报，举报会保留审核状态供管理员处理。</li><li>个人主页的联系方式由作者在其资料中自行配置；本项目目前没有虚构的客服或第三方登录入口。</li></ul></article>
    </section>

    <p class="about-stack">技术实现：Vue 3、TypeScript、Vite、Express 与 MySQL。<RouterLink to="/explore">探索公开文章</RouterLink> 或 <RouterLink to="/register">创建账户</RouterLink>。</p>
  </main>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
</script>

<style scoped>
.about-page { max-width: 1120px; }.about-hero { max-width: 760px; }.about-hero .page-title { max-width: 12ch; }.about-hero > p:last-child { margin: var(--space-4) 0 0; color: var(--muted); font-size: 1.03rem; line-height: 1.82; }.about-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-3); margin-top: var(--space-8); }.about-card { padding: var(--space-5); }.about-icon { display: grid; width: 40px; height: 40px; place-items: center; border-radius: var(--radius-sm); background: var(--accent-soft); color: var(--accent); }.about-card h2 { margin: var(--space-4) 0 var(--space-2); color: var(--text); font-size: 1.05rem; }.about-card p { margin: 0; color: var(--muted); line-height: 1.72; }.about-columns { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); margin-top: var(--space-5); }.about-panel { padding: var(--space-5); }.about-panel h2 { display: flex; align-items: center; gap: var(--space-2); margin: 0; color: var(--text); font-size: 1.05rem; }.about-panel h2 svg { color: var(--accent); }.about-panel ul { display: grid; gap: var(--space-2); margin: var(--space-4) 0 0; padding-left: 1.25em; color: var(--muted); line-height: 1.65; }.about-stack { margin: var(--space-6) 0 0; color: var(--muted); }.about-stack a { color: var(--accent); text-underline-offset: 3px; } @media (max-width: 760px) { .about-grid, .about-columns { grid-template-columns: 1fr; }.about-hero .page-title { max-width: none; } }
</style>
