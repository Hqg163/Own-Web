<template>
  <header class="site-header" data-sticky-header>
    <div class="container bar">
      <RouterLink class="brand" to="/" aria-label="Own-Web 首页">Own-Web<span>／</span></RouterLink>
      <button ref="mobileMenuButton" class="icon-button mobile-menu" type="button" :aria-label="menuOpen ? '关闭导航菜单' : '打开导航菜单'" :aria-expanded="menuOpen" aria-controls="primary-navigation" @click.stop="toggleMobileMenu">
        <AppIcon name="menu" />
      </button>
      <nav id="primary-navigation" :class="['nav', { open: menuOpen }]" aria-label="主导航">
        <RouterLink v-for="link in links" :key="link.to" :to="link.to" @click="menuOpen = false">{{ link.label }}</RouterLink>
        <RouterLink v-if="loggedIn" class="mobile-write" to="/write" @click="menuOpen = false"><AppIcon name="pen" :size="16" />继续写作</RouterLink>
      </nav>
      <div class="actions">
        <RouterLink class="icon-button" to="/explore" aria-label="搜索文章"><AppIcon name="search" /></RouterLink>
        <button class="icon-button" type="button" :aria-label="dark ? '切换浅色模式' : '切换深色模式'" @click="toggleTheme"><AppIcon :name="dark ? 'sun' : 'moon'" /></button>
        <template v-if="!loggedIn">
          <RouterLink class="login" to="/login">登录</RouterLink>
          <RouterLink class="button button-primary register" to="/register">注册</RouterLink>
        </template>
        <div v-else ref="userMenu" class="user-menu">
          <button ref="userMenuButton" class="user-menu-trigger" type="button" :aria-label="`${user.username || '用户'}的菜单`" :aria-expanded="userMenuOpen" aria-haspopup="menu" @click.stop="toggleUserMenu">
            <UserAvatar :src="user.avatar_url" :name="user.username" :size="32" />
            <span class="user-name">{{ user.username }}</span>
          </button>
          <div v-if="userMenuOpen" class="menu-panel" role="menu" @click.stop="closeUserMenu">
            <RouterLink role="menuitem" :to="`/u/${user.blog_slug || `u-${user.id}`}`">我的主页</RouterLink>
            <RouterLink role="menuitem" to="/write">写文章</RouterLink>
            <RouterLink role="menuitem" to="/creation">文章管理</RouterLink>
            <RouterLink role="menuitem" to="/creation?status=draft">草稿箱</RouterLink>
            <RouterLink role="menuitem" to="/dashboard/bookmarks">收藏</RouterLink>
            <RouterLink role="menuitem" to="/dashboard/notifications">通知</RouterLink>
            <RouterLink role="menuitem" to="/dashboard/reports">我的举报</RouterLink>
            <RouterLink role="menuitem" to="/settings">设置</RouterLink>
            <RouterLink role="menuitem" to="/dashboard">工作台</RouterLink>
            <button role="menuitem" type="button" @click="logout">退出登录</button>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import http, { cacheAuthenticatedUser, clearCachedAuth } from '@/services/http'
import AppIcon from './AppIcon.vue'
import UserAvatar from './UserAvatar.vue'

const route = useRoute()
const menuOpen = ref(false)
const userMenuOpen = ref(false)
const dark = ref(localStorage.getItem('theme') === 'dark')
const user = ref<Record<string, any>>(JSON.parse(localStorage.getItem('userInfo') || '{}'))
const loggedIn = ref(localStorage.getItem('isLoggedIn') === 'true')
const userMenu = ref<HTMLElement>()
const userMenuButton = ref<HTMLButtonElement>()
const mobileMenuButton = ref<HTMLButtonElement>()
const links = computed(() => [
  { label: '首页', to: '/' },
  { label: '探索', to: '/explore' },
  { label: '项目', to: '/projects' },
  { label: '关于', to: '/about' },
  ...(loggedIn.value ? [{ label: '创作中心', to: '/creation' }] : []),
])

function applyTheme() {
  const theme = dark.value ? 'dark' : 'light'
  document.documentElement.dataset.theme = theme
  localStorage.setItem('theme', theme)
  window.dispatchEvent(new CustomEvent('theme-changed', { detail: { theme } }))
}
function toggleTheme() { dark.value = !dark.value; applyTheme() }
function closeUserMenu() { userMenuOpen.value = false }
function toggleUserMenu() { userMenuOpen.value = !userMenuOpen.value; menuOpen.value = false }
function toggleMobileMenu() { menuOpen.value = !menuOpen.value; userMenuOpen.value = false }
function handleDocumentPointer(event: PointerEvent) {
  const target = event.target as Node | null
  if (userMenuOpen.value && target && !userMenu.value?.contains(target)) closeUserMenu()
  if (menuOpen.value && target && !(event.target as HTMLElement).closest('.site-header')) menuOpen.value = false
}
function handleEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  if (userMenuOpen.value) { closeUserMenu(); nextTick(() => userMenuButton.value?.focus()); return }
  if (menuOpen.value) { menuOpen.value = false; nextTick(() => mobileMenuButton.value?.focus()) }
}
async function logout() {
  closeUserMenu()
  try { await http.post('/api/logout') } finally { loggedIn.value = false; clearCachedAuth(); window.location.assign('/') }
}
function updateAvatar(event: Event) {
  const avatarUrl = (event as CustomEvent<{ avatarUrl?: string }>).detail?.avatarUrl
  if (!avatarUrl) return
  user.value = { ...user.value, avatar_url: avatarUrl }
  localStorage.setItem('userInfo', JSON.stringify(user.value))
}

watch(() => route.fullPath, () => { menuOpen.value = false; closeUserMenu() })
onMounted(async () => {
  applyTheme()
  window.addEventListener('profile-avatar-updated', updateAvatar)
  document.addEventListener('pointerdown', handleDocumentPointer)
  document.addEventListener('keydown', handleEscape)
  try {
    const { data } = await http.get('/api/me')
    cacheAuthenticatedUser(data.user)
    user.value = data.user
    loggedIn.value = true
  } catch {
    if (loggedIn.value) { loggedIn.value = false; clearCachedAuth() }
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('profile-avatar-updated', updateAvatar)
  document.removeEventListener('pointerdown', handleDocumentPointer)
  document.removeEventListener('keydown', handleEscape)
})
</script>

<style scoped>
.site-header { position: sticky; top: 0; z-index: 20; background: var(--surface); border-bottom: 1px solid var(--border); }
.bar { min-height: 64px; display: flex; align-items: center; gap: 24px; }
.brand { font-size: 1.2rem; font-weight: 800; letter-spacing: -.04em; text-decoration: none; }
.brand span { color: var(--accent); }
.nav { display: flex; align-items: center; gap: 20px; }
.nav a, .login { color: var(--muted); font-size: .94rem; font-weight: 650; text-decoration: none; }
.nav a.router-link-exact-active, .nav a:hover, .login:hover { color: var(--text); }
.actions { display: flex; align-items: center; gap: 8px; margin-left: auto; }
.icon-button { width: 38px; height: 38px; display: inline-grid; place-items: center; border: 1px solid transparent; border-radius: var(--radius-sm); background: transparent; color: var(--text); }
.icon-button:hover { border-color: var(--border); background: var(--surface); }
.register { min-height: 36px; padding: 0 12px; }
.user-menu { position: relative; }
.user-menu-trigger { display: flex; align-items: center; gap: 8px; padding: 0; border: 0; background: transparent; color: var(--text); cursor: pointer; }
.user-name { font-size: .92rem; font-weight: 650; }
.menu-panel { position: absolute; top: 44px; right: 0; width: 180px; display: grid; padding: 6px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); box-shadow: var(--shadow); }
.menu-panel a, .menu-panel button { padding: 9px 10px; border: 0; border-radius: 6px; background: transparent; color: var(--text); font-size: .9rem; text-align: left; text-decoration: none; }
.menu-panel a:hover, .menu-panel button:hover { background: var(--accent-soft); }
.mobile-menu, .mobile-write { display: none; }
@media (max-width: 760px) {
  .bar { gap: 10px; }
  .mobile-menu { display: grid; }
  .nav { display: none; }
  .nav.open { position: absolute; top: 64px; right: 0; left: 0; display: grid; padding: 16px; border-bottom: 1px solid var(--border); background: var(--surface-raised); box-shadow: var(--shadow); }
  .mobile-write { display: flex !important; align-items: center; gap: 8px; }
  .user-name, .login, .register { display: none; }
  .actions { gap: 2px; }
}
</style>
