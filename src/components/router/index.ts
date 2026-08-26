import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import Layout from '../layouts/Layout.vue'
import http, { cacheAuthenticatedUser, clearCachedAuth } from '../../services/http'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: Layout,
    children: [
      {
        path: '',
        name: 'Home',
        component: () => import('../views/Home.vue')
      },
      {
        path: 'personal',
        name: 'PersonalCenter',
        component: () => import('../views/PersonalCenter.vue'),
        redirect: '/personal/info',
        meta: { requiresAuth: true },
        children: [
          {
            path: 'info',
            name: 'PersonalInfo',
            component: () => import('../views/PersonalInfo.vue')
          },
          {
            path: 'study',
            name: 'StudyZone',
            component: () => import('../views/StudyZone.vue')
          },
          {
            path: 'entertainment',
            name: 'Entertainment',
            component: () => import('../views/Entertainment.vue')
          },
          {
            path: 'entertainment/images',
            name: 'ImageZone',
            component: () => import('../views/entertainment/ImageZone.vue')
          },
          {
            path: 'entertainment/videos',
            name: 'VideoZone',
            component: () => import('../views/entertainment/VideoZone.vue')
          },
          {
            path: 'entertainment/music',
            name: 'MusicZone',
            component: () => import('../views/entertainment/MusicZone.vue')
          }
        ]
      },
      {
        path: 'creation',
        name: 'Creation',
        component: () => import('../views/Creation.vue')
      },
      {
        path: 'about',
        name: 'About',
        component: () => import('../views/About.vue')
      }
    ]
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { guestOnly: true }
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('../views/Register.vue'),
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

router.beforeEach(async (to) => {
  const hasCachedLogin = localStorage.getItem('isLoggedIn') === 'true'
  let isLoggedIn = false

  if (hasCachedLogin || to.meta.requiresAuth || to.meta.guestOnly) {
    try {
      const response = await http.get('/api/me')
      cacheAuthenticatedUser(response.data.user)
      isLoggedIn = true
    } catch {
      clearCachedAuth()
    }
  }

  if (to.meta.requiresAuth && !isLoggedIn) {
    localStorage.setItem('redirectAfterLogin', to.fullPath)
    return '/login'
  }

  if (to.meta.guestOnly && isLoggedIn) {
    return '/personal'
  }

  return true
})

export default router
