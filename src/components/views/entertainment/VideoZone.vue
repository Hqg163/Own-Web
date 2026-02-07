<template>
  <div :class="themeClass" class="video-zone">
    <!-- 头部 -->
    <div class="zone-header">
      <button class="back-btn" @click="goBack">
        <span>←</span> 返回
      </button>
    </div>

    <!-- 描述区域 -->
    <div class="zone-description">
      <h3>🎬 视频专区</h3>
      <p>本专区为个人视频专区，以常见的缩略图为封面的视频进行展示</p>
      <p>悬停图片封面可直接小屏播放视频</p>
      <p>点击封面可跳转内嵌视频播放器进行播放，播放器中有调速、快进、全屏、指定视频播放等功能</p>
      <p>本页面视频均可播放和下载，请放心食用</p>
    </div>

    <!-- 操作栏 -->
    <div class="action-bar">
      <span class="selection-status">{{ selectionText }}</span>
      <div class="action-btns">
        <template v-if="!isFiltering">
          <button class="filter-btn" @click="startFilter">筛选视频</button>
          <button class="upload-btn" @click="showUpload = true">上传视频</button>
        </template>
        <template v-else>
          <button class="action-btn delete-btn" :disabled="selectedVideos.length === 0" @click="confirmDelete">
            批量删除
          </button>
          <button class="action-btn cancel-btn" @click="cancelFilter">取消筛选</button>
        </template>
      </div>
    </div>

    <!-- 视频展示区域 -->
    <div class="videos-grid">
      <div 
        v-for="video in videos" 
        :key="video.id"
        class="video-card"
        :class="{ 'selectable': isFiltering, 'selected': selectedVideos.includes(video.id) }"
        @click="handleVideoClick(video)"
        @mouseenter="hoverVideo = video.id"
        @mouseleave="hoverVideo = null"
      >
        <div v-if="isFiltering" class="selection-indicator">
          <span v-if="selectedVideos.includes(video.id)">✓</span>
        </div>
        
        <div class="video-thumbnail">
          <img 
            :src="getVideoCover(video)" 
            :alt="video.title"
            v-if="!isPlayingPreview(video)"
          />
          <video 
            v-else
            :src="getVideoUrl(video)" 
            autoplay
            muted
            loop
            class="preview-video"
          ></video>
          <div class="video-overlay">
            <span class="format-badge">{{ video.file_type }}</span>
            <span class="duration-badge" v-if="video.duration">{{ video.duration }}</span>
          </div>
          <div class="play-icon" v-if="!isFiltering && !isPlayingPreview(video)">▶</div>
        </div>
        
        <div class="video-info">
          <span class="video-title">{{ video.title }}</span>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="videos.length === 0" class="empty-state">
      <span>暂无视频，点击上传按钮添加视频</span>
    </div>

    <!-- 视频播放器 -->
    <div v-if="playingVideo" class="video-player-fullscreen">
      <div class="player-header">
        <button class="back-btn" @click="closePlayer">
          <span>←</span> 返回
        </button>
        <span class="player-title">{{ playingVideo.title }}</span>
        <div class="player-options">
          <button class="options-btn" @click="showOptions = !showOptions">⋮</button>
          <div v-if="showOptions" class="options-menu">
            <button @click="showVideoProperties">属性</button>
            <button @click="openVideoEditor">视频剪辑</button>
          </div>
        </div>
      </div>
      
      <div class="player-body">
        <div class="main-player">
          <video 
            ref="mainVideo"
            :src="getVideoUrl(playingVideo)"
            controls
            @timeupdate="updateProgress"
            @ended="onVideoEnded"
          ></video>
          
          <div class="custom-controls">
            <button @click="togglePlay">{{ isPlaying ? '⏸' : '▶' }}</button>
            <input 
              type="range" 
              v-model="currentTime" 
              :max="duration"
              @input="seekVideo"
              class="progress-bar"
            />
            <span class="time-display">{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</span>
            <select v-model="playbackRate" @change="changeSpeed" class="speed-control">
              <option value="0.5">0.5x</option>
              <option value="1">1x</option>
              <option value="1.5">1.5x</option>
              <option value="2">2x</option>
            </select>
            <button @click="toggleFullscreen">⛶</button>
          </div>
        </div>
        
        <div class="playlist-sidebar">
          <h4>播放列表</h4>
          <div class="playlist-items">
            <div 
              v-for="v in videos" 
              :key="v.id"
              :class="['playlist-item', { active: playingVideo && playingVideo.id === v.id }]"
              @click="playVideo(v)"
              @mouseenter="showVideoDuration = v.id"
            >
              <img :src="getVideoCover(v)" />
              <div class="playlist-item-info">
                <span class="playlist-title">{{ v.title }}</span>
                <span v-if="showVideoDuration === v.id" class="playlist-duration">{{ v.duration || '0:00' }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 视频属性弹窗 -->
    <div v-if="showProperties" class="modal-overlay" @click.self="showProperties = false">
      <div class="properties-modal">
        <h3>视频属性</h3>
        <div class="property-item">
          <label>标签：</label>
          <span>{{ currentVideoProperties.title }}</span>
        </div>
        <div class="property-item">
          <label>格式：</label>
          <span>{{ currentVideoProperties.file_type }}</span>
        </div>
        <div class="property-item">
          <label>帧数：</label>
          <span>{{ currentVideoProperties.frame_count || '未知' }}</span>
        </div>
        <div class="property-item">
          <label>帧率：</label>
          <span>{{ currentVideoProperties.frame_rate || '未知' }}</span>
        </div>
        <button @click="showProperties = false">关闭</button>
      </div>
    </div>

    <!-- 视频剪辑器 -->
    <div v-if="showEditor" class="video-editor-fullscreen">
      <div class="editor-header">
        <button class="back-btn" @click="closeEditor">← 返回</button>
        <h3>视频剪辑</h3>
        <button class="save-btn" @click="saveEditedVideo">保存</button>
      </div>
      
      <div class="editor-body">
        <div class="editor-preview">
          <video ref="editorVideo" :src="getVideoUrl(editingVideo)" controls></video>
        </div>
        
        <div class="editor-timeline">
          <div class="timeline-track">
            <div class="clip-range" :style="clipRangeStyle"></div>
          </div>
          <div class="clip-controls">
            <div class="clip-inputs">
              <label>开始时间：</label>
              <input type="number" v-model="clipStart" step="0.1" min="0" />
              <label>结束时间：</label>
              <input type="number" v-model="clipEnd" step="0.1" :max="videoDuration" />
            </div>
            <button @click="previewClip">预览剪辑</button>
          </div>
        </div>
        
        <div class="editor-tools">
          <button @click="splitClip">分割</button>
          <button @click="trimVideo">裁剪</button>
          <button @click="addTransition">添加转场</button>
        </div>
      </div>
    </div>

    <!-- 保存选项弹窗 -->
    <div v-if="showSaveOptions" class="modal-overlay" @click.self="showSaveOptions = false">
      <div class="save-options-modal">
        <h3>保存选项</h3>
        <p>视频覆盖原视频文件？</p>
        <div class="options">
          <button class="replace-btn" @click="saveWithReplace">确定</button>
          <button class="new-btn" @click="saveAsNew">生成新视频</button>
          <button @click="showSaveOptions = false">取消</button>
        </div>
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <div v-if="showDeleteConfirm" class="modal-overlay" @click.self="showDeleteConfirm = false">
      <div class="delete-modal">
        <h3>确认删除</h3>
        <p>是否要删除这 {{ selectedVideos.length }} 个视频？</p>
        <div class="actions">
          <button class="confirm-btn" @click="executeDelete">确定</button>
          <button @click="showDeleteConfirm = false">取消</button>
        </div>
      </div>
    </div>

    <!-- 上传弹窗 -->
    <div v-if="showUpload" class="modal-overlay" @click.self="showUpload = false">
      <div class="upload-modal">
        <h3>上传视频</h3>
        <div class="form-group">
          <label>视频标题（可选）</label>
          <input v-model="uploadForm.title" placeholder="默认为文件名" />
        </div>
        <div class="form-group">
          <label>选择文件</label>
          <input type="file" accept="video/*" @change="handleFileSelect" />
        </div>
        <div class="actions">
          <button class="upload-btn" :disabled="!uploadForm.file" @click="uploadVideo">本地上传</button>
          <button @click="showUpload = false">取消</button>
        </div>
      </div>
    </div>

    <!-- Toast -->
    <div v-if="toast.show" class="toast" :class="toast.type">{{ toast.message }}</div>
  </div>
</template>

<script>
import axios from 'axios'

export default {
  name: 'VideoZone',
  data() {
    return {
      themeClass: localStorage.getItem('theme') === 'dark' ? 'dark-mode' : 'light-mode',
      userId: null,
      videos: [],
      
      // 筛选
      isFiltering: false,
      selectedVideos: [],
      
      // 悬停预览
      hoverVideo: null,
      
      // 播放
      playingVideo: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      playbackRate: 1,
      showOptions: false,
      showVideoDuration: null,
      
      // 属性
      showProperties: false,
      currentVideoProperties: {},
      
      // 剪辑器
      showEditor: false,
      editingVideo: null,
      clipStart: 0,
      clipEnd: 0,
      videoDuration: 0,
      showSaveOptions: false,
      
      // 上传
      showUpload: false,
      uploadForm: { title: '', file: null },

      // 删除确认 - 添加这两行
      showDeleteConfirm: false,
      
      toast: { show: false, message: '', type: 'success' }
    }
  },
  computed: {
    selectionText() {
      if (!this.isFiltering) return ''
      return this.selectedVideos.length === 0 ? '未选择视频' : `已选择 ${this.selectedVideos.length} 个视频`
    },
    clipRangeStyle() {
      const start = (this.clipStart / this.videoDuration) * 100
      const width = ((this.clipEnd - this.clipStart) / this.videoDuration) * 100
      return {
        left: start + '%',
        width: width + '%'
      }
    }
  },
  created() {
    this.userId = localStorage.getItem('userId')
    if (!this.userId) {
      this.$router.push('/login')
      return
    }
    this.loadVideos()
    this.setupThemeListener()
  },
  methods: {
    setupThemeListener() {
      window.addEventListener('theme-changed', (e) => {
        this.themeClass = e.detail.theme === 'dark' ? 'dark-mode' : 'light-mode'
      })
    },
    
    async loadVideos() {
      try {
        const res = await axios.get(`/api/entertainment/videos/${this.userId}`)
        this.videos = res.data.videos || []
      } catch (err) {
        this.showToast('加载视频失败', 'error')
      }
    },
    
    getVideoUrl(video) {
      if (video.file_path && video.file_path.startsWith('/uploads')) {
        return video.file_path
      }
      return `/api/entertainment/video-file/${video.id}?userId=${this.userId}`
    },
    
    getVideoCover(video) {
      // 使用默认封面或视频首帧
      if (video.cover_path) {
        return video.cover_path
      }
      // 返回一个默认的视频封面占位图
      return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='180'%3E%3Crect width='320' height='180' fill='%23333'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23666' font-size='20'%3E视频封面%3C/text%3E%3C/svg%3E`
    },
    
    isPlayingPreview(video) {
      return this.hoverVideo === video.id && !this.isFiltering
    },
    
    goBack() {
      this.$router.push('/personal/entertainment')
    },
    
    startFilter() {
      this.isFiltering = true
      this.selectedVideos = []
    },
    
    cancelFilter() {
      this.isFiltering = false
      this.selectedVideos = []
    },
    
    handleVideoClick(video) {
      if (this.isFiltering) {
        const idx = this.selectedVideos.indexOf(video.id)
        if (idx > -1) {
          this.selectedVideos.splice(idx, 1)
        } else {
          this.selectedVideos.push(video.id)
        }
      } else {
        this.playVideo(video)
      }
    },
    
    playVideo(video) {
      this.playingVideo = video
      this.showOptions = false
      this.$nextTick(() => {
        const videoEl = this.$refs.mainVideo
        if (videoEl) {
          videoEl.play()
          this.isPlaying = true
        }
      })
    },
    
    closePlayer() {
      if (this.$refs.mainVideo) {
        this.$refs.mainVideo.pause()
      }
      this.playingVideo = null
      this.isPlaying = false
    },
    
    togglePlay() {
      const video = this.$refs.mainVideo
      if (video.paused) {
        video.play()
        this.isPlaying = true
      } else {
        video.pause()
        this.isPlaying = false
      }
    },
    
    updateProgress() {
      const video = this.$refs.mainVideo
      this.currentTime = video.currentTime
      this.duration = video.duration
    },
    
    seekVideo() {
      this.$refs.mainVideo.currentTime = this.currentTime
    },
    
    changeSpeed() {
      this.$refs.mainVideo.playbackRate = parseFloat(this.playbackRate)
    },
    
    toggleFullscreen() {
      const video = this.$refs.mainVideo
      if (video.requestFullscreen) {
        video.requestFullscreen()
      }
    },
    
    onVideoEnded() {
      this.isPlaying = false
      // 播放下一首
      const currentIdx = this.videos.findIndex(v => v.id === this.playingVideo.id)
      if (currentIdx < this.videos.length - 1) {
        this.playVideo(this.videos[currentIdx + 1])
      }
    },
    
    formatTime(seconds) {
      if (!seconds) return '0:00'
      const mins = Math.floor(seconds / 60)
      const secs = Math.floor(seconds % 60)
      return `${mins}:${secs.toString().padStart(2, '0')}`
    },
    
    showVideoProperties() {
      this.currentVideoProperties = this.playingVideo
      this.showProperties = true
      this.showOptions = false
    },
    
    openVideoEditor() {
      this.editingVideo = this.playingVideo
      this.showEditor = true
      this.showOptions = false
      this.$nextTick(() => {
        const video = this.$refs.editorVideo
        video.onloadedmetadata = () => {
          this.videoDuration = video.duration
          this.clipEnd = video.duration
        }
      })
    },
    
    closeEditor() {
      this.showEditor = false
      this.editingVideo = null
    },
    
    previewClip() {
      const video = this.$refs.editorVideo
      video.currentTime = this.clipStart
      video.play()
      setTimeout(() => {
        video.pause()
      }, (this.clipEnd - this.clipStart) * 1000)
    },
    
    splitClip() {
      this.showToast('分割功能演示')
    },
    
    trimVideo() {
      this.showToast('裁剪功能演示')
    },
    
    addTransition() {
      this.showToast('转场功能演示')
    },
    
    saveEditedVideo() {
      this.showSaveOptions = true
    },
    
    saveWithReplace() {
      this.showToast('视频已覆盖')
      this.showSaveOptions = false
      this.closeEditor()
    },
    
    saveAsNew() {
      this.showToast('新视频已生成')
      this.showSaveOptions = false
      this.closeEditor()
    },
    
    confirmDelete() {
      this.showDeleteConfirm = true
    },
    
    async executeDelete() {
      try {
        await axios.delete('/api/entertainment/videos', {
          data: { userId: this.userId, videoIds: this.selectedVideos }
        })
        this.showToast('删除成功')
        this.showDeleteConfirm = false
        this.loadVideos()
        this.cancelFilter()
      } catch (err) {
        this.showToast('删除失败', 'error')
      }
    },
    
    handleFileSelect(event) {
      const file = event.target.files[0]
      if (file && file.type.startsWith('video/')) {
        this.uploadForm.file = file
      } else {
        this.showToast('请选择视频文件', 'error')
      }
    },
    
    async uploadVideo() {
      const formData = new FormData()
      formData.append('video', this.uploadForm.file)
      formData.append('userId', this.userId)
      formData.append('title', this.uploadForm.title)
      
      try {
        await axios.post('/api/entertainment/videos', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        this.showToast('上传成功')
        this.showUpload = false
        this.uploadForm = { title: '', file: null }
        this.loadVideos()
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
.video-zone {
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
  --danger-color: #ef4444;
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
  --danger-color: #f87171;
}

.zone-header { margin-bottom: 20px; }

.back-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 15px;
}

.zone-description {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
}

.zone-description h3 {
  margin: 0 0 15px 0;
  color: var(--text-primary);
  font-size: 20px;
  padding-bottom: 10px;
  border-bottom: 2px solid var(--accent-color);
}

.zone-description p {
  margin: 8px 0;
  color: var(--text-secondary);
  font-size: 14px;
}

.action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 15px;
  background: var(--bg-primary);
  border-radius: 10px;
  border: 1px solid var(--border-color);
}

.selection-status {
  font-weight: 500;
  color: var(--text-primary);
}

.action-btns {
  display: flex;
  gap: 10px;
}

.filter-btn, .upload-btn, .action-btn {
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  border: none;
}

.filter-btn, .upload-btn {
  background: var(--accent-color);
  color: white;
}

.delete-btn {
  background: var(--danger-color);
  color: white;
}

.cancel-btn {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.videos-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.video-card {
  background: var(--bg-primary);
  border-radius: 12px;
  overflow: hidden;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.3s;
}

.video-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
}

.video-card.selectable {
  border: 2px dashed var(--border-color);
}

.video-card.selected {
  border-color: var(--danger-color);
}

.selection-indicator {
  position: absolute;
  top: 10px;
  left: 10px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid #9ca3af;
  background: var(--bg-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.video-card.selected .selection-indicator {
  background: var(--danger-color);
  border-color: var(--danger-color);
  color: white;
}

.video-thumbnail {
  position: relative;
  aspect-ratio: 16/9;
  overflow: hidden;
}

.video-thumbnail img, .preview-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.video-overlay {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  gap: 8px;
}

.format-badge, .duration-badge {
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border-radius: 4px;
  font-size: 11px;
}

.play-icon {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 60px;
  height: 60px;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 24px;
  opacity: 0;
  transition: opacity 0.3s;
}

.video-card:hover .play-icon {
  opacity: 1;
}

.video-info {
  padding: 12px;
}

.video-title {
  font-weight: 500;
  color: var(--text-primary);
}

/* 视频播放器 */
.video-player-fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #000;
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.player-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background: rgba(0, 0, 0, 0.8);
}

.player-header .back-btn {
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: none;
}

.player-title {
  flex: 1;
  text-align: center;
  color: white;
  font-size: 16px;
}

.player-options {
  position: relative;
}

.options-btn {
  width: 40px;
  height: 40px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: white;
  font-size: 20px;
  cursor: pointer;
  border-radius: 50%;
}

.options-menu {
  position: absolute;
  top: 100%;
  right: 0;
  background: var(--bg-primary);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  min-width: 120px;
  margin-top: 8px;
}

.options-menu button {
  width: 100%;
  padding: 12px 16px;
  background: transparent;
  border: none;
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
}

.options-menu button:hover {
  background: var(--bg-secondary);
}

.player-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.main-player {
  flex: 3;
  display: flex;
  flex-direction: column;
  background: #000;
}

.main-player video {
  flex: 1;
  width: 100%;
  object-fit: contain;
}

.custom-controls {
  display: flex;
  align-items: center;
  padding: 15px;
  background: rgba(0, 0, 0, 0.8);
  gap: 15px;
}

.custom-controls button {
  background: transparent;
  border: none;
  color: white;
  font-size: 20px;
  cursor: pointer;
}

.progress-bar {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
  outline: none;
}

.progress-bar::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  background: var(--accent-color);
  border-radius: 50%;
  cursor: pointer;
}

.time-display {
  color: white;
  font-size: 13px;
  font-family: monospace;
}

.speed-control {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  padding: 5px 10px;
  border-radius: 4px;
}

.playlist-sidebar {
  flex: 1;
  background: var(--bg-primary);
  border-left: 1px solid var(--border-color);
  padding: 20px;
  overflow-y: auto;
}

.playlist-sidebar h4 {
  margin: 0 0 15px 0;
  color: var(--text-primary);
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-color);
}

.playlist-items {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.playlist-item {
  display: flex;
  gap: 12px;
  padding: 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.3s;
}

.playlist-item:hover, .playlist-item.active {
  background: var(--bg-secondary);
}

.playlist-item img {
  width: 80px;
  height: 45px;
  object-fit: cover;
  border-radius: 4px;
}

.playlist-item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.playlist-title {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.playlist-duration {
  color: var(--text-secondary);
  font-size: 12px;
  margin-top: 4px;
}

/* 视频编辑器 */
.video-editor-fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--bg-primary);
  z-index: 1100;
  display: flex;
  flex-direction: column;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border-bottom: 1px solid var(--border-color);
}

.editor-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 20px;
}

.editor-preview {
  flex: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
}

.editor-preview video {
  max-width: 100%;
  max-height: 100%;
}

.editor-timeline {
  padding: 20px;
  background: var(--bg-secondary);
  border-radius: 8px;
  margin-top: 20px;
}

.timeline-track {
  height: 60px;
  background: var(--bg-primary);
  border-radius: 4px;
  position: relative;
  margin-bottom: 15px;
}

.clip-range {
  position: absolute;
  top: 0;
  height: 100%;
  background: var(--accent-color);
  opacity: 0.5;
}

.clip-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.clip-inputs {
  display: flex;
  gap: 15px;
  align-items: center;
}

.clip-inputs label {
  color: var(--text-secondary);
}

.clip-inputs input {
  width: 80px;
  padding: 8px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-primary);
}

.editor-tools {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.editor-tools button {
  padding: 12px 24px;
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

/* 通用弹窗 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1200;
}

.properties-modal, .save-options-modal, .delete-modal, .upload-modal {
  background: var(--bg-primary);
  border-radius: 16px;
  padding: 30px;
  max-width: 400px;
  width: 90%;
}

.property-item {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid var(--border-color);
}

.property-item label {
  color: var(--text-secondary);
}

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
}

.toast.success { background: #10b981; }
.toast.error { background: #ef4444; }

@media (max-width: 768px) {
  .player-body {
    flex-direction: column;
  }
  
  .playlist-sidebar {
    max-height: 200px;
    border-left: none;
    border-top: 1px solid var(--border-color);
  }
}
</style>