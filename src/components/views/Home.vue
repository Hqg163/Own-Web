<template>
  <div :class="themeClass" class="home-container">
    <NavigationBar />
    <div class="home-content">
      <h1>Welcome to Own-Web</h1>
      <p>这里是您的个人网站首页</p>
      <div class="features">
        <div class="feature-card">
          <span class="icon">📝</span>
          <h3>创作中心</h3>
          <p>记录您的想法和创意</p>
        </div>
        <div class="feature-card">
          <span class="icon">👤</span>
          <h3>个人中心</h3>
          <p>管理您的个人信息</p>
        </div>
        <div class="feature-card">
          <span class="icon">🎮</span>
          <h3>娱乐区</h3>
          <p>放松身心的空间</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import NavigationBar from '../NavigationBar.vue'

export default {
  name: 'Home',
  components: {
    NavigationBar
  },
  data() {
    return {
      themeClass: localStorage.getItem('theme') === 'dark' ? 'dark-mode' : 'light-mode'
    }
  },
  created() {
    window.addEventListener('theme-changed', this.handleThemeChange)
  },
  beforeUnmount() {
    window.removeEventListener('theme-changed', this.handleThemeChange)
  },
  methods: {
    handleThemeChange(e) {
      this.themeClass = e.detail.theme === 'dark' ? 'dark-mode' : 'light-mode'
    }
  }
}
</script>

<style scoped>
.home-container {
  min-height: 100vh;
  transition: background-color 0.3s, color 0.3s;
}

/* 白天模式背景 */
.home-container.light-mode {
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  color: #333;
}

/* 黑夜模式背景 */
.home-container.dark-mode {
  background: linear-gradient(135deg, #1a202c 0%, #2d3748 100%);
  color: #e2e8f0;
}

.home-content {
  padding: 40px 20px;
  max-width: 1200px;
  margin: 0 auto;  /* 紧贴导航栏，无额外间距 */
  text-align: center;
}

.home-content h1 {
  font-size: 3rem;
  margin-bottom: 20px;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.home-content > p {
  font-size: 1.2rem;
  opacity: 0.8;
  margin-bottom: 60px;
}

.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 30px;
  margin-top: 60px;
}

.feature-card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 30px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: transform 0.3s, box-shadow 0.3s;
}

.feature-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}

.light-mode .feature-card {
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.dark-mode .feature-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.icon {
  font-size: 3rem;
  display: block;
  margin-bottom: 15px;
}

.feature-card h3 {
  font-size: 1.5rem;
  margin-bottom: 10px;
}

.feature-card p {
  opacity: 0.8;
  line-height: 1.6;
}

@media (max-width: 768px) {
  .home-content h1 {
    font-size: 2rem;
  }
  
  .features {
    grid-template-columns: 1fr;
  }
}
</style>