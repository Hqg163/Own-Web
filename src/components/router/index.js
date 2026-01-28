import { createRouter, createWebHashHistory } from 'vue-router'
// ❌ 修正：Home 应该是 Home.vue，不是 NavigationBar
import Home from '../views/Home.vue'
import PersonalCenter from '../views/PersonalCenter.vue'
import Login from '../views/Login.vue'
import About from '../views/About.vue'        // 导入 About
import Creation from '../views/Creation.vue'  // 导入 Creation

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home  // ✅ 使用 Home.vue 作为首页
  },
  {
    path: '/personal',
    name: 'PersonalCenter',
    component: PersonalCenter,
    meta: { requiresAuth: true }
  },
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: { guestOnly: true }
  },
  {
    path: '/about',
    name: 'About',
    component: About  // 添加关于页面路由
  },
  {
    path: '/creation',
    name: 'Creation',
    component: Creation  // 添加创作中心路由
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  }
})

// 路由守卫：检查登录状态
router.beforeEach((to, from, next) => {
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true'
  
  if (to.meta.requiresAuth && !isLoggedIn) {
    localStorage.setItem('redirectAfterLogin', to.fullPath)
    next('/login')
    return
  }
  
  if (to.meta.guestOnly && isLoggedIn) {
    next('/personal')
    return
  }
  
  next()
})

export default router