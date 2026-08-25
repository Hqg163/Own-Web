<template>
  <div :class="themeClass" class="page-container">
    <div class="content">
      <h1>关于 Own-Web</h1>
      <p class="intro">一个用于整理个人资料、学习文件与娱乐媒体的个人网站。</p>
      <div class="about-grid">
        <section>
          <h2>当前模块</h2>
          <p>首页、个人资料、学习区、站内邮件，以及图片、视频、音乐管理。</p>
        </section>
        <section>
          <h2>技术栈</h2>
          <p>前端使用 Vue 3、Vue Router、Vite；后端使用 Express 与 MySQL。</p>
        </section>
        <section>
          <h2>项目状态</h2>
          <p>核心页面已可使用，创作中心和媒体编辑能力仍在迭代中。</p>
        </section>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'About',
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
  max-width: 960px;
  margin: 0 auto;
  padding: 64px 24px;
  text-align: center;
}

.content h1 {
  font-size: 2.5rem;
  margin-bottom: 20px;
}

.intro {
  font-size: 1.1rem;
  opacity: 0.6;
  margin: 20px auto 40px;
}

.about-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 20px;
  text-align: left;
}

.about-grid section {
  padding: 24px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.28);
}

.about-grid h2 {
  margin-bottom: 12px;
  font-size: 1.1rem;
}
</style>
