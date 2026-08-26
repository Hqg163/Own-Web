<!-- src/views/PersonalInfo.vue -->
<template>
  <!-- 关键修改：添加 themeClass 到根元素 -->
  <div :class="themeClass" class="info-content">
    <h2 class="content-title">个人信息</h2>
      
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
      
      <!-- 邮箱 -->
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
          >
            {{ isEditingPassword ? '取消修改' : '修改密码' }}
          </button>
        </div>
        
        <div class="password-input-wrapper">
          <input 
            :type="passwordVisible ? 'text' : 'password'"
            v-model="userInfo.password"
            :disabled="!isEditingPassword"
            :class="{ 'editable': isEditingPassword }"
            placeholder="********"
            required
          />
          <button 
            v-if="isEditingPassword"
            type="button" 
            class="eye-icon-btn"
            @click="passwordVisible = !passwordVisible"
          >
            <svg v-if="!passwordVisible" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
              <line x1="1" y1="1" x2="23" y2="23"></line>
            </svg>
            <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          </button>
        </div>

        <div v-if="isEditingPassword" class="password-hint">
          密码修改后需要重新登录
        </div>
        
        <div v-if="isEditingPassword" class="password-actions">
          <button 
            type="button" 
            class="btn-complete-password"
            @click="preparePasswordChange"
          >
            完成修改
          </button>
        </div>
      </div>

      <!-- 生日选择器 -->
      <div class="form-group date-form-group" ref="dateFormGroup">
        <label class="form-label">生日</label>
        <div 
          class="date-display" 
          :class="{ 'editable': isEditing, 'disabled': !isEditing, 'active': showDatePicker }"
          @click="isEditing && toggleDatePicker()"
        >
          <span :class="{ 'placeholder': !userInfo.birthday }">
            {{ displayBirthday }}
          </span>
          <button 
            type="button" 
            class="calendar-icon"
            :disabled="!isEditing"
            @click.stop="isEditing && toggleDatePicker()"
          >
            📅
          </button>
        </div>
        
        <transition name="datepicker-pop">
          <div v-if="showDatePicker" class="datepicker-dropdown" v-click-outside="closeDatePicker">
            <div class="datepicker-header">
              <div class="header-label">选择日期</div>
              <div class="header-date">{{ fullFormattedDate }}</div>
              <div class="header-weekday">{{ selectedWeekday }}</div>
            </div>
            
            <div class="datepicker-body">
              <div class="wheel-container">
                <div class="wheel-column">
                  <div class="wheel-title">年</div>
                  <div class="wheel-scroll" ref="yearScroll" @scroll.passive="handleYearScroll">
                    <div 
                      v-for="(year, index) in yearList" 
                      :key="year"
                      :class="['wheel-item', { active: scrollSelectedYear === year }]"
                    >
                      {{ year }}
                    </div>
                  </div>
                </div>
                
                <div class="wheel-column">
                  <div class="wheel-title">月</div>
                  <div class="wheel-scroll" ref="monthScroll" @scroll.passive="handleMonthScroll">
                    <div 
                      v-for="month in 12" 
                      :key="month"
                      :class="['wheel-item', { active: scrollSelectedMonth === month }]"
                    >
                      {{ month }}月
                    </div>
                  </div>
                </div>
                
                <div class="wheel-column">
                  <div class="wheel-title">日</div>
                  <div class="wheel-scroll" ref="dayScroll" @scroll.passive="handleDayScroll">
                    <div 
                      v-for="day in daysInMonth" 
                      :key="day"
                      :class="['wheel-item', { active: scrollSelectedDay === day }]"
                    >
                      {{ day }}日
                    </div>
                  </div>
                </div>
                
                <div class="wheel-highlight"></div>
              </div>
            </div>
            
            <div class="datepicker-footer">
              <button type="button" class="btn-text btn-today" @click="selectToday">
                今天
              </button>
              <div class="footer-actions">
                <button type="button" class="btn-text btn-cancel" @click="closeDatePicker">
                  取消
                </button>
                <button type="button" class="btn-text btn-confirm" @click="confirmDate">
                  确定
                </button>
              </div>
            </div>
          </div>
        </transition>
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
      
      <div v-if="saveStatus" class="save-status" :class="saveStatus.type">
        <span class="status-icon">{{ saveStatus.icon }}</span>
        <span class="status-message">{{ saveStatus.message }}</span>
      </div>
    </form>

    <!-- 身份验证弹窗 -->
    <transition name="modal">
      <div v-if="showVerifyModal" class="verify-modal-overlay" @click.self="cancelVerify">
        <div class="verify-modal">
          <h3>验证身份</h3>
          <p class="verify-desc">请输入当前密码以确认身份</p>
          
          <div class="verify-input-wrapper">
            <input 
              :type="verifyPasswordVisible ? 'text' : 'password'"
              v-model="verifyPassword"
              placeholder="请输入当前密码"
              class="verify-input"
              @keyup.enter="confirmPasswordChange"
            />
            <button 
              type="button" 
              class="eye-icon-btn verify-eye-btn"
              @click="verifyPasswordVisible = !verifyPasswordVisible"
            >
              <svg v-if="!verifyPasswordVisible" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
              </svg>
              <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
          </div>
          
          <div class="verify-actions">
            <button class="btn-verify-cancel" @click="cancelVerify">取消</button>
            <button class="btn-verify-confirm" @click="confirmPasswordChange">确认</button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
import axios from '@/services/http'

const clickOutside = {
  mounted(el, binding) {
    el._clickOutside = (event) => {
      if (!(el === event.target || el.contains(event.target))) {
        binding.value()
      }
    }
    document.addEventListener('click', el._clickOutside, true)
  },
  unmounted(el) {
    document.removeEventListener('click', el._clickOutside, true)
  }
}

const ITEM_HEIGHT = 36

export default {
  name: 'PersonalInfo',
  directives: { 'click-outside': clickOutside },
  data() {
    return {
      // 关键修改：添加 themeClass
      themeClass: localStorage.getItem('theme') === 'dark' ? 'dark-mode' : 'light-mode',
      isEditing: false,
      isEditingPassword: false,
      showDatePicker: false,
      saveStatus: null,
      selectedYear: new Date().getFullYear(),
      selectedMonth: new Date().getMonth() + 1,
      selectedDay: new Date().getDate(),
      scrollSelectedYear: new Date().getFullYear(),
      scrollSelectedMonth: new Date().getMonth() + 1,
      scrollSelectedDay: new Date().getDate(),
      isScrolling: false,
      passwordVisible: false,
      verifyPasswordVisible: false,
      showVerifyModal: false,
      verifyPassword: '',
      pendingPassword: '',
      userInfo: {
        username: '',
        email: '',
        password: '********',
        birthday: '',
        hobbies: '',
        occupation: '',
        notes: ''
      },
      originalUserInfo: {},
      themeHandler: null
    }
  },
  computed: {
    displayBirthday() {
      if (!this.userInfo.birthday) return '请选择日期'
      if (typeof this.userInfo.birthday === 'string') {
        return this.userInfo.birthday.split('T')[0]
      }
      if (this.userInfo.birthday instanceof Date) {
        const y = this.userInfo.birthday.getFullYear()
        const m = String(this.userInfo.birthday.getMonth() + 1).padStart(2, '0')
        const d = String(this.userInfo.birthday.getDate()).padStart(2, '0')
        return `${y}-${m}-${d}`
      }
      return this.userInfo.birthday
    },
    yearList() {
      const current = new Date().getFullYear()
      const years = []
      for (let i = current; i >= 1900; i--) years.push(i)
      return years
    },
    daysInMonth() {
      return new Date(this.scrollSelectedYear, this.scrollSelectedMonth, 0).getDate()
    },
    fullFormattedDate() {
      const y = this.scrollSelectedYear
      const m = String(this.scrollSelectedMonth).padStart(2, '0')
      const d = String(this.scrollSelectedDay).padStart(2, '0')
      return `${y}年${m}月${d}日`
    },
    selectedWeekday() {
      const date = new Date(this.scrollSelectedYear, this.scrollSelectedMonth - 1, this.scrollSelectedDay)
      const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
      return weekdays[date.getDay()]
    }
  },
  watch: {
    showDatePicker(newVal) {
      if (newVal) {
        let y, m, d
        if (this.userInfo.birthday) {
          let date
          if (typeof this.userInfo.birthday === 'string') {
            date = new Date(this.userInfo.birthday.split('T')[0])
          } else if (this.userInfo.birthday instanceof Date) {
            date = this.userInfo.birthday
          } else {
            date = new Date()
          }
          y = date.getFullYear()
          m = date.getMonth() + 1
          d = date.getDate()
        } else {
          const today = new Date()
          y = today.getFullYear()
          m = today.getMonth() + 1
          d = today.getDate()
        }
        this.scrollSelectedYear = y
        this.scrollSelectedMonth = m
        this.scrollSelectedDay = d
        this.selectedYear = y
        this.selectedMonth = m
        this.selectedDay = d
        this.$nextTick(() => this.scrollToSelected())
      }
    }
  },
  created() {
    this.loadUserInfo()
    // 关键修改：添加主题监听器
    this.setupThemeListener()
  },
  beforeUnmount() {
    if (this.themeHandler) window.removeEventListener('theme-changed', this.themeHandler)
  },
  methods: {
    // 关键修改：添加主题监听方法
    setupThemeListener() {
      this.themeHandler = (e) => {
        this.themeClass = e.detail.theme === 'dark' ? 'dark-mode' : 'light-mode'
      }
      window.addEventListener('theme-changed', this.themeHandler)
    },
    async loadUserInfo() {
      try {
        const response = await axios.get('/api/me')
        this.userInfo = response.data.user
        this.userInfo.password = '********'
        this.originalUserInfo = { ...this.userInfo }
      } catch (error) {
        console.error('加载用户信息失败:', error)
        if (error.response?.status === 401) this.$router.push('/login')
      }
    },
    toggleEdit() {
      if (!this.isEditing) {
        this.isEditing = true
        this.originalUserInfo = { ...this.userInfo }
      } else {
        this.savePersonalInfo()
      }
    },
    togglePasswordEdit() {
      if (!this.isEditingPassword) {
        this.isEditingPassword = true
        if (this.userInfo.password === '********') this.userInfo.password = ''
      } else {
        this.cancelPasswordEdit()
      }
    },
    cancelPasswordEdit() {
      this.isEditingPassword = false
      this.userInfo.password = '********'
    },
    cancelEdit() {
      this.userInfo = { ...this.originalUserInfo }
      this.isEditing = false
      this.isEditingPassword = false
      this.saveStatus = null
      this.closeDatePicker()
    },
    async savePersonalInfo() {
      try {
        if (this.isEditingPassword) {
          this.showSaveStatus('warning', '请先完成或取消密码修改')
          return
        }
        if (!this.userInfo.username || !this.userInfo.email) {
          this.showSaveStatus('error', '用户名和账号不能为空')
          return
        }
        const userId = localStorage.getItem('userId')
        await axios.put(`/api/user/${userId}`, {
          username: this.userInfo.username,
          birthday: this.userInfo.birthday,
          hobbies: this.userInfo.hobbies,
          occupation: this.userInfo.occupation,
          notes: this.userInfo.notes
        })
        this.showSaveStatus('success', '个人信息保存成功')
        this.originalUserInfo = { ...this.userInfo }
        this.isEditing = false
      } catch (error) {
        console.error('保存失败:', error)
        this.showSaveStatus('error', error.response?.data?.error || '保存失败')
      }
    },
    showSaveStatus(type, message) {
      const icons = { success: '✅', error: '❌', warning: '⚠️' }
      this.saveStatus = { type, icon: icons[type], message }
      setTimeout(() => this.saveStatus = null, 3000)
    },
    
    // 日期选择器方法
    toggleDatePicker() {
      this.showDatePicker = !this.showDatePicker
    },
    closeDatePicker() {
      this.showDatePicker = false
    },
    calculateIndexFromScroll(st) {
      return Math.round(st / ITEM_HEIGHT)
    },
    handleYearScroll(e) {
      if (this.isScrolling) return
      this.isScrolling = true
      requestAnimationFrame(() => {
        const i = this.calculateIndexFromScroll(e.target.scrollTop)
        if (i >= 0 && i < this.yearList.length) {
          this.scrollSelectedYear = this.yearList[i]
        }
        this.isScrolling = false
      })
    },
    handleMonthScroll(e) {
      if (this.isScrolling) return
      this.isScrolling = true
      requestAnimationFrame(() => {
        const i = this.calculateIndexFromScroll(e.target.scrollTop)
        if (i >= 0 && i < 12) this.scrollSelectedMonth = i + 1
        this.isScrolling = false
      })
    },
    handleDayScroll(e) {
      if (this.isScrolling) return
      this.isScrolling = true
      requestAnimationFrame(() => {
        const i = this.calculateIndexFromScroll(e.target.scrollTop)
        if (i >= 0 && i < this.daysInMonth) this.scrollSelectedDay = i + 1
        this.isScrolling = false
      })
    },
    scrollToSelected() {
      this.scrollToYear(this.scrollSelectedYear)
      this.scrollToMonth(this.scrollSelectedMonth)
      this.scrollToDay(this.scrollSelectedDay)
    },
    scrollToYear(y) {
      const el = this.$refs.yearScroll
      if (!el) return
      const i = this.yearList.indexOf(y)
      if (i !== -1) el.scrollTo({ top: i * ITEM_HEIGHT, behavior: 'auto' })
    },
    scrollToMonth(m) {
      const el = this.$refs.monthScroll
      if (!el) return
      el.scrollTo({ top: (m - 1) * ITEM_HEIGHT, behavior: 'auto' })
    },
    scrollToDay(d) {
      const el = this.$refs.dayScroll
      if (!el) return
      el.scrollTo({ top: (d - 1) * ITEM_HEIGHT, behavior: 'auto' })
    },
    selectToday() {
      const t = new Date()
      this.scrollSelectedYear = t.getFullYear()
      this.scrollSelectedMonth = t.getMonth() + 1
      this.scrollSelectedDay = t.getDate()
      this.selectedYear = this.scrollSelectedYear
      this.selectedMonth = this.scrollSelectedMonth
      this.selectedDay = this.scrollSelectedDay
      this.scrollToSelected()
      this.confirmDate()
    },
    confirmDate() {
      this.selectedYear = this.scrollSelectedYear
      this.selectedMonth = this.scrollSelectedMonth
      this.selectedDay = this.scrollSelectedDay
      const m = String(this.selectedMonth).padStart(2, '0')
      const d = String(this.selectedDay).padStart(2, '0')
      this.userInfo.birthday = `${this.selectedYear}-${m}-${d}`
      this.closeDatePicker()
    },
    
    // 密码修改
    preparePasswordChange() {
      if (!this.userInfo.password) {
        this.showSaveStatus('error', '密码不能为空')
        return
      }
      if (this.userInfo.password.length < 6) {
        this.showSaveStatus('error', '新密码长度至少6位')
        return
      }
      this.pendingPassword = this.userInfo.password
      this.verifyPassword = ''
      this.verifyPasswordVisible = false
      this.showVerifyModal = true
    },
    cancelVerify() {
      this.showVerifyModal = false
      this.verifyPassword = ''
      this.pendingPassword = ''
    },
    async confirmPasswordChange() {
      if (!this.verifyPassword) {
        this.showSaveStatus('error', '请输入当前密码')
        return
      }
      try {
        const userId = localStorage.getItem('userId')
        await axios.put(`/api/user/${userId}/password`, {
          oldPassword: this.verifyPassword,
          newPassword: this.pendingPassword
        })
        this.showVerifyModal = false
        this.showSaveStatus('success', '密码修改成功，请重新登录')
        this.isEditingPassword = false
        this.userInfo.password = '********'
        setTimeout(() => {
          localStorage.removeItem('isLoggedIn')
          localStorage.removeItem('userId')
          localStorage.removeItem('userEmail')
          localStorage.removeItem('userInfo')
          this.$router.push('/login')
        }, 2000)
      } catch (error) {
        this.showSaveStatus('error', error.response?.data?.error || '修改失败')
      }
    }
  }
}
</script>

<style scoped>
/* 关键修改：添加 light-mode 和 dark-mode 的 CSS 变量定义 */
.light-mode {
  --input-border: #d1d5db;
  --input-bg: #ffffff;
  --input-disabled-bg: #f3f4f6;
  --input-editable-bg: #ffffff;
  --input-editable-border: #3b82f6;
  --input-focus-border: #3b82f6;
  --input-focus-shadow: rgba(59, 130, 246, 0.1);
  --text-primary: #1f2937;
  --text-secondary: #6b7280;
  --text-disabled: #9ca3af;
  --text-muted: #6b7280;
  --title-border: #e5e7eb;
  --actions-border: #e5e7eb;
  --btn-primary-bg: #3b82f6;
  --btn-primary-text: #ffffff;
  --btn-primary-hover: #2563eb;
  --btn-secondary-bg: #f3f4f6;
  --btn-secondary-text: #4b5563;
  --btn-secondary-border: #d1d5db;
  --btn-secondary-hover: #e5e7eb;
  --btn-cancel-bg: #f3f4f6;
  --btn-cancel-text: #6b7280;
  --btn-cancel-enabled-bg: #ef4444;
  --btn-cancel-enabled-text: #ffffff;
  --btn-cancel-enabled-hover: #dc2626;
  --option-hover: #f3f4f6;
  --status-success-bg: #d1fae5;
  --status-success-text: #065f46;
  --status-success-border: #a7f3d0;
  --status-error-bg: #fee2e2;
  --status-error-text: #991b1b;
  --status-error-border: #fecaca;
  --datepicker-bg: #ffffff;
  --datepicker-border: #e5e7eb;
  --datepicker-header-bg: #f9fafb;
  --datepicker-wheel-bg: #f3f4f6;
  --datepicker-wheel-text: #4b5563;
  --datepicker-wheel-active: #3b82f6;
  --datepicker-highlight: rgba(59, 130, 246, 0.1);
  --content-bg: #ffffff;
  --content-border: #e5e7eb;
}

.dark-mode {
  --input-border: #4b5563;
  --input-bg: #374151;
  --input-disabled-bg: #1f2937;
  --input-editable-bg: #4b5563;
  --input-editable-border: #60a5fa;
  --input-focus-border: #60a5fa;
  --input-focus-shadow: rgba(96, 165, 250, 0.2);
  --text-primary: #f9fafb;
  --text-secondary: #d1d5db;
  --text-disabled: #6b7280;
  --text-muted: #9ca3af;
  --title-border: #374151;
  --actions-border: #374151;
  --btn-primary-bg: #3b82f6;
  --btn-primary-text: #ffffff;
  --btn-primary-hover: #2563eb;
  --btn-secondary-bg: #374151;
  --btn-secondary-text: #d1d5db;
  --btn-secondary-border: #4b5563;
  --btn-secondary-hover: #4b5563;
  --btn-cancel-bg: #374151;
  --btn-cancel-text: #9ca3af;
  --btn-cancel-enabled-bg: #dc2626;
  --btn-cancel-enabled-text: #ffffff;
  --btn-cancel-enabled-hover: #b91c1c;
  --option-hover: #374151;
  --status-success-bg: #064e3b;
  --status-success-text: #6ee7b7;
  --status-success-border: #059669;
  --status-error-bg: #7f1d1d;
  --status-error-text: #fca5a5;
  --status-error-border: #dc2626;
  --datepicker-bg: #1f2937;
  --datepicker-border: #374151;
  --datepicker-header-bg: #111827;
  --datepicker-wheel-bg: #111827;
  --datepicker-wheel-text: #d1d5db;
  --datepicker-wheel-active: #60a5fa;
  --datepicker-highlight: rgba(96, 165, 250, 0.2);
  --content-bg: #1f2937;
  --content-border: #374151;
}

.info-content {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.content-title {
  margin-top: 0;
  margin-bottom: 30px;
  color: var(--text-primary);
  font-size: 24px;
  padding-bottom: 15px;
  border-bottom: 2px solid var(--title-border);
}

/* ==================== 右侧内容区 ==================== */
.content-area {
  flex: 1;
  min-width: 0;
  background: var(--content-bg);
  border-radius: 12px;
  padding: 30px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  border: 1px solid var(--content-border);
  transition: background-color 0.3s, border-color 0.3s;
  min-height: 600px;
}

.content-title {
  margin-top: 0;
  margin-bottom: 30px;
  color: var(--text-primary);
  font-size: 24px;
  padding-bottom: 15px;
  border-bottom: 2px solid var(--title-border);
}

/* ==================== 个人信息表单 ==================== */
.info-form {
  max-width: 100%;
  width: 100%;
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

/* 日期选择器样式 */
.date-form-group {
  position: relative;
}

.date-display {
  width: 100%;
  padding: 12px 15px;
  border: 1px solid var(--input-border);
  border-radius: 8px;
  font-size: 15px;
  background: var(--input-bg);
  color: var(--text-primary);
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  transition: all 0.3s;
  position: relative;
}

.date-display.disabled {
  background: var(--input-disabled-bg);
  color: var(--text-disabled);
  cursor: not-allowed;
}

.date-display.editable {
  cursor: pointer;
}

.date-display.editable:hover {
  border-color: var(--input-focus-border);
}

.date-display.active {
  border-color: var(--input-focus-border);
  box-shadow: 0 0 0 3px var(--input-focus-shadow);
}

.date-display .placeholder {
  color: var(--text-secondary);
  opacity: 0.6;
}

.calendar-icon {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  opacity: 0.7;
  padding: 0;
  margin-left: 8px;
  transition: opacity 0.3s;
}

.calendar-icon:hover:not(:disabled) {
  opacity: 1;
}

.calendar-icon:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* 日期选择器下拉 */
.datepicker-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  width: 320px;
  background: var(--datepicker-bg);
  border: 1px solid var(--datepicker-border);
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  z-index: 100;
  overflow: hidden;
  animation: datepickerIn 0.2s ease;
}

@keyframes datepickerIn {
  from {
    opacity: 0;
    transform: translateY(-10px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.datepicker-header {
  background: var(--datepicker-header-bg);
  padding: 16px 20px;
  text-align: center;
  border-bottom: 1px solid var(--datepicker-border);
}

.header-label {
  font-size: 12px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 4px;
}

.header-date {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.header-weekday {
  font-size: 14px;
  color: var(--text-muted);
}

.datepicker-body {
  padding: 12px;
  position: relative;
}

.wheel-container {
  display: flex;
  height: 180px;
  position: relative;
  background: var(--datepicker-wheel-bg);
  border-radius: 8px;
  overflow: hidden;
}

.wheel-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  height: 100%;
}

.wheel-title {
  text-align: center;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  padding: 6px 0;
  border-bottom: 1px solid var(--datepicker-border);
  background: rgba(128, 128, 128, 0.05);
  flex-shrink: 0;
  height: 28px;
  box-sizing: border-box;
  z-index: 3;
}

.wheel-scroll {
  flex: 1;
  overflow-y: auto;
  scroll-snap-type: y mandatory;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
  padding: 58px 0;
  scroll-padding-top: 58px;
  scroll-padding-bottom: 58px;
  box-sizing: border-box;
  position: relative;
}

.wheel-scroll::-webkit-scrollbar { display: none; }
.wheel-scroll { -ms-overflow-style: none; scrollbar-width: none; }

.wheel-item {
  height: 36px;
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  color: var(--datepicker-wheel-text);
  scroll-snap-align: center;
  scroll-snap-stop: always;
  opacity: 0.5;
  transition: all 0.2s;
  line-height: 36px;
}

.wheel-item.active {
  color: var(--datepicker-wheel-active);
  font-weight: 700;
  opacity: 1;
  background: transparent;
  box-shadow: none;
  border-radius: 0;
  width: 100%;
  margin: 0;
  transform: none;
}

.wheel-highlight {
  position: absolute;
  top: 86px;
  left: 0;
  right: 0;
  height: 36px;
  background: transparent;
  border-top: 2px solid var(--datepicker-wheel-active);
  border-bottom: 2px solid var(--datepicker-wheel-active);
  pointer-events: none;
  z-index: 1;
  opacity: 0.6;
  box-sizing: border-box;
}

.datepicker-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-top: 1px solid var(--datepicker-border);
  background: rgba(128, 128, 128, 0.03);
}

.footer-actions {
  display: flex;
  gap: 8px;
}

.btn-text {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s;
  background: transparent;
  color: var(--text-secondary);
}

.btn-text:hover {
  background: var(--option-hover);
  color: var(--text-primary);
}

.btn-today {
  color: var(--btn-primary-bg);
  font-weight: 500;
}

.btn-today:hover {
  background: var(--datepicker-highlight);
}

.btn-cancel {
  color: var(--text-secondary);
}

.btn-confirm {
  background: var(--btn-primary-bg) !important;
  color: white !important;
  font-weight: 600;
}

.btn-confirm:hover {
  background: var(--btn-primary-hover) !important;
  filter: brightness(1.1);
}

/* 密码区域 */
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

.password-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.password-input-wrapper input {
  width: 100%;
  padding-right: 40px;
}

.eye-icon-btn {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
  z-index: 2;
}

.eye-icon-btn:hover {
  color: var(--text-primary);
  background: rgba(128, 128, 128, 0.1);
}

.password-hint {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 5px;
}

.password-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

.btn-complete-password {
  padding: 6px 14px;
  font-size: 13px;
  background: linear-gradient(to right, #3b82f6, #60a5fa);
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 1px 3px rgba(59, 130, 246, 0.2);
}

.btn-complete-password:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(59, 130, 246, 0.3);
  filter: brightness(1.1);
}

/* 表单操作按钮 */
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

.status-icon {
  font-size: 18px;
}

.status-message {
  font-weight: 500;
}

/* 验证弹窗 */
.verify-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.verify-modal {
  background: var(--content-bg);
  border: 1px solid var(--content-border);
  border-radius: 12px;
  padding: 24px;
  width: 90%;
  max-width: 360px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
}

.dark-mode .verify-modal {
  background: #1f2937;
  border-color: #374151;
  color: #e2e8f0;
}

.verify-modal h3 {
  margin: 0 0 8px 0;
  font-size: 18px;
  color: inherit;
}

.verify-desc {
  margin: 0 0 16px 0;
  font-size: 14px;
  color: var(--text-secondary);
  opacity: 0.8;
}

.verify-input-wrapper {
  position: relative;
  margin-bottom: 20px;
}

.verify-input {
  width: 100%;
  padding: 10px 40px 10px 12px;
  border: 1px solid var(--input-border);
  border-radius: 8px;
  font-size: 15px;
  background: var(--input-bg);
  color: var(--text-primary);
  transition: all 0.3s;
}

.verify-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.verify-eye-btn {
  right: 8px;
}

.verify-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.btn-verify-cancel,
.btn-verify-confirm {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
  border: none;
}

.btn-verify-cancel {
  background: var(--btn-secondary-bg);
  color: var(--text-secondary);
}

.btn-verify-cancel:hover {
  background: var(--btn-secondary-hover);
}

.btn-verify-confirm {
  background: linear-gradient(to right, #3b82f6, #60a5fa);
  color: white;
}

.btn-verify-confirm:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

/* ==================== 学习区容器 ==================== */
.study-content-wrapper {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Placeholder内容 */
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

/* 动画 */
.datepicker-pop-enter-active,
.datepicker-pop-leave-active {
  transition: all 0.2s ease;
}

.datepicker-pop-enter-from,
.datepicker-pop-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.95);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

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

/* ==================== 响应式设计 ==================== */
@media (max-width: 1024px) {
  .personal-content {
    flex-direction: column;
  }
  
  .options-sidebar {
    flex: none;
    width: 100%;
  }
}

@media (max-width: 768px) {
  .content-area {
    padding: 20px;
  }
}

@media (max-width: 480px) {
  .content-area {
    padding: 15px;
  }
}
</style>
