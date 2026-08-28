<template>
  <main class="auth-page">
    <section class="auth-card" aria-labelledby="login-title">
      <RouterLink class="auth-brand" to="/" aria-label="返回 Own-Web 首页">Own-Web<span>／</span></RouterLink>
      <p class="eyebrow">账户登录</p>
      <h1 id="login-title">欢迎回来</h1>
      <p class="auth-intro">登录后继续管理资料、学习文件、媒体和创作内容。</p>

      <form class="auth-form" @submit.prevent="handleLogin">
        <p v-if="error" class="form-message is-error" role="alert">{{ error }}</p>
        <p v-else-if="registered" class="form-message is-success" role="status">账户已创建，请使用刚才的邮箱和密码登录。</p>
        <div class="field">
          <label for="login-email">邮箱</label>
          <input id="login-email" v-model.trim="email" type="email" autocomplete="email" required placeholder="name@example.com" />
        </div>
        <div class="field">
          <label for="login-password">密码</label>
          <div class="password-field">
            <input id="login-password" v-model="password" :type="passwordVisible ? 'text' : 'password'" autocomplete="current-password" required placeholder="请输入密码" />
            <button type="button" class="icon-button" :aria-label="passwordVisible ? '隐藏密码' : '显示密码'" @click="passwordVisible = !passwordVisible">
              <AppIcon :name="passwordVisible ? 'eye-off' : 'eye'" :size="19" />
            </button>
          </div>
        </div>
        <label class="check-field" for="remember-email"><input id="remember-email" v-model="rememberMe" type="checkbox" /> 记住此邮箱</label>
        <button class="button button-primary auth-submit" type="submit" :disabled="loading">
          <span v-if="loading" class="loading-dot" aria-hidden="true"></span>{{ loading ? '登录中…' : '登录' }}
        </button>
      </form>

      <p class="auth-links"><RouterLink to="/">返回首页</RouterLink><span aria-hidden="true">·</span><RouterLink to="/register">创建账户</RouterLink></p>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import http from '@/services/http'

const router = useRouter()
const route = useRoute()
const registered = route.query.registered === '1'
const email = ref(localStorage.getItem('rememberUser') || '')
const password = ref('')
const passwordVisible = ref(false)
const rememberMe = ref(Boolean(email.value))
const loading = ref(false)
const error = ref('')

async function handleLogin() {
  loading.value = true
  error.value = ''
  try {
    const response = await http.post('/api/login', { email: email.value, password: password.value })
    localStorage.setItem('isLoggedIn', 'true')
    localStorage.setItem('userEmail', email.value)
    localStorage.setItem('userId', String(response.data.user.id))
    localStorage.setItem('userInfo', JSON.stringify(response.data.user))
    if (rememberMe.value) localStorage.setItem('rememberUser', email.value)
    else localStorage.removeItem('rememberUser')
    const redirectTo = localStorage.getItem('redirectAfterLogin') || '/dashboard'
    localStorage.removeItem('redirectAfterLogin')
    await router.push(redirectTo)
  } catch (requestError: any) {
    error.value = requestError.response?.data?.error?.message || requestError.response?.data?.error || '登录失败，请检查邮箱和密码。'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-page { display: grid; min-height: calc(100vh - 64px); place-items: center; padding: var(--space-6) var(--space-3); background: var(--bg); }
.auth-card { width: min(100%, 440px); padding: var(--space-6); border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); box-shadow: var(--shadow); }
.auth-brand { display: inline-flex; align-items: baseline; color: var(--text); font-weight: 800; letter-spacing: -.03em; text-decoration: none; }.auth-brand span { color: var(--accent); }
.eyebrow { margin: var(--space-6) 0 var(--space-1); color: var(--accent); font-size: .8rem; font-weight: 750; letter-spacing: .08em; }.auth-card h1 { margin: 0; color: var(--text); font-size: 1.7rem; letter-spacing: -.03em; }.auth-intro { margin: var(--space-2) 0 var(--space-5); color: var(--muted); line-height: 1.7; }
.auth-form { display: grid; gap: var(--space-4); }.field { display: grid; gap: 6px; }.field label { color: var(--text); font-size: .9rem; font-weight: 650; }.field input { box-sizing: border-box; width: 100%; min-height: 42px; padding: 9px 11px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); color: var(--text); font: inherit; }.field input:focus { border-color: var(--accent); outline: 3px solid color-mix(in srgb, var(--accent), transparent 70%); outline-offset: 1px; }
.password-field { position: relative; }.password-field input { padding-right: 44px; }.icon-button { position: absolute; top: 50%; right: 5px; display: grid; width: 34px; height: 34px; place-items: center; transform: translateY(-50%); border: 0; border-radius: 6px; background: transparent; color: var(--muted); cursor: pointer; }.icon-button:hover { background: var(--accent-soft); color: var(--accent); }.icon-button:focus-visible { outline: 3px solid color-mix(in srgb, var(--accent), transparent 68%); outline-offset: 1px; }
.check-field { display: inline-flex; align-items: center; gap: 7px; color: var(--muted); font-size: .9rem; cursor: pointer; }.check-field input { accent-color: var(--accent); }.auth-submit { justify-content: center; min-height: 42px; }.loading-dot { width: 14px; height: 14px; border: 2px solid rgb(255 255 255 / 45%); border-top-color: #fff; border-radius: 50%; animation: spin .7s linear infinite; }@keyframes spin { to { transform: rotate(360deg); } }
.form-message { margin: 0; padding: var(--space-3); border: 1px solid color-mix(in srgb, var(--danger), transparent 58%); border-radius: var(--radius-sm); background: color-mix(in srgb, var(--danger), transparent 92%); color: var(--danger); font-size: .9rem; }.form-message.is-success { border-color: color-mix(in srgb, var(--accent), transparent 58%); background: var(--accent-soft); color: var(--accent); }.auth-links { display: flex; justify-content: center; gap: var(--space-2); margin: var(--space-5) 0 0; color: var(--muted); font-size: .9rem; }.auth-links a { color: var(--accent); text-underline-offset: 3px; }
@media (max-width: 520px) { .auth-page { align-items: start; padding-top: var(--space-4); }.auth-card { padding: var(--space-5) var(--space-4); box-shadow: none; } }
</style>
