<template>
  <div :class="themeClass" class="entertainment-container">
    <main class="entertainment-content">
      <header class="media-page-header">
        <div>
          <p class="eyebrow">Media library</p>
          <h2>媒体库</h2>
          <p>在同一处整理图片、视频与音乐；所有资源仅属于当前账户。</p>
        </div>
        <button class="refresh-btn" type="button" :disabled="isLoading" @click="loadRecentData">刷新资源</button>
      </header>

      <div v-if="loadError" class="media-error" role="alert">
        <span>{{ loadError }}</span><button type="button" @click="loadRecentData">重试</button>
      </div>

      <section class="zone-section" aria-labelledby="images-heading">
        <header class="zone-header">
          <div class="zone-heading"><span class="zone-icon"><AppIcon name="image" :size="21" /></span><div><h3 id="images-heading">图片</h3><p>{{ recentImages.length }} 项最近资源</p></div></div>
          <div class="zone-actions"><button class="text-btn" type="button" @click="goToImageZone">管理图片<AppIcon name="arrow-right" :size="16" /></button><button class="upload-btn" type="button" @click="showUploadImage = true"><AppIcon name="upload" :size="16" />上传图片</button></div>
        </header>
        <div v-if="isLoading" class="media-loading">正在读取资源…</div>
        <div v-else-if="recentImages.length === 0" class="empty-zone"><AppIcon name="image" :size="26" /><p>还没有图片。上传后可在图片管理页预览、编辑与下载。</p></div>
        <div v-else class="zone-preview">
          <article v-for="image in recentImages" :key="image.id" class="preview-item">
            <img class="preview-thumbnail" :src="getImageUrl(image)" :alt="image.title || '图片缩略图'" @error="handleThumbnailError" />
            <div class="item-info"><strong>{{ image.title }}</strong><span>{{ image.file_type }} · {{ formatDate(image.created_at) }}</span></div>
            <span class="media-tag">{{ image.style || '普通' }}</span>
            <button class="icon-btn" type="button" :aria-label="`查看 ${image.title || '图片'} 缩略图`" @click="viewThumbnail(image)"><AppIcon name="image" :size="17" /></button>
          </article>
        </div>
      </section>

      <section class="zone-section" aria-labelledby="videos-heading">
        <header class="zone-header">
          <div class="zone-heading"><span class="zone-icon"><AppIcon name="video" :size="21" /></span><div><h3 id="videos-heading">视频</h3><p>{{ recentVideos.length }} 项最近资源</p></div></div>
          <div class="zone-actions"><button class="text-btn" type="button" @click="goToVideoZone">管理视频<AppIcon name="arrow-right" :size="16" /></button><button class="upload-btn" type="button" @click="showUploadVideo = true"><AppIcon name="upload" :size="16" />上传视频</button></div>
        </header>
        <div v-if="isLoading" class="media-loading">正在读取资源…</div>
        <div v-else-if="recentVideos.length === 0" class="empty-zone"><AppIcon name="video" :size="26" /><p>还没有视频。上传后可在视频管理页播放、剪辑与下载。</p></div>
        <div v-else class="zone-preview">
          <article v-for="video in recentVideos" :key="video.id" class="preview-item"><span class="preview-file-icon"><AppIcon name="video" :size="20" /></span><div class="item-info"><strong>{{ video.title }}</strong><span>{{ video.file_type }} · {{ formatDate(video.created_at) }}</span></div><span class="media-tag">{{ video.duration || '时长未知' }}</span></article>
        </div>
      </section>

      <section class="zone-section" aria-labelledby="music-heading">
        <header class="zone-header">
          <div class="zone-heading"><span class="zone-icon"><AppIcon name="music" :size="21" /></span><div><h3 id="music-heading">音乐</h3><p>{{ recentMusic.length }} 项最近资源</p></div></div>
          <div class="zone-actions"><button class="text-btn" type="button" @click="goToMusicZone">管理音乐<AppIcon name="arrow-right" :size="16" /></button><button class="upload-btn" type="button" @click="showUploadMusic = true"><AppIcon name="upload" :size="16" />上传音乐</button></div>
        </header>
        <div v-if="isLoading" class="media-loading">正在读取资源…</div>
        <div v-else-if="recentMusic.length === 0" class="empty-zone"><AppIcon name="music" :size="26" /><p>还没有音乐。上传后可在音乐管理页播放、编辑歌词与下载。</p></div>
        <div v-else class="zone-preview">
          <article v-for="music in recentMusic" :key="music.id" class="preview-item"><span class="preview-file-icon"><AppIcon name="music" :size="20" /></span><div class="item-info"><strong>{{ music.title }}</strong><span>{{ music.artist || '未知艺术家' }}{{ music.album ? ` · ${music.album}` : '' }}</span></div><span class="media-tag">{{ music.duration || '时长未知' }}</span></article>
        </div>
      </section>
    </main>

    <!-- 缩略图预览弹窗 -->
    <div v-if="thumbnailImage" class="modal-overlay" @click.self="thumbnailImage = null">
      <div class="thumbnail-modal" role="dialog" aria-modal="true" aria-labelledby="thumbnail-title">
        <h3 id="thumbnail-title">{{ thumbnailImage.title }}</h3>
        <img :src="getImageUrl(thumbnailImage)" :alt="thumbnailImage.title" />
        <button class="btn-secondary" type="button" @click="thumbnailImage = null">关闭</button>
      </div>
    </div>

    <!-- 上传图片弹窗 -->
    <div v-if="showUploadImage" class="modal-overlay" @click.self="showUploadImage = false">
      <div class="upload-modal" role="dialog" aria-modal="true" aria-labelledby="upload-image-title">
        <h3 id="upload-image-title">上传图片</h3>
        <div class="form-group">
          <label for="media-image-title">图片名称（可选）</label>
          <input id="media-image-title" type="text" v-model="uploadImageForm.title" placeholder="默认为文件名" />
        </div>
        <div class="form-group">
          <label for="media-image-style">风格</label>
          <select id="media-image-style" v-model="uploadImageForm.style">
            <option value="普通">普通</option>
            <option value="风景">风景</option>
            <option value="人物">人物</option>
            <option value="动漫">动漫</option>
            <option value="美食">美食</option>
            <option value="其他">其他</option>
          </select>
        </div>
        <div class="form-group">
          <label for="media-image-file">选择文件</label>
          <input id="media-image-file" type="file" accept="image/*" @change="handleImageFileSelect" />
          <span v-if="uploadImageForm.file" class="file-selected">{{ uploadImageForm.file.name }}</span>
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" type="button" @click="showUploadImage = false">取消</button>
          <button class="btn-primary" type="button" :disabled="!uploadImageForm.file || uploadingKind === 'image'" @click="confirmUploadImage">{{ uploadingKind === 'image' ? '上传中…' : '开始上传' }}</button>
        </div>
      </div>
    </div>

    <!-- 上传视频弹窗 -->
    <div v-if="showUploadVideo" class="modal-overlay" @click.self="showUploadVideo = false">
      <div class="upload-modal" role="dialog" aria-modal="true" aria-labelledby="upload-video-title">
        <h3 id="upload-video-title">上传视频</h3>
        <div class="form-group">
          <label for="media-video-title">视频标题（可选）</label>
          <input id="media-video-title" type="text" v-model="uploadVideoForm.title" placeholder="默认为文件名" />
        </div>
        <div class="form-group">
          <label for="media-video-file">选择文件</label>
          <input id="media-video-file" type="file" accept="video/*" @change="handleVideoFileSelect" />
          <span v-if="uploadVideoForm.file" class="file-selected">{{ uploadVideoForm.file.name }}</span>
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" type="button" @click="showUploadVideo = false">取消</button>
          <button class="btn-primary" type="button" :disabled="!uploadVideoForm.file || uploadingKind === 'video'" @click="confirmUploadVideo">{{ uploadingKind === 'video' ? '上传中…' : '开始上传' }}</button>
        </div>
      </div>
    </div>

    <!-- 上传音乐弹窗 -->
    <div v-if="showUploadMusic" class="modal-overlay" @click.self="showUploadMusic = false">
      <div class="upload-modal" role="dialog" aria-modal="true" aria-labelledby="upload-music-title">
        <h3 id="upload-music-title">上传音乐</h3>
        <div class="form-group">
          <label for="media-music-title">歌曲名 <span class="required">*</span></label>
          <input id="media-music-title" type="text" v-model="uploadMusicForm.title" placeholder="输入歌曲名" required />
        </div>
        <div class="form-group">
          <label for="media-music-artist">歌手 <span class="required">*</span></label>
          <input id="media-music-artist" type="text" v-model="uploadMusicForm.artist" placeholder="输入歌手名" required />
        </div>
        <div class="form-group">
          <label for="media-music-album">专辑（可选）</label>
          <input id="media-music-album" type="text" v-model="uploadMusicForm.album" placeholder="输入专辑名" />
        </div>
        <div class="form-group">
          <label for="media-music-release">发行时间（可选）</label>
          <input id="media-music-release" type="date" v-model="uploadMusicForm.releaseDate" />
        </div>
        <div class="form-group">
          <label for="media-music-file">选择文件 <span class="required">*</span></label>
          <input id="media-music-file" type="file" accept="audio/*" @change="handleMusicFileSelect" />
          <span v-if="uploadMusicForm.file" class="file-selected">{{ uploadMusicForm.file.name }}</span>
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" type="button" @click="showUploadMusic = false">取消</button>
          <button class="btn-primary" type="button" :disabled="!uploadMusicForm.file || !uploadMusicForm.title || uploadingKind === 'music'" @click="confirmUploadMusic">{{ uploadingKind === 'music' ? '上传中…' : '开始上传' }}</button>
        </div>
      </div>
    </div>

    <!-- Toast提示 -->
    <div v-if="toast.show" class="toast" :class="toast.type">{{ toast.message }}</div>
  </div>
</template>

<script>
import axios from '@/services/http'
import AppIcon from '@/components/AppIcon.vue'

export default {
  name: 'Entertainment',
  components: { AppIcon },
  data() {
    return {
      themeClass: localStorage.getItem('theme') === 'dark' ? 'dark-mode' : 'light-mode',
      userId: null,

      // 最近内容
      recentImages: [],
      recentVideos: [],
      recentMusic: [],
      isLoading: false,
      loadError: '',
      uploadingKind: '',

      // 上传弹窗控制
      showUploadImage: false,
      showUploadVideo: false,
      showUploadMusic: false,

      // 上传表单
      uploadImageForm: { title: '', style: '普通', file: null },
      uploadVideoForm: { title: '', file: null },
      uploadMusicForm: { title: '', artist: '', album: '', releaseDate: '', file: null },

      // 缩略图预览
      thumbnailImage: null,

      // 提示
      toast: { show: false, message: '', type: 'success' },
      themeHandler: null
    }
  },
  created() {
    this.userId = localStorage.getItem('userId')
    if (!this.userId) {
      this.$router.push('/login')
      return
    }

    this.loadRecentData()
    this.setupThemeListener()
    document.addEventListener('keydown', this.handleEscape)
  },
  beforeUnmount() {
    if (this.themeHandler) window.removeEventListener('theme-changed', this.themeHandler)
    document.removeEventListener('keydown', this.handleEscape)
  },
  methods: {
    setupThemeListener() {
      this.themeHandler = (e) => {
        this.themeClass = e.detail.theme === 'dark' ? 'dark-mode' : 'light-mode'
      }
      window.addEventListener('theme-changed', this.themeHandler)
    },

    async loadRecentData() {
      this.isLoading = true
      this.loadError = ''
      try {
        // 并行加载三种类型的最新内容
        const [imagesRes, videosRes, musicRes] = await Promise.all([
          axios.get(`/api/entertainment/images/recent/${this.userId}`),
          axios.get(`/api/entertainment/videos/recent/${this.userId}`),
          axios.get(`/api/entertainment/music/recent/${this.userId}`)
        ])

        this.recentImages = imagesRes.data.images || []
        this.recentVideos = videosRes.data.videos || []
        this.recentMusic = musicRes.data.music || []
      } catch (err) {
        console.error('加载娱乐区数据失败:', err)
        this.loadError = err.response?.data?.error || '媒体资源暂时无法读取，请稍后重试。'
      } finally {
        this.isLoading = false
      }
    },
    handleEscape(event) {
      if (event.key !== 'Escape') return
      if (this.thumbnailImage) this.thumbnailImage = null
      else if (this.showUploadImage) this.showUploadImage = false
      else if (this.showUploadVideo) this.showUploadVideo = false
      else if (this.showUploadMusic) this.showUploadMusic = false
    },

    formatDate(dateStr) {
      const date = new Date(dateStr)
      return `${date.getMonth() + 1}/${date.getDate()}`
    },

    viewThumbnail(image) {
      this.thumbnailImage = image
    },

    getImageUrl(image) {
      return `/api/entertainment/image-file/${image.id}`
    },
    handleThumbnailError(event) {
      event.currentTarget.style.visibility = 'hidden'
    },

    goToImageZone() {
      this.$router.push('/personal/entertainment/images')
    },

    goToVideoZone() {
      this.$router.push('/personal/entertainment/videos')
    },

    goToMusicZone() {
      this.$router.push('/personal/entertainment/music')
    },

    // 图片上传
    handleImageFileSelect(event) {
      const file = event.target.files[0]
      if (file) {
        if (!file.type.startsWith('image/')) {
          this.showToast('请选择图片文件', 'error')
          return
        }
        this.uploadImageForm.file = file
      }
    },

    async confirmUploadImage() {
      if (!this.uploadImageForm.file) return
      this.uploadingKind = 'image'
      const formData = new FormData()
      formData.append('image', this.uploadImageForm.file)
      formData.append('userId', this.userId)
      formData.append('title', this.uploadImageForm.title)
      formData.append('style', this.uploadImageForm.style)

      try {
        await axios.post('/api/entertainment/images', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        this.showToast('上传成功')
        this.showUploadImage = false
        this.uploadImageForm = { title: '', style: '普通', file: null }
        this.loadRecentData()
      } catch (err) {
        this.showToast(err.response?.data?.error || '上传失败', 'error')
      } finally {
        this.uploadingKind = ''
      }
    },

    // 视频上传
    handleVideoFileSelect(event) {
      const file = event.target.files[0]
      if (file) {
        if (!file.type.startsWith('video/')) {
          this.showToast('请选择视频文件', 'error')
          return
        }
        this.uploadVideoForm.file = file
      }
    },

    async confirmUploadVideo() {
      if (!this.uploadVideoForm.file) return
      this.uploadingKind = 'video'
      const formData = new FormData()
      formData.append('video', this.uploadVideoForm.file)
      formData.append('userId', this.userId)
      formData.append('title', this.uploadVideoForm.title)

      try {
        await axios.post('/api/entertainment/videos', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        this.showToast('上传成功')
        this.showUploadVideo = false
        this.uploadVideoForm = { title: '', file: null }
        this.loadRecentData()
      } catch (err) {
        this.showToast(err.response?.data?.error || '上传失败', 'error')
      } finally {
        this.uploadingKind = ''
      }
    },

    // 音乐上传
    handleMusicFileSelect(event) {
      const file = event.target.files[0]
      if (file) {
        if (!file.type.startsWith('audio/')) {
          this.showToast('请选择音频文件', 'error')
          return
        }
        this.uploadMusicForm.file = file
      }
    },

    async confirmUploadMusic() {
      if (!this.uploadMusicForm.file || !this.uploadMusicForm.title) return
      this.uploadingKind = 'music'
      const formData = new FormData()
      formData.append('music', this.uploadMusicForm.file)
      formData.append('userId', this.userId)
      formData.append('title', this.uploadMusicForm.title)
      formData.append('artist', this.uploadMusicForm.artist)
      formData.append('album', this.uploadMusicForm.album)  // 添加专辑
      formData.append('releaseDate', this.uploadMusicForm.releaseDate)

      try {
        await axios.post('/api/entertainment/music', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        this.showToast('上传成功')
        this.showUploadMusic = false
        this.uploadMusicForm = { title: '', artist: '', album: '', releaseDate: '', file: null }
        this.loadRecentData()
      } catch (err) {
        this.showToast(err.response?.data?.error || '上传失败', 'error')
      } finally {
        this.uploadingKind = ''
      }
    },

    showToast(message, type = 'success') {
      this.toast = { show: true, message, type }
      setTimeout(() => this.toast.show = false, 3000)
    }
  }
}
</script>

<style scoped>
.entertainment-container {
  min-height: 100vh;
  transition: background-color 0.3s, color 0.3s;
  padding: 20px;
}

.light-mode, .dark-mode { background: var(--bg); color: var(--text); }

.entertainment-content {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
}

.zone-section {
  background: var(--surface);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 24px;
  border: 1px solid var(--border);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.zone-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 2px solid var(--border);
}

.zone-title {
  margin: 0;
  font-size: 24px;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 10px;
}

.upload-btn {
  padding: 8px 20px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s;
}

.upload-btn:hover {
  background: var(--accent-strong);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.zone-preview {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.preview-item {
  display: flex;
  align-items: center;
  padding: 16px;
  background: var(--bg);
  border-radius: 10px;
  border: 1px solid var(--border);
  transition: all 0.3s;
  position: relative;
}

.preview-item:hover {
  transform: translateX(5px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-color: var(--accent);
}

.item-number {
  width: 30px;
  height: 30px;
  background: var(--accent);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 14px;
  margin-right: 15px;
  flex-shrink: 0;
}

.item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.item-title {
  font-weight: 600;
  color: var(--text);
  font-size: 15px;
}

.item-meta {
  font-size: 13px;
  color: var(--muted);
}

.item-style {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  margin-right: 10px;
}

.style-普通 { background: #e5e7eb; color: #374151; }
.style-风景 { background: #dbeafe; color: #1e40af; }
.style-人物 { background: #fce7f3; color: #be185d; }
.style-动漫 { background: #fef3c7; color: #92400e; }
.style-美食 { background: #d1fae5; color: #065f46; }
.style-其他 { background: #f3e8ff; color: #6b21a8; }

.thumb-btn {
  padding: 6px 14px;
  background: transparent;
  color: var(--accent);
  border: 1px solid var(--accent);
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.3s;
}

.thumb-btn:hover {
  background: var(--accent);
  color: white;
}

.duration-badge {
  padding: 4px 10px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  border-radius: 4px;
  font-size: 12px;
  font-family: monospace;
}

.empty-zone {
  text-align: center;
  padding: 40px;
  color: var(--muted);
  font-size: 16px;
}

.view-more {
  text-align: center;
  margin-top: 20px;
  padding-top: 15px;
  border-top: 1px solid var(--border);
}

.view-more-link {
  color: var(--accent);
  cursor: pointer;
  font-weight: 500;
  font-size: 14px;
  transition: all 0.3s;
}

.view-more-link:hover {
  text-decoration: underline;
  color: var(--accent-strong);
}

/* 音乐专区特殊样式 */
.music-item {
  padding: 12px 16px;
}

.music-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.music-title {
  font-weight: 600;
  color: var(--text);
}

.music-separator {
  color: var(--muted);
}

.music-artist {
  color: var(--muted);
  font-size: 14px;
}

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.thumbnail-modal, .upload-modal {
  background: var(--surface);
  border-radius: 16px;
  padding: 24px;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  border: 1px solid var(--border);
}

.thumbnail-modal img {
  width: 100%;
  height: auto;
  border-radius: 8px;
  margin: 16px 0;
}

.thumbnail-modal h4 {
  margin: 0 0 16px 0;
  color: var(--text);
}

.close-btn {
  width: 100%;
  padding: 12px;
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.close-btn:hover {
  background: var(--border);
}

.upload-modal h3 {
  margin: 0 0 20px 0;
  color: var(--text);
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  color: var(--text);
  font-weight: 500;
  font-size: 14px;
}

.form-group .required {
  color: #ef4444;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  font-size: 14px;
  transition: all 0.3s;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.file-selected {
  display: block;
  margin-top: 8px;
  font-size: 13px;
  color: var(--accent);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
}

.btn-primary, .btn-secondary {
  padding: 10px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s;
}

.btn-primary {
  background: var(--accent);
  color: white;
  border: none;
}

.btn-primary:hover:not(:disabled) {
  background: var(--accent-strong);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--border);
}

.btn-secondary:hover {
  background: var(--border);
}

/* Toast提示 */
.toast {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  border-radius: 8px;
  color: white;
  font-weight: 500;
  z-index: 2000;
  animation: slideDown 0.3s ease;
}

.toast.success {
  background: #10b981;
}

.toast.error {
  background: #ef4444;
}

@keyframes slideDown {
  from { opacity: 0; transform: translate(-50%, -20px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}

@media (max-width: 768px) {
  .zone-header {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }

  .preview-item {
    flex-wrap: wrap;
    gap: 8px;
  }

  .thumb-btn {
    width: 100%;
    margin-top: 8px;
  }
}

/* 媒体库的统一工作区样式：保留既有上传逻辑，只覆盖旧的渐变与彩色控件。 */
.entertainment-container {
  min-height: 0;
  padding: 0;
  background: transparent;
  color: var(--text);
}
.entertainment-container.light-mode,
.entertainment-container.dark-mode { background: transparent; color: var(--text); }
.entertainment-content { max-width: none; margin: 0; padding: 0; }
.media-page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-4); margin-bottom: var(--space-5); }
.media-page-header h2 { margin: var(--space-1) 0; color: var(--text); font-size: 1.6rem; letter-spacing: -.025em; }
.media-page-header p:last-child { max-width: 58ch; margin: 0; color: var(--muted); }
.refresh-btn,
.upload-btn,
.text-btn,
.icon-btn,
.entertainment-container .btn-primary,
.entertainment-container .btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: 38px;
  padding: 0 var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-raised);
  color: var(--text);
  box-shadow: none;
  font: inherit;
  font-size: .9rem;
  font-weight: 650;
  transition: border-color .15s ease, background .15s ease, color .15s ease;
}
.refresh-btn:hover:not(:disabled),
.text-btn:hover:not(:disabled),
.icon-btn:hover:not(:disabled),
.entertainment-container .btn-secondary:hover:not(:disabled) { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); transform: none; }
.upload-btn,
.entertainment-container .btn-primary { border-color: var(--accent); background: var(--accent); color: #fff; }
.upload-btn:hover:not(:disabled),
.entertainment-container .btn-primary:hover:not(:disabled) { background: var(--accent-strong); color: #fff; transform: none; box-shadow: none; }
.text-btn { border-color: transparent; background: transparent; color: var(--accent); padding: 0 var(--space-1); }
.icon-btn { width: 36px; padding: 0; }
.entertainment-container button:focus-visible,
.entertainment-container input:focus-visible,
.entertainment-container select:focus-visible { outline: 3px solid color-mix(in srgb, var(--accent), transparent 68%); outline-offset: 2px; }
.media-error { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); margin-bottom: var(--space-4); padding: var(--space-3); border: 1px solid color-mix(in srgb, var(--danger), transparent 58%); border-radius: var(--radius-sm); background: color-mix(in srgb, var(--danger), transparent 92%); color: var(--danger); }
.media-error button { border: 0; background: transparent; color: inherit; text-decoration: underline; cursor: pointer; }
.zone-section { margin: 0 0 var(--space-4); padding: var(--space-4); border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); box-shadow: none; }
.zone-header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); margin: 0 0 var(--space-3); padding: 0 0 var(--space-3); border-bottom: 1px solid var(--border); }
.zone-heading,
.zone-actions { display: flex; align-items: center; gap: var(--space-3); }
.zone-heading h3 { margin: 0; color: var(--text); font-size: 1rem; }
.zone-heading p { margin: 2px 0 0; color: var(--muted); font-size: .82rem; }
.zone-icon,
.preview-file-icon { display: grid; flex: none; place-items: center; width: 38px; height: 38px; border-radius: var(--radius-sm); background: var(--accent-soft); color: var(--accent); }
.zone-preview { display: grid; gap: var(--space-2); }
.preview-item { display: flex; align-items: center; gap: var(--space-3); min-height: 58px; padding: var(--space-2) var(--space-3); border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); color: var(--text); box-shadow: none; }
.preview-item:hover { border-color: var(--accent); box-shadow: none; transform: none; }
.preview-thumbnail { width: 44px; height: 44px; flex: none; object-fit: cover; border-radius: 6px; background: var(--accent-soft); }
.item-info { min-width: 0; flex: 1; display: grid; gap: 2px; }
.item-info strong { overflow: hidden; color: var(--text); font-size: .92rem; text-overflow: ellipsis; white-space: nowrap; }
.item-info span { overflow: hidden; color: var(--muted); font-size: .8rem; text-overflow: ellipsis; white-space: nowrap; }
.media-tag { flex: none; padding: 3px 8px; border: 1px solid var(--border); border-radius: 999px; color: var(--muted); font-size: .78rem; }
.empty-zone,
.media-loading { display: flex; align-items: center; justify-content: center; gap: var(--space-2); min-height: 112px; padding: var(--space-4); border: 1px dashed var(--border); border-radius: var(--radius-sm); background: transparent; color: var(--muted); text-align: center; }
.empty-zone p { max-width: 46ch; margin: 0; }
.modal-overlay { background: rgb(20 25 23 / 56%); }
.thumbnail-modal,
.upload-modal { width: min(480px, calc(100% - 32px)); padding: var(--space-5); border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); color: var(--text); box-shadow: var(--shadow); }
.thumbnail-modal h3,
.upload-modal h3 { margin: 0 0 var(--space-4); color: var(--text); }
.thumbnail-modal img { display: block; width: 100%; max-height: min(60vh, 520px); margin-bottom: var(--space-4); object-fit: contain; border-radius: var(--radius-sm); background: var(--bg); }
.form-group { display: grid; gap: 6px; margin-bottom: var(--space-3); }
.form-group label { color: var(--text); font-size: .9rem; font-weight: 650; }
.form-group input,
.form-group select { box-sizing: border-box; width: 100%; min-height: 40px; padding: 8px 10px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); color: var(--text); }
.file-selected { color: var(--muted); }
.modal-actions { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-5); }
.toast { top: var(--space-4); padding: var(--space-3) var(--space-4); border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); color: var(--text); box-shadow: var(--shadow); }
.toast.success { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }
.toast.error { border-color: var(--danger); background: color-mix(in srgb, var(--danger), transparent 92%); color: var(--danger); }
@media (max-width: 760px) {
  .media-page-header,
  .zone-header { align-items: stretch; flex-direction: column; }
  .zone-actions { justify-content: space-between; }
  .zone-actions .upload-btn { flex: 1; }
  .preview-item { align-items: flex-start; }
  .media-tag { display: none; }
  .thumbnail-modal,
  .upload-modal { padding: var(--space-4); }
}
</style>
