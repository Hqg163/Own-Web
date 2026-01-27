<template>
  <div :class="themeClass" class="personal-center">
    <!-- 顶部导航栏（复用原来的导航栏） -->
    <NavigationBar />
    
    <!-- 个人中心主内容 -->
    <div class="personal-content">
      <!-- 左侧选项栏 -->
      <div class="options-sidebar">
        <div class="user-profile">
          <div class="avatar">
            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=用户" alt="头像" />
          </div>
          <h3>{{ userInfo.username || '用户' }}</h3>
          <p class="email">{{ userInfo.email || '未设置邮箱' }}</p>
        </div>
        
        <div class="options-list">
          <div 
            v-for="option in options" 
            :key="option.id"
            :class="['option-item', { active: activeOption === option.id }]"
            @click="selectOption(option.id)"
          >
            <span class="option-icon">{{ option.icon }}</span>
            <span class="option-name">{{ option.name }}</span>
          </div>
        </div>
      </div>
      
      <!-- 右侧内容区域 -->
      <div class="content-area">
        <!-- 个人信息 -->
        <div v-if="activeOption === 'personal-info'" class="info-content">
          <h2 class="content-title">个人信息</h2>
          
          <!-- 个人信息表单 -->
          <form @submit.prevent="savePersonalInfo" class="info-form">
            <!-- 用户名 -->
            <div class="form-group">
              <label class="form-label">
                用户名
                <span class="required">*</span>
              </label>
              <input 
                type="text" 
                v-model="userInfo.username"
                :disabled="!isEditing"
                :class="{ 'editable': isEditing }"
                required
              />
            </div>
            
            <!-- 账号（邮箱） -->
            <div class="form-group">
              <label class="form-label">
                账号（邮箱）
                <span class="required">*</span>
              </label>
              <input 
                type="email" 
                v-model="userInfo.email"
                :disabled="!isEditing"
                :class="{ 'editable': isEditing }"
                required
              />
            </div>
            
            <!-- 密码 -->
            <div class="form-group password-group">
              <div class="password-header">
                <label class="form-label">
                  密码
                  <span class="required">*</span>
                </label>
                <button 
                  type="button" 
                  class="password-toggle"
                  @click="togglePasswordEdit"
                  :disabled="isEditingPassword && !isEditing"
                >
                  {{ isEditingPassword ? '取消修改' : '修改密码' }}
                </button>
              </div>
              <input 
                :type="isEditingPassword ? 'text' : 'password'"
                v-model="userInfo.password"
                :disabled="!isEditingPassword"
                :class="{ 'editable': isEditingPassword }"
                placeholder="********"
                required
              />
              <div v-if="isEditingPassword" class="password-hint">
                密码修改后需要重新登录
              </div>
            </div>
            
            <!-- 生日 -->
            <div class="form-group">
              <label class="form-label">生日</label>
              <div class="date-picker">
                <input 
                  type="text" 
                  v-model="userInfo.birthday"
                  :disabled="!isEditing"
                  :class="{ 'editable': isEditing }"
                  placeholder="请选择日期"
                  @click="isEditing && showDatePicker()"
                  readonly
                />
                <button 
                  type="button" 
                  class="calendar-btn"
                  @click="isEditing && showDatePicker()"
                  :disabled="!isEditing"
                >
                  📅
                </button>
              </div>
              <!-- 日期选择器（稍后实现） -->
            </div>
            
            <!-- 爱好 -->
            <div class="form-group">
              <label class="form-label">爱好</label>
              <input 
                type="text" 
                v-model="userInfo.hobbies"
                :disabled="!isEditing"
                :class="{ 'editable': isEditing }"
                placeholder="请输入您的爱好"
              />
            </div>
            
            <!-- 职业 -->
            <div class="form-group">
              <label class="form-label">职业</label>
              <select 
                v-model="userInfo.occupation"
                :disabled="!isEditing"
                :class="{ 'editable': isEditing }"
              >
                <option value="">请选择职业</option>
                <option value="student">学生</option>
                <option value="developer">开发者</option>
                <option value="designer">设计师</option>
                <option value="manager">管理者</option>
                <option value="other">其他</option>
              </select>
            </div>
            
            <!-- 备注 -->
            <div class="form-group">
              <label class="form-label">备注</label>
              <textarea 
                v-model="userInfo.notes"
                :disabled="!isEditing"
                :class="{ 'editable': isEditing }"
                placeholder="请输入备注信息..."
                rows="4"
              ></textarea>
            </div>
            
            <!-- 操作按钮 -->
            <div class="form-actions">
              <button 
                type="button" 
                class="btn-modify"
                @click="toggleEdit"
                :disabled="isEditingPassword"
              >
                {{ isEditing ? '保存' : '修改' }}
              </button>
              <button 
                type="button" 
                class="btn-cancel"
                @click="cancelEdit"
                :disabled="!isEditing && !isEditingPassword"
                :class="{ 'enabled': isEditing || isEditingPassword }"
              >
                取消
              </button>
            </div>
            
            <!-- 保存状态提示 -->
            <div v-if="saveStatus" class="save-status" :class="saveStatus.type">
              <span class="status-icon">{{ saveStatus.icon }}</span>
              <span class="status-message">{{ saveStatus.message }}</span>
            </div>
          </form>
        </div>
        
        <!-- 学习区（占位） -->
        <div v-else-if="activeOption === 'study'" class="placeholder-content">
          <h2>学习区</h2>
          <p>正在开发中...</p>
        </div>
        
        <!-- 娱乐区（占位） -->
        <div v-else-if="activeOption === 'entertainment'" class="placeholder-content">
          <h2>娱乐区</h2>
          <p>正在开发中...</p>
        </div>
      </div>
    </div>
    
    <!-- 日期选择器弹窗 -->
    <div v-if="showDatePickerModal" class="modal date-picker-modal" @click.self="closeDatePicker">
      <div class="modal-content">
        <div class="date-picker-header">
          <h3>选择日期</h3>
          <button class="close" @click="closeDatePicker">&times;</button>
        </div>
        <!-- 这里会放置日期选择器组件 -->
        <div class="calendar-placeholder">
          <p>日期选择器组件稍后实现</p>
          <button @click="selectToday" class="btn-today">选择今天</button>
          <button @click="closeDatePicker" class="btn-cancel">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import NavigationBar from '../NavigationBar.vue'
import axios from 'axios'

export default {
  name: 'PersonalCenter',
  components: {
    NavigationBar
  },
  data() {
    return {
      themeClass: localStorage.getItem('theme') === 'dark' ? 'dark-mode' : 'light-mode',
      activeOption: 'personal-info',
      isEditing: false,
      isEditingPassword: false,
      showDatePickerModal: false,
      saveStatus: null,
      
      // 左侧选项列表
      options: [
        { id: 'personal-info', name: '个人信息', icon: '👤' },
        { id: 'study', name: '学习区', icon: '📚' },
        { id: 'entertainment', name: '娱乐区', icon: '🎮' }
      ],
      
      // 用户信息
      userInfo: {
        username: '',
        email: '',
        password: '********',
        birthday: '',
        hobbies: '',
        occupation: '',
        notes: ''
      },
      
      // 备份原始数据（用于取消修改）
      originalUserInfo: {}
    }
  },
  computed: {
    isLoggedIn() {
      return localStorage.getItem('isLoggedIn') === 'true'
    }
  },
  created() {
    // 检查登录状态
    if (!this.isLoggedIn) {
      this.$router.push('/login')
      return
    }
    
    // 加载用户信息
    this.loadUserInfo()
    
    // 监听主题变化
    this.watchTheme()
  },
  methods: {
    // 监听主题变化
    watchTheme() {
      window.addEventListener('storage', (e) => {
        if (e.key === 'theme') {
          this.themeClass = e.newValue === 'dark' ? 'dark-mode' : 'light-mode'
        }
      })
    },
    
    // 选择选项
    selectOption(optionId) {
      this.activeOption = optionId
      
      // 如果切换到其他选项，取消编辑状态
      if (optionId !== 'personal-info') {
        this.isEditing = false
        this.isEditingPassword = false
        this.cancelEdit()
      }
    },
    
    // 修改loadUserInfo方法，加载用户信息
    async loadUserInfo() {
    try {
        // 从localStorage获取用户ID（实际应从登录响应中获取）
        const userId = localStorage.getItem('userId')
        
        if (userId) {
        // 调用后端API获取用户信息
        const response = await axios.get(`/api/user/${userId}`)
        this.userInfo = response.data.user
        
        // 保持密码隐藏
        this.userInfo.password = '********'
        
        // 备份原始数据
        this.originalUserInfo = { ...this.userInfo }
        } else {
        // 如果没有用户ID，使用默认值
        this.userInfo = {
            username: '用户' + Math.floor(Math.random() * 1000),
            email: localStorage.getItem('userEmail') || '',
            password: '********',
            birthday: '1990-01-01',
            hobbies: '阅读, 音乐, 运动',
            occupation: 'developer',
            notes: '欢迎使用个人中心！'
        }
        this.originalUserInfo = { ...this.userInfo }
        }
    } catch (error) {
        console.error('加载用户信息失败:', error)
    }
    },
    
    // 切换编辑状态
    toggleEdit() {
      if (!this.isEditing) {
        // 开始编辑
        this.isEditing = true
        // 备份当前数据
        this.originalUserInfo = { ...this.userInfo }
      } else {
        // 保存修改
        this.savePersonalInfo()
      }
    },
    
    // 切换密码编辑状态
    togglePasswordEdit() {
      if (!this.isEditingPassword) {
        // 开始编辑密码
        this.isEditingPassword = true
        // 如果密码是星号，清空以便输入
        if (this.userInfo.password === '********') {
          this.userInfo.password = ''
        }
      } else {
        // 取消密码编辑
        this.cancelPasswordEdit()
      }
    },
    
    // 取消密码编辑
    cancelPasswordEdit() {
      this.isEditingPassword = false
      // 恢复原始密码显示
      this.userInfo.password = '********'
    },
    
    // 取消所有编辑
    cancelEdit() {
      // 恢复所有数据
      this.userInfo = { ...this.originalUserInfo }
      this.isEditing = false
      this.isEditingPassword = false
      this.saveStatus = null
    },
    
    // 保存个人信息
    async savePersonalInfo() {
        try {
            // 验证必填项
            if (!this.userInfo.username || !this.userInfo.email) {
            this.showSaveStatus('error', '用户名和账号不能为空')
            return
            }
            
            if (this.isEditingPassword && !this.userInfo.password) {
            this.showSaveStatus('error', '密码不能为空')
            return
            }
            
            const userId = localStorage.getItem('userId')
            
            if (!userId) {
            this.showSaveStatus('error', '用户未登录')
            return
            }
            
            if (this.isEditingPassword) {
            // 调用更新密码API
            await axios.put(`/api/user/${userId}/password`, {
                oldPassword: prompt('请输入当前密码以验证'),
                newPassword: this.userInfo.password
            })
            
            this.showSaveStatus('success', '密码修改成功，请重新登录')
            
            // 延迟跳转
            setTimeout(() => {
                localStorage.removeItem('isLoggedIn')
                localStorage.removeItem('userId')
                this.$router.push('/login')
            }, 2000)
            } else {
            // 调用更新用户信息API
            await axios.put(`/api/user/${userId}`, {
                username: this.userInfo.username,
                birthday: this.userInfo.birthday,
                hobbies: this.userInfo.hobbies,
                occupation: this.userInfo.occupation,
                notes: this.userInfo.notes
            })
            
            this.showSaveStatus('success', '个人信息保存成功')
            }
            
            // 更新备份数据
            this.originalUserInfo = { ...this.userInfo }
            this.isEditing = false
            this.isEditingPassword = false
            
        } catch (error) {
            console.error('保存失败:', error)
            const message = error.response?.data?.error || '保存失败，请重试'
            this.showSaveStatus('error', message)
        }
    },
    
    // 显示保存状态
    showSaveStatus(type, message) {
      const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️'
      }
      
      this.saveStatus = {
        type,
        icon: icons[type],
        message
      }
      
      // 3秒后自动清除
      setTimeout(() => {
        this.saveStatus = null
      }, 3000)
    },
    
    // 日期选择器相关方法
    showDatePicker() {
      this.showDatePickerModal = true
    },
    
    closeDatePicker() {
      this.showDatePickerModal = false
    },
    
    selectToday() {
      const today = new Date()
      const formattedDate = today.toISOString().split('T')[0]
      this.userInfo.birthday = formattedDate
      this.closeDatePicker()
    }
  }
}
</script>

<style scoped>
/* 个人中心主容器 */
.personal-center {
  min-height: 100vh;
  transition: background-color 0.3s, color 0.3s;
}

/* 主内容区域 */
.personal-content {
  display: flex;
  max-width: 1200px;
  margin: 20px auto;
  padding: 0 20px;
  gap: 30px;
}

/* ==================== 左侧选项栏 ==================== */
.options-sidebar {
  flex: 0 0 250px;
  background: var(--sidebar-bg);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  border: 1px solid var(--sidebar-border);
}

/* 用户资料 */
.user-profile {
  text-align: center;
  padding-bottom: 20px;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--profile-border);
}

.avatar {
  width: 80px;
  height: 80px;
  margin: 0 auto 15px;
  border-radius: 50%;
  overflow: hidden;
  border: 3px solid var(--avatar-border);
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-profile h3 {
  margin: 10px 0 5px;
  font-size: 18px;
  font-weight: 600;
}

.user-profile .email {
  color: var(--text-secondary);
  font-size: 14px;
  margin: 0;
}

/* 选项列表 */
.options-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.option-item {
  display: flex;
  align-items: center;
  padding: 15px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  border: 1px solid transparent;
}

.option-item:hover {
  background: var(--option-hover);
  transform: translateX(5px);
}

.option-item.active {
  background: var(--option-active-bg);
  border-color: var(--option-active-border);
  transform: translateX(5px);
}

.option-item.active .option-name {
  font-weight: 600;
  font-size: 16px;
  color: var(--option-active-text);
}

.option-icon {
  font-size: 18px;
  margin-right: 12px;
  width: 24px;
  text-align: center;
}

.option-name {
  font-size: 15px;
  color: var(--text-primary);
}

/* ==================== 右侧内容区域 ==================== */
.content-area {
  flex: 1;
  background: var(--content-bg);
  border-radius: 12px;
  padding: 30px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  border: 1px solid var(--content-border);
}

.content-title {
  margin-top: 0;
  margin-bottom: 30px;
  color: var(--text-primary);
  font-size: 24px;
  padding-bottom: 15px;
  border-bottom: 2px solid var(--title-border);
}

/* 个人信息表单 */
.info-form {
  max-width: 600px;
}

.form-group {
  margin-bottom: 25px;
}

.form-label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: var(--text-primary);
  font-size: 15px;
}

.required {
  color: #ff4757;
  margin-left: 4px;
}

.info-form input,
.info-form select,
.info-form textarea {
  width: 100%;
  padding: 12px 15px;
  border: 1px solid var(--input-border);
  border-radius: 8px;
  font-size: 15px;
  transition: all 0.3s;
  background: var(--input-bg);
  color: var(--text-primary);
}

.info-form input:disabled,
.info-form select:disabled,
.info-form textarea:disabled {
  background: var(--input-disabled-bg);
  color: var(--text-disabled);
  cursor: not-allowed;
}

.info-form input.editable:not(:disabled),
.info-form select.editable:not(:disabled),
.info-form textarea.editable:not(:disabled) {
  background: var(--input-editable-bg);
  border-color: var(--input-editable-border);
}

.info-form input:focus:not(:disabled),
.info-form select:focus:not(:disabled),
.info-form textarea:focus:not(:disabled) {
  outline: none;
  border-color: var(--input-focus-border);
  box-shadow: 0 0 0 3px var(--input-focus-shadow);
}

/* 密码相关样式 */
.password-group {
  position: relative;
}

.password-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.password-toggle {
  padding: 6px 12px;
  background: var(--btn-secondary-bg);
  color: var(--btn-secondary-text);
  border: 1px solid var(--btn-secondary-border);
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.3s;
}

.password-toggle:hover:not(:disabled) {
  background: var(--btn-secondary-hover);
}

.password-toggle:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.password-hint {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 5px;
}

/* 日期选择器 */
.date-picker {
  position: relative;
  display: flex;
}

.calendar-btn {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: var(--text-secondary);
}

.calendar-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 操作按钮 */
.form-actions {
  display: flex;
  gap: 15px;
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid var(--actions-border);
}

.btn-modify,
.btn-cancel {
  flex: 1;
  padding: 14px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-modify {
  background: var(--btn-primary-bg);
  color: var(--btn-primary-text);
}

.btn-modify:hover:not(:disabled) {
  background: var(--btn-primary-hover);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.btn-modify:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-cancel {
  background: var(--btn-cancel-bg);
  color: var(--btn-cancel-text);
  opacity: 0.6;
}

.btn-cancel.enabled {
  opacity: 1;
  background: var(--btn-cancel-enabled-bg);
  color: var(--btn-cancel-enabled-text);
}

.btn-cancel.enabled:hover {
  background: var(--btn-cancel-enabled-hover);
  transform: translateY(-2px);
}

.btn-cancel:not(.enabled) {
  cursor: not-allowed;
}

/* 保存状态提示 */
.save-status {
  margin-top: 20px;
  padding: 15px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 10px;
  animation: slideIn 0.3s ease;
}

.save-status.success {
  background: var(--status-success-bg);
  color: var(--status-success-text);
  border: 1px solid var(--status-success-border);
}

.save-status.error {
  background: var(--status-error-bg);
  color: var(--status-error-text);
  border: 1px solid var(--status-error-border);
}

.save-status.warning {
  background: var(--status-warning-bg);
  color: var(--status-warning-text);
  border: 1px solid var(--status-warning-border);
}

.status-icon {
  font-size: 18px;
}

.status-message {
  font-weight: 500;
}

/* 占位内容 */
.placeholder-content {
  text-align: center;
  padding: 60px 20px;
}

.placeholder-content h2 {
  color: var(--text-primary);
  margin-bottom: 20px;
}

.placeholder-content p {
  color: var(--text-secondary);
  font-size: 18px;
}

/* 日期选择器弹窗 */
.date-picker-modal .modal-content {
  max-width: 400px;
}

.date-picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid var(--modal-border);
}

.date-picker-header h3 {
  margin: 0;
}

.calendar-placeholder {
  text-align: center;
  padding: 30px 0;
}

.calendar-placeholder p {
  margin-bottom: 20px;
  color: var(--text-secondary);
}

.btn-today {
  padding: 10px 20px;
  background: var(--btn-primary-bg);
  color: var(--btn-primary-text);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  margin-right: 10px;
}

.btn-today:hover {
  background: var(--btn-primary-hover);
}

/* 动画 */
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ==================== 主题变量 ==================== */
.light-mode {
  --sidebar-bg: #ffffff;
  --sidebar-border: #e5e7eb;
  --profile-border: #f3f4f6;
  --avatar-border: #3b82f6;
  --option-hover: #f8fafc;
  --option-active-bg: #eff6ff;
  --option-active-border: #3b82f6;
  --option-active-text: #1d4ed8;
  --text-primary: #1f2937;
  --text-secondary: #6b7280;
  --text-disabled: #9ca3af;
  
  --content-bg: #ffffff;
  --content-border: #e5e7eb;
  --title-border: #3b82f6;
  
  --input-bg: #ffffff;
  --input-border: #d1d5db;
  --input-disabled-bg: #f9fafb;
  --input-editable-bg: #ffffff;
  --input-editable-border: #3b82f6;
  --input-focus-border: #2563eb;
  --input-focus-shadow: rgba(59, 130, 246, 0.1);
  
  --btn-primary-bg: #3b82f6;
  --btn-primary-text: #ffffff;
  --btn-primary-hover: #2563eb;
  
  --btn-secondary-bg: #f3f4f6;
  --btn-secondary-text: #4b5563;
  --btn-secondary-border: #d1d5db;
  --btn-secondary-hover: #e5e7eb;
  
  --btn-cancel-bg: #f3f4f6;
  --btn-cancel-text: #6b7280;
  --btn-cancel-enabled-bg: #fef2f2;
  --btn-cancel-enabled-text: #dc2626;
  --btn-cancel-enabled-hover: #fee2e2;
  
  --actions-border: #e5e7eb;
  
  --status-success-bg: #d1fae5;
  --status-success-text: #065f46;
  --status-success-border: #a7f3d0;
  
  --status-error-bg: #fee2e2;
  --status-error-text: #991b1b;
  --status-error-border: #fecaca;
  
  --status-warning-bg: #fef3c7;
  --status-warning-text: #92400e;
  --status-warning-border: #fde68a;
  
  --modal-border: #e5e7eb;
}

.dark-mode {
  --sidebar-bg: #1f2937;
  --sidebar-border: #374151;
  --profile-border: #374151;
  --avatar-border: #60a5fa;
  --option-hover: #374151;
  --option-active-bg: #1e40af;
  --option-active-border: #3b82f6;
  --option-active-text: #ffffff;
  --text-primary: #f9fafb;
  --text-secondary: #d1d5db;
  --text-disabled: #6b7280;
  
  --content-bg: #1f2937;
  --content-border: #374151;
  --title-border: #60a5fa;
  
  --input-bg: #111827;
  --input-border: #4b5563;
  --input-disabled-bg: #374151;
  --input-editable-bg: #111827;
  --input-editable-border: #60a5fa;
  --input-focus-border: #3b82f6;
  --input-focus-shadow: rgba(59, 130, 246, 0.2);
  
  --btn-primary-bg: #2563eb;
  --btn-primary-text: #ffffff;
  --btn-primary-hover: #1d4ed8;
  
  --btn-secondary-bg: #374151;
  --btn-secondary-text: #d1d5db;
  --btn-secondary-border: #4b5563;
  --btn-secondary-hover: #4b5563;
  
  --btn-cancel-bg: #374151;
  --btn-cancel-text: #9ca3af;
  --btn-cancel-enabled-bg: #7f1d1d;
  --btn-cancel-enabled-text: #fecaca;
  --btn-cancel-enabled-hover: #991b1b;
  
  --actions-border: #374151;
  
  --status-success-bg: #064e3b;
  --status-success-text: #a7f3d0;
  --status-success-border: #047857;
  
  --status-error-bg: #7f1d1d;
  --status-error-text: #fecaca;
  --status-error-border: #991b1b;
  
  --status-warning-bg: #78350f;
  --status-warning-text: #fde68a;
  --status-warning-border: #92400e;
  
  --modal-border: #374151;
}

/* ==================== 响应式设计 ==================== */
@media (max-width: 768px) {
  .personal-content {
    flex-direction: column;
    padding: 10px;
  }
  
  .options-sidebar {
    flex: none;
    width: 100%;
  }
  
  .content-area {
    padding: 20px;
  }
  
  .form-actions {
    flex-direction: column;
  }
}
</style>