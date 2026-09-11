<template>
  <main class="container page-section settings-page">
    <header class="settings-header"><p class="eyebrow">设置</p><h1 class="page-title">账户与个人主页</h1><p>这些资料将用于你的公开博客主页；将主页设为私密后，访客无法打开它。</p></header>
    <form class="card settings-form" @submit.prevent="save">
      <p v-if="message" class="form-message" :class="message.type === 'error' ? 'is-error' : 'is-success'" role="status">{{ message.text }}</p>
      <section class="form-section"><h2>博客资料</h2><div class="form-grid"><div class="field"><label for="blog-title">博客标题</label><input id="blog-title" v-model.trim="form.blogTitle" maxlength="120" placeholder="例如：张三的写作空间" /></div><div class="field"><label for="blog-slug">公开主页标识</label><div class="slug-input"><span>/u/</span><input id="blog-slug" v-model.trim="form.blogSlug" minlength="3" maxlength="50" pattern="[a-z0-9-]+" aria-describedby="slug-help" /></div><small id="slug-help">3–50 位小写字母、数字或连字符。</small></div></div><div class="field"><label for="blog-bio">简介</label><textarea id="blog-bio" v-model="form.bio" maxlength="1000" rows="5" placeholder="介绍你自己、正在写什么，或希望读者从这里获得什么。"></textarea><small>{{ form.bio.length }}/1000</small></div><div class="field"><label for="profile-visibility">个人主页可见性</label><select id="profile-visibility" v-model="form.profileVisibility"><option value="public">公开：任何人可访问我的主页与公开文章</option><option value="private">私密：不展示公开个人主页</option></select></div></section>
      <section class="form-section"><h2>社交链接</h2><p class="section-hint">可选。只填写愿意显示在公开个人主页上的链接。</p><div class="form-grid"><div class="field"><label for="social-site">个人网站</label><input id="social-site" v-model.trim="form.socialLinks.website" type="url" placeholder="https://example.com" /></div><div class="field"><label for="social-github">GitHub</label><input id="social-github" v-model.trim="form.socialLinks.github" type="url" placeholder="https://github.com/username" /></div><div class="field"><label for="social-other">其他链接</label><input id="social-other" v-model.trim="form.socialLinks.other" type="url" placeholder="https://…" /></div></div></section>
      <section class="form-section identity-section" aria-labelledby="identity-title"><h2 id="identity-title" class="identity-title"><AppIcon name="shield" :size="18" />当前身份</h2><p class="section-hint">身份由服务器根据当前登录账号和环境配置判断。</p><p v-if="identityLoading" class="identity-status" role="status">正在读取当前账户…</p><p v-else-if="!session.authenticated" class="identity-status" role="status">当前未确认登录身份。登录后可查看身份权限。</p><div v-else class="identity-card"><UserAvatar :src="String(session.user?.avatar_url || '') || null" :name="displayName" :size="48" /><div class="identity-copy"><strong>{{ displayName }}</strong><span>{{ session.user?.email || '当前登录账户' }}</span></div><div class="identity-badges" aria-label="账户身份"><span v-for="role in roleLabels" :key="role" class="identity-badge"><AppIcon :name="role === '普通用户' ? 'user' : 'shield'" :size="15" />{{ role }}</span></div></div></section>
      <section v-if="ai.state.availability === 'available'" class="form-section ai-memory-section" aria-labelledby="ai-memory-title"><h2 id="ai-memory-title" class="identity-title"><AppIcon name="sparkles" :size="18" />AI Memory</h2><p class="section-hint">仅保存你明确添加的偏好，用于后续 AI 对话；不会保存隐藏推理或聊天全文。</p><p v-if="aiMemoryMessage" class="form-message" :class="aiMemoryMessage.type === 'error' ? 'is-error' : 'is-success'" role="status">{{ aiMemoryMessage.text }}</p><label class="ai-memory-switch"><input v-model="aiMemoryEnabled" type="checkbox" :disabled="aiMemorySaving" />在新对话中使用已保存偏好</label><button class="button button-secondary ai-memory-save" type="button" :disabled="aiMemorySaving" @click="saveAiSettings">{{ aiMemorySaving ? '保存中…' : '保存 AI 设置' }}</button><div class="ai-memory-add"><div class="field"><label for="ai-memory-key">偏好名称</label><input id="ai-memory-key" v-model.trim="newMemory.key" maxlength="120" placeholder="例如：回答语言" /></div><div class="field"><label for="ai-memory-value">偏好内容</label><input id="ai-memory-value" v-model.trim="newMemory.value" maxlength="2000" placeholder="例如：优先使用简体中文" /></div><button class="button" type="button" :disabled="aiMemorySaving || !newMemory.key || !newMemory.value" @click="addMemory"><AppIcon name="plus" :size="16" />添加偏好</button></div><div v-if="aiMemoryLoading" class="identity-status" role="status">正在读取已保存偏好…</div><div v-else-if="aiMemories.length" class="ai-memory-list"><div v-for="item in aiMemories" :key="item.id" class="ai-memory-item"><div><strong>{{ item.key }}</strong><span>{{ item.value }}</span></div><button class="icon-button" type="button" :aria-label="`删除偏好 ${item.key}`" @click="removeMemory(item.id)"><AppIcon name="trash" :size="16" /></button></div></div><p v-else class="identity-status">暂无已保存偏好。</p><button v-if="aiMemories.length" class="button button-danger ai-memory-clear" type="button" :disabled="aiMemorySaving" @click="clearMemories">清空全部偏好</button></section>
      <footer class="settings-actions"><RouterLink class="button button-secondary" to="/personal/info">编辑账户资料</RouterLink><button class="button button-primary" type="submit" :disabled="saving"><span v-if="saving" class="loading-dot" aria-hidden="true"></span>{{ saving ? '保存中…' : '保存设置' }}</button></footer>
    </form>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import http from '@/services/http'
import { emptySession, loadSession } from '@/services/session'
import { useAi } from '@/services/ai'

type SocialLinks = { website: string; github: string; other: string }
const form = ref({ blogTitle: '', blogSlug: '', bio: '', profileVisibility: 'public', socialLinks: { website: '', github: '', other: '' } as SocialLinks })
const saving = ref(false)
const message = ref<{ type: 'success' | 'error'; text: string }>()
const session = ref(emptySession())
const identityLoading = ref(true)
const ai = useAi()
const aiMemoryEnabled = ref(true)
const aiMemories = ref<Array<{ id: string; key: string; value: string }>>([])
const aiMemoryLoading = ref(false)
const aiMemorySaving = ref(false)
const aiMemoryMessage = ref<{ type: 'success' | 'error'; text: string }>()
const newMemory = ref({ key: '', value: '' })
const displayName = computed(() => String(session.value.user?.username || session.value.user?.email || '当前账户'))
const roleLabels = computed(() => {
  const roles: string[] = []
  if (session.value.capabilities.isSiteOwner) roles.push('站主')
  if (session.value.capabilities.isAdmin) roles.push('管理员')
  return roles.length ? roles : ['普通用户']
})

function socialLinks(value: unknown): SocialLinks {
  let source: any = value
  if (typeof value === 'string') { try { source = JSON.parse(value) } catch { source = {} } }
  return { website: String(source?.website || ''), github: String(source?.github || ''), other: String(source?.other || '') }
}

onMounted(async () => {
  try {
    const [profileResponse, sessionResponse] = await Promise.all([http.get('/api/me/blog-profile'), loadSession({ optional: true })])
    const profile = profileResponse.data.profile
    session.value = sessionResponse
    form.value = { blogTitle: profile?.blog_title || '', blogSlug: profile?.blog_slug || '', bio: profile?.bio || '', profileVisibility: profile?.profile_visibility || 'public', socialLinks: socialLinks(profile?.social_links) }
  } catch (error: any) {
    if (error.response?.status === 401) return
    message.value = { type: 'error', text: error.response?.data?.error?.message || '无法载入博客设置。' }
  } finally {
    identityLoading.value = false
  }
  if (await ai.refreshAvailability()) await loadAiMemory()
})

async function loadAiMemory() {
  aiMemoryLoading.value = true
  try {
    const [settingsResponse, memoriesResponse] = await Promise.all([http.get('/api/ai/settings'), http.get('/api/ai/memories')])
    aiMemoryEnabled.value = Boolean(settingsResponse.data?.settings?.memoryEnabled)
    aiMemories.value = Array.isArray(memoriesResponse.data?.items) ? memoriesResponse.data.items : []
  } catch (error: any) { aiMemoryMessage.value = { type: 'error', text: error.response?.data?.error?.message || '无法读取 AI Memory 设置。' } }
  finally { aiMemoryLoading.value = false }
}
async function saveAiSettings() {
  aiMemorySaving.value = true; aiMemoryMessage.value = undefined
  try { await http.put('/api/ai/settings', { memoryEnabled: aiMemoryEnabled.value }); aiMemoryMessage.value = { type: 'success', text: 'AI Memory 设置已保存。' } }
  catch (error: any) { aiMemoryMessage.value = { type: 'error', text: error.response?.data?.error?.message || 'AI Memory 设置保存失败。' } }
  finally { aiMemorySaving.value = false }
}
async function addMemory() {
  aiMemorySaving.value = true; aiMemoryMessage.value = undefined
  try { await http.post('/api/ai/memories', newMemory.value); newMemory.value = { key: '', value: '' }; await loadAiMemory(); aiMemoryMessage.value = { type: 'success', text: '偏好已保存。' } }
  catch (error: any) { aiMemoryMessage.value = { type: 'error', text: error.response?.data?.error?.message || '偏好保存失败。' } }
  finally { aiMemorySaving.value = false }
}
async function removeMemory(id: string) {
  aiMemorySaving.value = true
  try { await http.delete(`/api/ai/memories/${encodeURIComponent(id)}`); aiMemories.value = aiMemories.value.filter((item) => item.id !== id) }
  catch (error: any) { aiMemoryMessage.value = { type: 'error', text: error.response?.data?.error?.message || '偏好删除失败。' } }
  finally { aiMemorySaving.value = false }
}
async function clearMemories() {
  if (!window.confirm('确定清空所有 AI Memory 偏好吗？')) return
  aiMemorySaving.value = true
  try { await http.delete('/api/ai/memories'); aiMemories.value = []; aiMemoryMessage.value = { type: 'success', text: '已清空全部偏好。' } }
  catch (error: any) { aiMemoryMessage.value = { type: 'error', text: error.response?.data?.error?.message || '偏好清空失败。' } }
  finally { aiMemorySaving.value = false }
}

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
.settings-page { max-width: 880px; }.settings-header { max-width: 650px; }.settings-header .page-title { margin-bottom: var(--space-2); }.settings-header > p:last-child { margin: 0; color: var(--muted); line-height: 1.7; }.settings-form { display: grid; gap: var(--space-6); margin-top: var(--space-6); padding: var(--space-6); }.form-section { display: grid; gap: var(--space-4); }.form-section + .form-section { padding-top: var(--space-6); border-top: 1px solid var(--border); }.form-section h2 { margin: 0; color: var(--text); font-size: 1.05rem; }.identity-title { display: flex; align-items: center; gap: var(--space-2); }.section-hint { margin: calc(var(--space-3) * -1) 0 0; color: var(--muted); font-size: .9rem; }.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }.field { display: grid; gap: 6px; }.field label { color: var(--text); font-size: .9rem; font-weight: 650; }.field small { color: var(--muted); font-size: .78rem; }.field input, .field select, .field textarea { box-sizing: border-box; width: 100%; min-height: 42px; padding: 9px 11px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); color: var(--text); font: inherit; }.field textarea { resize: vertical; line-height: 1.7; }.field input:focus, .field select:focus, .field textarea:focus { border-color: var(--accent); outline: 3px solid color-mix(in srgb, var(--accent), transparent 70%); outline-offset: 1px; }.slug-input { display: flex; align-items: center; overflow: hidden; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); }.slug-input:focus-within { border-color: var(--accent); outline: 3px solid color-mix(in srgb, var(--accent), transparent 70%); outline-offset: 1px; }.slug-input span { padding-left: 11px; color: var(--muted); }.slug-input input { border: 0; outline: 0; }.identity-status { margin: 0; color: var(--muted); font-size: .9rem; }.identity-card { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3); border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); }.identity-copy { display: grid; min-width: 0; gap: var(--space-1); }.identity-copy strong, .identity-copy span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.identity-copy span { color: var(--muted); font-size: .9rem; }.identity-badges { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-left: auto; }.identity-badge { display: inline-flex; align-items: center; gap: var(--space-1); padding: 5px 8px; border: 1px solid var(--border); border-radius: 999px; color: var(--accent); background: var(--accent-soft); font-size: .82rem; font-weight: 700; white-space: nowrap; }.settings-actions { display: flex; justify-content: space-between; gap: var(--space-3); padding-top: var(--space-5); border-top: 1px solid var(--border); }.loading-dot { width: 14px; height: 14px; border: 2px solid rgb(255 255 255 / 45%); border-top-color: #fff; border-radius: 50%; animation: spin .7s linear infinite; }.form-message { margin: 0; padding: var(--space-3); border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); color: var(--text); }.form-message.is-success { border-color: color-mix(in srgb, var(--accent), transparent 58%); background: var(--accent-soft); color: var(--accent); }.form-message.is-error { border-color: color-mix(in srgb, var(--danger), transparent 58%); background: color-mix(in srgb, var(--danger), transparent 92%); color: var(--danger); }.ai-memory-switch { display: inline-flex; align-items: center; gap: var(--space-2); color: var(--text); font-size: .9rem; }.ai-memory-switch input { accent-color: var(--accent); }.ai-memory-save { justify-self: start; }.ai-memory-add { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr) auto; align-items: end; gap: var(--space-3); padding: var(--space-3); border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); }.ai-memory-add .field { margin: 0; }.ai-memory-list { display: grid; gap: var(--space-2); }.ai-memory-item { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); padding: var(--space-3); border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); }.ai-memory-item > div { display: grid; min-width: 0; gap: 2px; }.ai-memory-item span { overflow-wrap: anywhere; color: var(--muted); font-size: .86rem; }.ai-memory-clear { justify-self: start; } @media (max-width: 620px) { .settings-form { padding: var(--space-4); }.form-grid, .ai-memory-add { grid-template-columns: 1fr; }.identity-card { align-items: flex-start; flex-wrap: wrap; }.identity-badges { width: 100%; margin-left: 60px; }.settings-actions { align-items: stretch; flex-direction: column-reverse; }.settings-actions > * { justify-content: center; }.ai-memory-add .button { width: 100%; } }
</style>
