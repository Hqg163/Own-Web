import { createRouter, createWebHashHistory } from 'vue-router'
import NavigationBar from '../NavigationBar.vue'
import PersonalCenter from '../views/PersonalCenter.vue'
import Login from '../views/Login.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: NavigationBar
  },
  {
    path: '/personal',
    name: 'PersonalCenter',
    component: PersonalCenter,
    meta: { requiresAuth: true } // 需要登录
  },
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: { guestOnly: true } // 仅限未登录用户
  }
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