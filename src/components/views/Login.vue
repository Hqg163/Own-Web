<template>
  <div :class="themeClass" class="login-page">
    
    <div class="login-container">
      <div class="login-card">
        <h2>欢迎登录</h2>
        
        <form @submit.prevent="handleLogin" class="login-form">
          <div class="form-group">
            <label>邮箱</label>
            <input 
              type="email" 
              v-model="email" 
              placeholder="请输入邮箱"
              required
            />
          </div>
          
          <div class="form-group">
            <label>密码</label>
            <div class="password-input-wrapper">
              <input 
                :type="passwordVisible ? 'text' : 'password'"
                v-model="password" 
                placeholder="请输入密码"
                required
              />
              <!-- 眼睛图标按钮 -->
              <button 
                type="button"
                class="eye-icon-btn"
                @click="passwordVisible = !passwordVisible"
              >
                <!-- 睁眼：密码可见（有瞳孔 ◉） -->
                <svg v-if="passwordVisible" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                
                <!-- 闭眼：隐藏密码（只有下眼睑 ⌣ + 四根向下睫毛） -->
                <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                  <!-- 下眼睑：向上弯的弧线（⌣ 形状） -->
                  <path d="M4 14 Q12 20 20 14"></path>
                  <!-- 四根向下的睫毛（从下眼睑向下垂） -->
                  <path d="M6 15 L6 19"></path>
                  <path d="M10 17 L10 21"></path>
                  <path d="M14 17 L14 21"></path>
                  <path d="M18 15 L18 19"></path>
                </svg>
              </button>
            </div>
          </div>
          
          <div class="form-options">
            <label class="remember-me">
              <input type="checkbox" v-model="rememberMe" />
              <span>记住邮箱</span>
            </label>
            <a href="#" class="forgot-password">忘记密码？</a>
          </div>
          
          <button type="submit" class="login-btn" :disabled="loading">
            {{ loading ? '登录中...' : '立即登录' }}
          </button>
          
          <div class="divider">
            <span>或</span>
          </div>
          
          <div class="social-login">
            <button type="button" class="social-btn wechat">
              微信登录
            </button>
            <button type="button" class="social-btn github">
              GitHub登录
            </button>
          </div>
          
          <div class="login-footer">
            <router-link to="/">返回首页</router-link>
            <span>|</span>
            <router-link to="/register">还没有账号？立即注册</router-link>
          </div>
        </form>
        
        <div v-if="error" class="error-message">
          {{ error }}
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import NavigationBar from '../NavigationBar.vue'
import axios from '@/services/http'

export default {
  name: 'Login',
  components: {
    NavigationBar
  },
  data() {
    return {
      themeClass: localStorage.getItem('theme') === 'dark' ? 'dark-mode' : 'light-mode',
      email: localStorage.getItem('rememberUser') || '',
      password: '',
      passwordVisible: false,
      rememberMe: false,
      loading: false,
      error: ''
    }
  },
  created() {
    // 监听主题变化（关键：确保从其他页面跳转过来也能响应主题）
    window.addEventListener('theme-changed', this.handleThemeChange)
    
    // 如果已登录，跳转到个人中心或保存的重定向页面
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true'
    const redirectTo = localStorage.getItem('redirectAfterLogin')
    
    if (isLoggedIn) {
      this.$router.push(redirectTo || '/personal')
    }
  },
  beforeUnmount() {
    // 清理事件监听，防止内存泄漏
    window.removeEventListener('theme-changed', this.handleThemeChange)
  },
  methods: {
    // 处理主题变化
    handleThemeChange(e) {
      this.themeClass = e.detail.theme === 'dark' ? 'dark-mode' : 'light-mode'
    },
    
    async handleLogin() {
      this.loading = true
      this.error = ''
      
      try {
        // 调用登录API
        const response = await axios.post('/api/login', {
          email: this.email,
          password: this.password
        })
        
        // 登录成功处理
        localStorage.setItem('isLoggedIn', 'true')
        localStorage.setItem('userEmail', this.email)
        localStorage.setItem('userId', response.data.user.id)
        localStorage.setItem('userInfo', JSON.stringify(response.data.user))
        
        // 这里只记住邮箱，不记住登录状态；真正的会话由 HttpOnly Cookie 管理。
        if (this.rememberMe) {
          localStorage.setItem('rememberUser', this.email)
        } else {
          localStorage.removeItem('rememberUser')
        }
        
        // 检查是否有重定向目标
        const redirectTo = localStorage.getItem('redirectAfterLogin') || '/personal'
        localStorage.removeItem('redirectAfterLogin')
        
        // 跳转到目标页面
        this.$router.push(redirectTo)
        
      } catch (error) {
        this.error = error.response?.data?.error || '登录失败，请检查邮箱和密码'
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style scoped>
/* ===== 强力隐藏浏览器默认密码眼睛图标 ===== */
/* Chrome/Edge */
input[type="password"]::-webkit-credentials-auto-fill-button,
input[type="text"]::-webkit-credentials-auto-fill-button {
  display: none !important;
  visibility: hidden;
  pointer-events: none;
  position: absolute;
  right: 0;
}

/* Edge/IE 专用 */
input[type="password"]::-ms-reveal,
input[type="password"]::-ms-clear {
  display: none !important;
  filter: alpha(opacity=0);
  opacity: 0;
  width: 0;
  height: 0;
}

/* Webkit 旧版 */
input[type="password"]::-webkit-textfield-decoration-container {
  display: none !important;
}

/* Firefox */
input[type="password"] {
  -moz-appearance: none;
}

/* 页面根容器 - 全屏背景 */
.login-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  transition: background-color 0.3s, color 0.3s;
}

/* 白天模式背景 */
.login-page.light-mode {
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  color: #333;
}

/* 黑夜模式背景 */
.login-page.dark-mode {
  background: linear-gradient(135deg, #1a202c 0%, #2d3748 100%);
  color: #e2e8f0;
}

/* 登录内容区 */
.login-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
}

/* 登录卡片 */
.login-card {
  width: 100%;
  max-width: 420px;
  padding: 40px;
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  transition: all 0.3s;
}

/* 白天模式卡片 */
.light-mode .login-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  --text-primary: #1f2937;
  --text-secondary: #6b7280;
  --input-bg: #ffffff;
  --input-border: #d1d5db;
  --input-focus-border: #3b82f6;
  --input-focus-shadow: rgba(59, 130, 246, 0.1);
}

/* 黑夜模式卡片 */
.dark-mode .login-card {
  background: #1f2937;
  border: 1px solid #374151;
  --text-primary: #f9fafb;
  --text-secondary: #d1d5db;
  --input-bg: #111827;
  --input-border: #4b5563;
  --input-focus-border: #60a5fa;
  --input-focus-shadow: rgba(96, 165, 250, 0.2);
}

.login-card h2 {
  text-align: center;
  margin-bottom: 30px;
  color: var(--text-primary);
  font-size: 28px;
  font-weight: 700;
}

/* 表单样式 */
.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: var(--text-primary);
  font-weight: 500;
  font-size: 14px;
}

.form-group input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid var(--input-border);
  border-radius: 8px;
  font-size: 15px;
  background: var(--input-bg);
  color: var(--text-primary);
  transition: all 0.3s;
}

.form-group input:focus {
  outline: none;
  border-color: var(--input-focus-border);
  box-shadow: 0 0 0 3px var(--input-focus-shadow);
}

.form-group input::placeholder {
  color: var(--text-secondary);
  opacity: 0.6;
}

/* 选项行（记住我 + 忘记密码） */
.form-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  font-size: 14px;
}

.remember-me {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
  cursor: pointer;
}

.remember-me input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.forgot-password {
  color: #3b82f6;
  text-decoration: none;
  transition: color 0.3s;
}

.forgot-password:hover {
  color: #2563eb;
  text-decoration: underline;
}

/* 登录按钮 */
.login-btn {
  width: 100%;
  padding: 14px;
  background: linear-gradient(to right, #3b82f6, #60a5fa);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  margin-bottom: 20px;
}

.login-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(59, 130, 246, 0.3);
}

.login-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 分隔线 */
.divider {
  position: relative;
  text-align: center;
  margin: 20px 0;
}

.divider::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(to right, transparent, var(--input-border), transparent);
}

.divider span {
  position: relative;
  background: var(--input-bg);
  padding: 0 10px;
  color: var(--text-secondary);
  font-size: 14px;
}

/* 第三方登录 */
.social-login {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 20px;
}

.social-btn {
  padding: 10px;
  border: 1px solid var(--input-border);
  border-radius: 8px;
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s;
}

.social-btn:hover {
  background: var(--input-focus-shadow);
  border-color: var(--input-focus-border);
}

/* 底部链接 */
.login-footer {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: var(--text-secondary);
}

.login-footer a {
  color: #3b82f6;
  text-decoration: none;
  transition: color 0.3s;
}

.login-footer a:hover {
  color: #2563eb;
  text-decoration: underline;
}

/* 错误提示 */
.error-message {
  margin-top: 15px;
  padding: 12px;
  background: #fee2e2;
  color: #dc2626;
  border-radius: 8px;
  font-size: 14px;
  text-align: center;
  border: 1px solid #fecaca;
}

.dark-mode .error-message {
  background: #7f1d1d;
  color: #fecaca;
  border-color: #991b1b;
}

/* 响应式 */
@media (max-width: 480px) {
  .login-card {
    padding: 30px 20px;
  }
  
  .social-login {
    grid-template-columns: 1fr;
  }
}

/* 隐藏浏览器默认的眼睛图标 */
.password-input-wrapper input::-webkit-credentials-auto-fill-button {
  visibility: hidden;
  display: none !important;
}

/* 密码输入框容器 */
.password-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.password-input-wrapper input {
  width: 100%;
  padding-right: 40px; /* 给眼睛图标留出空间 */
}

/* 眼睛图标按钮 */
.eye-icon-btn {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: var(--text-secondary, #9ca3af);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.eye-icon-btn:hover {
  color: var(--text-primary, #4b5563);
  background: rgba(128, 128, 128, 0.1);
}

/* 暗色模式适配 */
.dark-mode .eye-icon-btn {
  color: #9ca3af;
}

.dark-mode .eye-icon-btn:hover {
  color: #e2e8f0;
  background: rgba(255, 255, 255, 0.1);
}

</style>
