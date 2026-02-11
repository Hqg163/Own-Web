<template>
  <div :class="themeClass" class="entertainment-container">
    <div class="entertainment-content">
      <!-- 图片专区 -->
      <section class="zone-section">
        <div class="zone-header">
          <h2 class="zone-title">🖼️ 图片专区</h2>
          <button class="upload-btn" @click="showUploadImage = true">上传图片</button>
        </div>
        
        <div class="zone-preview">
          <div v-if="recentImages.length === 0" class="empty-zone">
            <span>空空如也~</span>
          </div>
          <div 
            v-for="(image, index) in recentImages" 
            :key="image.id"
            class="preview-item"
          >
            <span class="item-number">{{ index + 1 }}</span>
            <div class="item-info">
              <span class="item-title">{{ image.title }}</span>
              <span class="item-meta">{{ image.file_type }} | {{ formatDate(image.created_at) }}</span>
            </div>
            <span class="item-style" :class="'style-' + (image.style || '普通')">{{ image.style || '普通' }}</span>
            <button class="thumb-btn" @click="viewThumbnail(image)">查看缩略图</button>
          </div>
        </div>
        
        <div class="view-more">
          <span class="view-more-link" @click="goToImageZone">查看更多</span>
        </div>
      </section>

      <!-- 视频专区 -->
      <section class="zone-section">
        <div class="zone-header">
          <h2 class="zone-title">🎬 视频专区</h2>
          <button class="upload-btn" @click="showUploadVideo = true">上传视频</button>
        </div>
        
        <div class="zone-preview">
          <div v-if="recentVideos.length === 0" class="empty-zone">
            <span>空空如也~</span>
          </div>
          <div 
            v-for="(video, index) in recentVideos" 
            :key="video.id"
            class="preview-item"
          >
            <span class="item-number">{{ index + 1 }}</span>
            <div class="item-info">
              <span class="item-title">{{ video.title }}</span>
              <span class="item-meta">{{ video.file_type }} | {{ formatDate(video.created_at) }}</span>
            </div>
            <span class="duration-badge" v-if="video.duration">{{ video.duration }}</span>
          </div>
        </div>
        
        <div class="view-more">
          <span class="view-more-link" @click="goToVideoZone">查看更多</span>
        </div>
      </section>

      <!-- 音乐专区 -->
      <section class="zone-section">
        <div class="zone-header">
          <h2 class="zone-title">🎵 音乐专区</h2>
          <button class="upload-btn" @click="showUploadMusic = true">上传歌曲</button>
        </div>
        
        <div class="zone-preview music-preview">
          <div v-if="recentMusic.length === 0" class="empty-zone">
            <span>空空如也~</span>
          </div>
          <div 
            v-for="(music, index) in recentMusic" 
            :key="music.id"
            class="preview-item music-item"
          >
            <span class="item-number">{{ index + 1 }}</span>
            <div class="music-info">
              <span class="music-title">{{ music.title }}</span>
              <span class="music-separator"> -- </span>
              <span class="music-artist">{{ music.artist || '未知歌手' }}</span>
            </div>
            <span class="duration-badge">{{ music.duration || '0:00' }}</span>
          </div>
        </div>
        
        <div class="view-more">
          <span class="view-more-link" @click="goToMusicZone">查看更多</span>
        </div>
      </section>
    </div>

    <!-- 缩略图预览弹窗 -->
    <div v-if="thumbnailImage" class="modal-overlay" @click.self="thumbnailImage = null">
      <div class="thumbnail-modal">
        <h4>{{ thumbnailImage.title }}</h4>
        <img :src="getImageUrl(thumbnailImage)" :alt="thumbnailImage.title" />
        <button class="close-btn" @click="thumbnailImage = null">关闭</button>
      </div>
    </div>

    <!-- 上传图片弹窗 -->
    <div v-if="showUploadImage" class="modal-overlay" @click.self="showUploadImage = false">
      <div class="upload-modal">
        <h3>上传图片</h3>
        <div class="form-group">
          <label>图片名称（可选）</label>
          <input type="text" v-model="uploadImageForm.title" placeholder="默认为文件名" />
        </div>
        <div class="form-group">
          <label>风格</label>
          <select v-model="uploadImageForm.style">
            <option value="普通">普通</option>
            <option value="风景">风景</option>
            <option value="人物">人物</option>
            <option value="动漫">动漫</option>
            <option value="美食">美食</option>
            <option value="其他">其他</option>
          </select>
        </div>
        <div class="form-group">
          <label>选择文件</label>
          <input type="file" accept="image/*" @change="handleImageFileSelect" />
          <span v-if="uploadImageForm.file" class="file-selected">{{ uploadImageForm.file.name }}</span>
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" @click="showUploadImage = false">取消</button>
          <button class="btn-primary" :disabled="!uploadImageForm.file" @click="confirmUploadImage">本地上传</button>
        </div>
      </div>
    </div>

    <!-- 上传视频弹窗 -->
    <div v-if="showUploadVideo" class="modal-overlay" @click.self="showUploadVideo = false">
      <div class="upload-modal">
        <h3>上传视频</h3>
        <div class="form-group">
          <label>视频标题（可选）</label>
          <input type="text" v-model="uploadVideoForm.title" placeholder="默认为文件名" />
        </div>
        <div class="form-group">
          <label>选择文件</label>
          <input type="file" accept="video/*" @change="handleVideoFileSelect" />
          <span v-if="uploadVideoForm.file" class="file-selected">{{ uploadVideoForm.file.name }}</span>
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" @click="showUploadVideo = false">取消</button>
          <button class="btn-primary" :disabled="!uploadVideoForm.file" @click="confirmUploadVideo">本地上传</button>
        </div>
      </div>
    </div>

    <!-- 上传音乐弹窗 -->
    <div v-if="showUploadMusic" class="modal-overlay" @click.self="showUploadMusic = false">
      <div class="upload-modal">
        <h3>上传歌曲</h3>
        <div class="form-group">
          <label>歌曲名 <span class="required">*</span></label>
          <input type="text" v-model="uploadMusicForm.title" placeholder="输入歌曲名" required />
        </div>
        <div class="form-group">
          <label>歌手 <span class="required">*</span></label>
          <input type="text" v-model="uploadMusicForm.artist" placeholder="输入歌手名" required />
        </div>
        <div class="form-group">
          <label>专辑（可选）</label>
          <input type="text" v-model="uploadMusicForm.album" placeholder="输入专辑名" />
        </div>
        <div class="form-group">
          <label>发行时间（可选）</label>
          <input type="date" v-model="uploadMusicForm.releaseDate" />
        </div>
        <div class="form-group">
          <label>选择文件 <span class="required">*</span></label>
          <input type="file" accept="audio/*" @change="handleMusicFileSelect" />
          <span v-if="uploadMusicForm.file" class="file-selected">{{ uploadMusicForm.file.name }}</span>
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" @click="showUploadMusic = false">取消</button>
          <button class="btn-primary" :disabled="!uploadMusicForm.file || !uploadMusicForm.title" @click="confirmUploadMusic">本地上传</button>
        </div>
      </div>
    </div>

    <!-- Toast提示 -->
    <div v-if="toast.show" class="toast" :class="toast.type">{{ toast.message }}</div>
  </div>
</template>

<script>
import axios from 'axios'

export default {
  name: 'Entertainment',
  data() {
    return {
      themeClass: localStorage.getItem('theme') === 'dark' ? 'dark-mode' : 'light-mode',
      userId: null,
      
      // 最近内容
      recentImages: [],
      recentVideos: [],
      recentMusic: [],
      
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
      toast: { show: false, message: '', type: 'success' }
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
  },
  methods: {
    setupThemeListener() {
      window.addEventListener('theme-changed', (e) => {
        this.themeClass = e.detail.theme === 'dark' ? 'dark-mode' : 'light-mode'
      })
    },
    
    async loadRecentData() {
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
      }
    },
    
    formatDate(dateStr) {
      const date = new Date(dateStr)
      return `${date.getMonth() + 1}/${date.getDate()}`
    },
    
    viewThumbnail(image) {
      this.thumbnailImage = image
    },
    
    getImageUrl(image) {
      // 直接使用存储的路径
      if (image.file_path && image.file_path.startsWith('/uploads')) {
        return image.file_path
      }
      return `/api/entertainment/image-file/${image.id}?userId=${this.userId}`
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
        this.uploadMusicForm = { title: '', artist: '', releaseDate: '', file: null }
        this.loadRecentData()
      } catch (err) {
        this.showToast(err.response?.data?.error || '上传失败', 'error')
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

.light-mode {
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  color: #333;
  --bg-primary: #ffffff;
  --bg-secondary: #f8fafc;
  --border-color: #e5e7eb;
  --text-primary: #1f2937;
  --text-secondary: #6b7280;
  --accent-color: #3b82f6;
  --accent-hover: #2563eb;
}

.dark-mode {
  background: linear-gradient(135deg, #1a202c 0%, #2d3748 100%);
  color: #e2e8f0;
  --bg-primary: #1f2937;
  --bg-secondary: #2d3748;
  --border-color: #374151;
  --text-primary: #f9fafb;
  --text-secondary: #d1d5db;
  --accent-color: #60a5fa;
  --accent-hover: #3b82f6;
}

.entertainment-content {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
}

.zone-section {
  background: var(--bg-primary);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 24px;
  border: 1px solid var(--border-color);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.zone-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 2px solid var(--border-color);
}

.zone-title {
  margin: 0;
  font-size: 24px;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 10px;
}

.upload-btn {
  padding: 8px 20px;
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s;
}

.upload-btn:hover {
  background: var(--accent-hover);
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
  background: var(--bg-secondary);
  border-radius: 10px;
  border: 1px solid var(--border-color);
  transition: all 0.3s;
  position: relative;
}

.preview-item:hover {
  transform: translateX(5px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-color: var(--accent-color);
}

.item-number {
  width: 30px;
  height: 30px;
  background: var(--accent-color);
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
  color: var(--text-primary);
  font-size: 15px;
}

.item-meta {
  font-size: 13px;
  color: var(--text-secondary);
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
  color: var(--accent-color);
  border: 1px solid var(--accent-color);
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.3s;
}

.thumb-btn:hover {
  background: var(--accent-color);
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
  color: var(--text-secondary);
  font-size: 16px;
}

.view-more {
  text-align: center;
  margin-top: 20px;
  padding-top: 15px;
  border-top: 1px solid var(--border-color);
}

.view-more-link {
  color: var(--accent-color);
  cursor: pointer;
  font-weight: 500;
  font-size: 14px;
  transition: all 0.3s;
}

.view-more-link:hover {
  text-decoration: underline;
  color: var(--accent-hover);
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
  color: var(--text-primary);
}

.music-separator {
  color: var(--text-secondary);
}

.music-artist {
  color: var(--text-secondary);
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
  backdrop-filter: blur(4px);
}

.thumbnail-modal, .upload-modal {
  background: var(--bg-primary);
  border-radius: 16px;
  padding: 24px;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  border: 1px solid var(--border-color);
}

.thumbnail-modal img {
  width: 100%;
  height: auto;
  border-radius: 8px;
  margin: 16px 0;
}

.thumbnail-modal h4 {
  margin: 0 0 16px 0;
  color: var(--text-primary);
}

.close-btn {
  width: 100%;
  padding: 12px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.close-btn:hover {
  background: var(--border-color);
}

.upload-modal h3 {
  margin: 0 0 20px 0;
  color: var(--text-primary);
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  color: var(--text-primary);
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
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 14px;
  transition: all 0.3s;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.file-selected {
  display: block;
  margin-top: 8px;
  font-size: 13px;
  color: var(--accent-color);
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
  background: var(--accent-color);
  color: white;
  border: none;
}

.btn-primary:hover:not(:disabled) {
  background: var(--accent-hover);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover {
  background: var(--border-color);
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
</style>