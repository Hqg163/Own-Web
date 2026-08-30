<template>
  <main class="container page-section about-page">
    <header class="about-heading">
      <p class="eyebrow">About me</p>
      <h1 class="page-title">关于我</h1>
      <p class="muted">这里记录正在思考、制作和长期维护的内容。</p>
    </header>

    <div v-if="loading" class="empty" role="status">正在载入站主资料…</div>
    <div v-else-if="owner" class="person-layout">
      <section class="card person-card" aria-labelledby="person-name">
        <UserAvatar :src="owner.avatar_url" :name="displayName" :size="104" />
        <div class="person-copy">
          <p class="eyebrow">{{ owner.blog_title || '个人写作者' }}</p>
          <h2 id="person-name">{{ displayName }}</h2>
          <p class="handle">@{{ owner.username }}</p>
          <p v-if="owner.bio" class="bio">{{ owner.bio }}</p>
          <ul v-if="socialLinks.length" class="social-links" aria-label="公开链接">
            <li v-for="link in socialLinks" :key="link.url">
              <a :href="link.url" target="_blank" rel="noreferrer noopener">{{ link.label }}<AppIcon name="external-link" :size="14" /></a>
            </li>
          </ul>
        </div>
      </section>

      <section class="about-copy" aria-labelledby="about-writing-title">
        <p class="eyebrow">A personal archive</p>
        <h2 id="about-writing-title">把值得重读的东西留下来</h2>
        <p>公开文章、项目和系列是这个网站的对外部分；它们围绕实际的阅读、写作与制作过程展开。你可以从<a href="#contact">公开链接</a>联系站主，也可以直接去阅读文章或查看项目。</p>
        <div class="about-actions">
          <RouterLink class="button button-primary" to="/explore"><AppIcon name="book" :size="17" />阅读文章</RouterLink>
          <RouterLink class="button" to="/projects"><AppIcon name="grid" :size="17" />查看项目</RouterLink>
          <RouterLink class="button button-ghost" to="/about/site">了解网站</RouterLink>
        </div>
      </section>
    </div>
    <section v-else class="empty profile-empty" role="status">
      <AppIcon name="user" :size="26" />
      <h2>站主资料尚未公开</h2>
      <p>目前还没有可公开展示的个人资料。你可以先探索公开文章。</p>
      <RouterLink class="button button-primary" to="/explore">探索文章</RouterLink>
    </section>

    <section id="contact" class="contact-panel card" aria-labelledby="contact-title">
      <div>
        <p class="eyebrow">Contact</p>
        <h2 id="contact-title">公开联系渠道</h2>
      </div>
      <p v-if="socialLinks.length" class="muted">请通过上方公开链接联系站主。</p>
      <p v-else class="muted">站主尚未公开联系渠道。</p>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import http from '@/services/http'

type Owner = { username: string; blog_title?: string | null; bio?: string | null; avatar_url?: string | null; social_links?: Record<string, unknown> | null }
type SocialLink = { label: string; url: string }

const owner = ref<Owner | null>(null)
const loading = ref(true)
const displayName = computed(() => owner.value?.username || owner.value?.blog_title || 'Own-Web')
const socialLinks = computed<SocialLink[]>(() => {
  const values = owner.value?.social_links || {}
  const labels: Record<string, string> = { website: '个人网站', github: 'GitHub', other: '其他链接' }
  return Object.entries(values).filter(([, value]) => typeof value === 'string' && /^https:\/\//i.test(value)).map(([key, value]) => ({ label: labels[key] || '链接', url: value as string }))
})

onMounted(async () => {
  try {
    const { data } = await http.get('/api/public/site-owner')
    owner.value = data.owner || null
  } catch {
    owner.value = null
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.about-page { max-width: 1120px; }
.about-heading { max-width: 680px; }
.about-heading .page-title { margin-bottom: var(--space-2); }
.about-heading > .muted { margin: 0; font-size: 1.05rem; }
.person-layout { display: grid; grid-template-columns: minmax(280px, .85fr) minmax(0, 1.15fr); gap: var(--space-6); align-items: start; margin-top: var(--space-7); }
.person-card { display: flex; align-items: flex-start; gap: var(--space-4); padding: var(--space-5); }
.person-copy { min-width: 0; }
.person-copy .eyebrow { margin: 0 0 var(--space-2); }
.person-copy h2 { margin: 0; font-size: 1.6rem; line-height: 1.3; }
.handle { margin: var(--space-1) 0 0; color: var(--muted); }
.bio { margin: var(--space-4) 0 0; color: var(--muted); line-height: 1.8; }
.social-links { display: flex; flex-wrap: wrap; gap: var(--space-3); margin: var(--space-4) 0 0; padding: 0; list-style: none; }
.social-links a { display: inline-flex; align-items: center; gap: 5px; color: var(--accent); text-underline-offset: 3px; }
.about-copy { padding: var(--space-3) 0; }
.about-copy .eyebrow { margin: 0 0 var(--space-2); }
.about-copy h2 { max-width: 15ch; margin: 0; font-size: clamp(1.8rem, 4vw, 2.7rem); line-height: 1.25; letter-spacing: -.03em; }
.about-copy > p:not(.eyebrow) { max-width: 58ch; margin: var(--space-4) 0 0; color: var(--muted); line-height: 1.85; }
.about-copy a { color: var(--accent); text-underline-offset: 3px; }
.about-actions { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-5); }
.empty { display: grid; justify-items: center; gap: var(--space-2); padding: var(--space-6); color: var(--muted); text-align: center; }
.empty h2, .empty p { margin: 0; }
.profile-empty { margin-top: var(--space-7); }
.contact-panel { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); margin-top: var(--space-8); padding: var(--space-5); scroll-margin-top: 88px; }
.contact-panel .eyebrow { margin: 0 0 var(--space-1); }
.contact-panel h2 { margin: 0; font-size: 1.08rem; }
.contact-panel p { margin: 0; }
@media (max-width: 760px) {
  .person-layout { grid-template-columns: 1fr; gap: var(--space-4); }
  .person-card { padding: var(--space-4); }
  .contact-panel { align-items: flex-start; flex-direction: column; }
}
@media (max-width: 440px) {
  .person-card { flex-direction: column; }
  .about-actions .button { flex: 1 1 100%; }
}
</style>
