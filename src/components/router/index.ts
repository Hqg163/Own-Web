import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import Layout from '../layouts/Layout.vue'
import http, { cacheAuthenticatedUser, clearCachedAuth } from '../../services/http'

const protectedMeta = { requiresAuth: true }
const routes: RouteRecordRaw[] = [{ path: '/', component: Layout, children: [
  { path:'', name:'Home', component:()=>import('../views/Home.vue') },
  { path:'explore', name:'Explore', component:()=>import('../views/Explore.vue') },
  { path:'posts/:slug', name:'PostDetail', component:()=>import('../views/PostDetail.vue') },
  { path:'u/:username', name:'Profile', component:()=>import('../views/Profile.vue') },
  { path:'u/:username/posts', name:'ProfilePosts', component:()=>import('../views/Profile.vue') },
  { path:'about', name:'About', component:()=>import('../views/About.vue') },
  { path:'creation', name:'Creation', component:()=>import('../views/Creation.vue'), meta:protectedMeta },
  { path:'write', name:'Write', component:()=>import('../views/PostEditor.vue'), meta:protectedMeta },
  { path:'posts/new', redirect:'/write' },
  { path:'posts/:id/edit', name:'EditPost', component:()=>import('../views/PostEditor.vue'), meta:protectedMeta },
  { path:'settings', name:'Settings', component:()=>import('../views/Settings.vue'), meta:protectedMeta },
  { path:'dashboard', name:'Dashboard', component:()=>import('../views/Dashboard.vue'), meta:protectedMeta },
  { path:'dashboard/notifications', name:'Notifications', component:()=>import('../views/Notifications.vue'), meta:protectedMeta },
  { path:'dashboard/reports/:id', name:'MyReportDetail', component:()=>import('../views/MyReports.vue'), meta:protectedMeta },
  { path:'dashboard/reports', name:'MyReports', component:()=>import('../views/MyReports.vue'), meta:protectedMeta },
  { path:'dashboard/bookmarks', name:'Bookmarks', component:()=>import('../views/Bookmarks.vue'), meta:protectedMeta },
  { path:'admin/reports/:id', name:'AdminReportDetail', component:()=>import('../views/AdminReports.vue'), meta:protectedMeta },
  { path:'admin/reports', name:'AdminReports', component:()=>import('../views/AdminReports.vue'), meta:protectedMeta },
  { path:'personal', name:'PersonalCenter', component:()=>import('../views/PersonalCenter.vue'), redirect:'/personal/info', meta:protectedMeta, children:[
    {path:'info',name:'PersonalInfo',component:()=>import('../views/PersonalInfo.vue')}, {path:'study',name:'StudyZone',component:()=>import('../views/StudyZone.vue')}, {path:'entertainment',name:'Entertainment',component:()=>import('../views/Entertainment.vue')},
    {path:'entertainment/images',name:'ImageZone',component:()=>import('../views/entertainment/ImageZone.vue')}, {path:'entertainment/videos',name:'VideoZone',component:()=>import('../views/entertainment/VideoZone.vue')}, {path:'entertainment/music',name:'MusicZone',component:()=>import('../views/entertainment/MusicZone.vue')}
  ]}
]},
{path:'/login',name:'Login',component:()=>import('../views/Login.vue'),meta:{guestOnly:true}}, {path:'/register',name:'Register',component:()=>import('../views/Register.vue'),meta:{guestOnly:true}}, {path:'/:pathMatch(.*)*',redirect:'/'}]
const router=createRouter({history:createWebHistory(),routes,scrollBehavior(){return{top:0}}})
router.beforeEach(async(to)=>{const cached=localStorage.getItem('isLoggedIn')==='true';let logged=false;if(cached||to.meta.requiresAuth||to.meta.guestOnly){try{const {data}=await http.get('/api/me');cacheAuthenticatedUser(data.user);logged=true}catch(error:any){if(error.response?.status===401)clearCachedAuth();else logged=cached}}if(to.meta.requiresAuth&&!logged){localStorage.setItem('redirectAfterLogin',to.fullPath);return'/login'}if(to.meta.guestOnly&&logged)return'/dashboard';return true})
export default router
