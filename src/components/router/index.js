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
        redirect: '/personal/info',  // 默认重定向到个人信息
        meta: { requiresAuth: true }
      },
      {
        path: 'personal/info',
        name: 'PersonalInfo',
        component: PersonalCenter,  // 个人信息页面
        meta: { requiresAuth: true }
      },
      // 娱乐区路由 - 与个人信息平级，但都受个人中心保护
      {
        path: 'personal/entertainment',
        name: 'Entertainment',
        component: Entertainment,
        meta: { requiresAuth: true }
      },
      {
        path: 'personal/entertainment/images',
        name: 'ImageZone',
        component: ImageZone,
        meta: { requiresAuth: true }
      },
      {
        path: 'personal/entertainment/videos',
        name: 'VideoZone',
        component: VideoZone,
        meta: { requiresAuth: true }
      },
      {
        path: 'personal/entertainment/music',
        name: 'MusicZone',
        component: MusicZone,
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