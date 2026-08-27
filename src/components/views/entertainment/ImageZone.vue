<template>
  <div :class="themeClass" class="image-zone">
    <!-- 头部 -->
    <div class="zone-header">
      <button class="back-btn" type="button" @click="goBack">
        <AppIcon name="arrow-left" :size="17" /> 返回媒体库
      </button>
    </div>

    <!-- 描述区域 -->
    <div class="zone-description">
      <p class="eyebrow">Media library</p>
      <h2>图片</h2>
      <p>查看、下载、整理和预览你的私有图片资源。Canvas 编辑器保留为本地预览工具。</p>
    </div>

    <!-- 操作栏 -->
    <div class="action-bar">
      <span class="selection-status">{{ selectionText }}</span>
      <div class="action-btns">
        <template v-if="!isFiltering">
          <button class="filter-btn" type="button" @click="startFilter">选择多项</button>
          <button class="upload-btn" type="button" @click="showUpload = true"><AppIcon name="upload" :size="16" />上传图片</button>
        </template>
        <template v-else>
          <button class="action-btn categorize-btn" type="button" :disabled="selectedImages.length === 0" @click="showCategorize = true">
            批量归类
          </button>
          <button class="action-btn delete-btn" type="button" :disabled="selectedImages.length === 0" @click="confirmDelete">
            批量删除
          </button>
          <button class="action-btn cancel-btn" type="button" @click="cancelFilter">取消</button>
        </template>
      </div>
    </div>

    <!-- 图片展示区域 -->
    <div class="images-grid">
      <button
        v-for="image in filteredImages" 
        :key="image.id"
        class="image-card"
        type="button"
        :class="{ 'selectable': isFiltering, 'selected': selectedImages.includes(image.id) }"
        :aria-pressed="isFiltering ? selectedImages.includes(image.id) : undefined"
        :aria-label="isFiltering ? `选择图片 ${image.title}` : `查看图片 ${image.title}`"
        @click="handleImageClick(image)"
      >
        <div v-if="isFiltering" class="selection-indicator">
          <AppIcon v-if="selectedImages.includes(image.id)" name="check" :size="15" />
        </div>
        
        <div class="image-wrapper">
          <img :src="getImageUrl(image)" :alt="image.title" @error="handleImageError" />
          <div class="image-overlay">
            <span class="format-badge">{{ image.file_type }}</span>
          </div>
          <div class="hover-description">
            <p>{{ image.description || image.title }}</p>
          </div>
        </div>
        
        <div class="image-info">
          <span class="image-title">{{ image.title }}</span>
          <span class="image-style" :class="'style-' + (image.style || '普通')">{{ image.style || '普通' }}</span>
        </div>
      </button>
    </div>

    <!-- 空状态 -->
    <div v-if="images.length === 0" class="empty-state">
      <AppIcon name="image" :size="28" /><span>还没有图片。上传后可以在此处预览、整理与下载。</span>
    </div>

    <!-- 图片预览/编辑页 -->
    <div v-if="viewingImage" class="fullscreen-viewer">
      <div class="viewer-header">
        <button class="back-btn" type="button" @click="closeViewer">
          <AppIcon name="arrow-left" :size="17" /> 返回
        </button>
        <span class="viewer-title">{{ viewingImage.title }}</span>
      </div>
      
      <div class="viewer-body">
        <div class="viewer-left">
          <div class="image-nav">
            <button type="button" :disabled="!hasPrev" aria-label="上一张图片" @click="prevImage"><AppIcon name="arrow-left" :size="17" /></button>
          </div>
          
          <div class="main-image-container">
            <img 
              :src="getImageUrl(viewingImage)" 
              :alt="viewingImage.title"
              :style="imageTransformStyle"
              ref="mainImage"
            />
          </div>
          
          <div class="image-nav">
            <button type="button" :disabled="!hasNext" aria-label="下一张图片" @click="nextImage"><AppIcon name="arrow-right" :size="17" /></button>
          </div>
          
          <div class="viewer-actions">
            <button type="button" @click="downloadImage"><AppIcon name="download" :size="16" />下载图片</button>
            <button type="button" @click="openEditor"><AppIcon name="pen" :size="16" />编辑预览</button>
          </div>
        </div>
        
        <div class="viewer-right">
          <div class="info-section">
            <h4>图片信息</h4>
            <div class="info-item">
              <label>标题</label>
              <input v-model="editForm.title" :disabled="!isEditing" />
            </div>
            <div class="info-item">
              <label>图片格式</label>
              <input :value="viewingImage.file_type" disabled />
            </div>
            <div class="info-item">
              <label>风格</label>
              <select v-model="editForm.style" :disabled="!isEditing">
                <option value="普通">普通</option>
                <option value="风景">风景</option>
                <option value="人物">人物</option>
                <option value="动漫">动漫</option>
                <option value="美食">美食</option>
                <option value="其他">其他</option>
              </select>
            </div>
            <div class="info-item">
              <label>分辨率</label>
              <input :value="(viewingImage.width || '?') + ' x ' + (viewingImage.height || '?')" disabled />
            </div>
            <div class="info-item">
              <label>图片描述</label>
              <textarea v-model="editForm.description" :disabled="!isEditing" rows="4"></textarea>
            </div>
          </div>
          
          <div class="edit-actions">
            <button v-if="!isEditing" class="edit-btn" @click="startEdit">更改</button>
            <template v-else>
              <button class="save-btn" @click="saveEdit">保存更改</button>
              <button class="cancel-btn" @click="cancelEdit">取消</button>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- 图片编辑器弹窗 -->
    <div v-if="showEditor" class="editor-modal">
      <div class="editor-header">
        <button class="back-btn" type="button" @click="closeEditor"><AppIcon name="arrow-left" :size="17" /> 返回</button>
        <h3>图片编辑</h3>
        <button class="save-btn" type="button" @click="saveEditedImage">保存选项</button>
      </div>
      
      <div class="editor-body">
        <div class="editor-canvas">
          <canvas ref="editorCanvas"></canvas>
        </div>
        
        <div class="editor-tools">
          <div class="tool-section">
            <h4>滤镜</h4>
            <button @click="applyFilter('grayscale')">黑白</button>
            <button @click="applyFilter('sepia')">复古</button>
            <button @click="applyFilter('blur')">模糊</button>
            <button @click="applyFilter('brightness')">明亮</button>
            <button @click="applyFilter('contrast')">对比</button>
            <button @click="resetFilters">重置</button>
          </div>
          
          <div class="tool-section">
            <h4>调整</h4>
            <label>亮度: {{ adjustments.brightness }}%</label>
            <input type="range" v-model="adjustments.brightness" min="0" max="200" @input="applyAdjustments" />
            
            <label>对比度: {{ adjustments.contrast }}%</label>
            <input type="range" v-model="adjustments.contrast" min="0" max="200" @input="applyAdjustments" />
            
            <label>饱和度: {{ adjustments.saturation }}%</label>
            <input type="range" v-model="adjustments.saturation" min="0" max="200" @input="applyAdjustments" />
          </div>
          
          <div class="tool-section">
            <h4>变换</h4>
            <button type="button" @click="rotateImage(90)"><AppIcon name="rotate-cw" :size="16" />顺时针 90°</button>
            <button type="button" @click="rotateImage(-90)"><AppIcon name="rotate-ccw" :size="16" />逆时针 90°</button>
            <button type="button" @click="flipImage('horizontal')"><AppIcon name="flip-horizontal" :size="16" />水平翻转</button>
            <button type="button" @click="flipImage('vertical')"><AppIcon name="flip-vertical" :size="16" />垂直翻转</button>
          </div>
          
          <div class="tool-section">
            <h4>裁剪</h4>
            <button type="button" @click="startCrop"><AppIcon name="crop" :size="16" />开始裁剪</button>
            <button v-if="isCropping" type="button" @click="applyCrop">应用裁剪</button>
            <button v-if="isCropping" type="button" @click="cancelCrop">取消裁剪</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 保存选项弹窗 -->
    <div v-if="showSaveOptions" class="modal-overlay" @click.self="showSaveOptions = false">
      <div class="save-options-modal">
        <h3>保存选项</h3>
        <p>是否替换原图片？</p>
        <div class="options">
          <button class="replace-btn" @click="saveWithReplace">确定替换</button>
          <button class="new-btn" @click="saveAsNew">生成新图片</button>
          <button class="cancel-btn" @click="showSaveOptions = false">取消</button>
        </div>
      </div>
    </div>

    <!-- 新图片命名弹窗 -->
    <div v-if="showNewNameInput" class="modal-overlay" @click.self="showNewNameInput = false">
      <div class="name-input-modal">
        <h3>命名新图片</h3>
        <input v-model="newImageSuffix" placeholder="输入后缀（如：_edited, _copy等）" />
        <div class="actions">
          <button @click="confirmNewName">确定</button>
          <button @click="showNewNameInput = false">取消</button>
        </div>
      </div>
    </div>

    <!-- 归类弹窗 -->
    <div v-if="showCategorize" class="modal-overlay" @click.self="showCategorize = false">
      <div class="categorize-modal">
        <h3>批量归类</h3>
        <p>请输入归类风格</p>
        <input v-model="categorizeStyle" list="styleOptions" placeholder="选择或输入风格" />
        <datalist id="styleOptions">
          <option value="普通"></option>
          <option value="风景"></option>
          <option value="人物"></option>
          <option value="动漫"></option>
          <option value="美食"></option>
          <option value="其他"></option>
        </datalist>
        <div class="actions">
          <button class="confirm-btn" @click="confirmCategorize">确定归类</button>
          <button @click="showCategorize = false">取消</button>
        </div>
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <div v-if="showDeleteConfirm" class="modal-overlay" @click.self="showDeleteConfirm = false">
      <div class="delete-modal">
        <h3>确认删除</h3>
        <p>是否要删除这 {{ selectedImages.length }} 张图片？</p>
        <div class="actions">
          <button class="confirm-btn" @click="executeDelete">确定</button>
          <button @click="showDeleteConfirm = false">取消</button>
        </div>
      </div>
    </div>

    <!-- 上传弹窗 -->
    <div v-if="showUpload" class="modal-overlay" @click.self="showUpload = false">
      <div class="upload-modal">
        <h3>上传图片</h3>
        <div class="form-group">
          <label>图片名称（可选）</label>
          <input v-model="uploadForm.title" placeholder="默认为文件名" />
        </div>
        <div class="form-group">
          <label>风格</label>
          <select v-model="uploadForm.style">
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
          <input type="file" accept="image/*" @change="handleFileSelect" />
        </div>
        <div class="actions">
          <button class="upload-btn" :disabled="!uploadForm.file" @click="uploadImage">本地上传</button>
          <button @click="showUpload = false">取消</button>
        </div>
      </div>
    </div>

    <!-- Toast -->
    <div v-if="toast.show" class="toast" :class="toast.type">{{ toast.message }}</div>
  </div>
</template>

<script>
import axios from '@/services/http'
import AppIcon from '@/components/AppIcon.vue'

export default {
  name: 'ImageZone',
  components: { AppIcon },
  data() {
    return {
      themeClass: localStorage.getItem('theme') === 'dark' ? 'dark-mode' : 'light-mode',
      userId: null,
      images: [],
      
      // 筛选状态
      isFiltering: false,
      selectedImages: [],
      
      // 查看/编辑
      viewingImage: null,
      currentImageIndex: 0,
      isEditing: false,
      editForm: { title: '', style: '', description: '' },
      
      // 图片编辑器
      showEditor: false,
      editorCanvas: null,
      editorContext: null,
      originalImage: null,
      currentImage: null,
      adjustments: { brightness: 100, contrast: 100, saturation: 100 },
      rotation: 0,
      flipH: 1,
      flipV: 1,
      isCropping: false,
      cropStart: null,
      cropRect: null,
      
      // 保存选项
      showSaveOptions: false,
      showNewNameInput: false,
      newImageSuffix: '',
      editedImageData: null,
      
      // 归类
      showCategorize: false,
      categorizeStyle: '',
      
      // 删除
      showDeleteConfirm: false,
      
      // 上传
      showUpload: false,
      uploadForm: { title: '', style: '普通', file: null },
      
      // 图片变换
      imageScale: 1,
      
      toast: { show: false, message: '', type: 'success' },
      themeHandler: null
    }
  },
  computed: {
    selectionText() {
      if (!this.isFiltering) return ''
      return this.selectedImages.length === 0 ? '未选择图片' : `已选择 ${this.selectedImages.length} 张图片`
    },
    filteredImages() {
      // 可以添加风格筛选逻辑
      return this.images
    },
    hasPrev() {
      return this.currentImageIndex > 0
    },
    hasNext() {
      return this.currentImageIndex < this.images.length - 1
    },
    imageTransformStyle() {
      return {
        transform: `scale(${this.imageScale}) rotate(${this.rotation}deg) scaleX(${this.flipH}) scaleY(${this.flipV})`,
        transition: 'transform 0.3s'
      }
    }
  },
  created() {
    this.userId = localStorage.getItem('userId')
    if (!this.userId) {
      this.$router.push('/login')
      return
    }
    this.loadImages()
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
    handleEscape(event) {
      if (event.key !== 'Escape') return
      if (this.showSaveOptions) this.showSaveOptions = false
      else if (this.showNewNameInput) this.showNewNameInput = false
      else if (this.showCategorize) this.showCategorize = false
      else if (this.showDeleteConfirm) this.showDeleteConfirm = false
      else if (this.showUpload) this.showUpload = false
      else if (this.showEditor) this.closeEditor()
      else if (this.viewingImage) this.closeViewer()
    },
    
    async loadImages() {
      try {
        const res = await axios.get(`/api/entertainment/images/${this.userId}`)
        this.images = res.data.images || []
      } catch (err) {
        this.showToast('加载图片失败', 'error')
      }
    },
    
    getImageUrl(image) {
      return `/api/entertainment/image-file/${image.id}`
    },
    
    handleImageError(e) {
      e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="%23f0f0f0"/%3E%3Ctext x="50" y="50" text-anchor="middle" fill="%23999"%3E图片加载失败%3C/text%3E%3C/svg%3E'
    },
    
    // 导航
    goBack() {
      this.$router.push('/personal/entertainment')
    },
    
    // 筛选功能
    startFilter() {
      this.isFiltering = true
      this.selectedImages = []
    },
    
    cancelFilter() {
      this.isFiltering = false
      this.selectedImages = []
    },
    
    handleImageClick(image) {
      if (this.isFiltering) {
        const idx = this.selectedImages.indexOf(image.id)
        if (idx > -1) {
          this.selectedImages.splice(idx, 1)
        } else {
          this.selectedImages.push(image.id)
        }
      } else {
        this.viewImage(image)
      }
    },
    
    // 查看图片
    viewImage(image) {
      this.viewingImage = image
      this.currentImageIndex = this.images.findIndex(img => img.id === image.id)
      this.editForm = {
        title: image.title,
        style: image.style || '普通',
        description: image.description || image.title
      }
      this.isEditing = false
    },
    
    closeViewer() {
      this.viewingImage = null
    },
    
    prevImage() {
      if (this.hasPrev) {
        this.currentImageIndex--
        this.viewImage(this.images[this.currentImageIndex])
      }
    },
    
    nextImage() {
      if (this.hasNext) {
        this.currentImageIndex++
        this.viewImage(this.images[this.currentImageIndex])
      }
    },
    
    // 编辑功能
    startEdit() {
      this.isEditing = true
    },
    
    async saveEdit() {
      try {
        await axios.put(`/api/entertainment/images/${this.viewingImage.id}`, {
          userId: this.userId,
          title: this.editForm.title,
          style: this.editForm.style,
          description: this.editForm.description
        })
        this.showToast('保存成功')
        this.isEditing = false
        this.loadImages()
        // 更新当前查看的图片
        this.viewingImage.title = this.editForm.title
        this.viewingImage.style = this.editForm.style
        this.viewingImage.description = this.editForm.description
      } catch (err) {
        this.showToast('保存失败', 'error')
      }
    },
    
    cancelEdit() {
      this.editForm = {
        title: this.viewingImage.title,
        style: this.viewingImage.style || '普通',
        description: this.viewingImage.description || this.viewingImage.title
      }
      this.isEditing = false
    },
    
    downloadImage() {
      const link = document.createElement('a')
      link.href = this.getImageUrl(this.viewingImage)
      link.download = this.viewingImage.title + this.viewingImage.file_type
      link.click()
    },
    
    // 图片编辑器
    openEditor() {
      this.showEditor = true
      this.resetEditor()
      this.$nextTick(() => {
        this.initEditor()
      })
    },
    
    closeEditor() {
      this.showEditor = false
    },
    
    initEditor() {
      const canvas = this.$refs.editorCanvas
      const ctx = canvas.getContext('2d')
      this.editorCanvas = canvas
      this.editorContext = ctx
      
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        this.originalImage = img
        this.currentImage = img
        canvas.width = img.width
        canvas.height = img.height
        ctx.drawImage(img, 0, 0)
      }
      img.src = this.getImageUrl(this.viewingImage)
    },
    
    resetEditor() {
      this.adjustments = { brightness: 100, contrast: 100, saturation: 100 }
      this.rotation = 0
      this.flipH = 1
      this.flipV = 1
      this.isCropping = false
      this.cropRect = null
    },
    
    applyFilter(filterType) {
      // 简化的滤镜实现
      const filters = {
        grayscale: 'grayscale(100%)',
        sepia: 'sepia(100%)',
        blur: 'blur(5px)',
        brightness: 'brightness(150%)',
        contrast: 'contrast(150%)'
      }
      
      this.editorCanvas.style.filter = filters[filterType] || 'none'
    },
    
    applyAdjustments() {
      const { brightness, contrast, saturation } = this.adjustments
      this.editorCanvas.style.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`
    },
    
    rotateImage(deg) {
      this.rotation = (this.rotation + deg) % 360
      this.renderEditor()
    },
    
    flipImage(direction) {
      if (direction === 'horizontal') {
        this.flipH *= -1
      } else {
        this.flipV *= -1
      }
      this.renderEditor()
    },
    
    renderEditor() {
      // 重新绘制图像
      const ctx = this.editorContext
      const canvas = this.editorCanvas
      const img = this.currentImage
      
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      
      // 应用变换
      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.rotate(this.rotation * Math.PI / 180)
      ctx.scale(this.flipH, this.flipV)
      
      ctx.drawImage(img, -img.width / 2, -img.height / 2)
      ctx.restore()
    },
    
    startCrop() {
      this.isCropping = true
      // 简化实现，实际应该添加鼠标事件监听
      this.showToast('请在图片上拖拽选择裁剪区域')
    },
    
    applyCrop() {
      this.isCropping = false
      // 实际裁剪逻辑
    },
    
    cancelCrop() {
      this.isCropping = false
    },
    
    saveEditedImage() {
      this.editedImageData = this.editorCanvas.toDataURL('image/jpeg')
      this.showSaveOptions = true
    },
    
    saveWithReplace() {
      this.showToast('编辑后的图片保存接口尚未实现，原图未被修改', 'error')
    },
    
    saveAsNew() {
      this.showNewNameInput = true
    },
    
    confirmNewName() {
      this.showToast('导出新图片的保存接口尚未实现，未创建新文件', 'error')
    },
    
    // 批量操作
    async confirmCategorize() {
      if (!this.categorizeStyle) {
        this.showToast('请输入风格', 'error')
        return
      }
      try {
        await axios.put('/api/entertainment/images/batch-style', {
          userId: this.userId,
          imageIds: this.selectedImages,
          style: this.categorizeStyle
        })
        this.showToast('归类成功')
        this.showCategorize = false
        this.categorizeStyle = ''
        this.loadImages()
        this.cancelFilter()
      } catch (err) {
        this.showToast('归类失败', 'error')
      }
    },
    
    confirmDelete() {
      if (this.selectedImages.length === 0) return
      this.showDeleteConfirm = true
    },
    
    async executeDelete() {
      try {
        await axios.delete('/api/entertainment/images', {
          data: { userId: this.userId, imageIds: this.selectedImages }
        })
        this.showToast('删除成功')
        this.showDeleteConfirm = false
        this.loadImages()
        this.cancelFilter()
      } catch (err) {
        this.showToast('删除失败', 'error')
      }
    },
    
    // 上传
    handleFileSelect(event) {
      const file = event.target.files[0]
      if (file && file.type.startsWith('image/')) {
        this.uploadForm.file = file
      } else {
        this.showToast('请选择图片文件', 'error')
      }
    },
    
    async uploadImage() {
      const formData = new FormData()
      formData.append('image', this.uploadForm.file)
      formData.append('userId', this.userId)
      formData.append('title', this.uploadForm.title)
      formData.append('style', this.uploadForm.style)
      
      try {
        await axios.post('/api/entertainment/images', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        this.showToast('上传成功')
        this.showUpload = false
        this.uploadForm = { title: '', style: '普通', file: null }
        this.loadImages()
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
.image-zone {
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

.zone-header {
  margin-bottom: 20px;
}

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
  transition: all 0.3s;
}

.back-btn:hover {
  background: var(--bg-secondary);
  transform: translateX(-5px);
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
  line-height: 1.6;
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
  font-weight: 500;
  transition: all 0.3s;
  border: none;
}

.filter-btn, .upload-btn {
  background: var(--accent-color);
  color: white;
}

.filter-btn:hover, .upload-btn:hover {
  opacity: 0.9;
  transform: translateY(-2px);
}

.categorize-btn {
  background: #f59e0b;
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

/* 图片网格 */
.images-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 20px;
}

.image-card {
  background: var(--bg-primary);
  border-radius: 12px;
  overflow: hidden;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.3s;
  position: relative;
}

.image-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
}

.image-card.selectable {
  border: 2px dashed var(--border-color);
}

.image-card.selected {
  border-color: var(--danger-color);
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2);
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

.image-card.selected .selection-indicator {
  background: var(--danger-color);
  border-color: var(--danger-color);
  color: white;
}

.image-wrapper {
  position: relative;
  aspect-ratio: 4/3;
  overflow: hidden;
}

.image-wrapper img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s;
}

.image-card:hover .image-wrapper img {
  transform: scale(1.05);
}

.image-overlay {
  position: absolute;
  bottom: 10px;
  right: 10px;
}

.format-badge {
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border-radius: 4px;
  font-size: 11px;
  text-transform: uppercase;
}

.hover-description {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  opacity: 0;
  transition: opacity 0.3s;
}

.image-card:hover .hover-description {
  opacity: 1;
}

.hover-description p {
  margin: 0;
  text-align: center;
  font-size: 14px;
  line-height: 1.5;
}

.image-info {
  padding: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.image-title {
  font-weight: 500;
  color: var(--text-primary);
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.image-style {
  padding: 4px 10px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
  margin-left: 8px;
}

.style-普通 { background: #e5e7eb; color: #374151; }
.style-风景 { background: #dbeafe; color: #1e40af; }
.style-人物 { background: #fce7f3; color: #be185d; }
.style-动漫 { background: #fef3c7; color: #92400e; }
.style-美食 { background: #d1fae5; color: #065f46; }
.style-其他 { background: #f3e8ff; color: #6b21a8; }

.empty-state {
  text-align: center;
  padding: 60px;
  color: var(--text-secondary);
  font-size: 16px;
  background: var(--bg-primary);
  border-radius: 12px;
  border: 2px dashed var(--border-color);
}

/* 全屏查看器 */
.fullscreen-viewer {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.95);
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.viewer-header {
  display: flex;
  align-items: center;
  padding: 15px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.viewer-header .back-btn {
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: none;
}

.viewer-title {
  flex: 1;
  text-align: center;
  color: white;
  font-size: 18px;
  font-weight: 500;
  margin: 0 20px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.viewer-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.viewer-left {
  flex: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  position: relative;
}

.image-nav {
  padding: 0 20px;
}

.image-nav button {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: white;
  font-size: 24px;
  cursor: pointer;
  transition: all 0.3s;
}

.image-nav button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
}

.image-nav button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.main-image-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  max-height: 80vh;
}

.main-image-container img {
  max-width: 100%;
  max-height: 80vh;
  object-fit: contain;
}

.viewer-actions {
  position: absolute;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 15px;
}

.viewer-actions button {
  padding: 12px 24px;
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s;
}

.viewer-actions button:hover {
  opacity: 0.9;
  transform: translateY(-2px);
}

.viewer-right {
  flex: 1;
  background: rgba(255, 255, 255, 0.05);
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  padding: 30px;
  overflow-y: auto;
}

.info-section h4 {
  color: white;
  margin: 0 0 20px 0;
  padding-bottom: 15px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.info-item {
  margin-bottom: 20px;
}

.info-item label {
  display: block;
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.info-item input,
.info-item select,
.info-item textarea {
  width: 100%;
  padding: 10px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: white;
  font-size: 14px;
}

.info-item input:disabled,
.info-item select:disabled,
.info-item textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.info-item textarea {
  resize: vertical;
  min-height: 100px;
}

.edit-actions {
  display: flex;
  gap: 10px;
  margin-top: 30px;
}

.edit-actions button {
  flex: 1;
  padding: 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s;
}

.edit-btn {
  background: var(--accent-color);
  color: white;
  border: none;
}

.save-btn {
  background: #10b981;
  color: white;
  border: none;
}

.edit-actions .cancel-btn {
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

/* 编辑器 */
.editor-modal {
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
}

.editor-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.editor-canvas {
  flex: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1a1a1a;
  padding: 20px;
}

.editor-canvas canvas {
  max-width: 90%;
  max-height: 90%;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

.editor-tools {
  flex: 1;
  background: var(--bg-secondary);
  border-left: 1px solid var(--border-color);
  padding: 20px;
  overflow-y: auto;
}

.tool-section {
  margin-bottom: 25px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border-color);
}

.tool-section h4 {
  margin: 0 0 15px 0;
  color: var(--text-primary);
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.tool-section button {
  display: block;
  width: 100%;
  padding: 10px;
  margin-bottom: 8px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.3s;
}

.tool-section button:hover {
  background: var(--accent-color);
  color: white;
  border-color: var(--accent-color);
}

.tool-section label {
  display: block;
  color: var(--text-secondary);
  font-size: 13px;
  margin: 10px 0 5px 0;
}

.tool-section input[type="range"] {
  width: 100%;
  margin-bottom: 10px;
}

/* 弹窗通用样式 */
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
  backdrop-filter: blur(4px);
}

.categorize-modal, .delete-modal, .save-options-modal, .name-input-modal, .upload-modal {
  background: var(--bg-primary);
  border-radius: 16px;
  padding: 30px;
  max-width: 400px;
  width: 90%;
  border: 1px solid var(--border-color);
}

.categorize-modal h3, .delete-modal h3, .save-options-modal h3, .name-input-modal h3, .upload-modal h3 {
  margin: 0 0 20px 0;
  color: var(--text-primary);
}

.categorize-modal p, .delete-modal p, .save-options-modal p {
  color: var(--text-secondary);
  margin-bottom: 20px;
}

.categorize-modal input, .name-input-modal input, .upload-modal input, .upload-modal select {
  width: 100%;
  padding: 12px;
  margin-bottom: 20px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-primary);
}

.actions, .options {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.actions button, .options button {
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  border: none;
}

.confirm-btn, .replace-btn {
  background: var(--danger-color);
  color: white;
}

.new-btn {
  background: var(--accent-color);
  color: white;
}

.actions button:last-child, .options button:last-child {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

/* Toast */
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

.toast.success { background: #10b981; }
.toast.error { background: #ef4444; }

@keyframes slideDown {
  from { opacity: 0; transform: translate(-50%, -20px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}

@media (max-width: 768px) {
  .images-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .viewer-body {
    flex-direction: column;
  }
  
  .viewer-right {
    border-left: none;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .editor-body {
    flex-direction: column;
  }
}

/* 图片资源库覆盖层：保留 Canvas 状态机，仅统一视觉与可访问交互。 */
.image-zone { min-height: 0; padding: 0; background: transparent; color: var(--text); }
.image-zone.light-mode,
.image-zone.dark-mode { background: transparent; color: var(--text); }
.image-zone .zone-header { margin: 0 0 var(--space-3); padding: 0; border: 0; }
.image-zone .back-btn,
.image-zone .filter-btn,
.image-zone .upload-btn,
.image-zone .action-btn,
.image-zone .viewer-actions button,
.image-zone .edit-actions button,
.image-zone .editor-header button,
.image-zone .tool-section button,
.image-zone .actions button,
.image-zone .options button {
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
  font-size: .88rem;
  font-weight: 650;
}
.image-zone .back-btn:hover:not(:disabled),
.image-zone .filter-btn:hover:not(:disabled),
.image-zone .action-btn:hover:not(:disabled),
.image-zone .viewer-actions button:hover:not(:disabled),
.image-zone .tool-section button:hover:not(:disabled),
.image-zone .actions button:hover:not(:disabled),
.image-zone .options button:hover:not(:disabled) { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); transform: none; }
.image-zone .upload-btn,
.image-zone .save-btn,
.image-zone .edit-btn,
.image-zone .new-btn { border-color: var(--accent); background: var(--accent); color: #fff; }
.image-zone .upload-btn:hover:not(:disabled),
.image-zone .save-btn:hover:not(:disabled),
.image-zone .edit-btn:hover:not(:disabled),
.image-zone .new-btn:hover:not(:disabled) { background: var(--accent-strong); color: #fff; transform: none; box-shadow: none; }
.image-zone .delete-btn,
.image-zone .confirm-btn,
.image-zone .replace-btn { border-color: var(--danger); background: var(--danger); color: #fff; }
.image-zone button:focus-visible,
.image-zone input:focus-visible,
.image-zone textarea:focus-visible,
.image-zone select:focus-visible { outline: 3px solid color-mix(in srgb, var(--accent), transparent 68%); outline-offset: 2px; }
.zone-description { max-width: 68ch; margin: 0 0 var(--space-4); padding: 0; border: 0; background: transparent; }
.zone-description h2 { margin: var(--space-1) 0; color: var(--text); font-size: 1.6rem; letter-spacing: -.025em; }
.zone-description p:last-child { margin: 0; color: var(--muted); }
.action-bar { min-height: auto; margin-bottom: var(--space-4); padding: var(--space-3); border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); }
.selection-status { color: var(--muted); font-size: .86rem; }
.action-btns { gap: var(--space-2); }
.images-grid { gap: var(--space-3); grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); }
.image-card { position: relative; min-width: 0; padding: 0; overflow: hidden; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); color: var(--text); box-shadow: none; text-align: left; cursor: pointer; }
.image-card:hover { transform: none; border-color: var(--accent); box-shadow: var(--shadow); }
.image-card.selected { border-color: var(--accent); background: var(--accent-soft); }
.image-card .image-wrapper { aspect-ratio: 4 / 3; border-radius: 0; background: var(--bg); }
.image-card .image-wrapper img { width: 100%; height: 100%; object-fit: cover; }
.image-card .image-overlay { background: linear-gradient(to top, rgb(0 0 0 / 48%), transparent); }
.image-card .hover-description { display: none; }
.image-card .image-info { min-height: 52px; padding: var(--space-2) var(--space-3); background: var(--surface); }
.image-card .image-title { overflow: hidden; color: var(--text); font-size: .9rem; text-overflow: ellipsis; white-space: nowrap; }
.image-card .image-style { border: 1px solid var(--border); background: var(--surface-raised); color: var(--muted); }
.selection-indicator { display: grid; place-items: center; width: 24px; height: 24px; border: 1px solid var(--accent); border-radius: 50%; background: var(--accent); color: #fff; }
.empty-state { display: flex; align-items: center; justify-content: center; gap: var(--space-2); min-height: 180px; padding: var(--space-4); border: 1px dashed var(--border); border-radius: var(--radius); background: transparent; color: var(--muted); }
.fullscreen-viewer,
.editor-modal { background: var(--bg); color: var(--text); }
.viewer-header,
.editor-header { min-height: 64px; padding: var(--space-3) var(--space-5); border-color: var(--border); background: var(--surface); }
.viewer-title,
.editor-header h3 { color: var(--text); }
.viewer-body { background: var(--bg); }
.viewer-left,
.viewer-right { background: var(--surface); border-color: var(--border); }
.main-image-container { border-color: var(--border); background: var(--bg); }
.image-nav button { display: grid; place-items: center; width: 38px; height: 38px; padding: 0; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); color: var(--text); }
.info-section h4,
.info-item label { color: var(--text); }
.info-item input,
.info-item textarea,
.info-item select,
.image-zone .categorize-modal input,
.image-zone .name-input-modal input,
.image-zone .upload-modal input,
.image-zone .upload-modal select { box-sizing: border-box; border-color: var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); color: var(--text); }
.editor-tools { border-color: var(--border); background: var(--surface); }
.tool-section { padding: var(--space-3); border-color: var(--border); background: transparent; }
.tool-section h4,
.tool-section label { color: var(--text); }
.modal-overlay { background: rgb(20 25 23 / 46%); backdrop-filter: blur(2px); }
.save-options-modal,
.name-input-modal,
.categorize-modal,
.delete-modal,
.upload-modal { width: min(460px, calc(100% - 32px)); padding: var(--space-5); border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); color: var(--text); box-shadow: var(--shadow); }
.save-options-modal h3,
.name-input-modal h3,
.categorize-modal h3,
.delete-modal h3,
.upload-modal h3 { margin: 0 0 var(--space-3); color: var(--text); }
.categorize-modal p,
.delete-modal p,
.save-options-modal p { color: var(--muted); }
.toast { top: var(--space-4); border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); color: var(--text); box-shadow: var(--shadow); }
.toast.success { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }
.toast.error { border-color: var(--danger); background: color-mix(in srgb, var(--danger), transparent 92%); color: var(--danger); }
@media (max-width: 760px) {
  .action-bar { align-items: stretch; flex-direction: column; gap: var(--space-2); }
  .action-btns { justify-content: flex-start; flex-wrap: wrap; }
  .images-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .viewer-header,
  .editor-header { padding: var(--space-3); }
  .viewer-body,
  .editor-body { overflow: auto; }
  .viewer-right { border-left: 0; border-top: 1px solid var(--border); }
  .editor-tools { min-width: 0; }
}
</style>
