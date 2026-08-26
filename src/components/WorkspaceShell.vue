<template>
  <div class="workspace-shell">
    <button class="workspace-menu button" type="button" aria-label="切换工作台菜单" :aria-expanded="mobileOpen" @click="mobileOpen = !mobileOpen">
      <AppIcon :name="mobileOpen ? 'close' : 'menu'" :size="18" />
      工作台
    </button>
    <button v-if="mobileOpen" class="workspace-backdrop" type="button" aria-label="关闭工作台菜单" @click="mobileOpen = false" />
    <aside class="workspace-sidebar" :class="{ 'is-open': mobileOpen }" aria-label="工作台导航">
      <RouterLink class="workspace-brand" to="/dashboard" @click="mobileOpen = false">
        <AppIcon name="grid" :size="18" />
        工作台
      </RouterLink>
      <section class="workspace-profile" aria-label="当前账户">
        <UserAvatar :src="user.avatarUrl" :name="user.name" :size="52" />
        <div class="workspace-profile__copy">
          <strong>{{ user.name || '用户' }}</strong>
          <small>{{ user.email || '正在载入账户信息…' }}</small>
        </div>
        <label v-if="allowAvatarUpload" class="avatar-action" title="更新头像">
          <span class="visually-hidden">更新头像</span>
          <AppIcon name="upload" :size="16" />
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" :disabled="avatarUploading" @change="selectAvatar">
        </label>
      </section>
      <p v-if="avatarMessage" class="workspace-status" :class="`is-${avatarMessage.type}`">{{ avatarMessage.text }}</p>
      <nav class="workspace-nav">
        <section v-for="section in sections" :key="section.label" class="workspace-nav__section">
          <p>{{ section.label }}</p>
          <RouterLink v-for="item in section.items" :key="item.to" :to="item.to" class="workspace-nav__link" :class="{ 'is-active': isActive(item.to) }" :aria-current="isActive(item.to) ? 'page' : undefined" @click="mobileOpen = false">
            <AppIcon :name="item.icon" :size="18" />
            <span>{{ item.label }}</span>
          </RouterLink>
        </section>
      </nav>
    </aside>
    <section class="workspace-content"><slot /></section>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import UserAvatar from '@/components/UserAvatar.vue'

type WorkspaceItem = { label: string; to: string; icon: string }
type WorkspaceSection = { label: string; items: WorkspaceItem[] }

const props = withDefaults(defineProps<{
  sections: WorkspaceSection[]
  user: { name?: string; email?: string; avatarUrl?: string | null }
  allowAvatarUpload?: boolean
  avatarUploading?: boolean
  avatarMessage?: { type: 'success' | 'error'; text: string } | null
}>(), { allowAvatarUpload: false, avatarUploading: false, avatarMessage: null })
const emit = defineEmits<{ avatarSelected: [file: File] }>()
const route = useRoute()
const mobileOpen = ref(false)

function isActive(target: string) {
  return route.path === target || route.path.startsWith(`${target}/`)
}
function selectAvatar(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) emit('avatarSelected', file)
  input.value = ''
}
</script>

<style scoped>
.workspace-shell { width: min(1360px, calc(100% - 32px)); display: grid; grid-template-columns: 264px minmax(0, 1fr); gap: var(--space-5); min-height: calc(100vh - 80px); margin: var(--space-4) auto; }
.workspace-sidebar { align-self: start; position: sticky; top: var(--space-4); display: grid; gap: var(--space-5); padding: var(--space-4); border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); box-shadow: var(--shadow); }
.workspace-brand { display: inline-flex; align-items: center; gap: var(--space-2); color: var(--text); font-weight: 750; text-decoration: none; }
.workspace-profile { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: var(--space-3); padding-bottom: var(--space-4); border-bottom: 1px solid var(--border); }
.workspace-profile__copy { min-width: 0; display: grid; gap: var(--space-1); }
.workspace-profile__copy strong, .workspace-profile__copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.workspace-profile__copy small, .workspace-nav__section > p { color: var(--muted); font-size: .78rem; }
.avatar-action { display: grid; width: 32px; height: 32px; place-items: center; border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--muted); cursor: pointer; }
.avatar-action:hover { color: var(--accent); border-color: var(--accent); }.avatar-action input { display: none; }
.workspace-status { margin: calc(var(--space-3) * -1) 0 0; font-size: .82rem; }.workspace-status.is-success { color: var(--accent); }.workspace-status.is-error { color: var(--danger); }
.workspace-nav { display: grid; gap: var(--space-4); }.workspace-nav__section { display: grid; gap: var(--space-1); }.workspace-nav__section > p { margin: 0 0 var(--space-1); font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
.workspace-nav__link { display: flex; align-items: center; gap: var(--space-3); min-height: 40px; padding: 0 var(--space-3); border: 1px solid transparent; border-radius: var(--radius-sm); color: var(--muted); text-decoration: none; }.workspace-nav__link:hover { border-color: var(--border); color: var(--text); background: var(--surface-raised); }.workspace-nav__link.is-active { border-color: var(--accent); color: var(--accent); background: var(--accent-soft); font-weight: 700; }
.workspace-content { min-width: 0; padding: var(--space-4) 0 var(--space-8); }.workspace-menu, .workspace-backdrop { display: none; }
@media (max-width: 860px) { .workspace-shell { display: block; width: min(100% - 24px, 1360px); margin: var(--space-3) auto; }.workspace-menu { display: inline-flex; position: sticky; top: var(--space-2); z-index: 21; }.workspace-sidebar { position: fixed; z-index: 30; top: var(--space-2); bottom: var(--space-2); left: var(--space-2); width: min(300px, calc(100vw - 32px)); overflow: auto; transform: translateX(calc(-100% - var(--space-3))); transition: transform .18s ease; }.workspace-sidebar.is-open { transform: translateX(0); }.workspace-backdrop { display: block; position: fixed; z-index: 29; inset: 0; border: 0; background: rgb(0 0 0 / 32%); }.workspace-content { padding-top: var(--space-4); } }
</style>
