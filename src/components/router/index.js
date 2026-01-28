import { createRouter, createWebHashHistory } from 'vue-router'
import Layout from '../layouts/Layout.vue'
import Home from '../views/Home.vue'

const routes = [
  {
    path: '/',
    component: Layout,
    redirect: '/home',
    children: [
      { path: 'home', name: 'Home', component: Home },
      { path: 'personal', name: 'PersonalCenter', component: () => import('../views/PersonalCenter.vue'), meta: { requiresAuth: true } },
      { path: 'creation', name: 'Creation', component: () => import('../views/Creation.vue') },
      { path: 'about', name: 'About', component: () => import('../views/About.vue') }
    ]
  },
  { path: '/login', name: 'Login', component: () => import('../views/Login.vue'), meta: { guestOnly: true } }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

// 路由守卫：检查登录状态
router.beforeEach((to, from, next) => {
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true'
  
  // 需要登录但未登录
  if (to.meta.requiresAuth && !isLoggedIn) {
    next('/login')
    return
  }
  
  // 仅限未登录用户但已登录
  if (to.meta.guestOnly && isLoggedIn) {
    next('/')
    return
  }
  
  next()
})

export default router