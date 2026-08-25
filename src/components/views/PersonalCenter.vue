<!-- PersonalCenter.vue - 修改后作为布局组件 -->
<template>
  <div :class="themeClass" class="personal-center">
    <div class="personal-content">
      <!-- 左侧选项栏 -->
      <div class="options-sidebar">
        <div class="user-profile">
          <div class="avatar">
            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=用户" alt="头像" />
          </div>
          <h3>{{ userInfo.username || '用户' }}</h3>
          <p class="email">{{ userInfo.email || '未设置邮箱' }}</p>
        </div>
        
        <div class="options-list">
          <div 
            v-for="option in options" 
            :key="option.id"
            :class="['option-item', { active: isActive(option.id) }]"
            @click="selectOption(option.id)"
          >
            <span class="option-icon">{{ option.icon }}</span>
            <span class="option-name">{{ option.name }}</span>
          </div>
        </div>
      </div>
      
      <!-- 右侧内容区域 - 使用 router-view -->
      <div class="content-area">
        <router-view />
      </div>
    </div>
  </div>
</template>

<script>
import axios from '@/services/http'

export default {
  name: 'PersonalCenter',
  data() {
    return {
      themeClass: localStorage.getItem('theme') === 'dark' ? 'dark-mode' : 'light-mode',
      options: [
        { id: 'personal-info', name: '个人信息', icon: '👤', route: '/personal/info' },
        { id: 'study', name: '学习区', icon: '📚', route: '/personal/study' },
        { id: 'entertainment', name: '娱乐区', icon: '🎮', route: '/personal/entertainment' }
      ],
      userInfo: {
        username: '',
        email: ''
      },
      themeHandler: null
    }
  },
  created() {
    if (localStorage.getItem('isLoggedIn') !== 'true') {
      this.$router.push('/login')
      return
    }
    this.loadUserInfo()
    this.setupThemeListener()
  },
  methods: {
    setupThemeListener() {
      this.themeHandler = (e) => {
        this.themeClass = e.detail.theme === 'dark' ? 'dark-mode' : 'light-mode'
      }
      window.addEventListener('theme-changed', this.themeHandler)
    },
    isActive(optionId) {
      // 根据当前路由判断哪个选项是激活的
      const routeMap = {
        'personal-info': '/personal/info',
        'study': '/personal/study',
        'entertainment': '/personal/entertainment'
      }
      const route = routeMap[optionId]
      return this.$route.path === route || this.$route.path.startsWith(`${route}/`)
    },
    selectOption(optionId) {
      const option = this.options.find(item => item.id === optionId)
      if (option) this.$router.push(option.route)
    },
    async loadUserInfo() {
      try {
        const response = await axios.get('/api/me')
        this.userInfo = response.data.user
      } catch (error) {
        console.error('加载用户信息失败:', error)
      }
    }
  },
  beforeUnmount() {
    if (this.themeHandler) {
      window.removeEventListener('theme-changed', this.themeHandler)
    }
  }
}
</script>

<style scoped>
/* 保留 PersonalCenter.vue 的样式，但移除个人信息相关的样式 */
.personal-center {
  min-height: 100vh;
  transition: background-color 0.3s, color 0.3s;
  background-color: #f5f7fa;
}

.dark-mode {
  background-color: #1a202c;
  color: #e2e8f0;
  
  --sidebar-bg: #1f2937;
  --sidebar-border: #374151;
  --profile-border: #374151;
  --avatar-border: #60a5fa;
  --option-hover: #374151;
  --option-active-bg: #1e40af;
  --option-active-border: #3b82f6;
  --option-active-text: #ffffff;
  --text-primary: #f9fafb;
  --text-secondary: #d1d5db;
  
  --content-bg: #1f2937;
  --content-border: #374151;
}

.light-mode {
  background-color: #f5f7fa;
  color: #1f2937;
  
  --sidebar-bg: #ffffff;
  --sidebar-border: #e5e7eb;
  --profile-border: #f3f4f6;
  --avatar-border: #3b82f6;
  --option-hover: #f8fafc;
  --option-active-bg: #eff6ff;
  --option-active-border: #3b82f6;
  --option-active-text: #1d4ed8;
  --text-primary: #1f2937;
  --text-secondary: #6b7280;
  
  --content-bg: #ffffff;
  --content-border: #e5e7eb;
}

.personal-content {
  display: flex;
  max-width: 1400px;
  margin: 10px auto;
  padding: 0 20px;
  gap: 30px;
}

/* 左侧边栏 */
.options-sidebar {
  flex: 0 0 250px;
  background: var(--sidebar-bg);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  border: 1px solid var(--sidebar-border);
  transition: background-color 0.3s, border-color 0.3s;
  height: fit-content;
}

.user-profile {
  text-align: center;
  padding-bottom: 20px;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--profile-border);
}

.avatar {
  width: 80px;
  height: 80px;
  margin: 0 auto 15px;
  border-radius: 50%;
  overflow: hidden;
  border: 3px solid var(--avatar-border);
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-profile h3 {
  margin: 10px 0 5px;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.user-profile .email {
  color: var(--text-secondary);
  font-size: 14px;
  margin: 0;
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.option-item {
  display: flex;
  align-items: center;
  padding: 15px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  border: 1px solid transparent;
}

.option-item:hover {
  background: var(--option-hover);
  transform: translateX(5px);
}

.option-item.active {
  background: var(--option-active-bg);
  border-color: var(--option-active-border);
  transform: translateX(5px);
}

.option-item.active .option-name {
  font-weight: 600;
  font-size: 16px;
  color: var(--option-active-text);
}

.option-icon {
  font-size: 18px;
  margin-right: 12px;
  width: 24px;
  text-align: center;
}

.option-name {
  font-size: 15px;
  color: var(--text-primary);
}

/* 右侧内容区 */
.content-area {
  flex: 1;
  min-width: 0;
  background: var(--content-bg);
  border-radius: 12px;
  padding: 30px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  border: 1px solid var(--content-border);
  transition: background-color 0.3s, border-color 0.3s;
  min-height: 600px;
}

@media (max-width: 1024px) {
  .personal-content {
    flex-direction: column;
  }
  
  .options-sidebar {
    flex: none;
    width: 100%;
  }
}
</style>
