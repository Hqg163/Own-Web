<template>
  <WorkspaceShell
    :sections="sections"
    :user="{ name: userInfo.username, email: userInfo.email, avatarUrl: userInfo.avatar_url }"
    allow-avatar-upload
    :avatar-uploading="avatarUploading"
    :avatar-message="avatarMessage"
    @avatar-selected="uploadAvatar"
  >
    <router-view />
  </WorkspaceShell>
</template>

<script>
import http from '@/services/http'
import WorkspaceShell from '@/components/WorkspaceShell.vue'

export default {
  name: 'PersonalCenter',
  components: { WorkspaceShell },
  data() {
    return {
      sections: [
        { label: '账户', items: [
          { label: '个人资料', icon: 'user', to: '/personal/info' },
          { label: '博客设置', icon: 'settings', to: '/settings' }
        ] },
        { label: '学习资料', items: [
          { label: '学习区', icon: 'book', to: '/personal/study' }
        ] },
        { label: '媒体库', items: [
          { label: '媒体概览', icon: 'grid', to: '/personal/entertainment' },
          { label: '图片', icon: 'image', to: '/personal/entertainment/images' },
          { label: '视频', icon: 'video', to: '/personal/entertainment/videos' },
          { label: '音乐', icon: 'music', to: '/personal/entertainment/music' }
        ] },
        { label: '创作', items: [
          { label: '创作中心', icon: 'pen', to: '/creation' },
          { label: '通知', icon: 'bell', to: '/dashboard/notifications' }
        ] }
      ],
      userInfo: { username: '', email: '', avatar_url: null },
      avatarUploading: false,
      avatarMessage: null,
      avatarMessageTimer: null
    }
  },
  created() {
    this.loadUserInfo()
  },
  beforeUnmount() {
    if (this.avatarMessageTimer) window.clearTimeout(this.avatarMessageTimer)
  },
  methods: {
    async loadUserInfo() {
      try {
        const response = await http.get('/api/me')
        this.userInfo = response.data.user
      } catch (error) {
        if (error.response?.status === 401) this.$router.push('/login')
      }
    },
    setAvatarMessage(type, text) {
      this.avatarMessage = { type, text }
      if (this.avatarMessageTimer) window.clearTimeout(this.avatarMessageTimer)
      this.avatarMessageTimer = window.setTimeout(() => { this.avatarMessage = null }, 3500)
    },
    async uploadAvatar(file) {
      if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) {
        this.setAvatarMessage('error', '请选择 PNG、JPEG、WebP 或 GIF 格式的图片。')
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        this.setAvatarMessage('error', '头像文件不能超过 5MB。')
        return
      }
      this.avatarUploading = true
      try {
        const data = new FormData()
        data.append('avatar', file)
        const response = await http.post('/api/me/avatar', data)
        this.userInfo.avatar_url = response.data.avatarUrl
        const cached = JSON.parse(localStorage.getItem('userInfo') || '{}')
        localStorage.setItem('userInfo', JSON.stringify({ ...cached, avatar_url: response.data.avatarUrl }))
        window.dispatchEvent(new CustomEvent('profile-avatar-updated', { detail: { avatarUrl: response.data.avatarUrl } }))
        this.setAvatarMessage('success', '头像已更新。')
      } catch (error) {
        this.setAvatarMessage('error', error.response?.data?.error?.message || error.response?.data?.error || '头像上传失败，请稍后重试。')
      } finally {
        this.avatarUploading = false
      }
    }
  }
}
</script>
