<template>
  <div :class="themeClass" class="page-container">
    <NavigationBar />
    <div class="content">
      <h1>关于我们</h1>
      <p class="placeholder">开发中...</p>
    </div>
  </div>
</template>

<script>
import NavigationBar from '../NavigationBar.vue'

export default {
  name: 'About',
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
.page-container {
  min-height: 100vh;
  transition: background-color 0.3s, color 0.3s;
}

.light-mode {
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  color: #333;
}

.dark-mode {
  background: linear-gradient(135deg, #1a202c 0%, #2d3748 100%);
  color: #e2e8f0;
}

.content {
  padding: 40px;
  text-align: center;
}

.content h1 {
  font-size: 2.5rem;
  margin-bottom: 20px;
}

.placeholder {
  font-size: 1.5rem;
  opacity: 0.6;
  margin-top: 40px;
}
</style>