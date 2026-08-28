<template>
  <main class="auth-page">
    <section class="auth-card" aria-labelledby="register-title">
      <RouterLink class="auth-brand" to="/" aria-label="返回 Own-Web 首页">Own-Web<span>／</span></RouterLink>
      <p class="eyebrow">创建账户</p>
      <h1 id="register-title">开始使用 Own-Web</h1>
      <p class="auth-intro">注册后可建立个人主页、整理私有资料并发布公开文章。</p>

      <form class="auth-form" @submit.prevent="handleRegister">
        <p v-if="error" class="form-message is-error" role="alert">{{ error }}</p>
        <div class="field">
          <label for="register-email">邮箱</label>
          <input id="register-email" v-model.trim="email" type="email" autocomplete="email" required placeholder="name@example.com" />
        </div>
        <div class="field">
          <label for="register-password">密码</label>
          <div class="password-field">
            <input id="register-password" v-model="password" :type="passwordVisible ? 'text' : 'password'" autocomplete="new-password" required minlength="10" aria-describedby="password-help" placeholder="至少 10 位，含大小写和数字" />
            <button type="button" class="icon-button" :aria-label="passwordVisible ? '隐藏密码' : '显示密码'" @click="passwordVisible = !passwordVisible"><AppIcon :name="passwordVisible ? 'eye-off' : 'eye'" :size="19" /></button>
          </div>
          <small id="password-help">密码至少 10 位，并同时包含大小写字母和数字。</small>
        </div>
        <div class="field">
          <label for="register-confirm-password">确认密码</label>
          <div class="password-field">
            <input id="register-confirm-password" v-model="confirmPassword" :type="confirmPasswordVisible ? 'text' : 'password'" autocomplete="new-password" required placeholder="再次输入密码" />
            <button type="button" class="icon-button" :aria-label="confirmPasswordVisible ? '隐藏密码' : '显示密码'" @click="confirmPasswordVisible = !confirmPasswordVisible"><AppIcon :name="confirmPasswordVisible ? 'eye-off' : 'eye'" :size="19" /></button>
          </div>
        </div>
        <button class="button button-primary auth-submit" type="submit" :disabled="loading"><span v-if="loading" class="loading-dot" aria-hidden="true"></span>{{ loading ? '注册中…' : '创建账户' }}</button>
      </form>

      <p class="auth-links"><RouterLink to="/">返回首页</RouterLink><span aria-hidden="true">·</span><RouterLink to="/login">已有账户，登录</RouterLink></p>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import http from '@/services/http'

const router = useRouter()
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const passwordVisible = ref(false)
const confirmPasswordVisible = ref(false)
const loading = ref(false)
const error = ref('')

async function handleRegister() {
  if (password.value !== confirmPassword.value) { error.value = '两次输入的密码不一致。'; return }
  if (password.value.length < 10 || !/[a-z]/.test(password.value) || !/[A-Z]/.test(password.value) || !/\d/.test(password.value)) { error.value = '密码至少 10 位，并同时包含大小写字母和数字。'; return }
  loading.value = true
  error.value = ''
  try {
    await http.post('/api/register', { email: email.value, password: password.value })
    await router.push({ path: '/login', query: { registered: '1' } })
  } catch (requestError: any) {
    error.value = requestError.response?.data?.error?.message || requestError.response?.data?.error || '注册失败，请稍后重试。'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-page { display: grid; min-height: calc(100vh - 64px); place-items: center; padding: var(--space-6) var(--space-3); background: var(--bg); }.auth-card { width: min(100%, 440px); padding: var(--space-6); border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); box-shadow: var(--shadow); }.auth-brand { display: inline-flex; align-items: baseline; color: var(--text); font-weight: 800; letter-spacing: -.03em; text-decoration: none; }.auth-brand span { color: var(--accent); }.eyebrow { margin: var(--space-6) 0 var(--space-1); color: var(--accent); font-size: .8rem; font-weight: 750; letter-spacing: .08em; }.auth-card h1 { margin: 0; color: var(--text); font-size: 1.7rem; letter-spacing: -.03em; }.auth-intro { margin: var(--space-2) 0 var(--space-5); color: var(--muted); line-height: 1.7; }.auth-form { display: grid; gap: var(--space-4); }.field { display: grid; gap: 6px; }.field label { color: var(--text); font-size: .9rem; font-weight: 650; }.field small { color: var(--muted); font-size: .78rem; }.field input { box-sizing: border-box; width: 100%; min-height: 42px; padding: 9px 11px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); color: var(--text); font: inherit; }.field input:focus { border-color: var(--accent); outline: 3px solid color-mix(in srgb, var(--accent), transparent 70%); outline-offset: 1px; }.password-field { position: relative; }.password-field input { padding-right: 44px; }.icon-button { position: absolute; top: 50%; right: 5px; display: grid; width: 34px; height: 34px; place-items: center; transform: translateY(-50%); border: 0; border-radius: 6px; background: transparent; color: var(--muted); cursor: pointer; }.icon-button:hover { background: var(--accent-soft); color: var(--accent); }.icon-button:focus-visible { outline: 3px solid color-mix(in srgb, var(--accent), transparent 68%); outline-offset: 1px; }.auth-submit { justify-content: center; min-height: 42px; }.loading-dot { width: 14px; height: 14px; border: 2px solid rgb(255 255 255 / 45%); border-top-color: #fff; border-radius: 50%; animation: spin .7s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }.form-message { margin: 0; padding: var(--space-3); border: 1px solid color-mix(in srgb, var(--danger), transparent 58%); border-radius: var(--radius-sm); background: color-mix(in srgb, var(--danger), transparent 92%); color: var(--danger); font-size: .9rem; }.auth-links { display: flex; justify-content: center; gap: var(--space-2); margin: var(--space-5) 0 0; color: var(--muted); font-size: .9rem; }.auth-links a { color: var(--accent); text-underline-offset: 3px; } @media (max-width: 520px) { .auth-page { align-items: start; padding-top: var(--space-4); }.auth-card { padding: var(--space-5) var(--space-4); box-shadow: none; } }
</style>
