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
            <button @click="downloadVideo">下载视频</button>
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
            :style="videoFilterStyle"
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
        <div class="property-item">
          <label>文件大小：</label>
          <span>{{ formatFileSize(currentVideoProperties.file_size) }}</span>
        </div>
        <div class="property-item">
          <label>上传时间：</label>
          <span>{{ formatDate(currentVideoProperties.created_at) }}</span>
        </div>
        <button @click="showProperties = false" class="btn-close">关闭</button>
      </div>
    </div>

    <!-- 视频剪辑器 - 完全重构 -->
    <div v-if="showEditor" class="video-editor-fullscreen">
      <div class="editor-header">
        <button class="back-btn" @click="closeEditor">← 返回</button>
        <h3>视频剪辑工作室</h3>
        <button class="save-btn" :disabled="processingVideo" @click="showSaveOptions = true">
          {{ processingVideo ? '处理中...' : '导出视频' }}
        </button>
      </div>
      
      <div class="editor-body">
        <!-- 左侧：视频预览区 -->
        <div class="editor-left">
          <div class="editor-preview">
            <video 
              ref="editorVideo" 
              :src="getVideoUrl(editingVideo)" 
              controls
              @loadedmetadata="onVideoLoaded"
              :style="editorFilterStyle"
            ></video>
            
            <!-- 水印预览层 -->
            <div v-if="watermark.enabled" class="watermark-preview" :style="watermarkStyle">
              {{ watermark.text }}
            </div>
            
            <!-- 打码预览层 -->
            <div v-if="mosaic.enabled" class="mosaic-preview" :style="mosaicStyle"></div>
          </div>
          
          <!-- 时间轴 -->
          <div class="editor-timeline">
            <div class="timeline-header">
              <span>时间轴</span>
              <span class="timeline-time">{{ formatTime(clipStart) }} - {{ formatTime(clipEnd) }} / {{ formatTime(videoDuration) }}</span>
            </div>
            <div class="timeline-track">
              <div class="clip-range" :style="clipRangeStyle"></div>
              <div class="timeline-markers">
                <div class="marker start" :style="{ left: (clipStart / videoDuration * 100) + '%' }"></div>
                <div class="marker end" :style="{ left: (clipEnd / videoDuration * 100) + '%' }"></div>
              </div>
            </div>
            <div class="clip-controls">
              <div class="clip-inputs">
                <div class="time-input-group">
                  <label>开始</label>
                  <input type="number" v-model.number="clipStart" step="0.1" min="0" :max="videoDuration" />
                </div>
                <div class="time-input-group">
                  <label>结束</label>
                  <input type="number" v-model.number="clipEnd" step="0.1" :min="clipStart" :max="videoDuration" />
                </div>
              </div>
              <button @click="previewClip" class="btn-preview">▶ 预览剪辑</button>
            </div>
          </div>
        </div>
        
        <!-- 右侧：工具面板 -->
        <div class="editor-tools-panel">
          <!-- 基础剪辑 -->
          <div class="tool-section">
            <h4>✂️ 基础剪辑</h4>
            <div class="tool-buttons">
              <button @click="splitClip" class="tool-btn">
                <span class="icon">✂️</span>
                <span>分割</span>
              </button>
              <button @click="trimVideo" class="tool-btn">
                <span class="icon">📐</span>
                <span>裁剪</span>
              </button>
            </div>
          </div>
          
          <!-- 画面调节 -->
          <div class="tool-section">
            <h4>🎨 画面调节</h4>
            
            <div class="adjust-item">
              <label>亮度</label>
              <input type="range" v-model.number="videoAdjustments.brightness" min="0" max="200" />
              <span>{{ videoAdjustments.brightness }}%</span>
            </div>
            
            <div class="adjust-item">
              <label>对比度</label>
              <input type="range" v-model.number="videoAdjustments.contrast" min="0" max="200" />
              <span>{{ videoAdjustments.contrast }}%</span>
            </div>
            
            <div class="adjust-item">
              <label>饱和度</label>
              <input type="range" v-model.number="videoAdjustments.saturation" min="0" max="200" />
              <span>{{ videoAdjustments.saturation }}%</span>
            </div>
            
            <div class="adjust-item">
              <label>模糊</label>
              <input type="range" v-model.number="videoAdjustments.blur" min="0" max="20" step="0.5" />
              <span>{{ videoAdjustments.blur }}px</span>
            </div>
            
            <div class="adjust-item">
              <label>色相</label>
              <input type="range" v-model.number="videoAdjustments.hue" min="0" max="360" />
              <span>{{ videoAdjustments.hue }}°</span>
            </div>
            
            <button @click="resetAdjustments" class="btn-reset">重置画面</button>
          </div>
          
          <!-- 滤镜效果 -->
          <div class="tool-section">
            <h4>🎬 滤镜效果</h4>
            <div class="filter-grid">
              <button 
                v-for="filter in videoFilters" 
                :key="filter.name"
                :class="['filter-btn', { active: currentFilter === filter.name }]"
                @click="applyFilter(filter.name)"
              >
                <div class="filter-preview" :style="{ filter: filter.css }"></div>
                <span>{{ filter.label }}</span>
              </button>
            </div>
          </div>
          
          <!-- 水印功能 -->
          <div class="tool-section">
            <h4>💧 水印</h4>
            <div class="watermark-controls">
              <label class="checkbox-label">
                <input type="checkbox" v-model="watermark.enabled" />
                启用水印
              </label>
              <div v-if="watermark.enabled" class="watermark-settings">
                <input type="text" v-model="watermark.text" placeholder="输入水印文字" />
                <div class="watermark-position">
                  <label>位置</label>
                  <div class="position-grid">
                    <button 
                      v-for="pos in ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right']" 
                      :key="pos"
                      :class="['pos-btn', { active: watermark.position === pos }]"
                      @click="watermark.position = pos"
                    >
                      {{ posLabels[pos] }}
                    </button>
                  </div>
                </div>
                <div class="adjust-item">
                  <label>大小</label>
                  <input type="range" v-model.number="watermark.size" min="12" max="72" />
                  <span>{{ watermark.size }}px</span>
                </div>
                <div class="adjust-item">
                  <label>透明度</label>
                  <input type="range" v-model.number="watermark.opacity" min="0" max="100" />
                  <span>{{ watermark.opacity }}%</span>
                </div>
                <div class="color-picker">
                  <label>颜色</label>
                  <input type="color" v-model="watermark.color" />
                </div>
              </div>
            </div>
          </div>
          
          <!-- 打码功能 -->
          <div class="tool-section">
            <h4>🟪 打码/马赛克</h4>
            <div class="mosaic-controls">
              <label class="checkbox-label">
                <input type="checkbox" v-model="mosaic.enabled" />
                启用打码
              </label>
              <div v-if="mosaic.enabled" class="mosaic-settings">
                <div class="adjust-item">
                  <label>X 位置</label>
                  <input type="range" v-model.number="mosaic.x" min="0" max="100" />
                  <span>{{ mosaic.x }}%</span>
                </div>
                <div class="adjust-item">
                  <label>Y 位置</label>
                  <input type="range" v-model.number="mosaic.y" min="0" max="100" />
                  <span>{{ mosaic.y }}%</span>
                </div>
                <div class="adjust-item">
                  <label>宽度</label>
                  <input type="range" v-model.number="mosaic.width" min="5" max="50" />
                  <span>{{ mosaic.width }}%</span>
                </div>
                <div class="adjust-item">
                  <label>高度</label>
                  <input type="range" v-model.number="mosaic.height" min="5" max="50" />
                  <span>{{ mosaic.height }}%</span>
                </div>
                <div class="adjust-item">
                  <label>模糊度</label>
                  <input type="range" v-model.number="mosaic.blur" min="1" max="20" />
                  <span>{{ mosaic.blur }}px</span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 旋转与翻转 -->
          <div class="tool-section">
            <h4>🔄 旋转与翻转</h4>
            <div class="transform-buttons">
              <button @click="rotateVideo(-90)" class="tool-btn">
                <span class="icon">↺</span>
                <span>左旋90°</span>
              </button>
              <button @click="rotateVideo(90)" class="tool-btn">
                <span class="icon">↻</span>
                <span>右旋90°</span>
              </button>
              <button @click="flipVideo('horizontal')" class="tool-btn">
                <span class="icon">↔️</span>
                <span>水平翻转</span>
              </button>
              <button @click="flipVideo('vertical')" class="tool-btn">
                <span class="icon">↕️</span>
                <span>垂直翻转</span>
              </button>
            </div>
          </div>
          
          <!-- 倍速与音量 -->
          <div class="tool-section">
            <h4>🔊 速度与音量</h4>
            <div class="adjust-item">
              <label>播放速度</label>
              <input type="range" v-model.number="videoAdjustments.speed" min="0.25" max="4" step="0.25" />
              <span>{{ videoAdjustments.speed }}x</span>
            </div>
            <div class="adjust-item">
              <label>音量</label>
              <input type="range" v-model.number="videoAdjustments.volume" min="0" max="200" />
              <span>{{ videoAdjustments.volume }}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 保存选项弹窗 -->
    <div v-if="showSaveOptions" class="modal-overlay" @click.self="showSaveOptions = false">
      <div class="save-options-modal">
        <h3>导出视频</h3>
        <div class="export-options">
          <div class="option-group">
            <label>画质</label>
            <select v-model="exportOptions.quality">
              <option value="high">高清 (1080p)</option>
              <option value="medium">标清 (720p)</option>
              <option value="low">流畅 (480p)</option>
              <option value="original">原画质</option>
            </select>
          </div>
          <div class="option-group">
            <label>格式</label>
            <select v-model="exportOptions.format">
              <option value="mp4">MP4</option>
              <option value="webm">WebM</option>
            </select>
          </div>
        </div>
        <div class="save-mode-buttons">
          <button class="replace-btn" @click="saveWithReplace">
            <span>💾</span>
            <div><strong>覆盖原视频</strong><small>替换原始文件</small></div>
          </button>
          <button class="new-btn" @click="saveAsNew">
            <span>📝</span>
            <div><strong>保存为新视频</strong><small>创建副本文件</small></div>
          </button>
        </div>
        <button @click="showSaveOptions = false" class="btn-cancel-export">取消</button>
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

    <!-- 上传弹窗 - 完全重构样式 -->
    <div v-if="showUpload" class="modal-overlay" @click.self="showUpload = false">
      <div class="upload-modal upload-modal-redesign">
        <div class="upload-modal-header">
          <h3>📤 上传视频</h3>
          <button class="close-icon" @click="showUpload = false">×</button>
        </div>
        
        <div class="upload-modal-body">
          <!-- 视频标题 -->
          <div class="form-row">
            <label class="form-label">
              <span class="label-icon">🏷️</span>
              视频标题
              <span class="optional">（可选）</span>
            </label>
            <div class="input-wrapper">
              <input 
                v-model="uploadForm.title" 
                placeholder="默认为文件名"
                class="form-input"
              />
              <span class="input-hint">不填写将使用原始文件名</span>
            </div>
          </div>
          
          <!-- 文件选择 -->
          <div class="form-row">
            <label class="form-label">
              <span class="label-icon">📁</span>
              选择文件
              <span class="required">*</span>
            </label>
            <div class="file-upload-area" @click="triggerFileInput" @drop.prevent="handleFileDrop" @dragover.prevent>
              <input 
                type="file" 
                ref="fileInput"
                accept="video//*" 
                @change="handleFileSelect"
                class="hidden-input"
              />
              <div v-if="!uploadForm.file" class="upload-placeholder">
                <div class="upload-icon">📹</div>
                <p class="upload-text">点击或拖拽视频文件到此处</p>
                <p class="upload-subtext">支持 MP4, AVI, MOV, MKV 等格式</p>
              </div>
              <div v-else class="file-selected">
                <div class="file-icon">✅</div>
                <div class="file-info">
                  <p class="file-name">{{ uploadForm.file.name }}</p>
                  <p class="file-size">{{ formatFileSize(uploadForm.file.size) }}</p>
                </div>
                <button class="remove-file" @click.stop="removeSelectedFile">×</button>
              </div>
            </div>
          </div>
          
          <!-- 上传进度 -->
          <div v-if="uploadProgress > 0 && uploadProgress < 100" class="upload-progress">
            <div class="progress-bar-container">
              <div class="progress-bar" :style="{ width: uploadProgress + '%' }"></div>
            </div>
            <span class="progress-text">{{ uploadProgress }}%</span>
          </div>
        </div>
        
        <div class="upload-modal-footer">
          <button class="btn-secondary" @click="showUpload = false">取消</button>
          <button 
            class="btn-primary upload-submit-btn" 
            :disabled="!uploadForm.file || uploading"
            @click="uploadVideo"
          >
            <span v-if="uploading" class="loading-spinner"></span>
            <span>{{ uploading ? '上传中...' : '开始上传' }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Toast -->
    <div v-if="toast.show" class="toast" :class="toast.type">{{ toast.message }}</div>
  </div>
</template>

<script>
import axios from '@/services/http'

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
      processingVideo: false,
      
      // 视频调节参数
      videoAdjustments: {
        brightness: 100,
        contrast: 100,
        saturation: 100,
        blur: 0,
        hue: 0,
        speed: 1,
        volume: 100,
        rotate: 0,
        flipH: false,
        flipV: false
      },
      
      // 滤镜
      currentFilter: 'none',
      videoFilters: [
        { name: 'none', label: '原图', css: 'none' },
        { name: 'grayscale', label: '黑白', css: 'grayscale(100%)' },
        { name: 'sepia', label: '复古', css: 'sepia(100%)' },
        { name: 'vintage', label: '怀旧', css: 'sepia(50%) contrast(120%)' },
        { name: 'cool', label: '冷色', css: 'hue-rotate(180deg) saturate(150%)' },
        { name: 'warm', label: '暖色', css: 'hue-rotate(-30deg) saturate(120%)' },
        { name: 'dramatic', label: '戏剧', css: 'contrast(150%) saturate(120%)' },
        { name: 'cinema', label: '电影', css: 'contrast(120%) brightness(90%) saturate(110%)' }
      ],
      
      // 水印设置
      watermark: {
        enabled: false,
        text: '',
        position: 'bottom-right',
        size: 24,
        opacity: 50,
        color: '#ffffff'
      },
      
      // 打码设置
      mosaic: {
        enabled: false,
        x: 50,
        y: 50,
        width: 20,
        height: 20,
        blur: 10
      },
      
      // 导出选项
      exportOptions: {
        quality: 'original',
        format: 'mp4'
      },
      
      // 上传
      showUpload: false,
      uploadForm: { title: '', file: null },
      uploading: false,
      uploadProgress: 0,

      // 删除确认
      showDeleteConfirm: false,
      
      toast: { show: false, message: '', type: 'success' },
      themeHandler: null
    }
  },
  computed: {
    selectionText() {
      if (!this.isFiltering) return ''
      return this.selectedVideos.length === 0 ? '未选择视频' : `已选择 ${this.selectedVideos.length} 个视频`
    },
    clipRangeStyle() {
      if (!this.videoDuration) return {}
      const start = (this.clipStart / this.videoDuration) * 100
      const width = ((this.clipEnd - this.clipStart) / this.videoDuration) * 100
      return {
        left: start + '%',
        width: width + '%'
      }
    },
    // 播放器滤镜样式
    videoFilterStyle() {
      return {
        filter: this.getCurrentFilterCss()
      }
    },
    // 编辑器滤镜样式
    editorFilterStyle() {
      let filter = this.getCurrentFilterCss()
      return { filter, transform: this.getTransformCss() }
    },
    // 水印样式
    watermarkStyle() {
      const positions = {
        'top-left': { top: '10px', left: '10px' },
        'top-right': { top: '10px', right: '10px' },
        'center': { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
        'bottom-left': { bottom: '10px', left: '10px' },
        'bottom-right': { bottom: '10px', right: '10px' }
      }
      return {
        ...positions[this.watermark.position],
        fontSize: this.watermark.size + 'px',
        opacity: this.watermark.opacity / 100,
        color: this.watermark.color
      }
    },
    // 打码样式
    mosaicStyle() {
      return {
        left: this.mosaic.x + '%',
        top: this.mosaic.y + '%',
        width: this.mosaic.width + '%',
        height: this.mosaic.height + '%',
        backdropFilter: `blur(${this.mosaic.blur}px)`
      }
    },
    // 位置标签
    posLabels() {
      return {
        'top-left': '左上',
        'top-right': '右上',
        'center': '居中',
        'bottom-left': '左下',
        'bottom-right': '右下'
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
  beforeUnmount() {
    if (this.themeHandler) window.removeEventListener('theme-changed', this.themeHandler)
  },
  methods: {
    setupThemeListener() {
      this.themeHandler = (e) => {
        this.themeClass = e.detail.theme === 'dark' ? 'dark-mode' : 'light-mode'
      }
      window.addEventListener('theme-changed', this.themeHandler)
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
      return `/api/entertainment/video-file/${video.id}`
    },
    
    getVideoCover(video) {
      // 使用默认封面或视频首帧
      if (video.cover_path) {
        return video.cover_path
      }
      // 返回一个默认的视频封面占位图（SVG）
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
    
    formatFileSize(bytes) {
      if (!bytes) return '未知'
      const units = ['B', 'KB', 'MB', 'GB']
      let size = bytes
      let unitIndex = 0
      while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024
        unitIndex++
      }
      return size.toFixed(2) + ' ' + units[unitIndex]
    },
    
    formatDate(dateStr) {
      if (!dateStr) return '未知'
      const date = new Date(dateStr)
      return date.toLocaleString('zh-CN')
    },
    
    showVideoProperties() {
      this.currentVideoProperties = this.playingVideo
      this.showProperties = true
      this.showOptions = false
    },
    
    downloadVideo() {
      if (this.playingVideo) {
        const link = document.createElement('a')
        link.href = this.getVideoUrl(this.playingVideo)
        link.download = this.playingVideo.title
        link.click()
        this.showToast('开始下载')
      }
      this.showOptions = false
    },
    
    // ========== 视频编辑器方法 ==========
    openVideoEditor() {
      this.editingVideo = this.playingVideo
      this.showEditor = true
      this.showOptions = false
      this.resetAllEditorSettings()
    },
    
    closeEditor() {
      this.showEditor = false
      this.editingVideo = null
      this.resetAllEditorSettings()
    },
    
    resetAllEditorSettings() {
      this.clipStart = 0
      this.clipEnd = 0
      this.videoDuration = 0
      this.videoAdjustments = {
        brightness: 100,
        contrast: 100,
        saturation: 100,
        blur: 0,
        hue: 0,
        speed: 1,
        volume: 100,
        rotate: 0,
        flipH: false,
        flipV: false
      }
      this.currentFilter = 'none'
      this.watermark = {
        enabled: false,
        text: '',
        position: 'bottom-right',
        size: 24,
        opacity: 50,
        color: '#ffffff'
      }
      this.mosaic = {
        enabled: false,
        x: 50,
        y: 50,
        width: 20,
        height: 20,
        blur: 10
      }
    },
    
    onVideoLoaded() {
      const video = this.$refs.editorVideo
      this.videoDuration = video.duration
      this.clipEnd = video.duration
    },
    
    previewClip() {
      const video = this.$refs.editorVideo
      video.currentTime = this.clipStart
      video.play()
      const duration = (this.clipEnd - this.clipStart) * 1000
      setTimeout(() => {
        if (video.currentTime >= this.clipEnd) {
          video.pause()
        }
      }, duration)
    },
    
    splitClip() {
      this.showToast('分割功能：在当前播放位置将视频分成两段（演示功能）')
    },
    
    trimVideo() {
      this.showToast(`已设置裁剪范围：${this.formatTime(this.clipStart)} - ${this.formatTime(this.clipEnd)}`)
    },
    
    resetAdjustments() {
      this.videoAdjustments.brightness = 100
      this.videoAdjustments.contrast = 100
      this.videoAdjustments.saturation = 100
      this.videoAdjustments.blur = 0
      this.videoAdjustments.hue = 0
      this.showToast('画面参数已重置')
    },
    
    getCurrentFilterCss() {
      const adj = this.videoAdjustments
      let filter = `brightness(${adj.brightness}%) contrast(${adj.contrast}%) saturate(${adj.saturation}%)`
      if (adj.blur > 0) filter += ` blur(${adj.blur}px)`
      if (adj.hue > 0) filter += ` hue-rotate(${adj.hue}deg)`
      
      const selectedFilter = this.videoFilters.find(f => f.name === this.currentFilter)
      if (selectedFilter && selectedFilter.name !== 'none') {
        filter += ' ' + selectedFilter.css
      }
      return filter
    },
    
    getTransformCss() {
      let transform = ''
      if (this.videoAdjustments.rotate) transform += `rotate(${this.videoAdjustments.rotate}deg) `
      if (this.videoAdjustments.flipH) transform += 'scaleX(-1) '
      if (this.videoAdjustments.flipV) transform += 'scaleY(-1) '
      return transform || 'none'
    },
    
    applyFilter(filterName) {
      this.currentFilter = filterName
      this.showToast(`已应用滤镜：${this.videoFilters.find(f => f.name === filterName)?.label || filterName}`)
    },
    
    rotateVideo(deg) {
      this.videoAdjustments.rotate = (this.videoAdjustments.rotate + deg) % 360
      this.showToast(`旋转 ${this.videoAdjustments.rotate}°`)
    },
    
    flipVideo(direction) {
      if (direction === 'horizontal') {
        this.videoAdjustments.flipH = !this.videoAdjustments.flipH
        this.showToast(this.videoAdjustments.flipH ? '已水平翻转' : '取消水平翻转')
      } else {
        this.videoAdjustments.flipV = !this.videoAdjustments.flipV
        this.showToast(this.videoAdjustments.flipV ? '已垂直翻转' : '取消垂直翻转')
      }
    },
    
    saveWithReplace() {
      this.processingVideo = true
      setTimeout(() => {
        this.processingVideo = false
        this.showToast('视频已覆盖（演示：实际需后端处理）')
        this.showSaveOptions = false
        this.closeEditor()
      }, 2000)
    },
    
    saveAsNew() {
      this.processingVideo = true
      setTimeout(() => {
        this.processingVideo = false
        this.showToast('新视频已生成（演示：实际需后端处理）')
        this.showSaveOptions = false
        this.closeEditor()
      }, 2000)
    },
    
    // ========== 上传相关方法 ==========
    triggerFileInput() {
      this.$refs.fileInput.click()
    },
    
    handleFileSelect(event) {
      const file = event.target.files[0]
      this.processSelectedFile(file)
    },
    
    handleFileDrop(event) {
      const file = event.dataTransfer.files[0]
      if (file && file.type.startsWith('video/')) {
        this.processSelectedFile(file)
      } else {
        this.showToast('请拖入视频文件', 'error')
      }
    },
    
    processSelectedFile(file) {
      if (!file) return
      if (!file.type.startsWith('video/')) {
        this.showToast('请选择视频文件', 'error')
        return
      }
      this.uploadForm.file = file
    },
    
    removeSelectedFile() {
      this.uploadForm.file = null
      this.uploadProgress = 0
      if (this.$refs.fileInput) {
        this.$refs.fileInput.value = ''
      }
    },
    
    async uploadVideo() {
      if (!this.uploadForm.file) return
      
      this.uploading = true
      this.uploadProgress = 0
      
      const formData = new FormData()
      formData.append('video', this.uploadForm.file)
      formData.append('userId', this.userId)
      formData.append('title', this.uploadForm.title)
      
      try {
        await axios.post('/api/entertainment/videos', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              this.uploadProgress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
            }
          }
        })
        this.showToast('上传成功')
        this.showUpload = false
        this.uploadForm = { title: '', file: null }
        this.uploadProgress = 0
        this.loadVideos()
      } catch (err) {
        this.showToast(err.response?.data?.error || '上传失败', 'error')
      } finally {
        this.uploading = false
      }
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

.editor-header h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: 18px;
}

.save-btn {
  padding: 10px 24px;
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.3s;
}

.save-btn:hover:not(:disabled) {
  background: var(--accent-hover);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.editor-body {
  flex: 1;
  display: flex;
  flex-direction: row;  /* 从 column 改为 row */
  overflow: hidden;
  height: calc(100vh - 70px);  /* 添加固定高度 */
}

.editor-left {
  flex: 2;
  display: flex;
  flex-direction: column;
  padding: 20px;
  gap: 20px;
  overflow: hidden;  /* 添加 */
  min-width: 0;      /* 添加，防止 flex 子项溢出 */
}

.editor-preview {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  border-radius: 12px;
  overflow: hidden;
  position: relative;
}

.editor-preview video {
  max-width: 100%;
  max-height: 100%;
  transition: filter 0.3s;
}

.watermark-preview {
  position: absolute;
  pointer-events: none;
  font-weight: bold;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
  z-index: 10;
}

.mosaic-preview {
  position: absolute;
  background: rgba(0,0,0,0.1);
  z-index: 10;
}

.editor-timeline {
  padding: 20px;
  background: var(--bg-secondary);
  border-radius: 12px;
  border: 1px solid var(--border-color);
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
  color: var(--text-primary);
  font-weight: 500;
}

.timeline-time {
  color: var(--text-secondary);
  font-size: 14px;
}

.timeline-track {
  height: 50px;
  background: var(--bg-primary);
  border-radius: 8px;
  position: relative;
  margin-bottom: 15px;
  overflow: hidden;
}

.clip-range {
  position: absolute;
  top: 0;
  height: 100%;
  background: var(--accent-color);
  opacity: 0.4;
}

.clip-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
}

.clip-inputs {
  display: flex;
  gap: 20px;
  flex: 1;
}

.time-input-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.time-input-group label {
  font-size: 12px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.time-input-group input {
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 15px;
  width: 100%;
}

.btn-preview {
  padding: 10px 20px;
  background: var(--success-color);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  white-space: nowrap;
}

.btn-preview:hover {
  filter: brightness(1.1);
}

.editor-tools-panel {
  flex: 1;
  background: var(--bg-secondary);
  border-left: 1px solid var(--border-color);
  padding: 20px;
  overflow-y: auto;
  max-height: calc(100vh - 70px);  /* 添加最大高度 */
  min-width: 320px;                 /* 添加最小宽度 */
}

.tool-section {
  margin-bottom: 25px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border-color);
}

.tool-section:last-child {
  border-bottom: none;
}

.tool-section h4 {
  margin: 0 0 15px 0;
  color: var(--text-primary);
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.tool-buttons, .transform-buttons {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.tool-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 15px 10px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s;
  color: var(--text-primary);
}

.tool-btn:hover {
  border-color: var(--accent-color);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.tool-btn .icon {
  font-size: 24px;
}

.tool-btn span:last-child {
  font-size: 12px;
}

.adjust-item {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.adjust-item label {
  width: 60px;
  font-size: 13px;
  color: var(--text-secondary);
}

.adjust-item input[type="range"] {
  flex: 1;
  height: 6px;
  -webkit-appearance: none;
  background: var(--bg-tertiary);
  border-radius: 3px;
  outline: none;
}

.adjust-item input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  background: var(--accent-color);
  border-radius: 50%;
  cursor: pointer;
}

.adjust-item span {
  width: 50px;
  text-align: right;
  font-size: 13px;
  color: var(--text-primary);
  font-family: monospace;
}

.btn-reset {
  width: 100%;
  padding: 10px;
  background: transparent;
  border: 1px dashed var(--border-color);
  color: var(--text-secondary);
  border-radius: 8px;
  cursor: pointer;
  margin-top: 10px;
  transition: all 0.3s;
}

.btn-reset:hover {
  border-color: var(--accent-color);
  color: var(--accent-color);
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.filter-grid .filter-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 10px 5px;
  background: var(--bg-primary);
  border: 2px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s;
}

.filter-grid .filter-btn:hover {
  border-color: var(--accent-color);
}

.filter-grid .filter-btn.active {
  border-color: var(--accent-color);
  background: rgba(59, 130, 246, 0.1);
}

.filter-preview {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 6px;
}

.filter-grid .filter-btn span {
  font-size: 11px;
  color: var(--text-secondary);
}

.watermark-controls, .mosaic-controls {
  background: var(--bg-primary);
  border-radius: 10px;
  padding: 15px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  color: var(--text-primary);
  margin-bottom: 15px;
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: var(--accent-color);
}

.watermark-settings, .mosaic-settings {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.watermark-settings input[type="text"] {
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 14px;
}

.watermark-position label {
  display: block;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.position-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.pos-btn {
  padding: 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  color: var(--text-secondary);
  transition: all 0.3s;
}

.pos-btn:hover, .pos-btn.active {
  border-color: var(--accent-color);
  color: var(--accent-color);
  background: rgba(59, 130, 246, 0.1);
}

.color-picker {
  display: flex;
  align-items: center;
  gap: 12px;
}

.color-picker label {
  font-size: 13px;
  color: var(--text-secondary);
}

.color-picker input[type="color"] {
  width: 50px;
  height: 35px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
}

/* ========== 保存选项弹窗 ========== */
.save-options-modal {
  max-width: 450px;
}

.export-options {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15px;
  margin-bottom: 20px;
}

.option-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.option-group label {
  font-size: 13px;
  color: var(--text-secondary);
}

.option-group select {
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 14px;
}

.save-mode-buttons {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15px;
  margin-bottom: 15px;
}

.save-mode-buttons button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px;
  background: var(--bg-secondary);
  border: 2px solid var(--border-color);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s;
  color: var(--text-primary);
}

.save-mode-buttons button:hover {
  border-color: var(--accent-color);
  transform: translateY(-2px);
}

.save-mode-buttons button span:first-child {
  font-size: 32px;
}

.save-mode-buttons button div {
  text-align: center;
}

.save-mode-buttons button strong {
  display: block;
  margin-bottom: 4px;
}

.save-mode-buttons button small {
  color: var(--text-secondary);
  font-size: 12px;
}

.replace-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: var(--danger-color) !important;
}

.new-btn:hover {
  background: rgba(16, 185, 129, 0.1);
  border-color: var(--success-color) !important;
}

.btn-cancel-export {
  width: 100%;
  padding: 12px;
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  border-radius: 8px;
  cursor: pointer;
}

.btn-cancel-export:hover {
  background: var(--bg-secondary);
}

/* ========== 删除确认弹窗 ========== */
.delete-modal p {
  color: var(--text-secondary);
  margin-bottom: 20px;
}

.delete-modal .actions {
  display: flex;
  gap: 12px;
}

.delete-modal button {
  flex: 1;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 15px;
  border: none;
  transition: all 0.3s;
}

.delete-modal button:first-child {
  background: var(--danger-color);
  color: white;
}

.delete-modal button:first-child:hover {
  background: var(--danger-hover);
}

.delete-modal button:last-child {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

/* ========== 模态框基础样式 ========== */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.properties-modal,
.save-options-modal,
.delete-modal {
  background: var(--bg-primary);
  border-radius: 16px;
  padding: 24px;
  max-width: 400px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}

.properties-modal h3,
.save-options-modal h3,
.delete-modal h3 {
  margin: 0 0 20px 0;
  color: var(--text-primary);
  font-size: 18px;
}

.property-item {
  display: flex;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid var(--border-color);
}

.property-item:last-child {
  border-bottom: none;
}

.property-item label {
  color: var(--text-secondary);
  font-size: 14px;
}

.property-item span {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 500;
}

.btn-close {
  width: 100%;
  padding: 12px;
  margin-top: 20px;
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 500;
  transition: all 0.3s;
}

.btn-close:hover {
  filter: brightness(1.1);
}

/* ========== 上传弹窗 - 重构版 ========== */
.upload-modal-redesign {
  max-width: 520px;
  width: 90%;
  background: var(--bg-primary);
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

.upload-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 25px;
  background: linear-gradient(135deg, var(--accent-color) 0%, var(--accent-hover) 100%);
  color: white;
}

.upload-modal-header h3 {
  margin: 0;
  font-size: 20px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.close-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.15);
  border: none;
  border-radius: 50%;
  color: white;
  font-size: 20px;
  cursor: pointer;
  transition: all 0.3s;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

/* 白天模式：关闭按钮改为黑色文字 */
.light-mode .upload-modal-header .close-icon {
  background: rgba(0, 0, 0, 0.1);
  color: #1f2937;
}

.light-mode .upload-modal-header .close-icon:hover {
  background: rgba(0, 0, 0, 0.2);
}

.close-icon:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: rotate(90deg);
}

.upload-modal-body {
  padding: 25px;
}

.form-row {
  margin-bottom: 25px;
}

.form-row:last-child {
  margin-bottom: 0;
}

.form-label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-weight: 600;
  color: var(--text-primary);
  font-size: 15px;
}

.label-icon {
  font-size: 18px;
}

.optional {
  color: var(--text-tertiary);
  font-weight: normal;
  font-size: 13px;
}

.required {
  color: var(--danger-color);
}

.input-wrapper {
  position: relative;
}

.form-input {
  width: 100%;
  padding: 14px 16px;
  border: 2px solid var(--border-color);
  border-radius: 12px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 15px;
  transition: all 0.3s;
}

.form-input:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
}

.input-hint {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.file-upload-area {
  border: 2px dashed var(--border-color);
  border-radius: 16px;
  padding: 40px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
  background: var(--bg-secondary);
}

.file-upload-area:hover {
  border-color: var(--accent-color);
  background: rgba(59, 130, 246, 0.05);
}

.hidden-input {
  display: none;
}

.upload-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.upload-icon {
  font-size: 56px;
  opacity: 0.8;
}

.upload-text {
  margin: 0;
  font-size: 16px;
  color: var(--text-primary);
  font-weight: 500;
}

.upload-subtext {
  margin: 0;
  font-size: 13px;
  color: var(--text-tertiary);
}

.file-selected {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 20px;
  background: rgba(16, 185, 129, 0.1);
  border: 2px solid var(--success-color);
  border-radius: 12px;
}

.file-icon {
  font-size: 32px;
}

.file-info {
  flex: 1;
  text-align: left;
}

.file-name {
  margin: 0 0 4px 0;
  font-weight: 600;
  color: var(--text-primary);
  word-break: break-all;
}

.file-size {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.remove-file {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(239, 68, 68, 0.1);
  border: none;
  border-radius: 50%;
  color: var(--danger-color);
  font-size: 18px;
  cursor: pointer;
  transition: all 0.3s;
}

.remove-file:hover {
  background: var(--danger-color);
  color: white;
}

.upload-progress {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-top: 20px;
  padding: 15px;
  background: var(--bg-secondary);
  border-radius: 10px;
}

.progress-bar-container {
  flex: 1;
  height: 8px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--accent-color) 0%, var(--accent-hover) 100%);
  border-radius: 4px;
  transition: width 0.3s;
}

.progress-text {
  font-weight: 600;
  color: var(--accent-color);
  min-width: 45px;
  text-align: right;
}

.upload-modal-footer {
  display: flex;
  gap: 12px;
  padding: 20px 25px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
}

.upload-modal-footer button {
  flex: 1;
  padding: 14px 24px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  border: none;
}

.btn-secondary {
  background: var(--bg-primary);
  color: var(--text-secondary);
  border: 1px solid var(--border-color) !important;
}

.btn-secondary:hover {
  background: var(--border-color);
  color: var(--text-primary);
}

.upload-submit-btn {
  background: linear-gradient(135deg, var(--accent-color) 0%, var(--accent-hover) 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

/* 白天模式：开始上传按钮改为浅色背景和深色文字 */
.light-mode .upload-submit-btn {
  background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
  color: #0369a1;
  border: 1px solid #7dd3fc;
}

.upload-submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(59, 130, 246, 0.3);
}

.upload-submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 响应式 */
@media (max-width: 1024px) {
  .editor-body {
    flex-direction: column;
    overflow: auto;  /* 改为 auto */
  }
  
  .editor-left {
    min-height: 50vh;  /* 添加最小高度 */
  }
  
  .editor-tools-panel {
    border-left: none;
    border-top: 1px solid var(--border-color);
    max-height: none;     /* 移除限制 */
    height: auto;
    min-width: auto;
  }
}

@media (max-width: 768px) {
  .player-body {
    flex-direction: column;
  }
  
  .playlist-sidebar {
    max-height: 200px;
    border-left: none;
    border-top: 1px solid var(--border-color);
  }
  
  .filter-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .save-mode-buttons {
    grid-template-columns: 1fr;
  }
  
  .videos-grid {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  }
}
</style>
