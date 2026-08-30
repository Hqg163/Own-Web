<template>
  <main class="container page-section about-site-page">
    <header class="site-heading">
      <p class="eyebrow">About this site</p>
      <h1 class="page-title">关于这个网站</h1>
      <p class="lead">Own-Web 把公开写作、克制的社区互动和私人的资料工作台放在清晰的边界里。</p>
      <RouterLink class="back-link" to="/about"><AppIcon name="arrow-left" :size="16" />返回关于我</RouterLink>
    </header>

    <div class="site-grid">
      <section class="card site-card">
        <span class="site-icon"><AppIcon name="pen" :size="21" /></span>
        <h2>公开写作</h2>
        <p>公开文章可以在首页、探索页、作者主页和公开归档中阅读。文章的可见性由服务端判断，未公开内容不会因为客户端链接而变成公开内容。</p>
      </section>
      <section class="card site-card">
        <span class="site-icon"><AppIcon name="archive" :size="21" /></span>
        <h2>私人工作台</h2>
        <p>Markdown、学习文件、站内邮件以及图片、视频、音乐管理都属于登录后的工作台。资源的读取与修改会校验当前会话和归属关系。</p>
      </section>
      <section class="card site-card">
        <span class="site-icon"><AppIcon name="heart" :size="21" /></span>
        <h2>克制社区</h2>
        <p>关注、点赞、收藏、评论、通知和举报服务于阅读与写作。营销、会员、排行榜、实时聊天等扩展保持在当前产品范围之外。</p>
      </section>
    </div>

    <div class="site-columns">
      <section class="card site-panel" aria-labelledby="privacy-title">
        <h2 id="privacy-title"><AppIcon name="shield" :size="20" />隐私与可见性</h2>
        <ul>
          <li>私有文章只对作者本人开放。</li>
          <li>关注者文章仅对作者及已关注该作者的用户开放。</li>
          <li>仅链接文章不出现在首页、搜索、探索和公开归档中。</li>
          <li>工作台中的学习资料和媒体不会被公开博客接口读取。</li>
        </ul>
      </section>
      <section id="rules" class="card site-panel" aria-labelledby="rules-title">
        <h2 id="rules-title"><AppIcon name="info" :size="20" />内容规则与反馈</h2>
        <ul>
          <li>只发布自己拥有权利或获授权使用的内容。</li>
          <li>公开内容支持举报，举报会保留审核状态供管理员处理。</li>
          <li>不要在公开文章、评论或上传内容中放置不应公开的个人信息。</li>
          <li>如果发现内容问题，请通过公开的联系渠道或站内举报功能反馈。</li>
        </ul>
      </section>
    </div>

    <section class="technology" aria-labelledby="technology-title">
      <p class="eyebrow">Built with</p>
      <h2 id="technology-title">技术栈</h2>
      <p class="muted">Vue 3、TypeScript、Vite、Express 与 MySQL。产品和数据边界会随着实际使用继续小步演进。</p>
    </section>
  </main>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
</script>

<style scoped>
.about-site-page { max-width: 1120px; }
.site-heading { max-width: 760px; }
.site-heading .page-title { margin-bottom: var(--space-2); }
.lead { margin: 0; color: var(--muted); font-size: 1.08rem; line-height: 1.8; }
.back-link { display: inline-flex; align-items: center; gap: var(--space-2); margin-top: var(--space-4); color: var(--accent); text-underline-offset: 3px; }
.site-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-3); margin-top: var(--space-7); }
.site-card { padding: var(--space-5); }
.site-icon { display: grid; width: 40px; height: 40px; place-items: center; border-radius: var(--radius-sm); background: var(--accent-soft); color: var(--accent); }
.site-card h2 { margin: var(--space-4) 0 var(--space-2); font-size: 1.08rem; }
.site-card p { margin: 0; color: var(--muted); line-height: 1.75; }
.site-columns { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); margin-top: var(--space-5); }
.site-panel { padding: var(--space-5); }
.site-panel h2 { display: flex; align-items: center; gap: var(--space-2); margin: 0; font-size: 1.08rem; }
.site-panel h2 .app-icon { color: var(--accent); }
.site-panel ul { display: grid; gap: var(--space-2); margin: var(--space-4) 0 0; padding-left: 1.25em; color: var(--muted); line-height: 1.7; }
.technology { margin-top: var(--space-8); }
.technology .eyebrow { margin: 0 0 var(--space-1); }
.technology h2 { margin: 0; font-size: 1.25rem; }
.technology p { max-width: 60ch; margin: var(--space-2) 0 0; line-height: 1.75; }
@media (max-width: 760px) { .site-grid, .site-columns { grid-template-columns: 1fr; } .site-card, .site-panel { padding: var(--space-4); } }
</style>
