<template>
  <div :class="themeClass" class="personal-center">
    
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
        
        <!-- ==================== 个人信息 ==================== -->
        <div v-if="activeOption === 'personal-info'" class="info-content">
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

        <!-- ==================== 学习区（新增） ==================== -->
        <div v-else-if="activeOption === 'study'" class="study-content-wrapper">
          <h2 class="content-title">学习区</h2>
          
          <div class="study-layout">
            <!-- 头部：分类标签 + 搜索 + 邮件 -->
            <div class="study-header-bar">
              <div class="category-tabs-wrapper">
                <button 
                  v-for="cat in studyCategories" 
                  :key="cat.id"
                  :class="['study-category-btn', { active: currentStudyCategory === cat.id }]"
                  @click="switchStudyCategory(cat.id)"
                >
                  {{ cat.name }}
                </button>
              </div>
              
              <div class="study-header-actions">
                <div class="study-search-box">
                  <input 
                    type="text" 
                    v-model="studySearchQuery" 
                    placeholder="搜索文件..." 
                    @keyup.enter="handleStudySearch"
                    @input="handleSearchInput"
                  />
                  <button 
                    class="search-icon-btn" 
                    @click="handleStudySearch"
                    :class="{ 'searching': isSearching }"
                  >
                    {{ isSearching ? '🔍' : '🔍' }}
                  </button>
                  <button 
                    v-if="studySearchQuery" 
                    class="clear-search-btn"
                    @click="clearSearch"
                  >
                    ✕
                  </button>
                </div>
                
                <div class="study-email-btns">
                  <button class="email-action-btn send-btn" @click="showSendEmail = true">
                    📧 发送邮件
                  </button>
                  <button class="email-action-btn inbox-btn" @click="showInbox = true">
                    📥 收件箱
                    <span v-if="unreadEmailCount > 0" class="email-badge">{{ unreadEmailCount }}</span>
                  </button>
                  <!-- 新增通知按钮 -->
                  <button class="email-action-btn notification-btn" @click="showNotificationPanel = true">
                    🔔 通知
                    <span v-if="unreadNotificationCount > 0" class="email-badge">{{ unreadNotificationCount }}</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- 工具栏 -->
            <div class="study-toolbar">
              <div class="toolbar-left-group">
                <button class="study-tool-btn upload-download-btn" @click="showUploadDialog = true">
                  ⬆️⬇️ 上传/下载
                </button>
                <button class="study-tool-btn edit-md-btn" @click="openMarkdownEditor">
                  ✏️ 编辑
                </button>
              </div>
              
              <div class="toolbar-right-group">
                <button 
                  v-if="currentStudyCategory === 'all'" 
                  class="study-tool-btn add-category-btn"
                  @click="showAddCategoryDialog = true"
                >
                  ➕ 添加分类
                </button>
                
                <template v-if="currentStudyCategory !== 'all'">
                  <button 
                    v-if="!isBatchDeleteMode" 
                    class="study-tool-btn batch-delete-btn" 
                    :disabled="currentStudyFiles.length === 0"
                    @click="startBatchDelete"
                  >
                    🗑️ 批量删除
                  </button>
                  <template v-else>
                    <button 
                      class="study-tool-btn confirm-delete-btn" 
                      :disabled="selectedStudyFiles.length === 0"
                      @click="confirmBatchDelete"
                    >
                      ⚠️ 确认删除
                    </button>
                    <button class="study-tool-btn cancel-btn" @click="cancelBatchDelete">
                      取消
                    </button>
                  </template>
                </template>
              </div>
            </div>

            <!-- 文件展示区 -->
            <div class="study-files-container">
              <!-- 所有分类视图 -->
              <template v-if="currentStudyCategory === 'all'">
                <div 
                  v-for="cat in studyCategories.filter(c => c.id !== 'all')" 
                  :key="cat.id" 
                  class="study-category-block"
                >
                  <h4 class="study-cat-title">{{ cat.name }}</h4>
                  <div class="study-files-grid" v-if="studyFilesByCategory[cat.id] && studyFilesByCategory[cat.id].length > 0">
                    <div 
                      v-for="file in studyFilesByCategory[cat.id]" 
                      :key="file.id"
                      class="study-file-card"
                      @click="openStudyFile(file)"
                    >
                      <div class="study-file-icon" :class="getStudyFileIconClass(file.file_type)">
                        {{ getStudyFileIcon(file.file_type) }}
                      </div>
                      <div class="study-file-name" :title="getDisplayFileName(file)">
                        <span v-html="getHighlightedFileName(file)"></span>
                      </div>
                      <div class="study-file-meta">{{ formatStudyDate(file.created_at) }}</div>
                    </div>
                  </div>
                  <div v-else class="study-empty-block">
                    <span class="empty-icon">📭</span>
                    <span>此类别现在空空如也哟~~</span>
                  </div>
                </div>
              </template>
              
              <!-- 单个分类视图 -->
              <template v-else>
                <div class="study-files-grid" v-if="currentStudyFiles.length > 0">
                  <div 
                    v-for="file in currentStudyFiles" 
                    :key="file.id"
                    class="study-file-card"
                    :class="{ 'selectable': isBatchDeleteMode, 'selected': selectedStudyFiles.includes(file.id) }"
                    @click="isBatchDeleteMode ? toggleStudyFileSelection(file.id) : openStudyFile(file)"
                  >
                    <div v-if="isBatchDeleteMode" class="selection-indicator">
                      <span v-if="selectedStudyFiles.includes(file.id)">✓</span>
                    </div>
                    
                    <div class="study-file-icon" :class="getStudyFileIconClass(file.file_type)">
                      {{ getStudyFileIcon(file.file_type) }}
                    </div>
                    <div class="study-file-name" :title="getDisplayFileName(file)">
                      <span v-html="getHighlightedFileName(file)"></span>
                    </div>
                    <div class="study-file-meta">{{ formatStudyDate(file.created_at) }}</div>
                  </div>
                </div>
                <div v-else class="study-empty-block main-empty">
                  <span class="empty-icon">📭</span>
                  <span>此类别现在空空如也哟~~</span>
                </div>
              </template>
            </div>
          </div>
        </div>
        
        <!-- 娱乐区 -->
        <div v-else-if="activeOption === 'entertainment'" class="placeholder-content">
          <h2>娱乐区</h2>
          <p>正在开发中...</p>
        </div>
      </div>
    </div>

    <!-- 学习区弹窗组件 -->
    
    <!-- 上传/下载选择 -->
    <div v-if="showUploadDialog" class="modal-overlay" @click.self="showUploadDialog = false">
      <div class="modal-content">
        <h3>选择操作</h3>
        <div class="choice-buttons">
          <button class="choice-card upload-card" @click="switchToUploadMode">
            <span class="choice-icon">⬆️</span>
            <span>上传文件</span>
          </button>
          <button class="choice-card download-card" @click="switchToDownloadMode">
            <span class="choice-icon">⬇️</span>
            <span>下载文件</span>
          </button>
        </div>
        <button class="modal-close-btn" @click="showUploadDialog = false">取消</button>
      </div>
    </div>

    <!-- 上传文件弹窗 -->
    <div v-if="showUploadForm" class="modal-overlay" @click.self="cancelUpload">
      <div class="modal-content">
        <h3>上传文件</h3>
        <div class="modal-form-group">
          <label>文件名称（可选）</label>
          <input type="text" v-model="uploadFormData.customName" placeholder="输入自定义名称" />
        </div>
        <div class="modal-form-group">
          <label>选择分类</label>
          <select v-model="uploadFormData.categoryId">
            <option v-for="cat in studyCategories.filter(c => c.id !== 'all')" :key="cat.id" :value="cat.id">
              {{ cat.name }}
            </option>
          </select>
        </div>
        <div class="modal-form-group">
          <label>选择文件</label>
          <input type="file" @change="handleFileSelect" class="file-input" />
          <div v-if="uploadFormData.selectedFile" class="selected-file-info">
            已选择: {{ uploadFormData.selectedFile.name }}
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" @click="cancelUpload">取消</button>
          <button class="btn-primary" :disabled="!uploadFormData.selectedFile || uploadingFile" @click="confirmUpload">
            {{ uploadingFile ? '上传中...' : '确认上传' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 下载文件弹窗 -->
    <div v-if="showDownloadForm" class="modal-overlay" @click.self="cancelDownload">
      <div class="modal-content download-modal">
        <h3>选择要下载的文件</h3>
        <div class="download-tree-view">
          <div class="tree-root" @click="toggleAllDownloadExpansion">
            <span class="tree-toggle-icon">{{ allDownloadExpanded ? '▼' : '▶' }}</span>
            <span class="tree-icon">📁</span>
            <span>所有</span>
          </div>
          <div v-show="allDownloadExpanded" class="tree-children">
            <div v-for="cat in studyCategories.filter(c => c.id !== 'all')" :key="cat.id" class="tree-category-item">
              <div class="tree-category-header" @click="toggleDownloadCategory(cat.id)">
                <span class="tree-toggle-icon">{{ expandedDownloadCats.includes(cat.id) ? '▼' : '▶' }}</span>
                <span class="tree-icon">📂</span>
                <span>{{ cat.name }}</span>
              </div>
              <div v-show="expandedDownloadCats.includes(cat.id)" class="tree-files">
                <div 
                  v-for="file in studyFilesByCategory[cat.id] || []" 
                  :key="file.id"
                  class="tree-file-row"
                  :class="{ selected: selectedDownloadFiles.includes(file.id) }"
                  @click="selectDownloadFile(file.id)"
                >
                  <span class="tree-file-icon">{{ getStudyFileIcon(file.file_type) }}</span>
                  <span class="tree-file-name">{{ getDisplayFileName(file) }}</span>
                  <span v-if="selectedDownloadFiles.includes(file.id)" class="selected-check">✓</span>
                </div>
                <div v-if="!studyFilesByCategory[cat.id] || studyFilesByCategory[cat.id].length === 0" class="tree-empty">
                  暂无文件
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" @click="cancelDownload">取消</button>
          <button class="btn-primary" :disabled="selectedDownloadFiles.length === 0" @click="confirmDownload">
            下载到本地
          </button>
        </div>
      </div>
    </div>

    <!-- 添加分类弹窗 -->
    <div v-if="showAddCategoryDialog" class="modal-overlay" @click.self="showAddCategoryDialog = false">
      <div class="modal-content">
        <h3>添加新分类</h3>
        <div class="modal-form-group">
          <label>分类名称</label>
          <input 
            type="text" 
            v-model="newStudyCategoryName" 
            placeholder="输入分类名称"
            @keyup.enter="confirmAddCategory"
          />
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" @click="showAddCategoryDialog = false">取消</button>
          <button class="btn-primary" :disabled="!newStudyCategoryName.trim()" @click="confirmAddCategory">
            确定
          </button>
        </div>
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <div v-if="showDeleteConfirmDialog" class="modal-overlay" @click.self="showDeleteConfirmDialog = false">
      <div class="modal-content">
        <h3>确认删除</h3>
        <p>你确定要删除这 {{ selectedStudyFiles.length }} 个文件吗？</p>
        <div class="modal-actions">
          <button class="btn-secondary" @click="showDeleteConfirmDialog = false">取消</button>
          <button class="btn-danger" :disabled="deletingFiles" @click="executeBatchDelete">
            {{ deletingFiles ? '删除中...' : '确认' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Markdown编辑器 -->
    <div v-if="showMarkdownEditor" class="fullscreen-modal">
      <div class="fullscreen-header">
        <button class="back-btn" @click="closeMarkdownEditor">
          <span>←</span> 返回
        </button>
        <h3>Markdown编辑器</h3>
        <div class="header-actions">
          <button class="btn-secondary" @click="closeMarkdownEditor">取消编辑</button>
          <button class="btn-primary" @click="showPublishMarkdownDialog = true">发布</button>
        </div>
      </div>
      
      <div class="md-toolbar">
        <button @click="insertMdSyntax('**', '**')" title="粗体"><b>B</b></button>
        <button @click="insertMdSyntax('*', '*')" title="斜体"><i>I</i></button>
        <button @click="insertMdSyntax('# ')">H1</button>
        <button @click="insertMdSyntax('## ')">H2</button>
        <button @click="insertMdSyntax('- ')">• 列表</button>
        <button @click="insertMdSyntax('> ')">引用</button>
        <button @click="insertMdSyntax('```\n', '\n```')">代码块</button>
        <button @click="insertMdSyntax('[', '](url)')">链接</button>
        <button @click="insertMdSyntax('![alt](', ')')">图片</button>
      </div>
      
      <div class="md-editor-body">
        <textarea 
          ref="mdTextarea"
          v-model="markdownContent" 
          placeholder="开始编写 Markdown..."
          class="md-input"
        ></textarea>
        <div class="md-preview" v-html="renderedMarkdown"></div>
      </div>
    </div>

    <!-- 发布Markdown弹窗 -->
    <div v-if="showPublishMarkdownDialog" class="modal-overlay" @click.self="showPublishMarkdownDialog = false">
      <div class="modal-content">
        <h3>发布文章</h3>
        <div class="modal-form-group">
          <label>标题</label>
          <input type="text" v-model="publishMdForm.title" placeholder="输入标题" />
        </div>
        <div class="modal-form-group">
          <label>选择分类</label>
          <select v-model="publishMdForm.categoryId">
            <option v-for="cat in studyCategories.filter(c => c.id !== 'all')" :key="cat.id" :value="cat.id">
              {{ cat.name }}
            </option>
          </select>
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" @click="showPublishMarkdownDialog = false">取消</button>
          <button class="btn-primary" :disabled="!publishMdForm.title.trim()" @click="confirmPublishMarkdown">
            发布
          </button>
        </div>
      </div>
    </div>

    <!-- 文件预览器 -->
    <div v-if="viewingStudyFile" class="fullscreen-modal file-viewer" @click.self="closeFileViewer">
      <div class="fullscreen-header">
        <button class="back-btn" @click="closeFileViewer">
          <span>←</span> 返回
        </button>
        <span class="viewer-filename">{{ viewingStudyFile.original_name }}</span>
        <div class="viewer-nav-btns">
          <button :disabled="!hasPrevStudyFile" @click="prevStudyFile">← 上一个</button>
          <button :disabled="!hasNextStudyFile" @click="nextStudyFile">下一个 →</button>
        </div>
      </div>
      
      <div class="viewer-content-area">
        <!-- 图片预览 -->
        <img 
          v-if="isImageType(viewingStudyFile.file_type)" 
          :src="studyFileContent.url" 
          class="preview-img"
          @error="handleImageError"
        />
        
        <!-- 视频预览 -->
        <video 
          v-else-if="isVideoType(viewingStudyFile.file_type)" 
          controls 
          class="preview-video"
          :type="getVideoMimeType(viewingStudyFile.file_type)"
        >
          <source :src="studyFileContent.url" />
          您的浏览器不支持视频播放
        </video>
        
        <!-- 音频预览 -->
        <audio 
          v-else-if="isAudioType(viewingStudyFile.file_type)" 
          controls 
          class="preview-audio"
        >
          <source :src="studyFileContent.url" :type="getAudioMimeType(viewingStudyFile.file_type)" />
          您的浏览器不支持音频播放
        </audio>
        
        <!-- PDF预览（修复） -->
        <!-- 修改 PDF 预览部分 -->
        <div v-else-if="isPdfType(viewingStudyFile.file_type)" class="preview-pdf-container">
          <!-- 使用 embed 替代 iframe，兼容性更好 -->
          <embed 
            :src="studyFileContent.url" 
            type="application/pdf"
            width="100%" 
            height="100%"
            style="border: none;"
          />
        </div>
        
        <!-- Office文档提示（新增） -->
        <div v-else-if="isOfficeType(viewingStudyFile.file_type)" class="preview-unsupported office-preview">
          <div class="big-file-icon">📊</div>
          <h3>Office 文档</h3>
          <p>浏览器无法直接预览 {{ viewingStudyFile.file_type.toUpperCase() }} 格式文件</p>
          <p class="sub-hint">建议下载后使用相应软件打开</p>
          <button class="btn-primary" @click="downloadCurrentStudyFile">📥 下载到本地</button>
        </div>
        
        <!-- 文本/Markdown预览 -->
        <div v-else-if="studyFileContent.type === 'text' || studyFileContent.type === 'markdown'" class="preview-text-content">
          <pre v-if="studyFileContent.type === 'text'">{{ studyFileContent.content }}</pre>
          <div v-else v-html="renderedFileMarkdown" class="markdown-body"></div>
        </div>
        
        <!-- 其他不支持的格式 -->
        <div v-else class="preview-unsupported">
          <div class="big-file-icon">📄</div>
          <h3>无法预览此格式</h3>
          <p>当前不方便预览 {{ viewingStudyFile.file_type.toUpperCase() }} 格式文件</p>
          <button class="btn-primary" @click="downloadCurrentStudyFile">📥 下载到本地查看</button>
        </div>
      </div>
    </div>

    <!-- 发送邮件 -->
    <div v-if="showSendEmail" class="fullscreen-modal">
      <div class="fullscreen-header">
        <button class="back-btn" @click="closeSendEmail">
          <span>←</span> 返回
        </button>
        <h3>发送邮件</h3>
        <button class="btn-primary" :disabled="!emailForm.recipient || !emailForm.subject" @click="sendEmail">
          确认发送
        </button>
      </div>
      
      <div class="email-compose-form">
        <div class="compose-row">
          <label>收件人：</label>
          <input type="email" v-model="emailForm.recipient" placeholder="recipient@example.com" />
        </div>
        <div class="compose-row">
          <label>主题：</label>
          <input type="text" v-model="emailForm.subject" placeholder="邮件主题" />
        </div>
        <div class="compose-row">
          <label>内容：</label>
          <textarea v-model="emailForm.content" placeholder="邮件内容..." rows="12"></textarea>
        </div>
        <div class="compose-row attachments-section">
          <label>附件：</label>
          <div class="attachments-list">
            <div v-for="(att, idx) in emailForm.attachments" :key="idx" class="attachment-tag-item">
              <span>{{ att.name }}</span>
              <button class="remove-attachment" @click="removeEmailAttachment(idx)">×</button>
            </div>
            <button class="add-att-btn" @click="showAttOptions = !showAttOptions">➕ 添加附件</button>
            <div v-if="showAttOptions" class="att-options-menu">
              <button @click="addLocalAttachment">本地上传</button>
              <button @click="openInternalFileSelector">站内选择</button>
            </div>
          </div>
        </div>
        <input type="file" ref="emailFileInput" style="display: none" @change="handleEmailFileSelect" />
      </div>
    </div>

    <!-- 站内文件选择器 -->
    <div v-if="showInternalSelector" class="modal-overlay" @click.self="closeInternalSelector">
      <div class="modal-content internal-selector-modal">
        <h3>选择站内文件</h3>
        <div class="internal-file-tree">
          <div v-for="cat in studyCategories.filter(c => c.id !== 'all')" :key="cat.id" class="selector-cat">
            <div class="selector-cat-name">{{ cat.name }}</div>
            <div class="selector-file-list">
              <div 
                v-for="file in studyFilesByCategory[cat.id] || []" 
                :key="file.id"
                class="selector-file-row"
                @click="selectInternalFileForEmail(file)"
              >
                <span>{{ getStudyFileIcon(file.file_type) }}</span>
                <span>{{ file.original_name }}</span>
              </div>
            </div>
          </div>
        </div>
        <button class="btn-secondary" @click="closeInternalSelector">关闭</button>
      </div>
    </div>

    <!-- 收件箱 -->
    <div v-if="showInbox" class="fullscreen-modal">
      <div class="fullscreen-header">
        <button class="back-btn" @click="closeInbox">
          <span>←</span> 返回
        </button>
        <h3>收件箱</h3>
        <div class="inbox-filter-tabs">
          <button 
            v-for="filter in ['all', 'unread', 'read']" 
            :key="filter"
            :class="['filter-tab', { active: emailFilter === filter }]"
            @click="emailFilter = filter"
          >
            {{ filter === 'all' ? '全部' : filter === 'unread' ? '未读' : '已读' }}
          </button>
        </div>
      </div>
      
      <div class="inbox-content">
        <div v-if="!viewingEmail" class="email-list-view">
          <div 
            v-for="email in filteredEmails" 
            :key="email.id"
            class="email-row"
            :class="{ unread: !email.is_read }"
            @click="viewEmail(email)"
          >
            <div class="email-row-main">
              <span class="email-sender-name">{{ email.sender_name || email.sender_email }}</span>
              <span class="email-subject-line">{{ email.subject }}</span>
              <span v-if="!email.is_read" class="unread-indicator"></span>
            </div>
            <div class="email-row-meta">
              <span v-if="email.has_attachments" class="has-attachment-icon">📎</span>
              <span class="email-time">{{ formatEmailTime(email.created_at) }}</span>
            </div>
          </div>
          <div v-if="filteredEmails.length === 0" class="empty-inbox-msg">
            <p>暂无邮件</p>
          </div>
        </div>
        
        <div v-else class="email-detail-view">
          <!-- 返回按钮 -->
          <div class="email-detail-nav">
            <button @click="viewingEmail = null">
              ← 返回邮件列表
            </button>
            <div class="nav-spacer"></div>
            <button :disabled="!hasPrevEmail" @click="prevEmail">← 上一封</button>
            <button :disabled="!hasNextEmail" @click="nextEmail">下一封 →</button>
          </div>
          
          <div class="email-detail-content">
            <h2>{{ viewingEmail.subject }}</h2>
            <div class="email-meta-info">
              <div><strong>发件人：</strong>{{ viewingEmail.sender_name || viewingEmail.sender_email }} &lt;{{ viewingEmail.sender_email }}&gt;</div>
              <div><strong>收件人：</strong>{{ viewingEmail.recipient_email }}</div>
              <div><strong>时间：</strong>{{ formatEmailTime(viewingEmail.created_at) }}</div>
            </div>
            
            <!-- 邮件正文 -->
            <div class="email-body-text" v-html="formatEmailContent(viewingEmail.content)"></div>
            
            <!-- 附件部分 - 使用更稳定的条件判断 -->
            <div v-if="emailHasAttachments" class="email-attachments-section">
              <h4>附件（{{ attachmentCount }}个）：</h4>
              <div 
                v-for="(att, idx) in viewingEmail.attachments" 
                :key="idx" 
                class="email-att-item"
              >
                <div class="att-info">
                  <span class="att-icon">📎</span>
                  <span class="att-name">{{ att.name || '未命名文件' }}</span>
                  <span v-if="att.type === 'internal'" class="att-type-tag">站内文件</span>
                  <span v-else class="att-type-tag">本地文件</span>
                </div>
                <button class="btn-small btn-download" @click="downloadEmailAttachment(att, idx)">
                  下载
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 通知面板 -->
    <div v-if="showNotificationPanel" class="fullscreen-modal">
      <div class="fullscreen-header">
        <button class="back-btn" @click="showNotificationPanel = false">
          <span>←</span> 返回
        </button>
        <h3>发送通知记录</h3>
        <button 
          v-if="notifications.length > 0" 
          class="btn-secondary" 
          @click="clearAllNotifications"
        >
          清空全部
        </button>
      </div>
      
      <div class="notification-content">
        <div v-if="notifications.length === 0" class="empty-notifications">
          <span class="empty-icon">📭</span>
          <p>暂无发送记录</p>
        </div>
        
        <div v-else class="notification-list">
          <div 
            v-for="notif in notifications" 
            :key="notif.id"
            :class="['notification-item', notif.type, { unread: !notif.read }]"
            @click="markNotificationRead(notif.id)"
          >
            <div class="notification-indicator" :class="notif.type">
              <span v-if="notif.type === 'success'">✓</span>
              <span v-else>✗</span>
            </div>
            
            <div class="notification-body">
              <div class="notification-title">{{ notif.title }}</div>
              <div class="notification-detail">
                <span class="detail-label">收件人：</span>{{ notif.recipientName || notif.recipient }}
              </div>
              <div class="notification-detail">
                <span class="detail-label">主题：</span>{{ notif.subject }}
              </div>
              <div class="notification-message">{{ notif.message }}</div>
              <div class="notification-time">{{ formatEmailTime(notif.time) }}</div>
            </div>
            
            <button class="notification-delete" @click.stop="removeNotification(notif.id)">×</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Toast提示 -->
    <div v-if="studyToast.show" class="study-toast" :class="studyToast.type">
      {{ studyToast.message }}
    </div>
  </div>
</template>


<script>
import NavigationBar from '../NavigationBar.vue'
import axios from 'axios'
import { marked } from 'marked'

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
  name: 'PersonalCenter',
  components: { NavigationBar },
  directives: { 'click-outside': clickOutside },
  data() {
    return {
      themeClass: localStorage.getItem('theme') === 'dark' ? 'dark-mode' : 'light-mode',
      activeOption: 'personal-info',
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
      options: [
        { id: 'personal-info', name: '个人信息', icon: '👤' },
        { id: 'study', name: '学习区', icon: '📚' },
        { id: 'entertainment', name: '娱乐区', icon: '🎮' }
      ],
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
      passwordVisible: false,
      verifyPasswordVisible: false,
      showVerifyModal: false,
      verifyPassword: '',
      pendingPassword: '',
      
      // 学习区数据
      studyCategories: [{ id: 'all', name: '所有' }],
      currentStudyCategory: 'all',
      studyFiles: [],
      studyFilesByCategory: {},
      studySearchQuery: '',
      isSearching: false,  // 添加搜索状态标识
      
      // 上传/下载
      showUploadDialog: false,
      showUploadForm: false,
      showDownloadForm: false,
      uploadFormData: {
        customName: '',
        categoryId: '',
        selectedFile: null
      },
      uploadingFile: false,
      allDownloadExpanded: true,
      expandedDownloadCats: [],
      selectedDownloadFiles: [],
      
      // 批量删除
      isBatchDeleteMode: false,
      selectedStudyFiles: [],
      showDeleteConfirmDialog: false,
      deletingFiles: false,
      
      // 添加分类
      showAddCategoryDialog: false,
      newStudyCategoryName: '',
      
      // Markdown编辑器
      showMarkdownEditor: false,
      markdownContent: '',
      showPublishMarkdownDialog: false,
      publishMdForm: {
        title: '',
        categoryId: ''
      },
      
      // 文件预览
      viewingStudyFile: null,
      studyFileContent: null,
      currentStudyFileIndex: 0,
      
      // 邮件
      showSendEmail: false,
      showInbox: false,
      emailFilter: 'all',
      emails: [],
      viewingEmail: null,
      emailForm: {
        recipient: '',
        subject: '',
        content: '',
        attachments: []
      },
      showAttOptions: false,
      showInternalSelector: false,
      
      // 提示
      studyToast: {
        show: false,
        message: '',
        type: 'success'
      },
      
      // 通知系统
      showNotificationPanel: false,
      notifications: [],
      
      // 邮件发送状态追踪
      emailSendingStatus: null, // 'sending', 'success', 'error'

      userId: null,
      userEmail: null
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
    
    // 学习区计算属性
    // 修改：根据搜索关键词过滤文件列表
    currentStudyFiles() {
      let files = []
      
      // 1. 获取当前分类的文件列表
      if (this.currentStudyCategory === 'all') {
        files = this.studyFiles
      } else {
        files = this.studyFilesByCategory[this.currentStudyCategory] || []
      }
      
      // 2. 如果有搜索关键词，进行过滤（只匹配文件名和后缀）
      const query = this.studySearchQuery.trim().toLowerCase()
      if (!query) {
        return files
      }
      
      // 3. 执行搜索匹配 - 只匹配文件名和后缀
      return files.filter(file => {
        // 获取文件名（带后缀）
        const displayName = this.getDisplayFileName(file).toLowerCase()
        
        // 只匹配文件名（包含后缀）
        return displayName.includes(query)
      })
    },
    renderedMarkdown() {
      return marked(this.markdownContent || '')
    },
    renderedFileMarkdown() {
      if (this.studyFileContent && this.studyFileContent.content) {
        return marked(this.studyFileContent.content)
      }
      return ''
    },
    filteredEmails() {
      if (this.emailFilter === 'all') return this.emails
      if (this.emailFilter === 'unread') return this.emails.filter(e => !e.is_read)
      if (this.emailFilter === 'read') return this.emails.filter(e => e.is_read)
      return this.emails
    },
    unreadEmailCount() {
      return this.emails.filter(e => !e.is_read).length
    },
    // 未读通知数（可选）
    unreadNotificationCount() {
      return this.notifications.filter(n => !n.read).length;
    },
    hasPrevEmail() {
      if (!this.viewingEmail) return false
      const idx = this.filteredEmails.findIndex(e => e.id === this.viewingEmail.id)
      return idx > 0
    },
    hasNextEmail() {
      if (!this.viewingEmail) return false
      const idx = this.filteredEmails.findIndex(e => e.id === this.viewingEmail.id)
      return idx < this.filteredEmails.length - 1 && idx !== -1
    },
    hasPrevStudyFile() {
      return this.currentStudyFileIndex > 0
    },
    hasNextStudyFile() {
      const files = this.currentStudyCategory === 'all' ? this.studyFiles : this.currentStudyFiles
      return this.currentStudyFileIndex < files.length - 1
    },
    // 判断是否有附件
    hasAttachments() {
      if (!this.viewingEmail) return false;
      const atts = this.viewingEmail.attachments;
      return Array.isArray(atts) && atts.length > 0;
    },
    // 修复：确保附件检测正常工作
    emailHasAttachments() {
      if (!this.viewingEmail) return false;
      const atts = this.viewingEmail.attachments;
      return Array.isArray(atts) && atts.length > 0;
    },

    // 修复：附件数量
    attachmentCount() {
      if (!this.viewingEmail || !Array.isArray(this.viewingEmail.attachments)) {
        return 0;
      }
      return this.viewingEmail.attachments.length;
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
    if (!localStorage.getItem('isLoggedIn')) {
      this.$router.push('/login')
      return
    }
    this.userId = localStorage.getItem('userId')
    this.userEmail = localStorage.getItem('userEmail')
    this.loadUserInfo()
    this.loadStudyCategories()
    this.loadStudyFiles()
    this.loadEmails()
    this.loadNotifications() // 添加这行
    this.setupThemeListener()
  },
  beforeUnmount() {
    window.removeEventListener('theme-changed', this.handleThemeChange)
    window.removeEventListener('storage', this.handleStorageChange)
  },
  methods: {
    setupThemeListener() {
      this.handleThemeChange = (e) => {
        this.themeClass = e.detail.theme === 'dark' ? 'dark-mode' : 'light-mode'
      }
      window.addEventListener('theme-changed', this.handleThemeChange)
      this.handleStorageChange = (e) => {
        if (e.key === 'theme') {
          this.themeClass = e.newValue === 'dark' ? 'dark-mode' : 'light-mode'
        }
      }
      window.addEventListener('storage', this.handleStorageChange)
    },
    selectOption(optionId) {
      this.activeOption = optionId
      if (optionId !== 'personal-info') {
        this.isEditing = false
        this.isEditingPassword = false
        this.cancelEdit()
      }
      // 切换选项时重置学习区状态
      if (optionId === 'study') {
        this.isBatchDeleteMode = false
        this.selectedStudyFiles = []
      }
    },
    
    // ==================== 个人信息方法（原有） ====================
    async loadUserInfo() {
      try {
        const userId = localStorage.getItem('userId')
        if (userId) {
          const response = await axios.get(`/api/user/${userId}`)
          this.userInfo = response.data.user
          this.userInfo.password = '********'
          this.originalUserInfo = { ...this.userInfo }
        }
      } catch (error) {
        console.error('加载用户信息失败:', error)
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
    },

    // ==================== 学习区方法 ====================
    async loadStudyCategories() {
      try {
        const res = await axios.get(`/api/categories/${this.userId}`)
        const cats = res.data.categories
        const defaultCats = cats.filter(c => c.is_default).sort((a, b) => a.sort_order - b.sort_order)
        const customCats = cats.filter(c => !c.is_default).sort((a, b) => a.sort_order - b.sort_order)
        this.studyCategories = [
          { id: 'all', name: '所有' },
          ...defaultCats,
          ...customCats
        ]
      } catch (err) {
        this.showStudyToast('加载分类失败', 'error')
      }
    },
    async loadStudyFiles() {
      try {
        const res = await axios.get(`/api/files/${this.userId}`)
        this.studyFiles = res.data.files
        this.studyFilesByCategory = {}
        this.studyCategories.forEach(cat => {
          if (cat.id !== 'all') {
            this.studyFilesByCategory[cat.id] = this.studyFiles.filter(f => f.category_id === cat.id)
          }
        })
      } catch (err) {
        this.showStudyToast('加载文件失败', 'error')
      }
    },
    async loadEmails() {
      try {
        const res = await axios.get(`/api/emails/${this.userEmail}`)
        this.emails = res.data.emails
      } catch (err) {
        console.error('加载邮件失败', err)
      }
    },
    switchStudyCategory(catId) {
      this.currentStudyCategory = catId
      this.isBatchDeleteMode = false
      this.selectedStudyFiles = []
    },
    handleStudySearch() {
      const query = this.studySearchQuery.trim()
      
      if (!query) {
        // 空搜索时重新加载所有文件
        this.loadStudyFiles()
        this.isSearching = false
        return
      }
      
      this.isSearching = true
      
      // 可选：调用后端API进行深度搜索（搜索文件内容）
      // 如果后端支持全文搜索，可以取消注释以下代码
      /*
      axios.get(`/api/files/${this.userId}?search=${encodeURIComponent(query)}`)
        .then(res => {
          // 后端返回的搜索结果
          this.studyFiles = res.data.files
          // 更新分类映射
          this.updateCategoryMap()
        })
        .catch(err => {
          console.error('搜索失败:', err)
          this.showStudyToast('搜索失败', 'error')
        })
      */
      
      // 前端本地搜索已经足够（由计算属性 currentStudyFiles 处理）
      // 这里可以添加一些提示
      const results = this.currentStudyFiles
      if (results.length === 0) {
        this.showStudyToast('没有找到匹配的文件', 'warning')
      } else {
        this.showStudyToast(`找到 ${results.length} 个匹配文件`, 'success')
      }
    },
    
    // 添加：实时搜索（输入时即时过滤）
    handleSearchInput() {
      // 防抖处理
      if (this.searchDebounceTimer) {
        clearTimeout(this.searchDebounceTimer)
      }
      this.searchDebounceTimer = setTimeout(() => {
        if (this.studySearchQuery.trim()) {
          this.isSearching = true
        } else {
          this.isSearching = false
        }
      }, 300)
    },
    
    // 添加：清空搜索
    clearSearch() {
      this.studySearchQuery = ''
      this.isSearching = false
      // this.loadStudyFiles()
    },
    
    // 辅助方法：更新分类映射
    updateCategoryMap() {
      this.studyFilesByCategory = {}
      this.studyCategories.forEach(cat => {
        if (cat.id !== 'all') {
          this.studyFilesByCategory[cat.id] = this.studyFiles.filter(
            f => f.category_id === cat.id
          )
        }
      })
    },
    
    // 高亮匹配文本
    highlightMatch(text, query) {
      if (!query || !text) return text
      
      // 转义正则特殊字符
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      
      // 创建不区分大小写的正则表达式
      const regex = new RegExp(`(${escapedQuery})`, 'gi')
      
      // 替换为高亮标签
      return text.replace(regex, '<mark style="background:#fbbf24;color:#000;padding:0 2px;border-radius:2px;">$1</mark>')
    },
    
    // 转义正则特殊字符
    escapeRegExp(string) {
      return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    },
    
    // 获取显示文件名（带高亮）
    getHighlightedFileName(file) {
      const name = this.getDisplayFileName(file)
      if (!this.studySearchQuery.trim()) return name
      return this.highlightMatch(name, this.studySearchQuery)
    },

    // 添加更多代码文件图标映射（可选，优化显示）
    getStudyFileIcon(ext) {
      const iconMap = {
        '.pdf': '📕', '.doc': '📘', '.docx': '📘', '.txt': '📄',
        '.md': '📝', '.js': '📜', '.html': '🌐', '.css': '🎨',
        '.py': '🐍', '.c': '🔧', '.cpp': '🔧', '.h': '🔧',
        '.java': '☕', '.json': '📋', '.xml': '📋', '.ts': '📘',
        '.vue': '💚', '.php': '🐘', '.go': '🐹', '.rs': '⚙️',
        '.rb': '💎', '.swift': '🦉', '.kt': '🎯', '.sql': '🗃️',
        '.jpg': '🖼️', '.jpeg': '🖼️', '.png': '🖼️', '.gif': '🖼️',
        '.mp4': '🎬', '.avi': '🎬', '.mp3': '🎵', '.wav': '🎵',
        '.zip': '📦', '.rar': '📦', '.ppt': '📽️', '.pptx': '📽️',
        '.xls': '📊', '.xlsx': '📊'
      }
      return iconMap[ext.toLowerCase()] || '📄'
    },
    getStudyFileIconClass(ext) {
      const classMap = {
        '.pdf': 'pdf', '.doc': 'doc', '.docx': 'doc', '.txt': 'text',
        '.md': 'markdown', '.js': 'code', '.html': 'code', '.css': 'code',
        '.py': 'code', '.c': 'code', '.cpp': 'code', '.h': 'code',
        '.jpg': 'image', '.jpeg': 'image', '.png': 'image', '.gif': 'image',
        '.mp4': 'video', '.avi': 'video', '.mp3': 'audio', '.wav': 'audio',
        '.zip': 'archive', '.rar': 'archive'
      }
      return classMap[ext.toLowerCase()] || 'default'
    },
    handleImageError() {
      this.showStudyToast('图片加载失败', 'error');
    },
    // 获取视频MIME类型
    getVideoMimeType(ext) {
      const mimeMap = {
        '.mp4': 'video/mp4',
        '.avi': 'video/x-msvideo',
        '.mov': 'video/quicktime',
        '.wmv': 'video/x-ms-wmv',
        '.flv': 'video/x-flv',
        '.mkv': 'video/x-matroska'
      }
      return mimeMap[ext.toLowerCase()] || 'video/mp4'
    },
    // 获取音频MIME类型
    getAudioMimeType(ext) {
      const mimeMap = {
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.ogg': 'audio/ogg',
        '.flac': 'audio/flac',
        '.aac': 'audio/aac',
        '.wma': 'audio/x-ms-wma'
      }
      return mimeMap[ext.toLowerCase()] || 'audio/mpeg'
    },
    formatStudyDate(dateStr) {
      const date = new Date(dateStr)
      return `${date.getMonth() + 1}/${date.getDate()}`
    },
    formatEmailTime(dateStr) {
      const date = new Date(dateStr)
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    },
    
    // 批量删除
    startBatchDelete() {
      this.isBatchDeleteMode = true
      this.selectedStudyFiles = []
    },
    cancelBatchDelete() {
      this.isBatchDeleteMode = false
      this.selectedStudyFiles = []
    },
    toggleStudyFileSelection(fileId) {
      const idx = this.selectedStudyFiles.indexOf(fileId)
      if (idx > -1) {
        this.selectedStudyFiles.splice(idx, 1)
      } else {
        this.selectedStudyFiles.push(fileId)
      }
    },
    confirmBatchDelete() {
      if (this.selectedStudyFiles.length === 0) return
      this.showDeleteConfirmDialog = true
    },
    async executeBatchDelete() {
      this.deletingFiles = true
      try {
        await axios.delete('/api/files', {
          data: { fileIds: this.selectedStudyFiles, userId: this.userId }
        })
        this.showStudyToast('删除成功')
        this.loadStudyFiles()
        this.showDeleteConfirmDialog = false
        this.isBatchDeleteMode = false
        this.selectedStudyFiles = []
      } catch (err) {
        this.showStudyToast(err.response?.data?.error || '删除失败', 'error')
      } finally {
        this.deletingFiles = false
      }
    },
    
    // 添加分类
    async confirmAddCategory() {
      if (!this.newStudyCategoryName.trim()) return
      try {
        await axios.post('/api/categories', {
          userId: this.userId,
          name: this.newStudyCategoryName.trim()
        })
        this.showStudyToast('分类添加成功')
        this.loadStudyCategories()
        this.showAddCategoryDialog = false
        this.newStudyCategoryName = ''
      } catch (err) {
        this.showStudyToast(err.response?.data?.error || '添加失败', 'error')
      }
    },
    
    // 上传下载
    switchToUploadMode() {
      this.showUploadDialog = false
      this.showUploadForm = true
      if (this.currentStudyCategory !== 'all') {
        this.uploadFormData.categoryId = this.currentStudyCategory
      } else {
        const firstCat = this.studyCategories.find(c => c.id !== 'all')
        this.uploadFormData.categoryId = firstCat ? firstCat.id : ''
      }
    },
    handleFileSelect(event) {
      this.uploadFormData.selectedFile = event.target.files[0]
    },
    cancelUpload() {
      this.showUploadForm = false
      this.uploadFormData = { customName: '', categoryId: '', selectedFile: null }
    },
    async confirmUpload() {
      if (!this.uploadFormData.selectedFile) return
  
      this.uploadingFile = true
      const formData = new FormData()
      formData.append('file', this.uploadFormData.selectedFile)
      formData.append('userId', this.userId)  // 确保这行存在
      formData.append('categoryId', this.uploadFormData.categoryId)
      
      if (this.uploadFormData.customName) {
        formData.append('customName', this.uploadFormData.customName)
      }
      try {
        await axios.post('/api/upload', formData, {
          headers: { 
            'Content-Type': 'multipart/form-data',
            'x-user-id': this.userId  // 添加 header 作为备用
          }
        })
        this.showStudyToast('上传成功')
        this.loadStudyFiles()
        this.cancelUpload()
      } catch (err) {
        this.showStudyToast(err.response?.data?.error || '上传失败', 'error')
      } finally {
        this.uploadingFile = false
      }
    },
    switchToDownloadMode() {
      this.showUploadDialog = false
      this.showDownloadForm = true
      this.selectedDownloadFiles = []
      this.expandedDownloadCats = this.studyCategories.filter(c => c.id !== 'all').map(c => c.id)
      this.allDownloadExpanded = true
    },
    toggleAllDownloadExpansion() {
      this.allDownloadExpanded = !this.allDownloadExpanded
      if (this.allDownloadExpanded) {
        this.expandedDownloadCats = this.studyCategories.filter(c => c.id !== 'all').map(c => c.id)
      } else {
        this.expandedDownloadCats = []
      }
    },
    toggleDownloadCategory(catId) {
      const idx = this.expandedDownloadCats.indexOf(catId)
      if (idx > -1) {
        this.expandedDownloadCats.splice(idx, 1)
      } else {
        this.expandedDownloadCats.push(catId)
      }
    },
    selectDownloadFile(fileId) {
      this.selectedDownloadFiles = [fileId]
    },
    cancelDownload() {
      this.showDownloadForm = false
      this.selectedDownloadFiles = []
    },
    confirmDownload() {
      if (this.selectedDownloadFiles.length === 0) return
      this.selectedDownloadFiles.forEach(fileId => {
        window.open(`/api/download/${fileId}?userId=${this.userId}`, '_blank')
      })
      this.showStudyToast('开始下载')
      this.cancelDownload()
    },
    // 在 methods 中添加一个计算显示名称的方法
    getDisplayFileName(file) {
      // 如果 original_name 没有扩展名，显示时加上
      const ext = file.file_type || ''
      if (ext && ext !== 'unknown' && !file.original_name.toLowerCase().endsWith(ext.toLowerCase())) {
        return file.original_name + ext
      }
      return file.original_name
    },
    
    // Markdown编辑器
    openMarkdownEditor() {
      this.showMarkdownEditor = true
      this.markdownContent = ''
    },
    closeMarkdownEditor() {
      this.showMarkdownEditor = false
      this.markdownContent = ''
    },
    insertMdSyntax(before, after = '') {
      const textarea = this.$refs.mdTextarea
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const text = this.markdownContent
      const beforeText = text.substring(0, start)
      const selectedText = text.substring(start, end)
      const afterText = text.substring(end)
      this.markdownContent = beforeText + before + selectedText + after + afterText
      this.$nextTick(() => {
        textarea.focus()
        const newCursor = start + before.length + selectedText.length
        textarea.setSelectionRange(newCursor, newCursor)
      })
    },
    async confirmPublishMarkdown() {
      if (!this.publishMdForm.title.trim()) {
        this.showStudyToast('请输入标题', 'error')
        return
      }
      try {
        await axios.post('/api/upload-markdown', {
          userId: this.userId,
          categoryId: this.publishMdForm.categoryId,
          title: this.publishMdForm.title,
          content: this.markdownContent
        })
        this.showStudyToast('发布成功')
        this.loadStudyFiles()
        this.showPublishMarkdownDialog = false
        this.closeMarkdownEditor()
      } catch (err) {
        this.showStudyToast(err.response?.data?.error || '发布失败', 'error')
      }
    },
    
    // 文件预览
    isImageType(ext) {
      return ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext.toLowerCase())
    },
    isVideoType(ext) {
      return ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv'].includes(ext.toLowerCase())
    },
    isAudioType(ext) {
      return ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.wma'].includes(ext.toLowerCase())
    },
    // 添加PDF检测
    isPdfType(ext) {
      return ['.pdf'].includes(ext.toLowerCase())
    },

    // 添加Office文档检测（浏览器无法直接预览，需要提示下载）
    isOfficeType(ext) {
      return ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'].includes(ext.toLowerCase())
    },
    async openStudyFile(file) {
      this.viewingStudyFile = file;
      this.currentStudyFileIndex = this.currentStudyFiles.findIndex(f => f.id === file.id);
      
      let fileUrl = file.file_path || '';
      
      // 标准化路径
      if (!fileUrl.startsWith('/')) {
        fileUrl = '/' + fileUrl;
      }
      
      // 修复重复 /uploads
      fileUrl = fileUrl.replace(/^\/uploads\/uploads\//, '/uploads/');
      
      console.log('预览文件:', file.original_name, 'URL:', fileUrl);
      
      // 对于可直接预览的二进制文件
      if (this.isImageType(file.file_type) || this.isVideoType(file.file_type) || 
          this.isAudioType(file.file_type) || this.isPdfType(file.file_type)) {
        
        // 关键修复：只使用相对路径，不拼接 origin
        const fullUrl = `${fileUrl}?t=${Date.now()}`;
        
        console.log('完整预览URL:', fullUrl);
        
        this.studyFileContent = {
          type: 'binary',
          url: fullUrl,  // 例如: /uploads/temp/其它/file-xxx.pdf?t=123
          file: file
        };
        return;
      }
      
      // 文本文件继续走API
      try {
        const res = await axios.get(`/api/file-content/${file.id}?userId=${this.userId}`);
        this.studyFileContent = res.data;
      } catch (err) {
        this.showStudyToast('加载文件失败', 'error');
        this.studyFileContent = { type: 'error' };
      }
    },
    closeFileViewer() {
      this.viewingStudyFile = null
      this.studyFileContent = null
    },
    prevStudyFile() {
      if (!this.hasPrevStudyFile) return
      this.currentStudyFileIndex--
      const files = this.currentStudyCategory === 'all' ? this.studyFiles : this.currentStudyFiles
      this.openStudyFile(files[this.currentStudyFileIndex])
    },
    nextStudyFile() {
      if (!this.hasNextStudyFile) return
      this.currentStudyFileIndex++
      const files = this.currentStudyCategory === 'all' ? this.studyFiles : this.currentStudyFiles
      this.openStudyFile(files[this.currentStudyFileIndex])
    },
    downloadCurrentStudyFile() {
      if (this.viewingStudyFile) {
        window.open(`/api/download/${this.viewingStudyFile.id}?userId=${this.userId}`, '_blank')
      }
    },
    
    // 邮件系统
    closeSendEmail() {
      this.showSendEmail = false
      this.emailForm = { recipient: '', subject: '', content: '', attachments: [] }
    },
    addLocalAttachment() {
      this.$refs.emailFileInput.click()
    },
    handleEmailFileSelect(event) {
      const file = event.target.files[0]
      if (file) {
        this.emailForm.attachments.push({
          name: file.name,
          type: 'local',
          file: file
        })
      }
      this.showAttOptions = false
      event.target.value = ''
    },
    openInternalFileSelector() {
      this.showInternalSelector = true
      this.showAttOptions = false
    },
    closeInternalSelector() {
      this.showInternalSelector = false
    },
    selectInternalFileForEmail(file) {
      this.emailForm.attachments.push({
        name: file.original_name,
        type: 'internal',
        fileId: file.id
      })
      this.closeInternalSelector()
    },
    removeEmailAttachment(idx) {
      this.emailForm.attachments.splice(idx, 1)
    },
    // 修改 sendEmail 方法 - 先上传本地附件
    async sendEmail() {
      if (!this.emailForm.recipient || !this.emailForm.subject) {
        this.showStudyToast('请填写收件人和主题', 'error');
        return;
      }
      
      this.emailSendingStatus = 'sending';
      
      try {
        // 第一步：处理附件 - 上传本地文件到服务器
        const processedAttachments = [];
        
        for (const att of this.emailForm.attachments) {
          if (att.type === 'local' && att.file instanceof File) {
            // 本地文件需要先上传
            try {
              const uploadResult = await this.uploadAttachmentFile(att.file);
              processedAttachments.push({
                name: att.name,
                type: 'internal',
                fileId: uploadResult.fileId
              });
            } catch (uploadErr) {
              console.error('上传附件失败:', uploadErr);
              this.showStudyToast(`上传附件 "${att.name}" 失败`, 'error');
              this.emailSendingStatus = 'error';
              return;
            }
          } else if (att.type === 'internal' && att.fileId) {
            // 已经是站内文件，直接使用
            processedAttachments.push({
              name: att.name,
              type: 'internal',
              fileId: att.fileId
            });
          }
        }
        
        // 第二步：发送邮件（使用处理后的附件）
        const userRes = await axios.get(`/api/user/${this.userId}`);
        const user = userRes.data.user;
        
        await axios.post('/api/emails', {
          senderId: this.userId,
          senderEmail: this.userEmail,
          senderName: user.username,
          recipientEmail: this.emailForm.recipient,
          subject: this.emailForm.subject,
          content: this.emailForm.content,
          attachments: processedAttachments  // 使用处理后的附件列表
        });
        
        this.emailSendingStatus = 'success';
        this.showStudyToast('邮件发送成功', 'success');
        this.closeSendEmail();
        
      } catch (err) {
        console.error('发送邮件失败:', err);
        const errorMsg = err.response?.data?.error || '网络错误，请重试';
        this.emailSendingStatus = 'error';
        this.showStudyToast(errorMsg, 'error');
      }
    },
    // 新增：上传附件文件到服务器
    async uploadAttachmentFile(file) {
      return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('userId', this.userId);
        // 上传到默认分类，比如 "其它"
        formData.append('categoryId', this.getDefaultCategoryId());
        formData.append('customName', file.name);
        
        axios.post('/api/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        .then(response => {
          resolve({ fileId: response.data.fileId });
        })
        .catch(error => {
          reject(error);
        });
      });
    },

    // 新增：获取默认分类ID（用于上传附件）
    getDefaultCategoryId() {
      // 找 "其它" 分类，如果没有就用第一个非'all'的分类
      const defaultCat = this.studyCategories.find(c => c.name === '其它');
      if (defaultCat) return defaultCat.id;
      
      const firstCat = this.studyCategories.find(c => c.id !== 'all');
      return firstCat ? firstCat.id : null;
    },
    // 添加通知
    addNotification(notification) {
      notification.id = Date.now();
      notification.read = false;
      this.notifications.unshift(notification); // 最新的在前
      // 限制通知数量，防止过多
      if (this.notifications.length > 50) {
        this.notifications = this.notifications.slice(0, 50);
      }
      // 保存到 localStorage（可选，实现持久化）
        localStorage.setItem('emailNotifications', JSON.stringify(this.notifications));
    },

    // 加载通知（在 created 中调用）
    loadNotifications() {
      const saved = localStorage.getItem('emailNotifications');
      if (saved) {
        try {
          this.notifications = JSON.parse(saved);
        } catch (e) {
          this.notifications = [];
        }
      }
    },

    // 标记通知已读
    markNotificationRead(id) {
      const notif = this.notifications.find(n => n.id === id);
      if (notif) {
        notif.read = true;
        localStorage.setItem('emailNotifications', JSON.stringify(this.notifications));
      }
    },

    // 删除通知
    removeNotification(id) {
      this.notifications = this.notifications.filter(n => n.id !== id);
      localStorage.setItem('emailNotifications', JSON.stringify(this.notifications));
    },

    // 清空所有通知
    clearAllNotifications() {
      this.notifications = [];
      localStorage.removeItem('emailNotifications');
    },
    closeInbox() {
      this.showInbox = false
      this.viewingEmail = null
    },
    // 修复：查看邮件详情 - 完全重写
    async viewEmail(email) {
      console.log('查看邮件:', email.id);
      
      // 先显示基本信息（从列表中获取的）
      this.viewingEmail = {
        ...email,
        // 确保 attachments 是数组
        attachments: Array.isArray(email.attachments) ? email.attachments : [],
        has_attachments: email.has_attachments || false
      };
      
      // 如果不是已读，标记为已读
      if (!email.is_read) {
        try {
          await axios.put(`/api/emails/${email.id}/read`);
          email.is_read = true;
          const idx = this.emails.findIndex(e => e.id === email.id);
          if (idx > -1) {
            this.emails[idx].is_read = true;
          }
        } catch (err) {
          console.error('标记已读失败', err);
        }
      }
      
      // 获取完整的邮件详情（包含附件下载链接）
      try {
        const res = await axios.get(`/api/email/${email.id}/detail`, {
          params: { userEmail: this.userEmail }
        });
        
        console.log('邮件详情API返回:', res.data);
        
        const emailData = res.data.email;
        
        // 关键：确保 attachments 是数组
        let attachments = emailData.attachments;
        if (typeof attachments === 'string') {
          try {
            attachments = JSON.parse(attachments);
          } catch (e) {
            attachments = [];
          }
        }
        if (!Array.isArray(attachments)) {
          attachments = [];
        }
        
        // 关键：使用重新赋值确保响应式更新
        this.viewingEmail = {
          ...this.viewingEmail,
          ...emailData,
          attachments: attachments,
          has_attachments: attachments.length > 0
        };
        
        console.log('最终邮件数据:', this.viewingEmail);
        console.log('附件列表:', this.viewingEmail.attachments);
        console.log('是否有附件:', this.emailHasAttachments);
        
      } catch (err) {
        console.error('获取邮件详情失败:', err);
        // 即使API失败，也保留列表中的数据
        if (!Array.isArray(this.viewingEmail.attachments)) {
          this.viewingEmail.attachments = [];
        }
      }
    },
    // 格式化邮件内容，处理换行符
    formatEmailContent(content) {
      if (!content) return '';
      // 将 \n 转换为 <br>，并处理转义的换行符
      return content
        .replace(/\\n/g, '\n')  // 先处理转义的换行符
        .replace(/\n/g, '<br>'); // 再将换行符转为 <br>
    },
    prevEmail() {
      if (!this.hasPrevEmail) return
      const idx = this.filteredEmails.findIndex(e => e.id === this.viewingEmail.id)
      this.viewingEmail = this.filteredEmails[idx - 1]
    },
    nextEmail() {
      if (!this.hasNextEmail) return
      const idx = this.filteredEmails.findIndex(e => e.id === this.viewingEmail.id)
      this.viewingEmail = this.filteredEmails[idx + 1]
    },
    // 修复：下载邮件附件 - 完全重写
    async downloadEmailAttachment(att, index = 0) {
      console.log('下载附件:', att);
      
      if (!this.viewingEmail) {
        console.error('viewingEmail 为空');
        this.showStudyToast('邮件信息缺失', 'error');
        return;
      }
      
      // 获取附件在数组中的索引
      const attachmentIndex = this.viewingEmail.attachments.findIndex(
        a => a.name === att.name && a.type === att.type
      );
      
      if (attachmentIndex === -1) {
        console.error('找不到附件索引');
        this.showStudyToast('附件信息错误', 'error');
        return;
      }
      
      try {
        // 判断附件类型：只要有 fileId 就认为是站内文件
        if (att.fileId) {
          // 站内文件：使用专用下载API
          const downloadUrl = `/api/email-attachment/${this.viewingEmail.id}/${attachmentIndex}?userEmail=${encodeURIComponent(this.userEmail)}`;
          console.log('下载站内文件, URL:', downloadUrl);
          
          // 创建临时链接并点击下载
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.target = '_blank';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          this.showStudyToast('开始下载附件', 'success');
          
        } else if (att.type === 'local' && att.file instanceof File) {
          // 真正的本地文件（File对象）：直接下载
          // 这种情况只在发送邮件时存在，收到的邮件中不应该有
          const url = URL.createObjectURL(att.file);
          const a = document.createElement('a');
          a.href = url;
          a.download = att.name;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
        } else if (att.downloadUrl) {
          // 如果有直接的下载链接，直接使用
          console.log('使用直接下载链接:', att.downloadUrl);
          const link = document.createElement('a');
          link.href = att.downloadUrl;
          link.target = '_blank';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          this.showStudyToast('开始下载附件', 'success');
          
        } else {
          console.error('无法识别的附件类型或缺少下载信息:', att);
          this.showStudyToast('无法下载此附件：不支持的类型', 'error');
        }
      } catch (err) {
        console.error('下载附件失败:', err);
        this.showStudyToast('下载失败: ' + (err.message || '未知错误'), 'error');
      }
    },
    showStudyToast(message, type = 'success') {
      this.studyToast = { show: true, message, type }
      setTimeout(() => {
        this.studyToast.show = false
      }, 3000)
    }
  }
}
</script>


<style scoped>
/* ==================== 基础变量和布局 ==================== */
.personal-center {
  min-height: 100vh;
  transition: background-color 0.3s, color 0.3s;
  background-color: #f5f7fa;
}

.dark-mode {
  background-color: #1a202c;
  color: #e2e8f0;
  
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
  --text-muted: #9ca3af;
  
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
  
  --datepicker-bg: #1f2937;
  --datepicker-border: #374151;
  --datepicker-header-bg: #111827;
  --datepicker-wheel-bg: #1f2937;
  --datepicker-wheel-active: #3b82f6;
  --datepicker-wheel-text: #d1d5db;
  --datepicker-highlight: rgba(59, 130, 246, 0.15);
}

.light-mode {
  background-color: #f5f7fa;
  color: #1f2937;
  
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
  --text-muted: #9ca3af;
  
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
  
  --datepicker-bg: #ffffff;
  --datepicker-border: #e5e7eb;
  --datepicker-header-bg: #f8fafc;
  --datepicker-wheel-bg: #ffffff;
  --datepicker-wheel-active: #3b82f6;
  --datepicker-wheel-text: #4b5563;
  --datepicker-highlight: rgba(59, 130, 246, 0.15);
}

.personal-content {
  display: flex;
  max-width: 1200px;  /* 改回原来的1200px，或者删除这行使用默认宽度 */
  margin: 10px auto;
  padding: 0 20px;
  gap: 30px;
}

/* ==================== 左侧边栏 ==================== */
.options-sidebar {
  flex: 0 0 250px;
  background: var(--sidebar-bg);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  border: 1px solid var(--sidebar-border);
  transition: background-color 0.3s, border-color 0.3s;
  height: fit-content;
}

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
  color: var(--text-primary);
}

.user-profile .email {
  color: var(--text-secondary);
  font-size: 14px;
  margin: 0;
}

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
  max-width: 100%; /* 原来是600px，现在改为100%占满 */
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

/* 日期选择器样式 - 保留原有 */
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

/* ==================== 学习区样式 ==================== */
.study-content-wrapper {
  animation: fadeIn 0.3s ease;
}

.study-layout {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 学习区头部栏 */
.study-header-bar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 15px;
  padding-bottom: 15px;
  border-bottom: 1px solid var(--content-border);
}

.category-tabs-wrapper {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  flex: 1;
}

.study-category-btn {
  padding: 8px 16px;
  border: 1px solid var(--content-border);
  background: var(--content-bg);
  color: var(--text-primary);
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.3s;
  font-size: 14px;
  white-space: nowrap;
}

.study-category-btn:hover {
  background: var(--option-hover);
  transform: translateY(-2px);
}

.study-category-btn.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.study-header-actions {
  display: flex;
  gap: 15px;
  align-items: center;
}

.study-search-box {
  display: flex;
  align-items: center;
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  border-radius: 25px;
  padding: 5px 15px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  position: relative;
}

.study-search-box input {
  border: none;
  background: transparent;
  color: var(--text-primary);
  outline: none;
  width: 150px;
  padding: 5px;
  font-size: 14px;
}

.search-icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  opacity: 0.7;
  transition: all 0.3s;
}

.search-icon-btn:hover {
  opacity: 1;
  transform: scale(1.1);
}

.search-icon-btn.searching {
  animation: pulse 1s infinite;
}

.clear-search-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 12px;
  margin-left: 5px;
  padding: 2px 6px;
  border-radius: 50%;
  transition: all 0.3s;
}

.clear-search-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

@keyframes pulse {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}

.search-icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  opacity: 0.7;
  transition: opacity 0.3s;
}

.search-icon-btn:hover {
  opacity: 1;
}

.study-email-btns {
  display: flex;
  gap: 10px;
}

.email-action-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s;
  background: var(--content-bg);
  color: var(--text-primary);
  border: 1px solid var(--content-border);
  position: relative;
  white-space: nowrap;
}

.send-btn:hover {
  background: #10b981;
  color: white;
  border-color: #10b981;
}

.inbox-btn:hover {
  background: #8b5cf6;
  color: white;
  border-color: #8b5cf6;
}

.email-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  background: #ef4444;
  color: white;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
}

.notification-btn:hover {
  background: #f59e0b;
  color: white;
  border-color: #f59e0b;
}

/* 学习区工具栏 */
.study-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  background: rgba(128, 128, 128, 0.05);
  border-radius: 10px;
  border: 1px solid var(--content-border);
  flex-wrap: wrap;
  gap: 10px;
}

.toolbar-left-group,
.toolbar-right-group {
  display: flex;
  gap: 10px;
}

.study-tool-btn {
  padding: 8px 16px;
  border: 1px solid var(--content-border);
  background: var(--content-bg);
  color: var(--text-primary);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s;
  font-size: 14px;
  white-space: nowrap;
}

.study-tool-btn:hover:not(:disabled) {
  background: var(--option-hover);
  transform: translateY(-1px);
}

.study-tool-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.upload-download-btn {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.upload-download-btn:hover:not(:disabled) {
  background: #2563eb;
}

.edit-md-btn {
  background: #10b981;
  color: white;
  border-color: #10b981;
}

.edit-md-btn:hover {
  background: #059669;
}

.light-mode .edit-md-btn:hover {
  color: #2d3748;
}

.add-category-btn {
  background: #f59e0b;
  color: white;
  border-color: #f59e0b;
}

.add-category-btn:hover {
  background: #d97706;
}

.light-mode .add-category-btn:hover {
  color: #1a202c;
}

.batch-delete-btn {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.batch-delete-btn:hover:not(:disabled) {
  background: #2563eb;
}

.confirm-delete-btn {
  background: #ef4444;
  color: white;
  border-color: #ef4444;
}

.confirm-delete-btn:hover:not(:disabled) {
  background: #dc2626;
}

/* 学习区文件容器 */
.study-files-container {
  max-height: calc(100vh - 400px);
  overflow-y: auto;
  padding-right: 10px;
}

.study-category-block {
  margin-bottom: 30px;
  padding: 20px;
  background: rgba(128, 128, 128, 0.03);
  border-radius: 12px;
  border: 1px solid var(--content-border);
}

.study-cat-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 15px;
  padding-left: 10px;
  border-left: 4px solid #3b82f6;
}

.study-files-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 20px;
}

.study-file-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 15px 10px;
  border-radius: 12px;
  background: var(--content-bg);
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.3s;
  position: relative;
}

.study-file-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
  border-color: rgba(59, 130, 246, 0.3);
}

.study-file-card.selectable {
  border: 2px dashed var(--content-border);
}

.study-file-card.selected {
  border-color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

.selection-indicator {
  position: absolute;
  top: 5px;
  left: 5px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid #9ca3af;
  background: var(--content-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: white;
  transition: all 0.3s;
}

.study-file-card.selected .selection-indicator {
  background: #ef4444;
  border-color: #ef4444;
}

.study-file-icon {
  font-size: 40px;
  margin-bottom: 8px;
  transition: transform 0.3s;
}

.study-file-card:hover .study-file-icon {
  transform: scale(1.1);
}

.study-file-name {
  font-size: 12px;
  color: var(--text-primary);
  text-align: center;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.study-file-name :deep(mark) {
  background: #fbbf24;
  color: #000;
  padding: 0 2px;
  border-radius: 2px;
  font-weight: bold;
}

.dark-mode .study-file-name :deep(mark) {
  background: #f59e0b;
  color: #000;
}

.study-file-meta {
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.study-empty-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px;
  color: var(--text-secondary);
  background: rgba(128, 128, 128, 0.05);
  border-radius: 10px;
  border: 2px dashed var(--content-border);
}

.study-empty-block.main-empty {
  grid-column: 1 / -1;
}

.study-empty-block .empty-icon {
  font-size: 48px;
  margin-bottom: 10px;
}

.file-ext-tag {
  font-size: 10px;
  color: #888;
  margin-left: 4px;
  opacity: 0.8;
}

/* 文件类型颜色 */
.study-file-icon.pdf { color: #ef4444; }
.study-file-icon.doc, .study-file-icon.docx { color: #3b82f6; }
.study-file-icon.image { color: #10b981; }
.study-file-icon.video { color: #8b5cf6; }
.study-file-icon.audio { color: #f59e0b; }
.study-file-icon.code { color: #06b6d4; }
.study-file-icon.archive { color: #6b7280; }
.study-file-icon.markdown { color: #ec4899; }
.study-file-icon.text { color: #64748b; }

/* ==================== 弹窗通用样式 ==================== */
.modal-overlay {
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

.modal-content {
  background: var(--content-bg);
  border: 1px solid var(--content-border);
  border-radius: 16px;
  padding: 25px;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
}

.modal-content h3 {
  margin-top: 0;
  margin-bottom: 20px;
  color: var(--text-primary);
}

.modal-form-group {
  margin-bottom: 20px;
}

.modal-form-group label {
  display: block;
  margin-bottom: 8px;
  color: var(--text-primary);
  font-weight: 500;
  font-size: 14px;
}

.modal-form-group input,
.modal-form-group select {
  width: 100%;
  padding: 10px 15px;
  border: 1px solid var(--input-border);
  border-radius: 8px;
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: 15px;
  transition: all 0.3s;
}

.modal-form-group input:focus,
.modal-form-group select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.file-input {
  padding: 10px 0 !important;
  border: none !important;
}

.selected-file-info {
  margin-top: 8px;
  font-size: 13px;
  color: var(--text-secondary);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.btn-primary, .btn-secondary, .btn-danger {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.btn-secondary {
  background: var(--btn-secondary-bg);
  color: var(--text-primary);
  border: 1px solid var(--btn-secondary-border);
}

.btn-secondary:hover {
  background: var(--btn-secondary-hover);
}

.btn-danger {
  background: #ef4444;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #dc2626;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.modal-close-btn {
  width: 100%;
  margin-top: 15px;
  padding: 10px;
  background: var(--btn-secondary-bg);
  border: 1px solid var(--btn-secondary-border);
  color: var(--text-primary);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.modal-close-btn:hover {
  background: var(--btn-secondary-hover);
}

/* 上传/下载选择弹窗 */
.choice-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin: 20px 0;
}

.choice-card {
  padding: 30px 20px;
  border: 2px solid var(--content-border);
  border-radius: 12px;
  background: var(--content-bg);
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.choice-card:hover {
  border-color: #3b82f6;
  transform: translateY(-3px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
}

.choice-icon {
  font-size: 36px;
}

/* 下载树形视图 */
.download-tree-view {
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid var(--content-border);
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 20px;
}

.tree-root,
.tree-category-header,
.tree-file-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.3s;
}

.tree-root:hover,
.tree-category-header:hover,
.tree-file-row:hover {
  background: var(--option-hover);
}

.tree-children {
  margin-left: 25px;
  border-left: 1px solid var(--content-border);
  padding-left: 10px;
}

.tree-toggle-icon {
  font-size: 12px;
  color: var(--text-secondary);
  width: 16px;
  text-align: center;
}

.tree-icon {
  font-size: 18px;
}

.tree-file-icon {
  font-size: 16px;
}

.tree-file-name {
  flex: 1;
  font-size: 14px;
  color: var(--text-primary);
}

.tree-file-row.selected {
  background: var(--option-active-bg);
  border-radius: 6px;
}

.selected-check {
  color: #10b981;
  font-weight: bold;
}

.tree-empty {
  color: var(--text-secondary);
  font-size: 13px;
  padding: 5px 10px;
  font-style: italic;
}

/* ==================== 全屏模态框（编辑器/预览/邮件） ==================== */
.fullscreen-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--content-bg);
  z-index: 2000;
  display: flex;
  flex-direction: column;
}

.fullscreen-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 25px;
  border-bottom: 1px solid var(--content-border);
  background: var(--content-bg);
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border: 1px solid var(--content-border);
  background: var(--btn-secondary-bg);
  color: var(--text-primary);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.back-btn:hover {
  background: var(--btn-secondary-hover);
}

.back-btn span {
  font-size: 18px;
}

.fullscreen-header h3 {
  margin: 0;
  color: var(--text-primary);
}

.header-actions {
  display: flex;
  gap: 10px;
}

/* Markdown编辑器工具栏 */
.md-toolbar {
  display: flex;
  gap: 10px;
  padding: 10px 25px;
  border-bottom: 1px solid var(--content-border);
  background: rgba(128, 128, 128, 0.05);
  overflow-x: auto;
}

.md-toolbar button {
  padding: 6px 12px;
  border: 1px solid var(--content-border);
  background: var(--content-bg);
  color: var(--text-primary);
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.3s;
  min-width: 36px;
}

.md-toolbar button:hover {
  background: var(--option-active-bg);
  border-color: #3b82f6;
  color: #3b82f6;
}

/* Markdown编辑器主体 */
.md-editor-body {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  overflow: hidden;
}

.md-input,
.md-preview {
  padding: 20px;
  overflow-y: auto;
  background: var(--content-bg);
  color: var(--text-primary);
}

.md-input {
  border: none;
  border-right: 1px solid var(--content-border);
  resize: none;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 14px;
  line-height: 1.6;
  outline: none;
}

.md-preview {
  background: var(--content-bg);
}

.md-preview :deep(h1) { border-bottom: 2px solid var(--content-border); padding-bottom: 10px; margin-top: 0; }
.md-preview :deep(h2) { border-bottom: 1px solid var(--content-border); padding-bottom: 8px; }
.md-preview :deep(code) { 
  background: rgba(128, 128, 128, 0.1); 
  padding: 2px 6px; 
  border-radius: 4px; 
  font-family: monospace;
}
.md-preview :deep(pre) { 
  background: rgba(128, 128, 128, 0.1); 
  padding: 15px; 
  border-radius: 8px; 
  overflow-x: auto;
}
.md-preview :deep(pre code) { background: none; padding: 0; }
.md-preview :deep(blockquote) { 
  border-left: 4px solid #3b82f6; 
  margin: 0; 
  padding-left: 20px; 
  color: var(--text-secondary); 
}
.md-preview :deep(ul), 
.md-preview :deep(ol) { padding-left: 25px; }
.md-preview :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 10px 0;
}
.md-preview :deep(th),
.md-preview :deep(td) {
  border: 1px solid var(--content-border);
  padding: 8px;
  text-align: left;
}
.md-preview :deep(th) {
  background: rgba(128, 128, 128, 0.1);
}

/* 邮件编辑表单 */
.email-compose-form {
  flex: 1;
  padding: 30px;
  overflow-y: auto;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
}

.compose-row {
  margin-bottom: 20px;
}

.compose-row label {
  display: block;
  margin-bottom: 8px;
  color: var(--text-primary);
  font-weight: 500;
}

.compose-row input,
.compose-row textarea {
  width: 100%;
  padding: 12px 15px;
  border: 1px solid var(--input-border);
  border-radius: 8px;
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: 15px;
  transition: all 0.3s;
}

.compose-row input:focus,
.compose-row textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.attachments-section {
  position: relative;
}

.attachments-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.attachment-tag-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: var(--option-active-bg);
  border-radius: 20px;
  font-size: 13px;
  color: var(--text-primary);
}

.remove-attachment {
  background: none;
  border: none;
  color: #ef4444;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.add-att-btn {
  padding: 8px 16px;
  border: 1px dashed var(--content-border);
  background: transparent;
  color: var(--text-secondary);
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.3s;
}

.add-att-btn:hover {
  border-color: #3b82f6;
  color: #3b82f6;
}

.att-options-menu {
  position: absolute;
  margin-top: 5px;
  background: var(--content-bg);
  border: 1px solid var(--content-border);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 100;
}

.att-options-menu button {
  display: block;
  width: 100%;
  padding: 10px 20px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
  transition: background 0.3s;
}

.att-options-menu button:hover {
  background: var(--option-hover);
}

/* 站内文件选择器 */
.internal-selector-modal {
  max-height: 500px;
}

.internal-file-tree {
  max-height: 350px;
  overflow-y: auto;
  margin-bottom: 20px;
}

.selector-cat {
  margin-bottom: 15px;
}

.selector-cat-name {
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
  padding: 5px 10px;
  background: rgba(59, 130, 246, 0.1);
  border-radius: 6px;
}

.selector-file-list {
  margin-left: 15px;
}

.selector-file-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  cursor: pointer;
  border-radius: 6px;
  margin: 3px 0;
  transition: background 0.3s;
}

.selector-file-row:hover {
  background: var(--option-hover);
}

/* 收件箱 */
.inbox-filter-tabs {
  display: flex;
  gap: 10px;
}

.filter-tab {
  padding: 6px 16px;
  border: 1px solid var(--content-border);
  background: var(--content-bg);
  color: var(--text-primary);
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.3s;
}

.filter-tab.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.inbox-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.email-list-view {
  max-width: 900px;
  margin: 0 auto;
}

.email-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border-bottom: 1px solid var(--content-border);
  cursor: pointer;
  transition: background 0.3s;
}

.email-row:hover {
  background: var(--option-hover);
}

.email-row.unread {
  background: rgba(59, 130, 246, 0.05);
}

.email-row-main {
  display: flex;
  align-items: center;
  gap: 15px;
  flex: 1;
  overflow: hidden;
}

.email-sender-name {
  font-weight: 600;
  color: var(--text-primary);
  min-width: 120px;
}

.email-subject-line {
  color: var(--text-secondary);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.unread-indicator {
  width: 8px;
  height: 8px;
  background: #ef4444;
  border-radius: 50%;
  flex-shrink: 0;
}

.email-row-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-secondary);
  font-size: 13px;
  flex-shrink: 0;
}

.has-attachment-icon {
  font-size: 14px;
}

.empty-inbox-msg {
  text-align: center;
  padding: 60px;
  color: var(--text-secondary);
}

/* 通知面板样式 */
.notification-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
}

.empty-notifications {
  text-align: center;
  padding: 60px;
  color: var(--text-secondary);
}

.empty-notifications .empty-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 15px;
}

.notification-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.notification-item {
  display: flex;
  align-items: flex-start;
  gap: 15px;
  padding: 15px 20px;
  background: var(--content-bg);
  border: 1px solid var(--content-border);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s;
  position: relative;
}

.notification-item:hover {
  transform: translateX(5px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.notification-item.unread {
  background: rgba(59, 130, 246, 0.05);
  border-left: 4px solid #3b82f6;
}

.notification-indicator {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
}

.notification-indicator.success {
  background: #10b981;
  color: white;
}

.notification-indicator.error {
  background: #ef4444;
  color: white;
}

.notification-body {
  flex: 1;
  min-width: 0;
}

.notification-title {
  font-weight: 600;
  font-size: 16px;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.notification-detail {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-label {
  color: var(--text-muted);
  margin-right: 5px;
}

.notification-message {
  font-size: 14px;
  color: var(--text-primary);
  margin-top: 8px;
  padding: 8px;
  background: rgba(128, 128, 128, 0.05);
  border-radius: 6px;
}

.notification-time {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 8px;
}

.notification-delete {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 20px;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.3s;
}

.notification-delete:hover {
  background: #ef4444;
  color: white;
}

/* 邮件详情 */
.email-detail-view {
  max-width: 800px;
  margin: 0 auto;
}

.email-detail-nav {
  display: flex;
  justify-content: space-between;
  margin-bottom: 30px;
}

.email-detail-nav button {
  padding: 8px 16px;
  border: 1px solid var(--content-border);
  background: var(--content-bg);
  color: var(--text-primary);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s;
}

.email-detail-nav button:hover:not(:disabled) {
  background: var(--option-hover);
}

.email-detail-nav button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.email-detail-content h2 {
  margin-bottom: 20px;
  color: var(--text-primary);
}

.email-meta-info {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 20px;
  padding: 15px;
  background: rgba(128, 128, 128, 0.05);
  border-radius: 8px;
  font-size: 14px;
  color: var(--text-secondary);
}

.email-body-text {
  line-height: 1.8;
  color: var(--text-primary);
  white-space: pre-wrap;
}

.email-attachments-section {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid var(--content-border);
}

.email-attachments-section h4 {
  margin-bottom: 15px;
  color: var(--text-primary);
}

.email-att-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
  background: rgba(128, 128, 128, 0.05);
  border-radius: 8px;
  margin-bottom: 10px;
}

.nav-spacer {
  flex: 1;
}

.btn-download {
  padding: 6px 16px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.3s;
}

.btn-download:hover {
  background: #2563eb;
}

.att-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.att-icon {
  font-size: 18px;
}

.att-name {
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.att-type-tag {
  font-size: 11px;
  padding: 2px 8px;
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
  border-radius: 10px;
  flex-shrink: 0;
}

/* 文件预览器 */
.file-viewer {
  background: rgba(0, 0, 0, 0.95) !important;
}

.file-viewer .fullscreen-header {
  background: rgba(0, 0, 0, 0.8);
  color: white;
  border-bottom-color: rgba(255, 255, 255, 0.1);
}

.viewer-filename {
  font-size: 16px;
  font-weight: 500;
  max-width: 50%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: white;
}

.viewer-nav-btns {
  display: flex;
  gap: 10px;
}

.viewer-nav-btns button {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.3s;
}

.viewer-nav-btns button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.3);
}

.viewer-nav-btns button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.viewer-content-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  padding: 20px;
}

.preview-img {
  max-width: 90%;
  max-height: 90%;
  object-fit: contain;
}

.preview-video {
  max-width: 90%;
  max-height: 90%;
}

.preview-audio {
  width: 60%;
}

.preview-text-content {
  width: 80%;
  max-height: 90%;
  background: var(--content-bg);
  padding: 30px;
  border-radius: 12px;
  overflow: auto;
}

.preview-text-content pre {
  white-space: pre-wrap;
  word-wrap: break-word;
  margin: 0;
  color: var(--text-primary);
  font-family: monospace;
  line-height: 1.6;
}

/* PDF预览容器 */
.preview-pdf-container {
  width: 90%;
  height: 90%;
  background: #525659; /* PDF 背景色 */
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.preview-pdf-embed {
  width: 100%;
  height: 100%;
  border: none;
}

/* Office文档提示 - 优化样式，与黑色背景协调 */
.office-preview {
  background: rgba(30, 30, 30, 0.95) !important;  /* 深灰色背景，与黑色主题协调 */
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 40px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  color: white !important;
  max-width: 500px;
  text-align: center;
}

.office-preview .big-file-icon {
  font-size: 80px;
  margin-bottom: 20px;
  display: block;
}

.office-preview h3 {
  margin: 0 0 10px 0;
  font-size: 24px;
  font-weight: 600;
  color: white;
}

.office-preview p {
  margin: 5px 0;
  color: rgba(255, 255, 255, 0.8);
  font-size: 16px;
}

.office-preview .sub-hint {
  opacity: 0.6;
  margin-top: 8px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
}

.office-preview .btn-primary {
  margin-top: 20px;
  padding: 12px 24px;
  font-size: 16px;
}

/* 代码/文本预览优化 */
.preview-text-content {
  width: 90%;
  max-height: 90%;
  background: var(--content-bg);
  padding: 30px;
  border-radius: 12px;
  overflow: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.preview-text-content pre {
  white-space: pre-wrap;
  word-wrap: break-word;
  margin: 0;
  color: var(--text-primary);
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
  line-height: 1.6;
  font-size: 14px;
}

/* Markdown内容样式优化 */
.markdown-body {
  line-height: 1.8;
  color: var(--text-primary);
}

.markdown-body h1, 
.markdown-body h2, 
.markdown-body h3 {
  border-bottom: 1px solid var(--content-border);
  padding-bottom: 10px;
  margin-top: 30px;
}

.markdown-body pre {
  background: rgba(128, 128, 128, 0.1);
  padding: 16px;
  border-radius: 8px;
  overflow-x: auto;
}

.markdown-body code {
  background: rgba(128, 128, 128, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
}

.markdown-body blockquote {
  border-left: 4px solid #3b82f6;
  margin: 0;
  padding-left: 20px;
  color: var(--text-secondary);
}

.preview-unsupported {
  text-align: center;
  color: white;
}

.big-file-icon {
  font-size: 80px;
  margin-bottom: 20px;
}

/* Toast提示 */
.study-toast {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  border-radius: 8px;
  color: white;
  font-weight: 500;
  z-index: 5000;
  animation: slideDown 0.3s ease;
}

.study-toast.success {
  background: #10b981;
}

.study-toast.error {
  background: #ef4444;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translate(-50%, -20px);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
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
  
  .md-editor-body {
    grid-template-columns: 1fr;
  }
  
  .md-input {
    border-right: none;
    border-bottom: 1px solid var(--content-border);
    min-height: 300px;
  }
}

@media (max-width: 768px) {
  .study-header-bar {
    flex-direction: column;
  }
  
  .study-header-actions {
    width: 100%;
    flex-wrap: wrap;
  }
  
  .study-search-box input {
    width: 120px;
  }
  
  .study-files-grid {
    grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
    gap: 15px;
  }
  
  .study-file-icon {
    font-size: 32px;
  }
  
  .fullscreen-header {
    flex-wrap: wrap;
    gap: 10px;
  }
  
  .viewer-filename {
    max-width: 100%;
    order: 3;
    width: 100%;
    text-align: center;
  }
  
  .choice-buttons {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .content-area {
    padding: 15px;
  }
  
  .study-toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  
  .toolbar-left-group,
  .toolbar-right-group {
    justify-content: center;
  }
  
  .email-row-main {
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
  }
  
  .email-sender-name {
    min-width: auto;
  }
}
</style>