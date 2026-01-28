<template>
  <div class="navbar-container">
    <nav class="navbar" :class="themeClass">
      <ul class="nav-links">
        <li v-for="link in navLinks" :key="link.name">
          <a 
            href="javascript:void(0)" 
            :class="['nav-link', { 'active': isActive(link.to) }]"
            @click.prevent="handleNavClick(link)"
          >
            {{ link.name }}
          </a>
        </li>
      </ul>
      <ul class="auth-links">
        <li><a href="#login" @click.prevent="showLogin" :class="['auth-link']">登录</a></li>
        <li><a href="#register" @click.prevent="showRegister" :class="['auth-link']">注册</a></li>
      </ul>
      <div class="theme-toggle">
        <div class="theme-icon sun-icon" :class="{ active: !isDarkMode }" @click="switchToLightMode">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="5" fill="currentColor" />
            <g stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
              <line x1="12" y1="2" x2="12" y2="5" />
              <line x1="12" y1="19" x2="12" y2="22" />
              <line x1="4.22" y1="4.22" x2="6.34" y2="6.34" />
              <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" />
              <line x1="2" y1="12" x2="5" y2="12" />
              <line x1="19" y1="12" x2="22" y2="12" />
              <line x1="4.22" y1="19.78" x2="6.34" y2="17.66" />
              <line x1="17.66" y1="6.34" x2="19.78" y2="4.22" />
            </g>
          </svg>
        </div>

        <label class="switch">
          <input type="checkbox" v-model="isDarkMode" @change="toggleTheme" />
          <span class="slider round"></span>
        </label>

        <div class="theme-icon moon-icon" :class="{ active: isDarkMode }" @click="switchToDarkMode">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="currentColor" />
          </svg>
        </div>

        <span class="theme-label">{{ isDarkMode ? '黑夜' : '白天' }}</span>
      </div>
    </nav>

    <!-- 登录弹窗 -->
    <div v-if="showLoginModal" class="modal" @click.self="showLoginModal = false">
      <div class="modal-content">
        <span class="close" @click="showLoginModal = false">&times;</span>
        <h2>登录</h2>
        <form @submit.prevent="login">
          <input type="email" v-model="email" placeholder="邮箱" required />
          <input type="password" v-model="password" placeholder="密码" required />
          <button type="submit">登录</button>
        </form>
      </div>
    </div>

    <!-- 注册弹窗 -->
    <div v-if="showRegisterModal" class="modal" @click.self="showRegisterModal = false">
      <div class="modal-content">
        <span class="close" @click="showRegisterModal = false">&times;</span>
        <h2>注册</h2>
        <form @submit.prevent="register">
          <input type="email" v-model="email" placeholder="邮箱" required />
          <input type="password" v-model="password" placeholder="密码" required />
          <button type="submit">注册</button>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  name: 'NavigationBar',
  data() {
    return {
      isDarkMode: localStorage.getItem('theme') === 'dark',
      showLoginModal: false,
      showRegisterModal: false,
      email: '',
      password: '',
      navLinks: [
        { name: '首页', to: '/' },
        { name: '个人中心', to: '/personal', requiresAuth: true },
        { name: '创作中心', to: '/creation' },
        { name: '关于', to: '/about' }
      ]
    };
  },
  computed: {
    themeClass() {
      return this.isDarkMode ? 'dark-mode' : 'light-mode';
    },
    isLoggedIn() {
      return localStorage.getItem('isLoggedIn') === 'true';
    }
  },
  methods: {
    isActive(path) {
      return this.$route.path === path;
    },

    toggleTheme() {
      const theme = this.isDarkMode ? 'dark' : 'light';
      localStorage.setItem('theme', theme);
      window.dispatchEvent(new CustomEvent('theme-changed', { 
        detail: { theme } 
      }));
    },

    switchToLightMode() {
      if (this.isDarkMode) {
        this.isDarkMode = false;
        localStorage.setItem('theme', 'light');
        window.dispatchEvent(new CustomEvent('theme-changed', { 
          detail: { theme: 'light' } 
        }));
      }
    },
    
    switchToDarkMode() {
      if (!this.isDarkMode) {
        this.isDarkMode = true;
        localStorage.setItem('theme', 'dark');
        window.dispatchEvent(new CustomEvent('theme-changed', { 
          detail: { theme: 'dark' } 
        }));
      }
    },

    showLogin() {
      this.showLoginModal = true;
      this.showRegisterModal = false;
    },
    showRegister() {
      this.showRegisterModal = true;
      this.showLoginModal = false;
    },

    handleNavClick(link) {
      if (link.requiresAuth && !this.isLoggedIn) {
        localStorage.setItem('redirectAfterLogin', link.to);
        this.showLogin();
        alert('请先登录');
        return;
      }
      this.$router.push(link.to);
    },
    
    async login() {
      try {
        const response = await axios.post('/api/login', {
          email: this.email,
          password: this.password,
        });
        
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('userEmail', response.data.user.email);
        localStorage.setItem('userId', response.data.user.id);
        localStorage.setItem('userInfo', JSON.stringify(response.data.user));
        
        this.showLoginModal = false;
        this.email = '';
        this.password = '';
        
        const redirectTo = localStorage.getItem('redirectAfterLogin');
        if (redirectTo) {
          localStorage.removeItem('redirectAfterLogin');
          this.$router.push(redirectTo);
        } else {
          location.reload();
        }
      } catch (error) {
        alert('登录失败，请检查用户名和密码');
      }
    },

    async register() {
      try {
        await axios.post('/api/register', {
          email: this.email,
          password: this.password,
        });
        this.showRegisterModal = false;
        alert('注册成功，请登录');
        this.showLogin();
      } catch (error) {
        alert('注册失败，请稍后重试');
      }
    },
  },
  mounted() {
    const currentTheme = localStorage.getItem('theme');
    this.isDarkMode = currentTheme === 'dark';
  },
};
</script>

<style scoped>
/* 导航栏容器 - 不再设置全屏高度 */
.navbar-container {
  width: 100%;
}

/* 导航栏本身 */
.navbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  transition: all 0.3s;
}

/* 白天模式 - 仅导航栏背景 */
.navbar.light-mode {
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

/* 黑夜模式 - 仅导航栏背景 */
.navbar.dark-mode {
  background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

/* 导航链接样式 */
.nav-links, .auth-links {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  gap: 20px;
}

.nav-link, .auth-link {
  text-decoration: none;
  font-size: 16px;
  font-weight: 500;
  transition: all 0.3s ease;
  border-radius: 25px;
  padding: 10px 24px;
  display: inline-block;
  text-align: center;
  min-width: 100px;
  border: 2px solid transparent;
  cursor: pointer;
}

/* 白天模式按钮 */
.navbar.light-mode .nav-link {
  background: linear-gradient(145deg, #ffffff, #f0f0f0);
  color: #4a5568;
  border: 2px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 4px 6px rgba(50, 50, 93, 0.11), 0 1px 3px rgba(0, 0, 0, 0.08);
}

.navbar.light-mode .nav-link:hover {
  background: linear-gradient(to bottom, #f8f9fa, #e9ecef);
  color: #2d3748;
  transform: translateY(-2px);
  box-shadow: 0 7px 14px rgba(50, 50, 93, 0.1), 0 3px 6px rgba(0, 0, 0, 0.08);
}

.navbar.light-mode .auth-link {
  background: linear-gradient(to right, #4facfe 0%, #00f2fe 100%);
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.3);
}

.navbar.light-mode .auth-link:hover {
  background: linear-gradient(to right, #00f2fe 0%, #4facfe 100%);
  transform: translateY(-2px);
}

/* 黑夜模式按钮 */
.navbar.dark-mode .nav-link {
  background: linear-gradient(145deg, #2d3748, #4a5568);
  color: #e2e8f0;
  border: 2px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
}

.navbar.dark-mode .nav-link:hover {
  background: linear-gradient(145deg, #4a5568, #2d3748);
  color: #fff;
  transform: translateY(-2px);
}

.navbar.dark-mode .auth-link {
  background: linear-gradient(to right, #4b66ff, #8360ff);
  color: #e2e8f0;
  border: 2px solid rgba(255, 255, 255, 0.1);
}

.navbar.dark-mode .auth-link:hover {
  background: linear-gradient(to right, #8360ff, #4b66ff);
  transform: translateY(-2px);
}

/* 激活状态 */
.nav-link.active {
  background: linear-gradient(145deg, #3b82f6, #2563eb) !important; 
  color: white !important;
  border-color: rgba(255, 255, 255, 0.3) !important;
}

/* 主题切换按钮 */
.theme-toggle {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 25px;
  backdrop-filter: blur(10px);
}

.navbar.light-mode .theme-toggle {
  background: rgba(0, 0, 0, 0.05);
}

.navbar.dark-mode .theme-toggle {
  background: rgba(255, 255, 255, 0.1);
}

.theme-label {
  font-size: 14px;
  font-weight: 500;
  color: inherit;
}

.switch {
  position: relative;
  display: inline-block;
  width: 60px;
  height: 30px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(to right, #d1e8ff, #a8c6ff);
  transition: 0.4s;
  border-radius: 34px;
}

input:checked + .slider {
  background: linear-gradient(to right, #4a5568, #2d3748);
}

.slider:before {
  position: absolute;
  content: "";
  height: 22px;
  width: 22px;
  left: 4px;
  bottom: 4px;
  background-color: white;
  transition: 0.4s;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

input:checked + .slider:before {
  transform: translateX(30px);
}

/* 图标样式 */
.theme-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.3s;
  opacity: 0.5;
}

.theme-icon.active {
  opacity: 1;
}

.sun-icon {
  color: #fbbf24;
}

.moon-icon {
  color: #94a3b8;
}

.navbar.dark-mode .moon-icon {
  color: #e2e8f0;
}

/* 弹窗样式 */
.modal {
  display: flex;
  position: fixed;
  z-index: 1000;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  align-items: center;
  justify-content: center;
}

.modal-content {
  background-color: white;
  padding: 30px;
  border-radius: 12px;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  position: relative;
}

.close {
  position: absolute;
  right: 20px;
  top: 15px;
  font-size: 24px;
  cursor: pointer;
}

form input {
  width: 100%;
  padding: 12px;
  margin: 10px 0;
  border: 1px solid #ddd;
  border-radius: 6px;
  box-sizing: border-box;
}

form button {
  width: 100%;
  padding: 12px;
  background: linear-gradient(to right, #4facfe 0%, #00f2fe 100%);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
  margin-top: 10px;
}

/* 响应式 */
@media (max-width: 768px) {
  .navbar {
    flex-direction: column;
    gap: 15px;
    padding: 15px;
  }
  
  .nav-links, .auth-links {
    flex-wrap: wrap;
    justify-content: center;
  }
}
</style>