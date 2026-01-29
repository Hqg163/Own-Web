<template>
  <div :class="themeClass" class="register-container">
    
    <div class="register-content">
      <div class="register-card">
        <h2>注册</h2>
        
        <form @submit.prevent="handleRegister" class="register-form">
          <div class="form-group">
            <label>邮箱</label>
            <input 
              type="email" 
              v-model="email" 
              placeholder="请输入邮箱"
              required
            />
          </div>
          
          <!-- 密码 -->
          <div class="form-group">
            <label>密码</label>
            <div class="password-input-wrapper">
              <input 
                :type="passwordVisible ? 'text' : 'password'"
                v-model="password" 
                placeholder="请输入密码（至少6位）"
                required
                minlength="6"
              />
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

          <!-- 确认密码 -->
          <div class="form-group">
            <label>确认密码</label>
            <div class="password-input-wrapper">
              <input 
                :type="confirmPasswordVisible ? 'text' : 'password'"
                v-model="confirmPassword" 
                placeholder="请再次输入密码"
                required
              />
              <button 
                type="button"
                class="eye-icon-btn"
                @click="confirmPasswordVisible = !confirmPasswordVisible"
              >
                <svg v-if="confirmPasswordVisible" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
          
          <button type="submit" class="register-btn" :disabled="loading">
            {{ loading ? '注册中...' : '注册' }}
          </button>
          
          <div class="register-links">
            <router-link to="/">返回首页</router-link>
            <span>|</span>
            <router-link to="/login">已有账号？立即登录</router-link>
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
import axios from 'axios'

export default {
  name: 'Register',
  components: {
    NavigationBar
  },
  data() {
    return {
      themeClass: localStorage.getItem('theme') === 'dark' ? 'dark-mode' : 'light-mode',
      email: '',
      password: '',
      passwordVisible: false,   // 密码显隐控制
      confirmPassword: '',
      confirmPasswordVisible: false,   // 确认密码显隐控制
      loading: false,
      error: ''
    }
  },
  created() {
    // 监听主题变化
    window.addEventListener('theme-changed', this.handleThemeChange)
    
    // 如果已登录，跳转到首页
    if (localStorage.getItem('isLoggedIn')) {
      this.$router.push('/')
    }
  },
  beforeUnmount() {
    window.removeEventListener('theme-changed', this.handleThemeChange)
  },
  methods: {
    handleThemeChange(e) {
      this.themeClass = e.detail.theme === 'dark' ? 'dark-mode' : 'light-mode'
    },
    
    async handleRegister() {
      // 验证密码
      if (this.password !== this.confirmPassword) {
        this.error = '两次输入的密码不一致'
        return
      }
      
      if (this.password.length < 6) {
        this.error = '密码长度至少6位'
        return
      }
      
      this.loading = true
      this.error = ''
      
      try {
        await axios.post('/api/register', {
          email: this.email,
          password: this.password
        })
        
        alert('注册成功，请登录')
        this.$router.push('/login')
        
      } catch (error) {
        this.error = error.response?.data?.error || '注册失败，请稍后重试'
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

/* 可以直接复制 Login.vue 的样式，把 login 改成 register */
.register-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  transition: background-color 0.3s, color 0.3s;
}

/* 白天模式背景 */
.register-container.light-mode {
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  color: #333;
}

/* 黑夜模式背景 */
.register-container.dark-mode {
  background: linear-gradient(135deg, #1a202c 0%, #2d3748 100%);
  color: #e2e8f0;
}

.register-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
}

.register-card {
  width: 100%;
  max-width: 400px;
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  transition: all 0.3s;
}

.light-mode .register-card {
  --card-bg: #ffffff;
  --card-border: #e5e7eb;
  --text-primary: #1f2937;
  --text-secondary: #6b7280;
  --input-bg: #ffffff;
  --input-border: #d1d5db;
  --input-focus-border: #3b82f6;
}

.dark-mode .register-card {
  --card-bg: #1f2937;
  --card-border: #374151;
  --text-primary: #f9fafb;
  --text-secondary: #d1d5db;
  --input-bg: #111827;
  --input-border: #4b5563;
  --input-focus-border: #60a5fa;
}

.register-card h2 {
  text-align: center;
  margin-bottom: 30px;
  color: var(--text-primary);
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: var(--text-primary);
  font-weight: 500;
}

.form-group input {
  width: 100%;
  padding: 12px 15px;
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
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.register-btn {
  width: 100%;
  padding: 14px;
  background: linear-gradient(to right, #8360ff, #4b66ff);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  margin-top: 10px;
}

.register-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(131, 96, 255, 0.3);
}

.register-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.register-links {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  margin-top: 20px;
  font-size: 14px;
}

.register-links a {
  color: #3b82f6;
  text-decoration: none;
}

.register-links a:hover {
  text-decoration: underline;
}

.register-links span {
  color: var(--text-secondary);
}

.error-message {
  margin-top: 15px;
  padding: 10px;
  background: #fee2e2;
  color: #dc2626;
  border-radius: 6px;
  font-size: 14px;
  text-align: center;
}

.dark-mode .error-message {
  background: #7f1d1d;
  color: #fecaca;
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