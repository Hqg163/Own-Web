// index.js - 修改后的路由配置
import { createRouter, createWebHashHistory } from 'vue-router'
import Layout from '../layouts/Layout.vue'
import Home from '../views/Home.vue'
import PersonalCenter from '../views/PersonalCenter.vue'
import Login from '../views/Login.vue'
import Register from '../views/Register.vue'
import About from '../views/About.vue'
import Creation from '../views/Creation.vue'

// 导入娱乐区组件
import Entertainment from '../views/Entertainment.vue'
import ImageZone from '../views/entertainment/ImageZone.vue'
import VideoZone from '../views/entertainment/VideoZone.vue'
import MusicZone from '../views/entertainment/MusicZone.vue'

// 导入学习区组件
import StudyZone from '../views/StudyZone.vue'

const routes = [
  {
    path: '/',
    component: Layout,
    children: [
      {
        path: '',
        name: 'Home',
        component: Home
      },
      {
        path: 'personal',
        name: 'PersonalCenter',
        component: PersonalCenter,
        redirect: '/personal/info',  // 默认重定向到个人信息
        meta: { requiresAuth: true },
        children: [
          {
            path: 'info',
            name: 'PersonalInfo',
            component: () => import('../views/PersonalInfo.vue')  // 需要创建这个文件
          },
          {
            path: 'study',
            name: 'StudyZone',
            component: StudyZone
          },
          {
            path: 'entertainment',
            name: 'Entertainment',
            component: Entertainment
          },
          {
            path: 'entertainment/images',
            name: 'ImageZone',
            component: ImageZone,
            meta: { requiresAuth: true }
          },
          {
            path: 'entertainment/videos',
            name: 'VideoZone',
            component: VideoZone,
            meta: { requiresAuth: true }
          },
          {
            path: 'entertainment/music',
            name: 'MusicZone',
            component: MusicZone,
            meta: { requiresAuth: true }
          }
        ]
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
    component: Register,
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