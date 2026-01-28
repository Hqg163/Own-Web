<template>
  <div :class="themeClass" class="login-container">
    <NavigationBar />
    
    <div class="login-content">
      <div class="login-card">
        <h2>登录</h2>
        
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
            <input 
              type="password" 
              v-model="password" 
              placeholder="请输入密码"
              required
            />
          </div>
          
          <button type="submit" class="login-btn" :disabled="loading">
            {{ loading ? '登录中...' : '登录' }}
          </button>
          
          <div class="login-links">
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
import axios from 'axios'

export default {
  name: 'Login',
  components: {
    NavigationBar
  },
  data() {
    return {
      themeClass: localStorage.getItem('theme') === 'dark' ? 'dark-mode' : 'light-mode',
      email: '',
      password: '',
      loading: false,
      error: ''
    }
  },
  created() {
    // 如果已登录，跳转到个人中心或保存的重定向页面
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true'
    const redirectTo = localStorage.getItem('redirectAfterLogin')
    
    if (isLoggedIn) {
      this.$router.push(redirectTo || '/personal')
    }
  },
  methods: {
    async handleLogin() {
      this.loading = true
      this.error = ''
      
      try {
        // 调用登录API
        const response = await axios.post('/api/login', {
          email: this.email,
          password: this.password
        })
        
        // 登录成功
        localStorage.setItem('isLoggedIn', 'true')
        localStorage.setItem('userEmail', this.email)
        localStorage.setItem('userId', response.data.user.id)
        localStorage.setItem('userInfo', JSON.stringify(response.data.user))
        
        // 检查是否有重定向目标
        const redirectTo = localStorage.getItem('redirectAfterLogin') || '/personal'
        localStorage.removeItem('redirectAfterLogin')
        
        // 跳转到目标页面（个人中心或之前尝试访问的页面）
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
.login-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.login-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
}

.login-card {
  width: 100%;
  max-width: 400px;
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  background: var(--card-bg);
  border: 1px solid var(--card-border);
}

.light-mode .login-card {
  --card-bg: #ffffff;
  --card-border: #e5e7eb;
}

.dark-mode .login-card {
  --card-bg: #1f2937;
  --card-border: #374151;
}

.login-card h2 {
  text-align: center;
  margin-bottom: 30px;
  color: var(--text-primary);
}

.login-form .form-group {
  margin-bottom: 20px;
}

.login-form label {
  display: block;
  margin-bottom: 8px;
  color: var(--text-primary);
  font-weight: 500;
}

.login-form input {
  width: 100%;
  padding: 12px 15px;
  border: 1px solid var(--input-border);
  border-radius: 8px;
  font-size: 15px;
  background: var(--input-bg);
  color: var(--text-primary);
}

.login-form input:focus {
  outline: none;
  border-color: var(--input-focus-border);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.light-mode .login-form input {
  --input-border: #d1d5db;
  --input-bg: #ffffff;
  --input-focus-border: #3b82f6;
}

.dark-mode .login-form input {
  --input-border: #4b5563;
  --input-bg: #111827;
  --input-focus-border: #60a5fa;
}

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
  margin-top: 10px;
}

.login-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(59, 130, 246, 0.3);
}

.login-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.login-links {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  margin-top: 20px;
  font-size: 14px;
}

.login-links a {
  color: #3b82f6;
  text-decoration: none;
}

.login-links a:hover {
  text-decoration: underline;
}

.login-links span {
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
</style>