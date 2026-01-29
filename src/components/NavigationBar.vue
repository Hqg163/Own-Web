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
        <!-- 未登录显示登录/注册按钮 -->
        <template v-if="!isLoggedIn">
          <li>
            <a href="javascript:void(0)" class="auth-link login-link" @click="goToLogin">
              登录
            </a>
          </li>
          <li>
            <a href="javascript:void(0)" class="auth-link register-link" @click="goToRegister">
              注册
            </a>
          </li>
        </template>
        
        <!-- 已登录显示用户信息（优化样式） -->
        <template v-else>
          <li class="user-info">
            <span class="user-greeting">你好, {{ currentUser.username || '用户' }}</span>
          </li>
          <li>
            <a href="javascript:void(0)" class="auth-link logout-link" @click="logout">
              退出登录
            </a>
          </li>
        </template>
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
  </div>
</template>

<script>
export default {
  name: 'NavigationBar',
  data() {
    return {
      isDarkMode: localStorage.getItem('theme') === 'dark',
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
    },
    currentUser() {
      const userInfo = localStorage.getItem('userInfo');
      return userInfo ? JSON.parse(userInfo) : {};
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

    goToLogin() {
      if (this.$route.meta.requiresAuth) {
        localStorage.setItem('redirectAfterLogin', this.$route.fullPath);
      }
      this.$router.push('/login');
    },

    goToRegister() {
      this.$router.push('/register');
    },

    logout() {
      // 清除登录状态
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('userInfo');
      localStorage.removeItem('userId');
      localStorage.removeItem('userEmail');
      
      // 如果在需要登录的页面，跳回首页
      if (this.$route.meta.requiresAuth) {
        this.$router.push('/');
      } else {
        // 刷新当前页以更新状态
        this.$router.go(0);
      }
    },

    handleNavClick(link) {
      if (link.requiresAuth && !this.isLoggedIn) {
        localStorage.setItem('redirectAfterLogin', link.to);
        this.goToLogin();
        return;
      }
      this.$router.push(link.to);
    }
  },
  mounted() {
    const currentTheme = localStorage.getItem('theme');
    this.isDarkMode = currentTheme === 'dark';
  }
};
</script>

<style scoped>
.navbar-container {
  width: 100%;
}

.navbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  transition: all 0.3s;
}

/* 白天模式导航栏背景 */
.navbar.light-mode {
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

/* 黑夜模式导航栏背景 */
.navbar.dark-mode {
  background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

/* 导航链接通用样式 */
.nav-links, .auth-links {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  gap: 15px;
  align-items: center;
}

.nav-link, .auth-link {
  text-decoration: none;
  font-size: 15px;
  font-weight: 500;
  transition: all 0.3s ease;
  border-radius: 20px;
  padding: 8px 20px;
  display: inline-block;
  text-align: center;
  min-width: 80px;
  border: 2px solid transparent;
  cursor: pointer;
}

/* 白天模式导航按钮 */
.navbar.light-mode .nav-link {
  background: linear-gradient(145deg, #ffffff, #f0f0f0);
  color: #4a5568;
  border: 2px solid rgba(0, 0, 0, 0.1);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.navbar.light-mode .nav-link:hover {
  background: linear-gradient(to bottom, #f8f9fa, #e9ecef);
  color: #2d3748;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

/* 黑夜模式导航按钮 */
.navbar.dark-mode .nav-link {
  background: linear-gradient(145deg, #2d3748, #4a5568);
  color: #e2e8f0;
  border: 2px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.navbar.dark-mode .nav-link:hover {
  background: linear-gradient(145deg, #4a5568, #2d3748);
  color: #fff;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

/* 激活状态 */
.nav-link.active {
  background: linear-gradient(145deg, #3b82f6, #2563eb) !important; 
  color: white !important;
  border-color: rgba(255, 255, 255, 0.3) !important;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3) !important;
}

/* 登录/注册按钮特殊样式 */
.auth-link.login-link {
  background: linear-gradient(to right, #3b82f6, #60a5fa) !important;
  color: white !important;
  border: none;
  box-shadow: 0 4px 6px rgba(59, 130, 246, 0.2);
}

.auth-link.register-link {
  background: linear-gradient(to right, #8b5cf6, #a78bfa) !important;
  color: white !important;
  border: none;
  box-shadow: 0 4px 6px rgba(139, 92, 246, 0.2);
}

.auth-link.login-link:hover,
.auth-link.register-link:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(59, 130, 246, 0.3);
  filter: brightness(1.1);
}

/* =========================================
   关键修改：退出登录按钮样式（黑夜模式醒目）
   ========================================= */

/* 退出登录按钮基础样式 */
.auth-link.logout-link {
  background: linear-gradient(145deg, #ef4444, #dc2626) !important;
  color: white !important;
  border: none;
  font-weight: 600;
  box-shadow: 0 4px 6px rgba(220, 38, 38, 0.25);
  position: relative;
  overflow: hidden;
}

/* 悬停效果 - 更亮更醒目 */
.auth-link.logout-link:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(220, 38, 38, 0.4);
  filter: brightness(1.15);
}

/* 点击效果 */
.auth-link.logout-link:active {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(220, 38, 38, 0.3);
}

/* 黑夜模式下特别增强对比度 */
.navbar.dark-mode .auth-link.logout-link {
  background: linear-gradient(145deg, #f87171, #dc2626) !important; /* 更亮的红色 */
  box-shadow: 0 4px 8px rgba(220, 38, 38, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.navbar.dark-mode .auth-link.logout-link:hover {
  background: linear-gradient(145deg, #fca5a5, #ef4444) !important; /* 悬停时更亮 */
  box-shadow: 0 6px 16px rgba(220, 38, 38, 0.6), 0 0 0 2px rgba(255, 255, 255, 0.2);
  filter: brightness(1.2);
}

/* 用户信息区域样式优化 */
.user-info {
  display: flex;
  align-items: center;
}

.user-greeting {
  color: inherit;
  font-weight: 600;
  font-size: 15px;
  margin-right: 5px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

/* 黑夜模式下用户名字更亮 */
.navbar.dark-mode .user-greeting {
  color: #f9fafb;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

/* 白天模式下 */
.navbar.light-mode .user-greeting {
  color: #1f2937;
}

/* 主题切换按钮区域 */
.theme-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  background: rgba(128, 128, 128, 0.1);
  border-radius: 20px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(128, 128, 128, 0.2);
}

.theme-label {
  font-size: 13px;
  font-weight: 500;
  color: inherit;
  min-width: 35px;
  text-align: center;
}

.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
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
  background-color: #cbd5e1;
  transition: .4s;
  border-radius: 34px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .4s;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

input:checked + .slider {
  background: linear-gradient(to right, #4a5568, #2d3748);
}

input:checked + .slider:before {
  transform: translateX(20px);
}

/* 图标样式 */
.theme-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.3s;
  opacity: 0.6;
}

.theme-icon.active {
  opacity: 1;
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.1);
}

.sun-icon { color: #fbbf24; }
.moon-icon { color: #94a3b8; }

.navbar.dark-mode .moon-icon {
  color: #e2e8f0;
}

/* 响应式适配 */
@media (max-width: 768px) {
  .navbar {
    flex-direction: column;
    gap: 12px;
    padding: 12px;
  }
  
  .nav-links, .auth-links {
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
  }
  
  .nav-link, .auth-link {
    padding: 6px 16px;
    font-size: 14px;
    min-width: 70px;
  }
  
  .user-greeting {
    display: none; /* 移动端隐藏欢迎语，只保留退出按钮 */
  }
  
  .theme-toggle {
    order: -1; /* 主题切换放最上面 */
  }
}
</style>