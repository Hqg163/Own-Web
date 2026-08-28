<!-- src/views/PersonalInfo.vue -->
<template>
  <!-- 关键修改：添加 themeClass 到根元素 -->
  <div :class="themeClass" class="info-content">
    <h2 class="content-title">个人信息</h2>

    <form @submit.prevent="savePersonalInfo" class="info-form">
      <!-- 用户名 -->
      <div class="form-group">
        <label class="form-label" for="profile-username">
          用户名
          <span class="required">*</span>
        </label>
        <input
          id="profile-username"
          type="text"
          v-model="userInfo.username"
          :disabled="!isEditing"
          :class="{ 'editable': isEditing }"
          required
        />
      </div>

      <!-- 邮箱 -->
      <div class="form-group">
        <label class="form-label" for="profile-email">
          账号（邮箱）
          <span class="required">*</span>
        </label>
        <input
          id="profile-email"
          type="email"
          v-model="userInfo.email"
          readonly
          aria-describedby="profile-email-help"
          required
        />
        <small id="profile-email-help" class="field-hint">邮箱目前不可在站内修改。</small>
      </div>

      <!-- 密码 -->
      <div class="form-group password-group">
        <div class="password-header">
          <label class="form-label" for="profile-password">
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
            id="profile-password"
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
            :aria-label="passwordVisible ? '隐藏新密码' : '显示新密码'"
            @click="passwordVisible = !passwordVisible"
          >
            <AppIcon :name="passwordVisible ? 'eye-off' : 'eye'" :size="18" />
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
        <label id="profile-birthday-label" class="form-label">生日</label>
        <div
          id="profile-birthday"
          role="button"
          :tabindex="isEditing ? 0 : -1"
          :aria-disabled="!isEditing"
          aria-labelledby="profile-birthday-label"
          class="date-display"
          :class="{ 'editable': isEditing, 'disabled': !isEditing, 'active': showDatePicker }"
          @click="isEditing && toggleDatePicker()"
          @keydown.enter.prevent="isEditing && toggleDatePicker()"
          @keydown.space.prevent="isEditing && toggleDatePicker()"
          @keydown.esc.prevent="closeDatePicker"
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
            <AppIcon name="calendar" :size="18" />
          </button>
        </div>

        <transition name="datepicker-pop">
          <div v-if="showDatePicker" ref="datePicker" class="datepicker-dropdown" role="dialog" aria-label="选择生日" tabindex="-1" @keydown.esc.prevent="closeDatePicker" v-click-outside="closeDatePicker">
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
        <label class="form-label" for="profile-hobbies">爱好</label>
        <input
          id="profile-hobbies"
          type="text"
          v-model="userInfo.hobbies"
          :disabled="!isEditing"
          :class="{ 'editable': isEditing }"
          placeholder="请输入您的爱好"
        />
      </div>

      <!-- 职业 -->
      <div class="form-group">
        <label class="form-label" for="profile-occupation">职业</label>
        <select
          id="profile-occupation"
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
        <label class="form-label" for="profile-notes">备注</label>
        <textarea
          id="profile-notes"
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

      <div v-if="saveStatus" class="save-status" :class="saveStatus.type" role="status">
        <AppIcon class="status-icon" :name="statusIcon" :size="18" />
        <span class="status-message">{{ saveStatus.message }}</span>
      </div>
    </form>

    <section class="blog-profile-panel" aria-labelledby="blog-profile-title">
      <div class="blog-profile-heading">
        <div><p class="panel-eyebrow">公开资料</p><h3 id="blog-profile-title">个人博客主页</h3><p>这些资料仅用于公开个人主页；将主页设为私密后，访客无法访问。</p></div>
        <a v-if="blogProfile.blogSlug && blogProfile.profileVisibility === 'public'" class="profile-preview-link" :href="`/u/${blogProfile.blogSlug}`" target="_blank" rel="noreferrer">预览主页<AppIcon name="external-link" :size="16" /></a>
      </div>
      <p v-if="blogMessage" class="blog-message" :class="blogMessage.type" role="status">{{ blogMessage.text }}</p>
      <div class="avatar-editor">
        <img v-if="avatarUrl" :src="avatarUrl" alt="当前头像" @error="avatarUrl = ''" />
        <span v-else class="avatar-fallback" aria-hidden="true">{{ (userInfo.username || '用').slice(0, 1) }}</span>
        <div><strong>头像</strong><p>支持 PNG、JPEG、WebP 或 GIF，最大 5MB。</p><label class="avatar-upload-button" for="profile-avatar"><AppIcon name="upload" :size="16" />{{ avatarUploading ? '上传中…' : '更新头像' }}</label><input id="profile-avatar" type="file" accept="image/png,image/jpeg,image/webp,image/gif" :disabled="avatarUploading" @change="uploadAvatar" /></div>
      </div>
      <div class="blog-form-grid">
        <div class="form-group"><label class="form-label" for="personal-blog-title">博客标题</label><input id="personal-blog-title" v-model.trim="blogProfile.blogTitle" maxlength="120" placeholder="例如：我的写作空间" /></div>
        <div class="form-group"><label class="form-label" for="personal-blog-slug">公开主页标识</label><div class="personal-slug"><span>/u/</span><input id="personal-blog-slug" v-model.trim="blogProfile.blogSlug" maxlength="50" pattern="[a-z0-9-]+" /></div><small class="field-hint">3–50 位小写字母、数字或连字符。</small></div>
        <div class="form-group blog-wide"><label class="form-label" for="personal-blog-bio">简介</label><textarea id="personal-blog-bio" v-model="blogProfile.bio" maxlength="1000" rows="4" placeholder="介绍你自己或正在创作的内容。"></textarea></div>
        <div class="form-group"><label class="form-label" for="personal-profile-visibility">主页可见性</label><select id="personal-profile-visibility" v-model="blogProfile.profileVisibility"><option value="public">公开</option><option value="private">私密</option></select></div>
      </div>
      <fieldset class="social-links"><legend>社交链接（可选）</legend><div class="blog-form-grid"><div class="form-group"><label class="form-label" for="personal-social-website">个人网站</label><input id="personal-social-website" v-model.trim="blogProfile.socialLinks.website" type="url" placeholder="https://example.com" /></div><div class="form-group"><label class="form-label" for="personal-social-github">GitHub</label><input id="personal-social-github" v-model.trim="blogProfile.socialLinks.github" type="url" placeholder="https://github.com/username" /></div><div class="form-group blog-wide"><label class="form-label" for="personal-social-other">其他链接</label><input id="personal-social-other" v-model.trim="blogProfile.socialLinks.other" type="url" placeholder="https://…" /></div></div></fieldset>
      <button type="button" class="save-blog-profile" :disabled="blogSaving" @click="saveBlogProfile">{{ blogSaving ? '保存中…' : '保存博客资料' }}</button>
    </section>

    <!-- 身份验证弹窗 -->
    <transition name="modal">
      <div v-if="showVerifyModal" class="verify-modal-overlay" @click.self="cancelVerify">
        <div class="verify-modal" role="dialog" aria-modal="true" aria-labelledby="verify-password-title" tabindex="-1" @keydown.esc.prevent="cancelVerify">
          <h3 id="verify-password-title">验证身份</h3>
          <p class="verify-desc">请输入当前密码以确认身份</p>

          <div class="verify-input-wrapper">
            <input
              id="verify-current-password"
              :type="verifyPasswordVisible ? 'text' : 'password'"
              v-model="verifyPassword"
              placeholder="请输入当前密码"
              class="verify-input"
              @keyup.enter="confirmPasswordChange"
            />
            <button
              type="button"
              class="eye-icon-btn verify-eye-btn"
              :aria-label="verifyPasswordVisible ? '隐藏当前密码' : '显示当前密码'"
              @click="verifyPasswordVisible = !verifyPasswordVisible"
            >
              <AppIcon :name="verifyPasswordVisible ? 'eye-off' : 'eye'" :size="18" />
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
import AppIcon from '@/components/AppIcon.vue'

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
  components: { AppIcon },
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
      avatarUrl: '',
      avatarUploading: false,
      blogSaving: false,
      blogMessage: null,
      blogProfile: {
        blogTitle: '',
        blogSlug: '',
        bio: '',
        profileVisibility: 'public',
        socialLinks: { website: '', github: '', other: '' }
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
    },
    statusIcon() {
      if (this.saveStatus?.type === 'success') return 'check'
      if (this.saveStatus?.type === 'error') return 'close'
      return 'info'
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
    document.addEventListener('keydown', this.handleEscape)
  },
  beforeUnmount() {
    if (this.themeHandler) window.removeEventListener('theme-changed', this.themeHandler)
    document.removeEventListener('keydown', this.handleEscape)
  },
  methods: {
    // 关键修改：添加主题监听方法
    setupThemeListener() {
      this.themeHandler = (e) => {
        this.themeClass = e.detail.theme === 'dark' ? 'dark-mode' : 'light-mode'
      }
      window.addEventListener('theme-changed', this.themeHandler)
    },
    handleEscape(event) {
      if (event.key !== 'Escape') return
      if (this.showVerifyModal) {
        this.cancelVerify()
        return
      }
      if (this.showDatePicker) this.closeDatePicker()
    },
    async loadUserInfo() {
      try {
        const response = await axios.get('/api/me')
        this.userInfo = response.data.user
        this.userInfo.password = '********'
        this.originalUserInfo = { ...this.userInfo }
        this.avatarUrl = response.data.user.avatar_url || ''
        this.loadBlogProfile()
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
      this.saveStatus = { type, message }
      setTimeout(() => this.saveStatus = null, 3000)
    },
    normalizeSocialLinks(value) {
      let links = value
      if (typeof links === 'string') {
        try { links = JSON.parse(links) } catch (_) { links = {} }
      }
      return { website: String(links?.website || ''), github: String(links?.github || ''), other: String(links?.other || '') }
    },
    async loadBlogProfile() {
      try {
        const response = await axios.get('/api/me/blog-profile')
        const profile = response.data.profile || {}
        this.blogProfile = {
          blogTitle: profile.blog_title || '',
          blogSlug: profile.blog_slug || '',
          bio: profile.bio || '',
          profileVisibility: profile.profile_visibility || 'public',
          socialLinks: this.normalizeSocialLinks(profile.social_links)
        }
        this.avatarUrl = profile.avatar_url || this.avatarUrl
      } catch (error) {
        this.blogMessage = { type: 'error', text: '无法载入博客资料。' }
      }
    },
    async uploadAvatar(event) {
      const file = event.target?.files?.[0]
      if (!file) return
      if (file.size > 5 * 1024 * 1024) { this.blogMessage = { type: 'error', text: '头像不能超过 5MB。' }; return }
      this.avatarUploading = true
      this.blogMessage = null
      try {
        const form = new FormData()
        form.set('avatar', file)
        const response = await axios.post('/api/me/avatar', form)
        this.avatarUrl = response.data.avatarUrl || ''
        window.dispatchEvent(new CustomEvent('profile-avatar-updated', { detail: { avatarUrl: this.avatarUrl } }))
        this.blogMessage = { type: 'success', text: '头像已更新。' }
      } catch (error) {
        this.blogMessage = { type: 'error', text: error.response?.data?.error?.message || '头像上传失败。' }
      } finally {
        this.avatarUploading = false
        event.target.value = ''
      }
    },
    async saveBlogProfile() {
      this.blogSaving = true
      this.blogMessage = null
      try {
        await axios.put('/api/me/blog-profile', this.blogProfile)
        this.blogMessage = { type: 'success', text: '博客资料已保存。' }
      } catch (error) {
        this.blogMessage = { type: 'error', text: error.response?.data?.error?.message || '保存失败，请检查主页标识和链接。' }
      } finally {
        this.blogSaving = false
      }
    },

    // 日期选择器方法
    toggleDatePicker() {
      this.showDatePicker = !this.showDatePicker
      if (this.showDatePicker) this.$nextTick(() => this.$refs.datePicker?.focus())
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
      this.$nextTick(() => document.getElementById('verify-current-password')?.focus())
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
        setTimeout(async () => {
          await axios.post('/api/logout').catch(() => {})
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
.light-mode, .dark-mode { color: var(--text); }

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
  color: var(--text);
  font-size: 24px;
  padding-bottom: 15px;
  border-bottom: 2px solid var(--border);
}

/* ==================== 右侧内容区 ==================== */
.content-area {
  flex: 1;
  min-width: 0;
  background: var(--surface);
  border-radius: 12px;
  padding: 30px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  border: 1px solid var(--border);
  transition: background-color 0.3s, border-color 0.3s;
  min-height: 600px;
}

.content-title {
  margin-top: 0;
  margin-bottom: 30px;
  color: var(--text);
  font-size: 24px;
  padding-bottom: 15px;
  border-bottom: 2px solid var(--border);
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
  color: var(--text);
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
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 15px;
  transition: all 0.3s;
  background: var(--surface-raised);
  color: var(--text);
}

.info-form input:disabled,
.info-form select:disabled,
.info-form textarea:disabled {
  background: var(--bg);
  color: var(--subtle);
  cursor: not-allowed;
}

.info-form input.editable:not(:disabled),
.info-form select.editable:not(:disabled),
.info-form textarea.editable:not(:disabled) {
  background: var(--surface-raised);
  border-color: var(--accent);
}

.info-form input:focus:not(:disabled),
.info-form select:focus:not(:disabled),
.info-form textarea:focus:not(:disabled) {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

/* 日期选择器样式 */
.date-form-group {
  position: relative;
}

.date-display {
  width: 100%;
  padding: 12px 15px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 15px;
  background: var(--surface-raised);
  color: var(--text);
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  transition: all 0.3s;
  position: relative;
}

.date-display.disabled {
  background: var(--bg);
  color: var(--subtle);
  cursor: not-allowed;
}

.date-display.editable {
  cursor: pointer;
}

.date-display.editable:hover {
  border-color: var(--accent);
}

.date-display.active {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.date-display .placeholder {
  color: var(--muted);
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
  background: var(--surface);
  border: 1px solid var(--border);
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
  background: var(--surface-raised);
  padding: 16px 20px;
  text-align: center;
  border-bottom: 1px solid var(--border);
}

.header-label {
  font-size: 12px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 4px;
}

.header-date {
  font-size: 20px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 2px;
}

.header-weekday {
  font-size: 14px;
  color: var(--muted);
}

.datepicker-body {
  padding: 12px;
  position: relative;
}

.wheel-container {
  display: flex;
  height: 180px;
  position: relative;
  background: var(--surface-raised);
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
  color: var(--muted);
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
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
  color: var(--text);
  scroll-snap-align: center;
  scroll-snap-stop: always;
  opacity: 0.5;
  transition: all 0.2s;
  line-height: 36px;
}

.wheel-item.active {
  color: var(--accent);
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
  border-top: 2px solid var(--accent);
  border-bottom: 2px solid var(--accent);
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
  border-top: 1px solid var(--border);
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
  color: var(--muted);
}

.btn-text:hover {
  background: var(--accent-soft);
  color: var(--text);
}

.btn-today {
  color: var(--accent);
  font-weight: 500;
}

.btn-today:hover {
  background: var(--accent-soft);
}

.btn-cancel {
  color: var(--muted);
}

.btn-confirm {
  background: var(--accent) !important;
  color: white !important;
  font-weight: 600;
}

.btn-confirm:hover {
  background: var(--accent-strong) !important;
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
  background: var(--surface-raised);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.3s;
}

.password-toggle:hover:not(:disabled) {
  background: var(--accent-soft);
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
  color: var(--muted);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
  z-index: 2;
}

.eye-icon-btn:hover {
  color: var(--text);
  background: rgba(128, 128, 128, 0.1);
}

.password-hint {
  font-size: 12px;
  color: var(--muted);
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
  background: var(--accent);
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
  border-top: 1px solid var(--border);
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
  background: var(--accent);
  color: var(--surface);
}

.btn-modify:hover:not(:disabled) {
  background: var(--accent-strong);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.btn-modify:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-cancel {
  background: var(--surface-raised);
  color: var(--muted);
  opacity: 0.6;
}

.btn-cancel.enabled {
  opacity: 1;
  background: var(--danger);
  color: var(--surface);
}

.btn-cancel.enabled:hover {
  background: var(--danger);
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
  background: var(--accent-soft);
  color: var(--accent);
  border: 1px solid var(--accent);
}

.save-status.error {
  background: var(--surface-raised);
  color: var(--danger);
  border: 1px solid var(--danger);
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
}

.verify-modal {
  background: var(--surface);
  border: 1px solid var(--border);
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
  color: var(--muted);
  opacity: 0.8;
}

.verify-input-wrapper {
  position: relative;
  margin-bottom: 20px;
}

.verify-input {
  width: 100%;
  padding: 10px 40px 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 15px;
  background: var(--surface-raised);
  color: var(--text);
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
  background: var(--surface-raised);
  color: var(--muted);
}

.btn-verify-cancel:hover {
  background: var(--accent-soft);
}

.btn-verify-confirm {
  background: var(--accent);
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
  color: var(--text);
  margin-bottom: 20px;
}

.placeholder-content p {
  color: var(--muted);
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

/* 个人资料沿用工作台令牌；旧日期和密码流程保留，只统一呈现。 */
.info-content,
.info-content.light-mode,
.info-content.dark-mode {
  --border: var(--border);
  --surface-raised: var(--surface-raised);
  --bg: var(--surface-raised);
  --surface-raised: var(--surface-raised);
  --accent: var(--accent);
  --accent: var(--accent);
  --accent-soft: color-mix(in srgb, var(--accent), transparent 70%);
  --text: var(--text);
  --muted: var(--muted);
  --subtle: var(--subtle);
  --muted: var(--muted);
  --border: var(--border);
  --border: var(--border);
  --accent: var(--accent);
  --accent-strong: var(--accent-strong);
  --surface-raised: var(--surface-raised);
  --text: var(--text);
  --border: var(--border);
  --accent-soft: var(--accent-soft);
  --surface: var(--surface);
  --border: var(--border);
  padding: 0;
  background: transparent;
  color: var(--text);
}
.info-content .content-title { margin: 0 0 var(--space-5); padding: 0; border: 0; color: var(--text); font-size: 1.55rem; letter-spacing: -.025em; }
.info-content .info-form,
.blog-profile-panel { box-sizing: border-box; width: 100%; margin: 0; padding: var(--space-5); border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); box-shadow: none; }
.info-content .info-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-4); }
.info-content .form-group { min-width: 0; margin: 0; }.info-content .password-group, .info-content .date-form-group, .info-content .form-actions, .info-content .save-status { grid-column: 1 / -1; }
.info-content .form-label { margin: 0 0 6px; color: var(--text); font-size: .9rem; font-weight: 650; }.info-content .field-hint { display: block; margin-top: 5px; color: var(--muted); font-size: .78rem; }.info-content .info-form input, .info-content .info-form select, .info-content .info-form textarea, .blog-profile-panel input, .blog-profile-panel select, .blog-profile-panel textarea { box-sizing: border-box; width: 100%; min-height: 42px; padding: 9px 11px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); color: var(--text); font: inherit; }.info-content .info-form input:disabled, .info-content .info-form input[readonly] { opacity: 1; background: var(--bg); color: var(--muted); cursor: default; }.info-content .info-form input:focus, .info-content .info-form select:focus, .info-content .info-form textarea:focus, .blog-profile-panel input:focus, .blog-profile-panel select:focus, .blog-profile-panel textarea:focus { border-color: var(--accent); outline: 3px solid color-mix(in srgb, var(--accent), transparent 70%); outline-offset: 1px; box-shadow: none; }.info-content .date-display { min-height: 42px; border-color: var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); color: var(--text); }.info-content .calendar-icon { display: grid; place-items: center; background: transparent; color: var(--accent); }.info-content .datepicker-dropdown { border-color: var(--border); border-radius: var(--radius); background: var(--surface); box-shadow: var(--shadow); }.info-content .datepicker-header, .info-content .datepicker-footer { border-color: var(--border); background: var(--surface-raised); }.info-content .wheel-scroll { background: var(--surface-raised); }.info-content .wheel-item { color: var(--muted); }.info-content .wheel-item.active { color: var(--accent); }.info-content .btn-modify, .save-blog-profile, .info-content .btn-verify-confirm { border-color: var(--accent); background: var(--accent); color: #fff; box-shadow: none; }.info-content .btn-modify:hover:not(:disabled), .save-blog-profile:hover:not(:disabled), .info-content .btn-verify-confirm:hover { background: var(--accent-strong); transform: none; box-shadow: none; }.info-content .btn-cancel, .info-content .btn-complete-password, .info-content .password-toggle, .info-content .btn-verify-cancel { border-color: var(--border); background: var(--surface-raised); color: var(--text); box-shadow: none; }.info-content .btn-cancel:hover:not(:disabled), .info-content .btn-complete-password:hover, .info-content .password-toggle:hover, .info-content .btn-verify-cancel:hover { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }.info-content .form-actions { display: flex; justify-content: flex-end; gap: var(--space-2); margin: 0; padding: var(--space-4) 0 0; border-top: 1px solid var(--border); }.info-content .save-status { display: flex; align-items: center; gap: var(--space-2); margin: 0; padding: var(--space-3); border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); color: var(--text); }.info-content .save-status.success { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }.info-content .save-status.error { border-color: var(--danger); background: color-mix(in srgb, var(--danger), transparent 92%); color: var(--danger); }.info-content .verify-modal-overlay { background: rgb(20 25 23 / 56%); }.info-content .verify-modal { border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); color: var(--text); box-shadow: var(--shadow); }.info-content .verify-modal h3 { color: var(--text); }
.blog-profile-panel { display: grid; gap: var(--space-5); margin-top: var(--space-5); }.blog-profile-heading { display: flex; justify-content: space-between; gap: var(--space-4); }.panel-eyebrow { margin: 0 0 var(--space-1); color: var(--accent); font-size: .8rem; font-weight: 750; letter-spacing: .07em; }.blog-profile-heading h3 { margin: 0; color: var(--text); font-size: 1.1rem; }.blog-profile-heading p:last-child { max-width: 58ch; margin: var(--space-2) 0 0; color: var(--muted); font-size: .9rem; line-height: 1.65; }.profile-preview-link { display: inline-flex; align-items: center; align-self: start; gap: 6px; color: var(--accent); font-size: .9rem; white-space: nowrap; text-underline-offset: 3px; }.blog-message { margin: 0; padding: var(--space-3); border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); color: var(--text); }.blog-message.success { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }.blog-message.error { border-color: var(--danger); background: color-mix(in srgb, var(--danger), transparent 92%); color: var(--danger); }.avatar-editor { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3); border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); }.avatar-editor img, .avatar-fallback { display: grid; flex: none; width: 58px; height: 58px; place-items: center; overflow: hidden; border: 1px solid var(--border); border-radius: 50%; background: var(--accent-soft); color: var(--accent); font-size: 1.15rem; font-weight: 750; object-fit: cover; }.avatar-editor strong { color: var(--text); }.avatar-editor p { margin: 4px 0 var(--space-2); color: var(--muted); font-size: .82rem; }.avatar-editor input[type='file'] { position: absolute; width: 1px; height: 1px; overflow: hidden; opacity: 0; }.avatar-upload-button, .save-blog-profile { display: inline-flex; align-items: center; justify-content: center; gap: var(--space-2); min-height: 36px; padding: 0 var(--space-3); border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); color: var(--text); cursor: pointer; font-size: .88rem; font-weight: 650; }.avatar-upload-button:hover { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }.blog-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-4); }.blog-wide { grid-column: 1 / -1; }.personal-slug { display: flex; align-items: center; overflow: hidden; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); }.personal-slug span { padding-left: 11px; color: var(--muted); }.personal-slug input { border: 0; outline: 0; }.personal-slug:focus-within { border-color: var(--accent); outline: 3px solid color-mix(in srgb, var(--accent), transparent 70%); outline-offset: 1px; }.social-links { margin: 0; padding: var(--space-4); border: 1px solid var(--border); border-radius: var(--radius-sm); }.social-links legend { padding: 0 var(--space-1); color: var(--text); font-size: .9rem; font-weight: 650; }.save-blog-profile { justify-self: end; border-color: var(--accent); background: var(--accent); color: #fff; }.info-content button:focus-visible, .blog-profile-panel input:focus-visible, .blog-profile-panel select:focus-visible, .blog-profile-panel textarea:focus-visible { outline: 3px solid color-mix(in srgb, var(--accent), transparent 68%); outline-offset: 2px; }
@media (max-width: 720px) { .info-content .info-form, .blog-form-grid { grid-template-columns: 1fr; }.info-content .form-group, .blog-wide { grid-column: auto; }.blog-profile-heading { align-items: flex-start; flex-direction: column; }.profile-preview-link { align-self: auto; }.info-content .info-form, .blog-profile-panel { padding: var(--space-4); }.avatar-editor { align-items: flex-start; }.info-content .form-actions { justify-content: stretch; }.info-content .form-actions button { flex: 1; } }
</style>
