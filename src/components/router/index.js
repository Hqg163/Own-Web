import { createRouter, createWebHashHistory } from 'vue-router'
import Layout from '../layouts/Layout.vue'
// ❌ 修正：Home 应该是 Home.vue，不是 NavigationBar
import Home from '../views/Home.vue'
import PersonalCenter from '../views/PersonalCenter.vue'
import Login from '../views/Login.vue'
import Register from '../views/Register.vue'
import About from '../views/About.vue'        // 导入 About
import Creation from '../views/Creation.vue'  // 导入 Creation

const routes = [
  {
    path: '/',
    component: Layout,  // 使用 Layout 作为父路由
    children: [
      {
        path: '',  // 默认子路由
        name: 'Home',
        component: Home
      },
      {
        path: 'personal',
        name: 'PersonalCenter',
        component: PersonalCenter,
        meta: { requiresAuth: true }
      },
      {
        path: 'creation',
        name: 'Creation',
        component: Creation
      },
      {
        path: 'about',
        name: 'About',
        component: About
      }
    ]
  },
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: { guestOnly: true }
  },
  {
    path: '/register',
    name: 'Register',
    component: Register,  // 添加注册路由
    meta: { guestOnly: true }
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