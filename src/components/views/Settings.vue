<template>
  <main class="container page-section settings-page">
    <header class="settings-header"><p class="eyebrow">设置</p><h1 class="page-title">账户与个人主页</h1><p>这些资料将用于你的公开博客主页；将主页设为私密后，访客无法打开它。</p></header>
    <form class="card settings-form" @submit.prevent="save">
      <p v-if="message" class="form-message" :class="message.type === 'error' ? 'is-error' : 'is-success'" role="status">{{ message.text }}</p>
      <section class="form-section"><h2>博客资料</h2><div class="form-grid"><div class="field"><label for="blog-title">博客标题</label><input id="blog-title" v-model.trim="form.blogTitle" maxlength="120" placeholder="例如：张三的写作空间" /></div><div class="field"><label for="blog-slug">公开主页标识</label><div class="slug-input"><span>/u/</span><input id="blog-slug" v-model.trim="form.blogSlug" minlength="3" maxlength="50" pattern="[a-z0-9-]+" aria-describedby="slug-help" /></div><small id="slug-help">3–50 位小写字母、数字或连字符。</small></div></div><div class="field"><label for="blog-bio">简介</label><textarea id="blog-bio" v-model="form.bio" maxlength="1000" rows="5" placeholder="介绍你自己、正在写什么，或希望读者从这里获得什么。"></textarea><small>{{ form.bio.length }}/1000</small></div><div class="field"><label for="profile-visibility">个人主页可见性</label><select id="profile-visibility" v-model="form.profileVisibility"><option value="public">公开：任何人可访问我的主页与公开文章</option><option value="private">私密：不展示公开个人主页</option></select></div></section>
      <section class="form-section"><h2>社交链接</h2><p class="section-hint">可选。只填写愿意显示在公开个人主页上的链接。</p><div class="form-grid"><div class="field"><label for="social-site">个人网站</label><input id="social-site" v-model.trim="form.socialLinks.website" type="url" placeholder="https://example.com" /></div><div class="field"><label for="social-github">GitHub</label><input id="social-github" v-model.trim="form.socialLinks.github" type="url" placeholder="https://github.com/username" /></div><div class="field"><label for="social-other">其他链接</label><input id="social-other" v-model.trim="form.socialLinks.other" type="url" placeholder="https://…" /></div></div></section>
      <footer class="settings-actions"><RouterLink class="button button-secondary" to="/personal/info">编辑账户资料</RouterLink><button class="button button-primary" type="submit" :disabled="saving"><span v-if="saving" class="loading-dot" aria-hidden="true"></span>{{ saving ? '保存中…' : '保存设置' }}</button></footer>
    </form>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import http from '@/services/http'

type SocialLinks = { website: string; github: string; other: string }
const form = ref({ blogTitle: '', blogSlug: '', bio: '', profileVisibility: 'public', socialLinks: { website: '', github: '', other: '' } as SocialLinks })
const saving = ref(false)
const message = ref<{ type: 'success' | 'error'; text: string }>()

function socialLinks(value: unknown): SocialLinks {
  let source: any = value
  if (typeof value === 'string') { try { source = JSON.parse(value) } catch { source = {} } }
  return { website: String(source?.website || ''), github: String(source?.github || ''), other: String(source?.other || '') }
}

onMounted(async () => {
  try {
    const profile = (await http.get('/api/me/blog-profile')).data.profile
    form.value = { blogTitle: profile?.blog_title || '', blogSlug: profile?.blog_slug || '', bio: profile?.bio || '', profileVisibility: profile?.profile_visibility || 'public', socialLinks: socialLinks(profile?.social_links) }
  } catch (error: any) {
    message.value = { type: 'error', text: error.response?.data?.error?.message || '无法载入博客设置。' }
  }
})

async function save() {
  saving.value = true
  message.value = undefined
  try {
    await http.put('/api/me/blog-profile', form.value)
    message.value = { type: 'success', text: '个人主页设置已保存。' }
  } catch (error: any) {
    message.value = { type: 'error', text: error.response?.data?.error?.message || '保存失败，请检查输入内容。' }
  } finally { saving.value = false }
}
</script>

<style scoped>
.settings-page { max-width: 880px; }.settings-header { max-width: 650px; }.settings-header .page-title { margin-bottom: var(--space-2); }.settings-header > p:last-child { margin: 0; color: var(--muted); line-height: 1.7; }.settings-form { display: grid; gap: var(--space-6); margin-top: var(--space-6); padding: var(--space-6); }.form-section { display: grid; gap: var(--space-4); }.form-section + .form-section { padding-top: var(--space-6); border-top: 1px solid var(--border); }.form-section h2 { margin: 0; color: var(--text); font-size: 1.05rem; }.section-hint { margin: calc(var(--space-3) * -1) 0 0; color: var(--muted); font-size: .9rem; }.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }.field { display: grid; gap: 6px; }.field label { color: var(--text); font-size: .9rem; font-weight: 650; }.field small { color: var(--muted); font-size: .78rem; }.field input, .field select, .field textarea { box-sizing: border-box; width: 100%; min-height: 42px; padding: 9px 11px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); color: var(--text); font: inherit; }.field textarea { resize: vertical; line-height: 1.7; }.field input:focus, .field select:focus, .field textarea:focus { border-color: var(--accent); outline: 3px solid color-mix(in srgb, var(--accent), transparent 70%); outline-offset: 1px; }.slug-input { display: flex; align-items: center; overflow: hidden; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); }.slug-input:focus-within { border-color: var(--accent); outline: 3px solid color-mix(in srgb, var(--accent), transparent 70%); outline-offset: 1px; }.slug-input span { padding-left: 11px; color: var(--muted); }.slug-input input { border: 0; outline: 0; }.settings-actions { display: flex; justify-content: space-between; gap: var(--space-3); padding-top: var(--space-5); border-top: 1px solid var(--border); }.loading-dot { width: 14px; height: 14px; border: 2px solid rgb(255 255 255 / 45%); border-top-color: #fff; border-radius: 50%; animation: spin .7s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }.form-message { margin: 0; padding: var(--space-3); border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); color: var(--text); }.form-message.is-success { border-color: color-mix(in srgb, var(--accent), transparent 58%); background: var(--accent-soft); color: var(--accent); }.form-message.is-error { border-color: color-mix(in srgb, var(--danger), transparent 58%); background: color-mix(in srgb, var(--danger), transparent 92%); color: var(--danger); } @media (max-width: 620px) { .settings-form { padding: var(--space-4); }.form-grid { grid-template-columns: 1fr; }.settings-actions { align-items: stretch; flex-direction: column-reverse; }.settings-actions > * { justify-content: center; } }
</style>
