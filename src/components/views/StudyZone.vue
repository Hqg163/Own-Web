<!-- src/views/StudyZone.vue -->
<template>
  <div class="study-zone-container" :class="themeClass">
    <div class="study-layout">
      <header class="study-page-header">
        <div><p class="eyebrow">Learning workspace</p><h2>学习资料</h2><p>文件、Markdown 与站内邮件都保留在此处。</p></div>
        <div class="study-email-btns" aria-label="邮件与通知">
          <button class="email-action-btn" type="button" @click="showSendEmail = true"><AppIcon name="mail" :size="17" />发送邮件</button>
          <button class="email-action-btn" type="button" @click="showInbox = true"><AppIcon name="inbox" :size="17" />收件箱 <span v-if="unreadEmailCount > 0" class="email-badge">{{ unreadEmailCount }}</span></button>
          <button class="email-action-btn icon-only" type="button" aria-label="发送通知记录" @click="showNotificationPanel = true"><AppIcon name="bell" :size="17" /><span v-if="unreadNotificationCount > 0" class="email-badge">{{ unreadNotificationCount }}</span></button>
        </div>
      </header>
      <div class="study-header-bar">
        <div class="category-tabs-wrapper" aria-label="文件分类">
          <button v-for="cat in studyCategories" :key="cat.id" :class="['study-category-btn', { active: currentStudyCategory === cat.id }]" type="button" :aria-pressed="currentStudyCategory === cat.id" @click="switchStudyCategory(cat.id)">{{ cat.name }}</button>
        </div>
        <div class="study-search-box">
          <label class="visually-hidden" for="study-file-search">搜索文件</label>
          <input id="study-file-search" v-model="studySearchQuery" type="search" placeholder="搜索文件" @keyup.enter="handleStudySearch" @input="handleSearchInput" />
          <button class="search-icon-btn" type="button" aria-label="搜索文件" :aria-busy="isSearching" @click="handleStudySearch"><AppIcon name="search" :size="17" /></button>
          <button v-if="studySearchQuery" class="clear-search-btn" type="button" aria-label="清除搜索" @click="clearSearch"><AppIcon name="close" :size="16" /></button>
        </div>
      </div>
      <div class="study-toolbar" aria-label="文件操作">
        <div class="toolbar-left-group">
          <button class="study-tool-btn button-primary" type="button" @click="showUploadDialog = true"><AppIcon name="upload" :size="17" />上传或下载</button>
          <button class="study-tool-btn" type="button" @click="openMarkdownEditor"><AppIcon name="pen" :size="17" />新建 Markdown</button>
        </div>
        <div class="toolbar-right-group">
          <div class="view-toggle" aria-label="文件视图"><button type="button" :class="{ active: viewMode === 'grid' }" :aria-pressed="viewMode === 'grid'" aria-label="网格视图" @click="viewMode = 'grid'"><AppIcon name="grid" :size="16" /></button><button type="button" :class="{ active: viewMode === 'list' }" :aria-pressed="viewMode === 'list'" aria-label="列表视图" @click="viewMode = 'list'"><AppIcon name="menu" :size="16" /></button></div>
          <button v-if="currentStudyCategory === 'all'" class="study-tool-btn" type="button" @click="showAddCategoryDialog = true"><AppIcon name="plus" :size="17" />添加分类</button>
          <template v-else>
            <button v-if="!isBatchDeleteMode" class="study-tool-btn button-danger" type="button" :disabled="currentStudyFiles.length === 0" @click="startBatchDelete"><AppIcon name="trash" :size="17" />批量删除</button>
            <template v-else><button class="study-tool-btn button-danger" type="button" :disabled="selectedStudyFiles.length === 0" @click="confirmBatchDelete"><AppIcon name="check" :size="17" />删除 {{ selectedStudyFiles.length || '' }}</button><button class="study-tool-btn" type="button" @click="cancelBatchDelete">取消</button></template>
          </template>
        </div>
      </div>
      <div class="study-files-container">
        <template v-if="currentStudyCategory === 'all'">
          <section v-for="cat in studyCategories.filter(c => c.id !== 'all')" :key="cat.id" class="study-category-block">
            <div class="study-category-heading"><h3>{{ cat.name }}</h3><span>{{ (studyFilesByCategory[cat.id] || []).length }} 个文件</span></div>
            <div v-if="studyFilesByCategory[cat.id] && studyFilesByCategory[cat.id].length > 0" class="study-files-grid" :class="{ 'is-list': viewMode === 'list' }">
              <button v-for="file in studyFilesByCategory[cat.id]" :key="file.id" type="button" class="study-file-card" @click="openStudyFile(file)"><span class="study-file-icon" :class="getStudyFileIconClass(file.file_type)"><AppIcon :name="getStudyFileIconName(file.file_type)" :size="22" /></span><span class="study-file-name" :title="getDisplayFileName(file)">{{ getDisplayFileName(file) }}</span><span class="study-file-meta">{{ formatFileSize(file.file_size) }} · {{ formatStudyDate(file.created_at) }}</span></button>
            </div>
            <div v-else class="study-empty-block"><AppIcon name="folder" :size="21" /><span>此分类暂时没有文件。</span></div>
          </section>
        </template>
        <template v-else>
          <div v-if="currentStudyFiles.length > 0" class="study-files-grid" :class="{ 'is-list': viewMode === 'list' }">
            <button v-for="file in currentStudyFiles" :key="file.id" type="button" class="study-file-card" :class="{ selectable: isBatchDeleteMode, selected: selectedStudyFiles.includes(file.id) }" :aria-pressed="isBatchDeleteMode ? selectedStudyFiles.includes(file.id) : undefined" @click="isBatchDeleteMode ? toggleStudyFileSelection(file.id) : openStudyFile(file)"><span v-if="isBatchDeleteMode" class="selection-indicator"><AppIcon v-if="selectedStudyFiles.includes(file.id)" name="check" :size="14" /></span><span class="study-file-icon" :class="getStudyFileIconClass(file.file_type)"><AppIcon :name="getStudyFileIconName(file.file_type)" :size="22" /></span><span class="study-file-name" :title="getDisplayFileName(file)">{{ getDisplayFileName(file) }}</span><span class="study-file-meta">{{ formatFileSize(file.file_size) }} · {{ formatStudyDate(file.created_at) }}</span></button>
          </div>
          <div v-else class="study-empty-block main-empty"><AppIcon name="folder" :size="24" /><span>此分类暂时没有文件。</span></div>
        </template>
      </div>
    </div>

    <!-- 学习区弹窗组件 -->

    <!-- 上传/下载选择 -->
    <div v-if="showUploadDialog" class="modal-overlay" @click.self="showUploadDialog = false">
      <div class="modal-content">
        <h3>选择操作</h3>
        <div class="choice-buttons">
          <button class="choice-card upload-card" type="button" @click="switchToUploadMode">
            <AppIcon class="choice-icon" name="upload" :size="28" />
            <span>上传文件</span>
          </button>
          <button class="choice-card download-card" type="button" @click="switchToDownloadMode">
            <AppIcon class="choice-icon" name="download" :size="28" />
            <span>下载文件</span>
          </button>
        </div>
          <button class="modal-close-btn" type="button" @click="showUploadDialog = false">取消</button>
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
          <button class="btn-secondary" type="button" @click="cancelUpload">取消</button>
          <button class="btn-primary" type="button" :disabled="!uploadFormData.selectedFile || uploadingFile" @click="confirmUpload">
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
          <button class="tree-root" type="button" :aria-expanded="allDownloadExpanded" @click="toggleAllDownloadExpansion">
            <AppIcon class="tree-toggle-icon" :class="{ expanded: allDownloadExpanded }" name="chevron-down" :size="15" />
            <AppIcon class="tree-icon" name="folder" :size="18" />
            <span>所有</span>
          </button>
          <div v-show="allDownloadExpanded" class="tree-children">
            <div v-for="cat in studyCategories.filter(c => c.id !== 'all')" :key="cat.id" class="tree-category-item">
              <button class="tree-category-header" type="button" :aria-expanded="expandedDownloadCats.includes(cat.id)" @click="toggleDownloadCategory(cat.id)">
                <AppIcon class="tree-toggle-icon" :class="{ expanded: expandedDownloadCats.includes(cat.id) }" name="chevron-down" :size="15" />
                <AppIcon class="tree-icon" name="folder" :size="18" />
                <span>{{ cat.name }}</span>
              </button>
              <div v-show="expandedDownloadCats.includes(cat.id)" class="tree-files">
                <button
                  v-for="file in studyFilesByCategory[cat.id] || []"
                  :key="file.id"
                  class="tree-file-row"
                  :class="{ selected: selectedDownloadFiles.includes(file.id) }"
                  @click="selectDownloadFile(file.id)"
                >
                  <AppIcon class="tree-file-icon" :name="getStudyFileIconName(file.file_type)" :size="16" />
                  <span class="tree-file-name">{{ getDisplayFileName(file) }}</span>
                  <AppIcon v-if="selectedDownloadFiles.includes(file.id)" class="selected-check" name="check" :size="16" />
                </button>
                <div v-if="!studyFilesByCategory[cat.id] || studyFilesByCategory[cat.id].length === 0" class="tree-empty">
                  暂无文件
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" type="button" @click="cancelDownload">取消</button>
          <button class="btn-primary" type="button" :disabled="selectedDownloadFiles.length === 0" @click="confirmDownload">
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
          <button class="btn-secondary" type="button" @click="showAddCategoryDialog = false">取消</button>
          <button class="btn-primary" type="button" :disabled="!newStudyCategoryName.trim()" @click="confirmAddCategory">
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
          <button class="btn-secondary" type="button" @click="showDeleteConfirmDialog = false">取消</button>
          <button class="btn-danger" type="button" :disabled="deletingFiles" @click="executeBatchDelete">
            {{ deletingFiles ? '删除中...' : '确认' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Markdown编辑器 -->
    <div v-if="showMarkdownEditor" class="fullscreen-modal">
      <div class="fullscreen-header">
        <button class="back-btn" type="button" @click="closeMarkdownEditor">
          <AppIcon name="arrow-left" :size="17" /> 返回
        </button>
        <h3>Markdown编辑器</h3>
        <div class="header-actions">
          <button class="btn-secondary" type="button" @click="closeMarkdownEditor">取消编辑</button>
          <button class="btn-primary" type="button" @click="showPublishMarkdownDialog = true">发布</button>
        </div>
      </div>

      <div class="md-toolbar">
        <button type="button" aria-label="粗体" @click="insertMdSyntax('**', '**')"><b>B</b></button>
        <button type="button" aria-label="斜体" @click="insertMdSyntax('*', '*')"><i>I</i></button>
        <button type="button" aria-label="一级标题" @click="insertMdSyntax('# ')">H1</button>
        <button type="button" aria-label="二级标题" @click="insertMdSyntax('## ')">H2</button>
        <button type="button" aria-label="列表" @click="insertMdSyntax('- ')">列表</button>
        <button type="button" aria-label="引用" @click="insertMdSyntax('> ')">引用</button>
        <button type="button" aria-label="代码块" @click="insertMdSyntax('```\n', '\n```')">代码</button>
        <button type="button" aria-label="链接" @click="insertMdSyntax('[', '](url)')">链接</button>
        <button type="button" aria-label="插入图片（需填写 alt 文本）" @click="insertMdSyntax('![alt](', ')')">图片</button>
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

      <!-- 发布Markdown弹窗 -->
      <div v-if="showPublishMarkdownDialog" class="modal-overlay publish-overlay" @click.self="showPublishMarkdownDialog = false">
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
            <button class="btn-secondary" type="button" @click="showPublishMarkdownDialog = false">取消</button>
            <button class="btn-primary" type="button" :disabled="!publishMdForm.title.trim()" @click="confirmPublishMarkdown">
              发布
            </button>
          </div>
        </div>
      </div>

    </div>

    <!-- 文件预览器 -->
    <div v-if="viewingStudyFile" class="fullscreen-modal file-viewer" @click.self="closeFileViewer">
      <div class="fullscreen-header">
        <button class="back-btn" type="button" @click="closeFileViewer">
          <AppIcon name="arrow-left" :size="17" /> 返回
        </button>
        <span class="viewer-filename">{{ viewingStudyFile.original_name }}</span>
        <div class="viewer-nav-btns">
          <button type="button" :disabled="!hasPrevStudyFile" @click="prevStudyFile"><AppIcon name="arrow-left" :size="15" />上一个</button>
          <button type="button" :disabled="!hasNextStudyFile" @click="nextStudyFile">下一个<AppIcon name="arrow-right" :size="15" /></button>
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
          <AppIcon class="big-file-icon" name="file" :size="44" />
          <h3>Office 文档</h3>
          <p>浏览器无法直接预览 {{ viewingStudyFile.file_type.toUpperCase() }} 格式文件</p>
          <p class="sub-hint">建议下载后使用相应软件打开</p>
          <button class="btn-primary" type="button" @click="downloadCurrentStudyFile"><AppIcon name="download" :size="17" />下载到本地</button>
        </div>

        <!-- 文本/Markdown预览 -->
        <div v-else-if="studyFileContent.type === 'text' || studyFileContent.type === 'markdown'" class="preview-text-content">
          <pre v-if="studyFileContent.type === 'text'">{{ studyFileContent.content }}</pre>
          <div v-else v-html="renderedFileMarkdown" class="markdown-body"></div>
        </div>

        <!-- 其他不支持的格式 -->
        <div v-else class="preview-unsupported">
          <AppIcon class="big-file-icon" name="file" :size="44" />
          <h3>无法预览此格式</h3>
          <p>当前不方便预览 {{ viewingStudyFile.file_type.toUpperCase() }} 格式文件</p>
          <button class="btn-primary" type="button" @click="downloadCurrentStudyFile"><AppIcon name="download" :size="17" />下载到本地查看</button>
        </div>
      </div>
    </div>

    <!-- 发送邮件 -->
    <div v-if="showSendEmail" class="fullscreen-modal">
      <div class="fullscreen-header">
        <button class="back-btn" type="button" @click="closeSendEmail">
          <AppIcon name="arrow-left" :size="17" /> 返回
        </button>
        <h3>发送邮件</h3>
        <button class="btn-primary" type="button" :disabled="!emailForm.recipient || !emailForm.subject || emailSendingStatus === 'sending'" @click="sendEmail">
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
              <button class="remove-attachment" type="button" :aria-label="`移除附件 ${att.name}`" @click="removeEmailAttachment(idx)"><AppIcon name="close" :size="14" /></button>
            </div>
            <button class="add-att-btn" type="button" @click="showAttOptions = !showAttOptions"><AppIcon name="plus" :size="16" />添加附件</button>
            <div v-if="showAttOptions" class="att-options-menu">
              <button type="button" @click="addLocalAttachment">本地上传</button>
              <button type="button" @click="openInternalFileSelector">站内选择</button>
            </div>
          </div>

          <!-- 站内文件选择器 -->
          <div v-if="showInternalSelector" class="internal-selector-embedded">
            <div class="internal-file-tree">
              <h3>选择站内文件</h3>
              <div class="internal-file-tree">
                <div v-for="cat in studyCategories.filter(c => c.id !== 'all')" :key="cat.id" class="selector-cat">
                  <div class="selector-cat-name">{{ cat.name }}</div>
                  <div class="selector-file-list">
                    <button
                      v-for="file in studyFilesByCategory[cat.id] || []"
                      :key="file.id"
                      class="selector-file-row"
                      @click="selectInternalFileForEmail(file)"
                    >
                      <AppIcon :name="getStudyFileIconName(file.file_type)" :size="16" />
                      <span>{{ file.original_name }}</span>
                    </button>
                  </div>
                </div>
              </div>
              <button class="btn-secondary" type="button" @click="closeInternalSelector">关闭</button>
            </div>
          </div>

        </div>
        <input type="file" ref="emailFileInput" style="display: none" @change="handleEmailFileSelect" />
      </div>
    </div>

    <!-- 收件箱 -->
    <div v-if="showInbox" class="fullscreen-modal">
      <div class="fullscreen-header">
        <button class="back-btn" type="button" @click="closeInbox">
          <AppIcon name="arrow-left" :size="17" /> 返回
        </button>
        <h3>收件箱</h3>
        <div class="inbox-filter-tabs">
          <button
            v-for="filter in ['all', 'unread', 'read']"
            :key="filter"
            :class="['filter-tab', { active: emailFilter === filter }]"
            type="button"
            :aria-pressed="emailFilter === filter"
            @click="emailFilter = filter"
          >
            {{ filter === 'all' ? '全部' : filter === 'unread' ? '未读' : '已读' }}
          </button>
        </div>
      </div>

      <div class="inbox-content">
        <div v-if="!viewingEmail" class="email-list-view">
          <button
            v-for="email in filteredEmails"
            :key="email.id"
            type="button"
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
              <AppIcon v-if="email.has_attachments" class="has-attachment-icon" name="paperclip" :size="15" />
              <span class="email-time">{{ formatEmailTime(email.created_at) }}</span>
            </div>
          </button>
          <div v-if="filteredEmails.length === 0" class="empty-inbox-msg">
            <p>暂无邮件</p>
          </div>
        </div>

        <div v-else class="email-detail-view">
          <!-- 返回按钮 -->
          <div class="email-detail-nav">
            <button type="button" @click="viewingEmail = null">
              <AppIcon name="arrow-left" :size="15" />返回邮件列表
            </button>
            <div class="nav-spacer"></div>
            <button type="button" :disabled="!hasPrevEmail" @click="prevEmail"><AppIcon name="arrow-left" :size="15" />上一封</button>
            <button type="button" :disabled="!hasNextEmail" @click="nextEmail">下一封<AppIcon name="arrow-right" :size="15" /></button>
          </div>

          <div class="email-detail-content">
            <h2>{{ viewingEmail.subject }}</h2>
            <div class="email-meta-info">
              <div><strong>发件人：</strong>{{ viewingEmail.sender_name || viewingEmail.sender_email }} &lt;{{ viewingEmail.sender_email }}&gt;</div>
              <div><strong>收件人：</strong>{{ viewingEmail.recipient_email }}</div>
              <div><strong>时间：</strong>{{ formatEmailTime(viewingEmail.created_at) }}</div>
            </div>

            <!-- 邮件正文 -->
            <div class="email-body-text">{{ viewingEmail.content }}</div>

            <!-- 附件部分 - 使用更稳定的条件判断 -->
            <div v-if="emailHasAttachments" class="email-attachments-section">
              <h4>附件（{{ attachmentCount }}个）：</h4>
              <div
                v-for="(att, idx) in viewingEmail.attachments"
                :key="idx"
                class="email-att-item"
              >
                <div class="att-info">
                  <AppIcon class="att-icon" name="paperclip" :size="16" />
                  <span class="att-name">{{ att.name || '未命名文件' }}</span>
                  <span v-if="att.type === 'internal'" class="att-type-tag">站内文件</span>
                  <span v-else class="att-type-tag">本地文件</span>
                </div>
                <button class="btn-small btn-download" type="button" @click="downloadEmailAttachment(att, idx)">
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
        <button class="back-btn" type="button" @click="showNotificationPanel = false">
          <AppIcon name="arrow-left" :size="17" /> 返回
        </button>
        <h3>发送通知记录</h3>
        <button
          v-if="notifications.length > 0"
          class="btn-secondary"
          type="button"
          @click="clearAllNotifications"
        >
          清空全部
        </button>
      </div>

      <div class="notification-content">
        <div v-if="notifications.length === 0" class="empty-notifications">
          <AppIcon class="empty-icon" name="inbox" :size="32" />
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
              <AppIcon v-if="notif.type === 'success'" name="check" :size="16" />
              <AppIcon v-else name="close" :size="16" />
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

            <button class="notification-delete" type="button" aria-label="删除通知记录" @click.stop="removeNotification(notif.id)"><AppIcon name="close" :size="15" /></button>
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
import axios from '@/services/http'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import AppIcon from '@/components/AppIcon.vue'

export default {
  name: 'StudyZone',
  components: { AppIcon },
  data() {
    return {
      themeClass: localStorage.getItem('theme') === 'dark' ? 'dark-mode' : 'light-mode',

      // 学习区数据
      studyCategories: [{ id: 'all', name: '所有' }],
      currentStudyCategory: 'all',
      studyFiles: [],
      studyFilesByCategory: {},
      studySearchQuery: '',
      isSearching: false,
      viewMode: 'grid',

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
      emailSendingStatus: null,

      userId: null,
      userEmail: null
    }
  },
  computed: {
    // 学习区计算属性
    currentStudyFiles() {
      let files = []

      if (this.currentStudyCategory === 'all') {
        files = this.studyFiles
      } else {
        files = this.studyFilesByCategory[this.currentStudyCategory] || []
      }

      const query = this.studySearchQuery.trim().toLowerCase()
      if (!query) {
        return files
      }

      return files.filter(file => {
        const displayName = this.getDisplayFileName(file).toLowerCase()
        return displayName.includes(query)
      })
    },
    renderedMarkdown() {
      return DOMPurify.sanitize(marked.parse(this.markdownContent || ''))
    },
    renderedFileMarkdown() {
      if (this.studyFileContent && this.studyFileContent.content) {
        return DOMPurify.sanitize(marked.parse(this.studyFileContent.content))
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
    emailHasAttachments() {
      if (!this.viewingEmail) return false;
      const atts = this.viewingEmail.attachments;
      return Array.isArray(atts) && atts.length > 0;
    },
    attachmentCount() {
      if (!this.viewingEmail || !Array.isArray(this.viewingEmail.attachments)) {
        return 0;
      }
      return this.viewingEmail.attachments.length;
    }
  },
  async created() {
    if (localStorage.getItem('isLoggedIn') !== 'true') {
      this.$router.push('/login')
      return
    }
    this.userId = localStorage.getItem('userId')
    this.userEmail = localStorage.getItem('userEmail')
    await this.loadStudyCategories()
    await this.loadStudyFiles()
    this.loadEmails()
    this.loadNotifications()
    this.setupThemeListener()
    document.addEventListener('keydown', this.handleEscape)
  },
  beforeUnmount() {
    window.removeEventListener('theme-changed', this.handleThemeChange)
    window.removeEventListener('storage', this.handleStorageChange)
    document.removeEventListener('keydown', this.handleEscape)
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
    handleEscape(event) {
      if (event.key !== 'Escape') return
      if (this.showPublishMarkdownDialog) {
        this.showPublishMarkdownDialog = false
      } else if (this.showDeleteConfirmDialog) {
        this.showDeleteConfirmDialog = false
      } else if (this.showAddCategoryDialog) {
        this.showAddCategoryDialog = false
      } else if (this.showDownloadForm) {
        this.cancelDownload()
      } else if (this.showUploadForm) {
        this.cancelUpload()
      } else if (this.showUploadDialog) {
        this.showUploadDialog = false
      } else if (this.viewingStudyFile) {
        this.closeFileViewer()
      } else if (this.showMarkdownEditor) {
        this.closeMarkdownEditor()
      } else if (this.showSendEmail) {
        this.closeSendEmail()
      } else if (this.showInbox) {
        this.closeInbox()
      } else if (this.showNotificationPanel) {
        this.showNotificationPanel = false
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
        this.updateCategoryMap()
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
        this.loadStudyFiles()
        this.isSearching = false
        return
      }

      this.isSearching = true

      const results = this.currentStudyFiles
      if (results.length === 0) {
        this.showStudyToast('没有找到匹配的文件', 'warning')
      } else {
        this.showStudyToast(`找到 ${results.length} 个匹配文件`, 'success')
      }
    },
    handleSearchInput() {
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
    clearSearch() {
      this.studySearchQuery = ''
      this.isSearching = false
    },
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
    highlightMatch(text, query) {
      if (!query || !text) return text
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(`(${escapedQuery})`, 'gi')
      return text.replace(regex, '<mark style="background:#fbbf24;color:#000;padding:0 2px;border-radius:2px;">$1</mark>')
    },
    escapeRegExp(string) {
      return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    },
    getHighlightedFileName(file) {
      const name = this.getDisplayFileName(file)
      if (!this.studySearchQuery.trim()) return name
      return this.highlightMatch(name, this.studySearchQuery)
    },
    getStudyFileIconName(ext) {
      const value = String(ext || '').toLowerCase()
      if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(value)) return 'image'
      if (['.mp4', '.avi', '.mov', '.mkv', '.flv', '.wmv'].includes(value)) return 'video'
      if (['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a'].includes(value)) return 'music'
      if (['.zip', '.rar', '.7z', '.tar', '.gz'].includes(value)) return 'archive'
      if (['.js', '.ts', '.html', '.css', '.py', '.c', '.cpp', '.h', '.java', '.json', '.xml', '.vue', '.php', '.go', '.rs', '.rb', '.swift', '.kt', '.sql'].includes(value)) return 'code'
      if (value === '.md') return 'pen'
      return 'file'
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
    formatFileSize(bytes) {
      const value = Number(bytes)
      if (!Number.isFinite(value) || value < 1024) return `${Math.max(0, value || 0)} B`
      if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
      return `${(value / (1024 * 1024)).toFixed(1)} MB`
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
        await this.loadStudyCategories()
        this.updateCategoryMap()
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
      formData.append('userId', this.userId)
      formData.append('categoryId', this.uploadFormData.categoryId)

      if (this.uploadFormData.customName) {
        formData.append('customName', this.uploadFormData.customName)
      }
      try {
        await axios.post('/api/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            'x-user-id': this.userId
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
    getDisplayFileName(file) {
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
    isPdfType(ext) {
      return ['.pdf'].includes(ext.toLowerCase())
    },
    isOfficeType(ext) {
      return ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'].includes(ext.toLowerCase())
    },
    async openStudyFile(file) {
      this.viewingStudyFile = file;
      this.currentStudyFileIndex = this.currentStudyFiles.findIndex(f => f.id === file.id);

      if (this.isImageType(file.file_type) || this.isVideoType(file.file_type) ||
          this.isAudioType(file.file_type) || this.isPdfType(file.file_type)) {
        this.studyFileContent = {
          type: 'binary',
          url: `/api/file-stream/${file.id}`,
          file: file
        };
        return;
      }

      try {
        const res = await axios.get(`/api/file-content/${file.id}`);
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
    async sendEmail() {
      if (!this.emailForm.recipient || !this.emailForm.subject) {
        this.showStudyToast('请填写收件人和主题', 'error');
        return;
      }

      this.emailSendingStatus = 'sending';

      try {
        const processedAttachments = [];

        for (const att of this.emailForm.attachments) {
          if (att.type === 'local' && att.file instanceof File) {
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
            processedAttachments.push({
              name: att.name,
              type: 'internal',
              fileId: att.fileId
            });
          }
        }

        const userRes = await axios.get(`/api/user/${this.userId}`);
        const user = userRes.data.user;

        await axios.post('/api/emails', {
          senderId: this.userId,
          senderEmail: this.userEmail,
          senderName: user.username,
          recipientEmail: this.emailForm.recipient,
          subject: this.emailForm.subject,
          content: this.emailForm.content,
          attachments: processedAttachments
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
    async uploadAttachmentFile(file) {
      return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('userId', this.userId);
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
    getDefaultCategoryId() {
      const defaultCat = this.studyCategories.find(c => c.name === '其它');
      if (defaultCat) return defaultCat.id;

      const firstCat = this.studyCategories.find(c => c.id !== 'all');
      return firstCat ? firstCat.id : null;
    },
    addNotification(notification) {
      notification.id = Date.now();
      notification.read = false;
      this.notifications.unshift(notification);
      if (this.notifications.length > 50) {
        this.notifications = this.notifications.slice(0, 50);
      }
      localStorage.setItem('emailNotifications', JSON.stringify(this.notifications));
    },
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
    markNotificationRead(id) {
      const notif = this.notifications.find(n => n.id === id);
      if (notif) {
        notif.read = true;
        localStorage.setItem('emailNotifications', JSON.stringify(this.notifications));
      }
    },
    removeNotification(id) {
      this.notifications = this.notifications.filter(n => n.id !== id);
      localStorage.setItem('emailNotifications', JSON.stringify(this.notifications));
    },
    clearAllNotifications() {
      this.notifications = [];
      localStorage.removeItem('emailNotifications');
    },
    closeInbox() {
      this.showInbox = false
      this.viewingEmail = null
    },
    async viewEmail(email) {
      console.log('查看邮件:', email.id);

      this.viewingEmail = {
        ...email,
        attachments: Array.isArray(email.attachments) ? email.attachments : [],
        has_attachments: email.has_attachments || false
      };

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

      try {
        const res = await axios.get(`/api/email/${email.id}/detail`, {
          params: { userEmail: this.userEmail }
        });

        console.log('邮件详情API返回:', res.data);

        const emailData = res.data.email;

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
        if (!Array.isArray(this.viewingEmail.attachments)) {
          this.viewingEmail.attachments = [];
        }
      }
    },
    formatEmailContent(content) {
      if (!content) return '';
      return content
        .replace(/\\n/g, '\n')
        .replace(/\n/g, '<br>');
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
    async downloadEmailAttachment(att, index = 0) {
      console.log('下载附件:', att);

      if (!this.viewingEmail) {
        console.error('viewingEmail 为空');
        this.showStudyToast('邮件信息缺失', 'error');
        return;
      }

      const attachmentIndex = this.viewingEmail.attachments.findIndex(
        a => a.name === att.name && a.type === att.type
      );

      if (attachmentIndex === -1) {
        console.error('找不到附件索引');
        this.showStudyToast('附件信息错误', 'error');
        return;
      }

      try {
        if (att.fileId) {
          const downloadUrl = `/api/email-attachment/${this.viewingEmail.id}/${attachmentIndex}?userEmail=${encodeURIComponent(this.userEmail)}`;
          console.log('下载站内文件, URL:', downloadUrl);

          const link = document.createElement('a');
          link.href = downloadUrl;
          link.target = '_blank';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          this.showStudyToast('开始下载附件', 'success');

        } else if (att.type === 'local' && att.file instanceof File) {
          const url = URL.createObjectURL(att.file);
          const a = document.createElement('a');
          a.href = url;
          a.download = att.name;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

        } else if (att.downloadUrl) {
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
.study-zone-container {
  min-height: 100vh;
  transition: background-color 0.3s, color 0.3s;
  background-color: var(--bg);
  padding: 20px;
}

.dark-mode, .light-mode { background: var(--bg); color: var(--text); }

.study-layout {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 1200px;
  margin: 0 auto;
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
  border-bottom: 1px solid var(--border);
}

.category-tabs-wrapper {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  flex: 1;
}

.study-category-btn {
  padding: 8px 16px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.3s;
  font-size: 14px;
  white-space: nowrap;
}

.study-category-btn:hover {
  background: var(--surface-raised);
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
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: 25px;
  padding: 5px 15px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  position: relative;
}

.study-search-box input {
  border: none;
  background: transparent;
  color: var(--text);
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
  color: var(--muted);
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
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
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
  border: 1px solid var(--border);
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
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s;
  font-size: 14px;
  white-space: nowrap;
}

.study-tool-btn:hover:not(:disabled) {
  background: var(--surface-raised);
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
  border: 1px solid var(--border);
}

.study-cat-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text);
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
  background: var(--surface);
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
  border: 2px dashed var(--border);
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
  background: var(--surface);
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
  color: var(--text);
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
}

.dark-mode .study-file-name :deep(mark) {
  background: #f59e0b;
  color: #000;
}

.study-file-meta {
  font-size: 11px;
  color: var(--muted);
  margin-top: 4px;
}

.study-empty-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px;
  color: var(--muted);
  background: rgba(128, 128, 128, 0.05);
  border-radius: 10px;
  border: 2px dashed var(--border);
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
}

.modal-content {
  background: var(--surface);
  border: 1px solid var(--border);
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
  color: var(--text);
}

.modal-form-group {
  margin-bottom: 20px;
}

.modal-form-group label {
  display: block;
  margin-bottom: 8px;
  color: var(--text);
  font-weight: 500;
  font-size: 14px;
}

.modal-form-group input,
.modal-form-group select {
  width: 100%;
  padding: 10px 15px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-raised);
  color: var(--text);
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
  color: var(--muted);
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
  background: var(--surface-raised);
  color: var(--text);
  border: 1px solid var(--border);
}

.btn-secondary:hover {
  background: var(--accent-soft);
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
  background: var(--surface-raised);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.modal-close-btn:hover {
  background: var(--accent-soft);
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
  border: 2px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
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
  border: 1px solid var(--border);
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
  background: var(--surface-raised);
}

.tree-children {
  margin-left: 25px;
  border-left: 1px solid var(--border);
  padding-left: 10px;
}

.tree-toggle-icon {
  font-size: 12px;
  color: var(--muted);
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
  color: var(--text);
}

.tree-file-row.selected {
  background: var(--accent-soft);
  border-radius: 6px;
}

.selected-check {
  color: #10b981;
  font-weight: bold;
}

.tree-empty {
  color: var(--muted);
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
  background: var(--surface);
  z-index: 2000;
  display: flex;
  flex-direction: column;
}

.fullscreen-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 25px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border: 1px solid var(--border);
  background: var(--surface-raised);
  color: var(--text);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.back-btn:hover {
  background: var(--accent-soft);
}

.back-btn span {
  font-size: 18px;
}

.fullscreen-header h3 {
  margin: 0;
  color: var(--text);
}

.header-actions {
  display: flex;
  gap: 10px;
}

/* 发布弹窗在编辑器内的特殊样式 */
.fullscreen-modal .publish-overlay {
  position: absolute;
  background: rgba(0, 0, 0, 0.7);
}

.fullscreen-modal .modal-content {
  max-height: 60vh;
}

/* Markdown编辑器工具栏 */
.md-toolbar {
  display: flex;
  gap: 10px;
  padding: 10px 25px;
  border-bottom: 1px solid var(--border);
  background: rgba(128, 128, 128, 0.05);
  overflow-x: auto;
}

.md-toolbar button {
  padding: 6px 12px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.3s;
  min-width: 36px;
}

.md-toolbar button:hover {
  background: var(--accent-soft);
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
  background: var(--surface);
  color: var(--text);
}

.md-input {
  border: none;
  border-right: 1px solid var(--border);
  resize: none;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 14px;
  line-height: 1.6;
  outline: none;
}

.md-preview {
  background: var(--surface);
}

.md-preview :deep(h1) { border-bottom: 2px solid var(--border); padding-bottom: 10px; margin-top: 0; }
.md-preview :deep(h2) { border-bottom: 1px solid var(--border); padding-bottom: 8px; }
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
  color: var(--muted);
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
  border: 1px solid var(--border);
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
  color: var(--text);
  font-weight: 500;
}

.compose-row input,
.compose-row textarea {
  width: 100%;
  padding: 12px 15px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-raised);
  color: var(--text);
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
  background: var(--accent-soft);
  border-radius: 20px;
  font-size: 13px;
  color: var(--text);
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
  border: 1px dashed var(--border);
  background: transparent;
  color: var(--muted);
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
  background: var(--surface);
  border: 1px solid var(--border);
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
  color: var(--text);
  cursor: pointer;
  text-align: left;
  transition: background 0.3s;
}

.att-options-menu button:hover {
  background: var(--surface-raised);
}

/* 站内文件选择器 */
.internal-selector-embedded {
  margin-top: 15px;
  padding: 15px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  max-height: 300px;
  overflow-y: auto;
}

.internal-selector-embedded .internal-file-tree {
  max-height: 250px;
  overflow-y: auto;
  margin-bottom: 15px;
}

.internal-selector-embedded .btn-secondary {
  width: 100%;
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
  color: var(--text);
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
  background: var(--surface-raised);
}

/* 收件箱 */
.inbox-filter-tabs {
  display: flex;
  gap: 10px;
}

.filter-tab {
  padding: 6px 16px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
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
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: background 0.3s;
}

.email-row:hover {
  background: var(--surface-raised);
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
  color: var(--text);
  min-width: 120px;
}

.email-subject-line {
  color: var(--muted);
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
  color: var(--muted);
  font-size: 13px;
  flex-shrink: 0;
}

.has-attachment-icon {
  font-size: 14px;
}

.empty-inbox-msg {
  text-align: center;
  padding: 60px;
  color: var(--muted);
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
  color: var(--muted);
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
  background: var(--surface);
  border: 1px solid var(--border);
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
  color: var(--text);
  margin-bottom: 8px;
}

.notification-detail {
  font-size: 13px;
  color: var(--muted);
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-label {
  color: var(--subtle);
  margin-right: 5px;
}

.notification-message {
  font-size: 14px;
  color: var(--text);
  margin-top: 8px;
  padding: 8px;
  background: rgba(128, 128, 128, 0.05);
  border-radius: 6px;
}

.notification-time {
  font-size: 12px;
  color: var(--subtle);
  margin-top: 8px;
}

.notification-delete {
  background: none;
  border: none;
  color: var(--muted);
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
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s;
}

.email-detail-nav button:hover:not(:disabled) {
  background: var(--surface-raised);
}

.email-detail-nav button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.email-detail-content h2 {
  margin-bottom: 20px;
  color: var(--text);
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
  color: var(--muted);
}

.email-body-text {
  line-height: 1.8;
  color: var(--text);
  white-space: pre-wrap;
}

.email-attachments-section {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid var(--border);
}

.email-attachments-section h4 {
  margin-bottom: 15px;
  color: var(--text);
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
  color: var(--text);
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
  background: var(--surface);
  padding: 30px;
  border-radius: 12px;
  overflow: auto;
}

.preview-text-content pre {
  white-space: pre-wrap;
  word-wrap: break-word;
  margin: 0;
  color: var(--text);
  font-family: monospace;
  line-height: 1.6;
}

/* PDF预览容器 */
.preview-pdf-container {
  width: 90%;
  height: 90%;
  background: #525659;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.preview-pdf-embed {
  width: 100%;
  height: 100%;
  border: none;
}

/* Office文档提示 */
.office-preview {
  background: rgba(30, 30, 30, 0.95) !important;
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
  background: var(--surface);
  padding: 30px;
  border-radius: 12px;
  overflow: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.preview-text-content pre {
  white-space: pre-wrap;
  word-wrap: break-word;
  margin: 0;
  color: var(--text);
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
  line-height: 1.6;
  font-size: 14px;
}

/* Markdown内容样式优化 */
.markdown-body {
  line-height: 1.8;
  color: var(--text);
}

.markdown-body h1,
.markdown-body h2,
.markdown-body h3 {
  border-bottom: 1px solid var(--border);
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
  color: var(--muted);
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
  .md-editor-body {
    grid-template-columns: 1fr;
  }

  .md-input {
    border-right: none;
    border-bottom: 1px solid var(--border);
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

/* 文稿室工作区覆盖层：保留旧业务状态与弹窗，统一入口、文件集合和主题令牌。 */
.study-zone-container { min-height: 0; padding: 0; background: transparent; color: var(--text); }
.study-layout { max-width: none; gap: var(--space-4); margin: 0; }
.study-page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-4); }.study-page-header h2 { margin: var(--space-1) 0; font-size: 1.6rem; letter-spacing: -.025em; }.study-page-header > div > p:last-child { margin: 0; color: var(--muted); }
.study-header-bar { align-items: center; gap: var(--space-3); padding: var(--space-3) 0; border-color: var(--border); }.category-tabs-wrapper { gap: var(--space-2); }.study-category-btn { min-height: 34px; padding: 0 var(--space-3); border-color: var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); color: var(--muted); transition: border-color .15s ease, background .15s ease, color .15s ease; }.study-category-btn:hover { transform: none; border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }.study-category-btn.active { border-color: var(--accent); background: var(--accent-soft); box-shadow: none; color: var(--accent); }
.study-search-box { min-width: min(100%, 260px); padding: 0 var(--space-2); border-color: var(--border); border-radius: var(--radius-sm); box-shadow: none; background: var(--surface-raised); }.study-search-box input { width: 100%; min-height: 38px; padding: 0 var(--space-2); color: var(--text); }.search-icon-btn, .clear-search-btn { display: grid; width: 32px; height: 32px; place-items: center; padding: 0; border: 0; border-radius: var(--radius-sm); color: var(--muted); }.search-icon-btn:hover, .clear-search-btn:hover { transform: none; color: var(--accent); background: var(--accent-soft); }
.study-email-btns { display: flex; flex-wrap: wrap; gap: var(--space-2); }.email-action-btn { display: inline-flex; align-items: center; gap: var(--space-2); min-height: 38px; padding: 0 var(--space-3); border-color: var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); color: var(--text); }.email-action-btn:hover { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }.email-action-btn.icon-only { position: relative; width: 38px; padding: 0; justify-content: center; }.email-badge { top: -5px; right: -5px; background: var(--danger); }
.study-toolbar { justify-content: space-between; padding: var(--space-3); border-color: var(--border); border-radius: var(--radius); background: var(--surface); }.toolbar-left-group, .toolbar-right-group { align-items: center; flex-wrap: wrap; gap: var(--space-2); }.study-tool-btn { display: inline-flex; align-items: center; gap: var(--space-2); min-height: 38px; padding: 0 var(--space-3); border-color: var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); color: var(--text); }.study-tool-btn:hover:not(:disabled) { transform: none; border-color: var(--accent); background: var(--accent-soft); }.study-tool-btn.button-primary { background: var(--accent); border-color: var(--accent); color: #fff; }.study-tool-btn.button-primary:hover:not(:disabled) { background: var(--accent-strong); color: #fff; }.study-tool-btn.button-danger { color: var(--danger); }.view-toggle { display: inline-flex; padding: 2px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); }.view-toggle button { display: grid; width: 30px; height: 30px; place-items: center; padding: 0; border: 0; border-radius: 6px; color: var(--muted); background: transparent; }.view-toggle button.active { color: var(--accent); background: var(--accent-soft); }
.study-files-container { display: grid; gap: var(--space-5); }.study-category-block { padding-top: 0; border: 0; }.study-category-heading { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: var(--space-2); }.study-category-heading h3 { margin: 0; font-size: 1rem; }.study-category-heading span { color: var(--muted); font-size: .8rem; }.study-files-grid { gap: var(--space-2); grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); }.study-files-grid.is-list { grid-template-columns: 1fr; }.study-file-card { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: var(--space-2) var(--space-3); min-height: 86px; padding: var(--space-3); text-align: left; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); color: var(--text); box-shadow: none; cursor: pointer; }.study-file-card:hover { transform: none; border-color: var(--accent); box-shadow: var(--shadow); }.study-files-grid.is-list .study-file-card { grid-template-columns: auto minmax(0, 1fr) auto; min-height: 58px; }.study-file-icon { display: grid; width: 38px; height: 38px; place-items: center; border-radius: var(--radius-sm); background: var(--accent-soft); color: var(--accent); font-size: inherit; }.study-file-name { min-width: 0; overflow: hidden; color: var(--text); font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }.study-file-meta { grid-column: 2; color: var(--muted); font-size: .78rem; }.study-files-grid.is-list .study-file-meta { grid-column: 3; white-space: nowrap; }.selection-indicator { position: absolute; display: grid; width: 20px; height: 20px; place-items: center; border: 1px solid var(--accent); border-radius: 50%; background: var(--accent); color: #fff; }.study-file-card.selectable { position: relative; }.study-file-card.selected { border-color: var(--accent); background: var(--accent-soft); }.study-empty-block { display: inline-flex; align-items: center; gap: var(--space-2); padding: var(--space-4); border: 1px dashed var(--border); border-radius: var(--radius); background: transparent; color: var(--muted); }.main-empty { width: 100%; justify-content: center; min-height: 180px; }
@media (max-width: 760px) { .study-page-header { align-items: stretch; flex-direction: column; }.study-email-btns { width: 100%; }.study-header-bar { align-items: stretch; flex-direction: column; }.study-search-box { width: 100%; max-width: none; }.study-toolbar { align-items: stretch; flex-direction: column; }.toolbar-left-group, .toolbar-right-group { justify-content: flex-start; }.study-tool-btn { flex: 1 1 auto; justify-content: center; }.study-files-grid { grid-template-columns: 1fr; }.study-files-grid.is-list .study-file-card { grid-template-columns: auto minmax(0, 1fr); }.study-files-grid.is-list .study-file-meta { grid-column: 2; }.category-tabs-wrapper { flex-wrap: nowrap; overflow-x: auto; padding-bottom: var(--space-1); } }

/* 所有遗留弹窗、编辑器与邮件界面接入同一套工作区令牌。 */
.study-zone-container .modal-overlay {
  background: rgb(20 25 23 / 46%);
}
.study-zone-container .modal-content {
  width: min(500px, calc(100% - 32px));
  max-height: min(80vh, 680px);
  padding: var(--space-5);
  border-color: var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow);
}
.study-zone-container .modal-content h3 { margin: 0 0 var(--space-4); color: var(--text); }
.study-zone-container .modal-form-group { margin-bottom: var(--space-4); }
.study-zone-container .modal-form-group label { color: var(--text); }
.study-zone-container .modal-form-group input,
.study-zone-container .modal-form-group select,
.study-zone-container .compose-row input,
.study-zone-container .compose-row textarea {
  box-sizing: border-box;
  border-color: var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-raised);
  color: var(--text);
}
.study-zone-container .modal-form-group input:focus,
.study-zone-container .modal-form-group select:focus,
.study-zone-container .compose-row input:focus,
.study-zone-container .compose-row textarea:focus,
.study-zone-container button:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--accent), transparent 68%);
  outline-offset: 2px;
  border-color: var(--accent);
  box-shadow: none;
}
.study-zone-container .modal-actions { gap: var(--space-2); margin-top: var(--space-5); }
.study-zone-container .btn-primary,
.study-zone-container .btn-secondary,
.study-zone-container .btn-danger,
.study-zone-container .modal-close-btn,
.study-zone-container .back-btn,
.study-zone-container .viewer-nav-btns button,
.study-zone-container .email-detail-nav button,
.study-zone-container .btn-small {
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
  transition: border-color .15s ease, background .15s ease, color .15s ease;
}
.study-zone-container .btn-primary { border-color: var(--accent); background: var(--accent); color: #fff; }
.study-zone-container .btn-danger { border-color: var(--danger); background: var(--danger); color: #fff; }
.study-zone-container .btn-primary:hover:not(:disabled) { background: var(--accent-strong); transform: none; }
.study-zone-container .btn-danger:hover:not(:disabled) { filter: brightness(.94); }
.study-zone-container .btn-secondary:hover:not(:disabled),
.study-zone-container .modal-close-btn:hover,
.study-zone-container .back-btn:hover,
.study-zone-container .viewer-nav-btns button:hover:not(:disabled),
.study-zone-container .email-detail-nav button:hover:not(:disabled) { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }
.study-zone-container .choice-buttons { gap: var(--space-3); margin: var(--space-4) 0; }
.study-zone-container .choice-card {
  gap: var(--space-3);
  min-height: 130px;
  padding: var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-raised);
  color: var(--text);
}
.study-zone-container .choice-card:hover { transform: none; border-color: var(--accent); background: var(--accent-soft); box-shadow: none; }
.study-zone-container .choice-icon { color: var(--accent); }
.study-zone-container .download-tree-view,
.study-zone-container .internal-selector-embedded {
  border-color: var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-raised);
}
.study-zone-container .tree-root,
.study-zone-container .tree-category-header,
.study-zone-container .tree-file-row,
.study-zone-container .selector-file-row {
  display: flex;
  width: 100%;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--text);
  font: inherit;
  text-align: left;
}
.study-zone-container .tree-root:hover,
.study-zone-container .tree-category-header:hover,
.study-zone-container .tree-file-row:hover,
.study-zone-container .selector-file-row:hover { background: var(--accent-soft); }
.study-zone-container .tree-toggle-icon { color: var(--muted); transition: transform .15s ease; }
.study-zone-container .tree-toggle-icon.expanded { transform: rotate(0deg); }
.study-zone-container .tree-toggle-icon:not(.expanded) { transform: rotate(-90deg); }
.study-zone-container .tree-icon,
.study-zone-container .tree-file-icon,
.study-zone-container .selected-check { color: var(--accent); }
.study-zone-container .fullscreen-modal { background: var(--bg); color: var(--text); }
.study-zone-container .fullscreen-header {
  min-height: 64px;
  padding: var(--space-3) var(--space-5);
  border-color: var(--border);
  background: var(--surface);
}
.study-zone-container .fullscreen-header h3,
.study-zone-container .viewer-filename { color: var(--text); }
.study-zone-container .md-toolbar { gap: var(--space-2); padding: var(--space-2) var(--space-5); border-color: var(--border); background: var(--surface); }
.study-zone-container .md-toolbar button { min-height: 32px; padding: 0 var(--space-2); border-color: var(--border); border-radius: 6px; background: var(--surface-raised); color: var(--text); box-shadow: none; }
.study-zone-container .md-toolbar button:hover { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }
.study-zone-container .md-input,
.study-zone-container .md-preview { padding: var(--space-5); background: var(--surface); color: var(--text); }
.study-zone-container .md-input { border-color: var(--border); }
.study-zone-container .preview-unsupported .big-file-icon { color: var(--accent); }
.study-zone-container .email-compose-form,
.study-zone-container .inbox-content,
.study-zone-container .notification-content { padding: var(--space-5); }
.study-zone-container .compose-row label,
.study-zone-container .email-meta-info,
.study-zone-container .email-body-text { color: var(--text); }
.study-zone-container .add-att-btn,
.study-zone-container .attachment-tag-item,
.study-zone-container .filter-tab {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 34px;
  border-color: var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-raised);
  color: var(--text);
}
.study-zone-container .add-att-btn:hover,
.study-zone-container .filter-tab:hover { border-color: var(--accent); color: var(--accent); }
.study-zone-container .filter-tab.active { border-color: var(--accent); background: var(--accent); color: #fff; }
.study-zone-container .email-row {
  width: 100%;
  border: 1px solid transparent;
  border-bottom-color: var(--border);
  background: transparent;
  color: var(--text);
  font: inherit;
  text-align: left;
}
.study-zone-container .email-row:hover,
.study-zone-container .email-row.unread { background: var(--accent-soft); }
.study-zone-container .email-row:hover { border-color: var(--border); }
.study-zone-container .email-sender-name,
.study-zone-container .email-subject-line { color: var(--text); }
.study-zone-container .email-subject-line,
.study-zone-container .email-time { color: var(--muted); }
.study-zone-container .has-attachment-icon,
.study-zone-container .att-icon { color: var(--accent); }
.study-zone-container .unread-indicator { background: var(--accent); }
.study-zone-container .empty-inbox-msg,
.study-zone-container .empty-notifications { color: var(--muted); }
.study-zone-container .empty-notifications .empty-icon { color: var(--accent); }
.study-zone-container .notification-item { border-color: var(--border); border-radius: var(--radius); background: var(--surface); }
.study-zone-container .notification-indicator.success { background: var(--accent-soft); color: var(--accent); }
.study-zone-container .notification-indicator.failed { background: color-mix(in srgb, var(--danger), transparent 88%); color: var(--danger); }
.study-zone-container .notification-delete { display: grid; width: 32px; height: 32px; place-items: center; border: 0; border-radius: 6px; background: transparent; color: var(--muted); }
.study-zone-container .notification-delete:hover { background: color-mix(in srgb, var(--danger), transparent 88%); color: var(--danger); }
.study-zone-container button:disabled { opacity: .55; cursor: not-allowed; }
@media (max-width: 760px) {
  .study-zone-container .fullscreen-header,
  .study-zone-container .email-compose-form,
  .study-zone-container .inbox-content,
  .study-zone-container .notification-content { padding: var(--space-3); }
  .study-zone-container .fullscreen-header { align-items: center; }
  .study-zone-container .md-toolbar { padding: var(--space-2) var(--space-3); }
  .study-zone-container .md-editor-body { grid-template-columns: 1fr; overflow: auto; }
  .study-zone-container .md-input { min-height: 45vh; border-right: 0; border-bottom: 1px solid var(--border); }
  .study-zone-container .md-preview { min-height: 45vh; }
  .study-zone-container .email-row { align-items: flex-start; gap: var(--space-2); padding: var(--space-3); }
}
</style>
