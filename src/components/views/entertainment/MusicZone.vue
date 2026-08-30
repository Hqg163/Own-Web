<template>
  <div class="music-zone">
    <!-- 头部 -->
    <div class="zone-header">
      <button class="back-btn" type="button" @click="goBack">
        <AppIcon name="arrow-left" :size="17" />
        返回媒体库
      </button>
    </div>

    <!-- 描述区域 -->
    <div class="zone-description">
      <div class="zone-eyebrow"><AppIcon name="music" :size="18" /> 媒体库</div>
      <h3>音乐</h3>
      <p>管理个人曲目、歌词和播放队列。支持下载、全屏阅读歌词以及顺序、随机、单曲循环播放。</p>
    </div>

    <!-- 操作栏 -->
    <div class="action-bar">
      <div class="list-header">
        <h4>歌曲列表 <span class="selection-indicator-text">{{ selectionText }}</span></h4>
      </div>
      <div class="action-btns">
        <template v-if="!isFiltering">
          <button class="filter-btn" type="button" @click="startFilter">选择多个</button>
          <button class="upload-btn" type="button" @click="showUpload = true"><AppIcon name="upload" :size="17" />上传歌曲</button>
        </template>
        <template v-else>
          <button class="action-btn delete-btn" type="button" :disabled="selectedMusic.length === 0" @click="confirmDelete">
            批量删除
          </button>
          <button class="action-btn cancel-btn" type="button" @click="cancelFilter">取消</button>
        </template>
      </div>
    </div>

    <!-- 音乐列表区域 -->
    <div class="music-list-container" :class="{ 'with-lyrics': showLyricsSidebar }">
      <div class="music-list">
        <div
          v-for="(music, index) in musicList"
          :key="music.id"
          :class="['music-row', {
            'selectable': isFiltering,
            'selected': selectedMusic.includes(music.id),
            'playing': currentMusic && currentMusic.id === music.id,
            'paused': currentMusic && currentMusic.id === music.id && !isPlaying
          }]"
          @click="handleMusicClick(music)"
        >
          <div v-if="isFiltering" class="row-selection-indicator">
            <AppIcon v-if="selectedMusic.includes(music.id)" name="check" :size="17" />
          </div>

          <span class="row-number" v-if="!isFiltering">{{ index + 1 }}</span>

          <div class="music-cover" @click.stop="playMusic(music)">
            <img :src="getMusicCover(music)" :alt="music.title" />
            <div class="play-overlay">
              <div class="disc-animation" v-if="currentMusic && currentMusic.id === music.id && isPlaying">
                <div class="disc"></div>
              </div>
              <AppIcon v-else-if="currentMusic && currentMusic.id === music.id && !isPlaying" name="pause" :size="21" />
              <AppIcon v-else name="play" :size="21" />
            </div>
            <div class="playing-waves" v-if="currentMusic && currentMusic.id === music.id && isPlaying">
              <span></span><span></span><span></span>
            </div>
          </div>

          <div class="music-details" @click.stop="playMusic(music)">
            <span class="music-name" :title="music.title">{{ music.title }}</span>
            <span class="music-separator"> -- </span>
            <span class="music-artist" :title="music.artist">{{ music.artist || '未知歌手' }}</span>
            <span v-if="music.album" class="music-album">《{{ music.album }}》</span>
          </div>

          <div class="music-tools" v-if="!isFiltering">
            <button
              type="button"
              class="tool-btn play-pause-btn"
              @click.stop="togglePlayMusic(music)"
              :aria-label="isPlaying && currentMusic && currentMusic.id === music.id ? '暂停' : '播放'"
            >
              <AppIcon :name="isPlaying && currentMusic && currentMusic.id === music.id ? 'pause' : 'play'" :size="18" />
            </button>
            <button class="tool-btn more-btn" type="button" @click.stop="showMusicInfo(music)" aria-label="歌曲更多信息"><AppIcon name="more" :size="18" /></button>
            <button
              class="tool-btn lyrics-btn"
              @click.stop="toggleLyricsSidebar(music)"
              :class="{ active: showLyricsSidebar && currentMusic && currentMusic.id === music.id }"
              aria-label="显示歌词侧栏"
            >
              <AppIcon name="panel-right" :size="18" />
            </button>
            <button class="tool-btn download-btn" type="button" @click.stop="downloadMusic(music)" aria-label="下载歌曲"><AppIcon name="download" :size="18" /></button>
            <button class="tool-btn delete-tool" type="button" @click.stop="deleteSingleMusic(music)" aria-label="删除歌曲"><AppIcon name="trash" :size="18" /></button>
          </div>

          <div class="music-meta">
            <span class="music-quality" v-if="music.file_type === '.flac' || music.file_type === '.wav'">无损</span>
            <span class="music-duration">{{ formatDuration(music.duration) }}</span>
          </div>
        </div>

        <div v-if="musicList.length === 0" class="empty-music-list">
          <div class="empty-icon"><AppIcon name="music" :size="30" /></div>
          <p>暂无歌曲，点击上传按钮添加音乐</p>
          <button class="upload-empty-btn" type="button" @click="showUpload = true"><AppIcon name="upload" :size="17" />立即上传</button>
        </div>
      </div>

      <!-- 歌词侧边栏 -->
      <div v-if="showLyricsSidebar" class="lyrics-sidebar">
        <div class="lyrics-header">
          <div class="lyrics-song-info">
            <img :src="getMusicCover(currentMusic)" class="lyrics-cover" />
            <div>
              <h5>{{ currentMusic ? currentMusic.title : '未播放' }}</h5>
              <span>{{ currentMusic ? currentMusic.artist : '' }}</span>
            </div>
          </div>
          <button class="close-lyrics-btn" type="button" aria-label="关闭歌词侧栏" @click="showLyricsSidebar = false"><AppIcon name="close" :size="18" /></button>
        </div>

        <div class="lyrics-scroll-wrapper" ref="lyricsWrapper" @scroll="onLyricsScroll" @wheel="pauseLyricsFollow" @touchstart="pauseLyricsFollow" @pointerdown="pauseLyricsFollow">
          <div class="lyrics-content">
            <div
              v-for="(line, index) in parsedLyrics"
              :key="index"
              :class="['lyrics-line', { active: isCurrentLyric(index) }]"
              @click="seekToLyric(line.time)"
            >
              {{ line.text }}
            </div>

            <div v-if="!currentMusic" class="no-lyrics-playing">
              <p>请选择一首歌曲播放</p>
            </div>
            <div v-else-if="parsedLyrics.length === 0" class="no-lyrics">
              <p>该歌曲暂无可显示歌词</p>
              <button class="add-lyrics-btn" @click="showAddLyrics = true">添加歌词</button>
            </div>
          </div>
        </div>

        <div class="lyrics-controls">
          <button @click="adjustLyricsOffset(-0.5)" title="歌词提前0.5秒">−0.5s</button>
          <span>歌词偏移: {{ lyricsOffset.toFixed(1) }}s</span>
          <button @click="adjustLyricsOffset(0.5)" title="歌词延后0.5秒">+0.5s</button>
          <button type="button" @click="resetLyricsOffset" aria-label="重置歌词偏移"><AppIcon name="rotate-ccw" :size="16" /></button>
          <button v-if="!lyricsAutoScroll" type="button" class="return-lyrics-btn" @click="resumeLyricsFollow"><AppIcon name="arrow-down" :size="16" />回到当前歌词</button>
        </div>
      </div>
    </div>

    <!-- 底部播放控制栏 -->
    <transition name="slide-up">
      <div v-if="currentMusic && !fullscreenPlayer" class="mini-player" :class="{ 'is-playing': isPlaying }">
        <div class="mini-progress" @click="seekFromClick">
          <div class="progress-track">
            <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
            <div class="progress-buffer" :style="{ width: bufferedPercent + '%' }"></div>
          </div>
        </div>

        <div class="mini-content">
          <div class="mini-info" @click="openFullscreenPlayer">
            <div class="mini-cover-wrapper">
              <img :src="getMusicCover(currentMusic)" :class="{ rotating: isPlaying }" />
              <div class="mini-visualizer" v-if="isPlaying">
                <span v-for="i in 4" :key="i" :style="{ animationDelay: (i * 0.1) + 's' }"></span>
              </div>
            </div>
            <div class="mini-text">
              <span class="mini-title" :title="currentMusic.title">{{ currentMusic.title }}</span>
              <span class="mini-artist">{{ currentMusic.artist }}</span>
            </div>
          </div>

          <div class="mini-controls">
            <button class="mode-btn-mini" type="button" @click="togglePlayMode" :aria-label="playModeTitle">
              <AppIcon :name="playModeIcon" :size="18" />
            </button>
            <button type="button" @click="prevMusic" :disabled="!canGoPrev" class="nav-btn" aria-label="上一首"><AppIcon name="skip-back" :size="18" /></button>
            <button class="main-play-btn" type="button" @click="togglePlay" :aria-label="isPlaying ? '暂停' : '播放'">
              <AppIcon :name="isPlaying ? 'pause' : 'play'" :size="20" />
            </button>
            <button type="button" @click="nextMusic" :disabled="!canGoNext" class="nav-btn" aria-label="下一首"><AppIcon name="skip-forward" :size="18" /></button>
            <button class="playlist-btn-mini" type="button" @click="toggleMiniPlaylist" aria-label="播放列表"><AppIcon name="list" :size="18" /></button>
          </div>

          <div class="mini-extra">
            <div class="volume-control">
              <button type="button" @click="toggleMute" :aria-label="isMuted ? '取消静音' : '静音'"><AppIcon :name="isMuted || volume === 0 ? 'volume-x' : 'volume'" :size="18" /></button>
              <input
                type="range"
                v-model.number="volume"
                min="0"
                max="100"
                @input="changeVolume"
                class="volume-slider"
                :style="{ '--volume-percent': `${volume}%` }"
                aria-label="音量"
                :aria-valuetext="isMuted ? '已静音' : `${volume}%`"
              />
            </div>
            <button class="fullscreen-btn" type="button" @click="openFullscreenPlayer" aria-label="全屏模式"><AppIcon name="maximize" :size="18" /></button>
          </div>
        </div>

        <div v-if="showMiniPlaylist" class="mini-playlist">
          <div
            v-for="m in musicList"
            :key="m.id"
            :class="['mini-playlist-item', { active: currentMusic && currentMusic.id === m.id }]"
            @click="playMusic(m)"
          >
            <img :src="getMusicCover(m)" />
            <div class="item-info">
              <span class="item-title">{{ m.title }}</span>
              <span class="item-artist">{{ m.artist }}</span>
            </div>
            <span class="item-duration">{{ formatDuration(m.duration) }}</span>
          </div>
        </div>
      </div>
    </transition>

    <!-- 全屏播放器 -->
    <transition name="fade">
      <div v-if="fullscreenPlayer" class="fullscreen-music-player" role="dialog" aria-modal="true" aria-label="全屏音乐播放器">
        <div class="fs-background" :style="fsBackgroundStyle"></div>
        <div class="fs-background-overlay"></div>

        <div class="fs-header">
          <button class="back-btn" type="button" @click="closeFullscreenPlayer">
            <AppIcon name="arrow-left" :size="17" />
            返回音乐库
          </button>
          <div class="fs-header-center">
            <span class="fs-mode-badge">{{ playModeTitle }}</span>
            <span class="fs-title">{{ isPlaying ? '正在播放' : '已暂停' }}</span>
          </div>
          <div class="fs-volume-control">
            <button type="button" @click="toggleMute" :aria-label="isMuted ? '取消静音' : '静音'"><AppIcon :name="isMuted ? 'volume-x' : 'volume'" :size="18" /></button>
            <input
              type="range"
              v-model.number="volume"
              min="0"
              max="100"
              @input="changeVolume"
              class="fs-volume-slider"
              :style="{ '--volume-percent': `${volume}%` }"
              aria-label="音量"
              :aria-valuetext="isMuted ? '已静音' : `${volume}%`"
            />
          </div>
        </div>

        <div class="fs-body">
          <div class="fs-album-section">
            <div class="album-disc" :class="{ playing: isPlaying }">
              <img :src="getMusicCover(currentMusic)" />
              <div class="disc-center"></div>
            </div>
            <div class="album-glow"></div>
          </div>

          <!-- 全屏歌词区域 - 已修复 -->
          <div class="fs-lyrics-section">
            <div
              class="lyrics-scroll-wrapper"
              ref="fsLyricsWrapper"
              @scroll="onFsLyricsScroll"
              @wheel="pauseLyricsFollow"
              @touchstart="pauseLyricsFollow"
              @pointerdown="pauseLyricsFollow"
            >
              <div class="lyrics-content">
                <div
                  v-for="(line, index) in parsedLyrics"
                  :key="index"
                  :class="['fs-lyric-line', {
                    active: isCurrentLyric(index),
                    past: index < currentLyricIndex
                  }]"
                  @click="seekToLyric(line.time)"
                >
                  <span class="lyric-text">{{ line.text }}</span>
                </div>

                <div v-if="parsedLyrics.length === 0" class="fs-no-lyrics">
                  <div class="no-lyrics-icon"><AppIcon name="music" :size="30" /></div>
                  <p>暂无歌词</p>
                  <button class="add-lyrics-btn-large" @click="showAddLyrics = true">添加歌词</button>
                </div>
              </div>
            </div>

            <div class="next-lyric" v-if="parsedLyrics.length > 0 && currentLyricIndex < parsedLyrics.length - 1">
              <span>下一句：</span>
              {{ parsedLyrics[currentLyricIndex + 1]?.text || '' }}
            </div>
            <button v-if="!lyricsAutoScroll" type="button" class="return-lyrics-btn fs-return-lyrics-btn" @click="resumeLyricsFollow"><AppIcon name="arrow-down" :size="16" />回到当前歌词</button>
          </div>

          <div class="fs-playlist-section" :class="{ collapsed: !showFsPlaylist }">
            <button class="playlist-toggle-btn" type="button" @click="showFsPlaylist = !showFsPlaylist" :aria-label="showFsPlaylist ? '收起播放列表' : '展开播放列表'">
              <AppIcon :name="showFsPlaylist ? 'arrow-right' : 'arrow-left'" :size="17" />
            </button>
            <div v-if="showFsPlaylist" class="fs-playlist-content">
              <h4>播放列表 ({{ musicList.length }})</h4>
              <div class="fs-playlist-scroll">
                <div
                  v-for="(m, idx) in musicList"
                  :key="m.id"
                  :class="['fs-playlist-item', {
                    active: currentMusic && currentMusic.id === m.id,
                    played: playedHistory.includes(m.id)
                  }]"
                  @click="playMusic(m)"
                >
                  <span class="playlist-number">{{ idx + 1 }}</span>
                  <img :src="getMusicCover(m)" />
                  <div class="playlist-item-info">
                    <span class="playlist-title">{{ m.title }}</span>
                    <span class="playlist-artist">{{ m.artist }}</span>
                  </div>
                  <span class="playlist-duration">{{ formatDuration(m.duration) }}</span>
                  <span v-if="currentMusic && currentMusic.id === m.id" class="playing-indicator">
                    <span v-for="i in 4" :key="i"></span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="fs-controls">
          <div class="fs-song-info">
            <h3>{{ currentMusic.title }}</h3>
            <p>{{ currentMusic.artist }} <span v-if="currentMusic.album">· {{ currentMusic.album }}</span></p>
          </div>

          <div class="fs-progress-section">
            <span class="time-current">{{ formatTime(currentTime) }}</span>
            <div class="fs-progress-bar" @click="seekFromFsClick" ref="fsProgressBar">
              <div class="progress-track">
                <div class="progress-fill" :style="{ width: progressPercent + '%' }">
                  <div class="progress-handle"></div>
                </div>
              </div>
            </div>
            <span class="time-total">{{ formatTime(totalDuration) }}</span>
          </div>

          <div class="fs-buttons">
            <button class="mode-btn" type="button" @click="togglePlayMode" :aria-label="playModeTitle">
              <AppIcon class="mode-icon" :name="playModeIcon" :size="18" />
              <span class="mode-text">{{ playModeTitle }}</span>
            </button>

            <div class="main-controls">
              <button type="button" @click="prevMusic" :disabled="!canGoPrev" class="nav-btn large" aria-label="上一首">
                <AppIcon name="skip-back" :size="23" />
              </button>
              <button class="fs-play-btn" type="button" @click="togglePlay" :class="{ playing: isPlaying }" :aria-label="isPlaying ? '暂停' : '播放'">
                <AppIcon :name="isPlaying ? 'pause' : 'play'" :size="25" />
              </button>
              <button type="button" @click="nextMusic" :disabled="!canGoNext" class="nav-btn large" aria-label="下一首">
                <AppIcon name="skip-forward" :size="23" />
              </button>
            </div>

            <div class="extra-controls">
              <button
                :class="['lyrics-toggle-btn', { active: showLyricsSidebar }]"
                type="button"
                @click="toggleLyricsSidebar(currentMusic)"
                aria-label="切换歌词侧栏"
              >
                <AppIcon name="panel-right" :size="18" />
              </button>
              <button class="playlist-toggle-fs" type="button" @click="showFsPlaylist = !showFsPlaylist" aria-label="播放列表">
                <AppIcon name="list" :size="18" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- 歌曲信息弹窗 -->
    <div v-if="showInfoModal" class="modal-overlay info-overlay" @click.self="showInfoModal = false">
      <div class="info-modal modern" role="dialog" aria-modal="true" aria-label="歌曲信息">
        <div class="info-header">
          <img :src="getMusicCover(infoModalData)" />
          <div class="info-header-text">
            <h3>{{ infoModalData.title }}</h3>
            <p>{{ infoModalData.artist }}</p>
          </div>
        </div>
        <div class="info-body">
          <div class="info-row">
            <label>歌曲名</label>
            <span>{{ infoModalData.title }}</span>
          </div>
          <div class="info-row">
            <label>歌手</label>
            <span>{{ infoModalData.artist || '未知' }}</span>
          </div>
          <div class="info-row">
            <label>专辑</label>
            <span>{{ infoModalData.album || '未知' }}</span>
          </div>
          <div class="info-row">
            <label>发行时间</label>
            <span>{{ infoModalData.release_date || '未知' }}</span>
          </div>
          <div class="info-row">
            <label>时长</label>
            <span>{{ formatDuration(infoModalData.duration) }}</span>
          </div>
          <div class="info-row">
            <label>格式</label>
            <span class="format-badge" :class="infoModalData.file_type">{{ infoModalData.file_type }}</span>
          </div>
          <div class="info-row">
            <label>文件大小</label>
            <span>{{ formatFileSize(infoModalData.file_size) }}</span>
          </div>
        </div>
        <div class="info-actions">
          <button class="primary-btn" @click="playMusic(infoModalData)">播放歌曲</button>
          <button @click="showInfoModal = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- 添加歌词弹窗 -->
    <div v-if="showAddLyrics" class="modal-overlay" @click.self="showAddLyrics = false">
      <div class="lyrics-input-modal" role="dialog" aria-modal="true" aria-label="添加歌词">
        <h3>添加歌词</h3>
        <p class="hint">支持LRC格式：[mm:ss.xx]歌词内容</p>
        <textarea v-model="newLyricsText" placeholder="在此粘贴歌词..." rows="10"></textarea>
        <div class="actions">
          <button class="primary-btn" @click="saveLyrics">保存歌词</button>
          <button @click="showAddLyrics = false">取消</button>
        </div>
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <div v-if="showDeleteConfirm" class="modal-overlay" @click.self="showDeleteConfirm = false">
      <div class="delete-modal modern" role="dialog" aria-modal="true" aria-label="确认删除歌曲">
        <div class="delete-icon"><AppIcon name="trash" :size="28" /></div>
        <h3>确认删除</h3>
        <p>是否要删除这 <strong>{{ selectedMusic.length }}</strong> 首歌曲？</p>
        <p class="delete-warning">删除后无法恢复</p>
        <div class="actions">
          <button class="danger-btn" @click="executeDelete">确定删除</button>
          <button @click="showDeleteConfirm = false">取消</button>
        </div>
      </div>
    </div>

    <!-- 上传弹窗 -->
    <div v-if="showUpload" class="modal-overlay" @click.self="closeUpload">
      <div class="upload-modal modern" role="dialog" aria-modal="true" aria-label="上传歌曲">
        <h3>上传歌曲</h3>
        <div class="upload-steps">
          <div :class="['step', { active: uploadStep === 1, done: uploadStep > 1 }]">1.填写信息</div>
          <div :class="['step', { active: uploadStep === 2, done: uploadStep > 2 }]">2.选择文件</div>
          <div :class="['step', { active: uploadStep === 3 }]">3.完成</div>
        </div>

        <div v-if="uploadStep === 1" class="step-content">
          <div class="form-group">
            <label>歌曲名 <span class="required">*</span></label>
            <input v-model="uploadForm.title" placeholder="输入歌曲名" @blur="validateTitle" />
            <span class="error-msg" v-if="errors.title">{{ errors.title }}</span>
          </div>
          <div class="form-group">
            <label>歌手 <span class="required">*</span></label>
            <input v-model="uploadForm.artist" placeholder="输入歌手名" @blur="validateArtist" />
            <span class="error-msg" v-if="errors.artist">{{ errors.artist }}</span>
          </div>
          <div class="form-group">
            <label>专辑（可选）</label>
            <input v-model="uploadForm.album" placeholder="输入专辑名" />
          </div>
          <div class="form-group">
            <label>发行时间（可选）</label>
            <input type="date" v-model="uploadForm.releaseDate" />
          </div>
          <div class="actions">
            <button class="primary-btn" :disabled="!canProceedStep1" @click="uploadStep = 2">下一步</button>
            <button @click="closeUpload">取消</button>
          </div>
        </div>

        <div v-if="uploadStep === 2" class="step-content">
          <div class="file-drop-zone"
               :class="{ dragging: isDragging }"
               @dragover.prevent="isDragging = true"
               @dragleave="isDragging = false"
               @drop.prevent="handleFileDrop">
            <input type="file" ref="fileInput" accept="audio/*" @change="handleFileSelect" hidden />
            <div class="drop-content" @click="$refs.fileInput.click()">
              <div class="upload-icon"><AppIcon name="folder" :size="30" /></div>
              <p v-if="!uploadForm.file">点击或拖拽文件到此处</p>
              <p v-else class="selected-file">{{ uploadForm.file.name }}</p>
              <span class="file-hint">支持 MP3, FLAC, WAV, AAC 等格式</span>
            </div>
          </div>

          <div class="file-info" v-if="uploadForm.file">
            <div class="info-item">
              <span>大小：</span>
              <span>{{ formatFileSize(uploadForm.file.size) }}</span>
            </div>
            <div class="info-item">
              <span>类型：</span>
              <span>{{ uploadForm.file.type }}</span>
            </div>
          </div>

          <div class="actions">
            <button class="secondary-btn" @click="uploadStep = 1">上一步</button>
            <button class="primary-btn" :disabled="!uploadForm.file" @click="uploadMusic">开始上传</button>
          </div>
        </div>

        <div v-if="uploadStep === 3" class="step-content center">
          <div class="upload-success">
            <div class="success-icon"><AppIcon name="check" :size="28" /></div>
            <h4>上传成功！</h4>
            <p>{{ uploadForm.title }} - {{ uploadForm.artist }}</p>
          </div>
          <div class="actions">
            <button class="primary-btn" @click="closeUploadAndRefresh">完成</button>
            <button @click="uploadAnother">继续上传</button>
          </div>
        </div>

        <div v-if="isUploading" class="upload-progress">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: uploadProgress + '%' }"></div>
          </div>
          <span>{{ uploadProgress }}%</span>
        </div>
      </div>
    </div>

    <!-- 音频元素 -->
    <audio
      ref="audioPlayer"
      @timeupdate="updateTime"
      @ended="onMusicEnded"
      @loadedmetadata="onMetadataLoaded"
      @progress="onProgress"
      @waiting="onBuffering"
      @playing="onPlaying"
    ></audio>

    <!-- Toast -->
    <div v-if="toast.show" class="toast modern" :class="toast.type">{{ toast.message }}</div>

    <!-- 快捷键提示 -->
    <div v-if="showShortcuts" class="shortcuts-overlay" @click="showShortcuts = false">
      <div class="shortcuts-modal" role="dialog" aria-modal="true" aria-label="键盘快捷键">
        <h3>键盘快捷键</h3>
        <div class="shortcut-list">
          <div><kbd>Space</kbd> 播放/暂停</div>
          <div><kbd>←</kbd> 上一首</div>
          <div><kbd>→</kbd> 下一首</div>
          <div><kbd>↑</kbd> 音量+</div>
          <div><kbd>↓</kbd> 音量-</div>
          <div><kbd>M</kbd> 静音</div>
          <div><kbd>F</kbd> 全屏模式</div>
          <div><kbd>L</kbd> 歌词开关</div>
          <div><kbd>Esc</kbd> 退出全屏</div>
        </div>
        <button @click="showShortcuts = false">知道了</button>
      </div>
    </div>

    <button class="shortcuts-hint-btn" type="button" @click="showShortcuts = true" aria-label="键盘快捷键"><AppIcon name="keyboard" :size="18" /></button>
  </div>
</template>

<script>
import axios from '@/services/http'
import AppIcon from '@/components/AppIcon.vue'
import { findActiveLyricIndex, getCenteredScrollTop, parseLrc } from '@/utils/lrc'

export default {
  name: 'MusicZone',
  components: { AppIcon },
  data() {
    return {
      userId: null,
      musicList: [],

      // 播放状态
      currentMusic: null,
      isPlaying: false,
      currentTime: 0,
      totalDuration: 0,
      bufferedTime: 0,
      isBuffering: false,
      playMode: 'sequence',
      volume: 80,
      isMuted: false,
      previousVolume: 80,
      playedHistory: [],

      // 歌词
      currentLyrics: '',
      parsedLyrics: [],
      currentLyricIndex: -1,
      lyricsOffset: 0,
      lrcOffset: 0,
      lyricsOffsetSaveTimer: null,
      lyricsAutoScroll: true,
      lyricsScrollTimer: null,
      lyricsProgrammaticScroll: false,
      lyricsSyncFrame: null,
      lyricsResizeObserver: null,

      // 筛选
      isFiltering: false,
      selectedMusic: [],

      // UI状态
      fullscreenPlayer: false,
      showFsPlaylist: true,
      showMiniPlaylist: false,
      showLyricsSidebar: false,
      showInfoModal: false,
      infoModalData: {},
      showDeleteConfirm: false,
      showUpload: false,
      uploadStep: 1,
      isUploading: false,
      uploadProgress: 0,
      isDragging: false,
      showAddLyrics: false,
      newLyricsText: '',
      showShortcuts: false,

      // 表单
      uploadForm: { title: '', artist: '', album: '', releaseDate: '', file: null },
      errors: {},

      toast: { show: false, message: '', type: 'success' }
    }
  },
  computed: {
    selectionText() {
      if (!this.isFiltering) return ''
      if (this.selectedMusic.length === 0) return '（未选择）'
      return `（已选择 ${this.selectedMusic.length} 首歌曲）`
    },
    playModeIcon() {
      const icons = { 'sequence': 'repeat', 'random': 'shuffle', 'single': 'repeat-1' }
      return icons[this.playMode]
    },
    playModeTitle() {
      const titles = { 'sequence': '顺序播放', 'random': '随机播放', 'single': '单曲循环' }
      return titles[this.playMode]
    },
    progressPercent() {
      if (!this.totalDuration) return 0
      return (this.currentTime / this.totalDuration) * 100
    },
    bufferedPercent() {
      if (!this.totalDuration) return 0
      return (this.bufferedTime / this.totalDuration) * 100
    },
    canGoPrev() {
      if (this.musicList.length <= 1) return false
      if (this.playMode === 'random') return true
      const currentIdx = this.musicList.findIndex(m => m.id === this.currentMusic?.id)
      return currentIdx > 0
    },
    canGoNext() {
      if (this.musicList.length <= 1) return false
      if (this.playMode === 'random') return true
      const currentIdx = this.musicList.findIndex(m => m.id === this.currentMusic?.id)
      return currentIdx < this.musicList.length - 1
    },
    canProceedStep1() {
      return this.uploadForm.title.trim() && this.uploadForm.artist.trim() && !this.errors.title && !this.errors.artist
    },
    fsBackgroundStyle() {
      if (!this.currentMusic) return {}
      return { backgroundImage: `url(${this.getMusicCover(this.currentMusic)})` }
    }
  },
  watch: {
    currentTime(newVal) {
      this.scheduleLyricsSync(newVal)
    },
    volume(newVal) {
      if (this.$refs.audioPlayer) {
        this.$refs.audioPlayer.volume = newVal / 100
        if (newVal > 0 && this.isMuted) this.isMuted = false
      }
    }
  },
  created() {
    this.userId = localStorage.getItem('userId')
    if (!this.userId) {
      this.$router.push('/login')
      return
    }
    this.loadMusic()
    this.setupKeyboardShortcuts()
    this.loadVolumeSetting()
  },
  mounted() {
    this.lyricsResizeObserver = new ResizeObserver(() => this.scheduleLyricsSync(this.currentTime, true))
  },
  beforeUnmount() {
    this.removeKeyboardShortcuts()
    if (this.lyricsScrollTimer) clearTimeout(this.lyricsScrollTimer)
    if (this.lyricsSyncFrame) cancelAnimationFrame(this.lyricsSyncFrame)
    if (this.lyricsResizeObserver) this.lyricsResizeObserver.disconnect()
    if (this.$refs.audioPlayer) this.$refs.audioPlayer.pause()
    document.body.style.overflow = ''
  },
  methods: {
    loadVolumeSetting() {
      const saved = localStorage.getItem('musicVolume')
      if (saved !== null) this.volume = parseInt(saved)
    },

    saveVolumeSetting() {
      localStorage.setItem('musicVolume', this.volume)
    },

    setupKeyboardShortcuts() {
      document.addEventListener('keydown', this.handleKeyDown)
    },

    removeKeyboardShortcuts() {
      document.removeEventListener('keydown', this.handleKeyDown)
    },

    handleKeyDown(e) {
      const target = e.target
      if (target?.closest?.('input, textarea, select, [contenteditable="true"]')) return

      switch(e.code) {
        case 'Space':
          e.preventDefault()
          this.togglePlay()
          break
        case 'ArrowLeft':
          if (e.ctrlKey || e.metaKey) this.prevMusic()
          break
        case 'ArrowRight':
          if (e.ctrlKey || e.metaKey) this.nextMusic()
          break
        case 'ArrowUp':
          this.volume = Math.min(100, this.volume + 5)
          this.saveVolumeSetting()
          break
        case 'ArrowDown':
          this.volume = Math.max(0, this.volume - 5)
          this.saveVolumeSetting()
          break
        case 'KeyM':
          this.toggleMute()
          break
        case 'KeyF':
          if (!this.fullscreenPlayer && this.currentMusic) {
            this.openFullscreenPlayer()
          } else {
            this.closeFullscreenPlayer()
          }
          break
        case 'KeyL':
          if (this.currentMusic) this.toggleLyricsSidebar(this.currentMusic)
          break
        case 'Escape':
          if (this.showShortcuts) { this.showShortcuts = false; break }
          if (this.showAddLyrics) { this.showAddLyrics = false; break }
          if (this.showDeleteConfirm) { this.showDeleteConfirm = false; break }
          if (this.showInfoModal) { this.showInfoModal = false; break }
          if (this.showUpload) { this.closeUpload(); break }
          if (this.fullscreenPlayer) this.closeFullscreenPlayer()
          break
      }
    },

    async loadMusic() {
      try {
        const res = await axios.get(`/api/entertainment/music/${this.userId}`)
        this.musicList = res.data.music || []
      } catch (err) {
        this.showToast('加载音乐失败', 'error')
      }
    },

    getMusicCover(music) {
      if (!music) return ''
      if (music.cover_path) return music.cover_path
      return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300' viewBox='0 0 300 300'%3E%3Crect width='300' height='300' fill='%23e7e8e4'/%3E%3Ccircle cx='150' cy='150' r='89' fill='none' stroke='%234d6177' stroke-width='5'/%3E%3Ccircle cx='150' cy='150' r='28' fill='%234d6177'/%3E%3Cpath d='M137 113v75l55-16' fill='none' stroke='%234d6177' stroke-width='12' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"
    },

    generateColorsFromString(str) {
      let hash = 0
      for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash)
      }
      const c1 = Math.abs(hash % 360)
      const c2 = (c1 + 40) % 360
      return [this.hslToHex(c1, 70, 50), this.hslToHex(c2, 70, 40)]
    },

    hslToHex(h, s, l) {
      l /= 100
      const a = s * Math.min(l, 1 - l) / 100
      const f = n => {
        const k = (n + h / 30) % 12
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
        return Math.round(255 * color).toString(16).padStart(2, '0')
      }
      return `${f(0)}${f(8)}${f(4)}`
    },

    getMusicUrl(music) {
      return `/api/entertainment/music-file/${music.id}`
    },

    formatDuration(duration) {
      if (!duration) return '0:00'
      if (typeof duration === 'string' && duration.includes(':')) {
        const parts = duration.split(':')
        if (parts.length === 2) return duration
        if (parts.length === 3) {
          const h = parseInt(parts[0]), m = parseInt(parts[1]), s = parts[2]
          return `${h * 60 + m}:${s}`
        }
      }
      const seconds = parseInt(duration) || 0
      const m = Math.floor(seconds / 60)
      const s = seconds % 60
      return `${m}:${s.toString().padStart(2, '0')}`
    },

    formatFileSize(bytes) {
      if (!bytes) return '0 B'
      const units = ['B', 'KB', 'MB', 'GB']
      let size = bytes, unitIndex = 0
      while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024
        unitIndex++
      }
      return size.toFixed(2) + ' ' + units[unitIndex]
    },

    formatTime(seconds) {
      if (!seconds || isNaN(seconds)) return '0:00'
      const m = Math.floor(seconds / 60)
      const s = Math.floor(seconds % 60)
      return `${m}:${s.toString().padStart(2, '0')}`
    },

    playMusic(music, addToHistory = true) {
      if (!music) return

      if (this.currentMusic && this.currentMusic.id === music.id) {
        this.togglePlay()
        return
      }

      this.currentMusic = music
      const audio = this.$refs.audioPlayer

      if (addToHistory && !this.playedHistory.includes(music.id)) {
        this.playedHistory.push(music.id)
      }

      this.incrementPlayCount(music.id)

      audio.src = this.getMusicUrl(music)
      audio.load()

      audio.oncanplaythrough = () => {
        audio.play()
        this.isPlaying = true
        this.loadLyrics(music)
      }
    },

    async incrementPlayCount(musicId) {
      try {
        await axios.post(`/api/entertainment/music/${musicId}/play`, { userId: this.userId })
      } catch (e) {}
    },

    togglePlay() {
      if (!this.currentMusic) {
        if (this.musicList.length > 0) this.playMusic(this.musicList[0])
        return
      }

      const audio = this.$refs.audioPlayer
      if (audio.paused) {
        audio.play()
        this.isPlaying = true
      } else {
        audio.pause()
        this.isPlaying = false
      }
    },

    togglePlayMusic(music) {
      if (this.currentMusic && this.currentMusic.id === music.id) {
        this.togglePlay()
      } else {
        this.playMusic(music)
      }
    },

    prevMusic() {
      if (!this.currentMusic || this.musicList.length === 0) return

      let prevIdx
      const currentIdx = this.musicList.findIndex(m => m.id === this.currentMusic.id)

      if (this.playMode === 'random') {
        if (this.playedHistory.length > 1) {
          this.playedHistory.pop()
          const prevId = this.playedHistory[this.playedHistory.length - 1]
          prevIdx = this.musicList.findIndex(m => m.id === prevId)
        } else {
          prevIdx = Math.floor(Math.random() * this.musicList.length)
        }
      } else {
        prevIdx = currentIdx - 1
        if (prevIdx < 0) {
          if (this.playMode === 'single') prevIdx = this.musicList.length - 1
          else {
            this.showToast('已经是第一首了')
            return
          }
        }
      }

      this.playMusic(this.musicList[prevIdx])
    },

    nextMusic() {
      if (!this.currentMusic || this.musicList.length === 0) return

      let nextIdx
      const currentIdx = this.musicList.findIndex(m => m.id === this.currentMusic.id)

      if (this.playMode === 'random') {
        nextIdx = Math.floor(Math.random() * this.musicList.length)
        let attempts = 0
        while (this.musicList[nextIdx].id === this.currentMusic.id && attempts < 5) {
          nextIdx = Math.floor(Math.random() * this.musicList.length)
          attempts++
        }
      } else {
        nextIdx = currentIdx + 1
        if (nextIdx >= this.musicList.length) {
          if (this.playMode === 'single') nextIdx = 0
          else {
            this.showToast('已经是最后一首了')
            return
          }
        }
      }

      this.playMusic(this.musicList[nextIdx])
    },

    togglePlayMode() {
      const modes = ['sequence', 'random', 'single']
      const currentIdx = modes.indexOf(this.playMode)
      this.playMode = modes[(currentIdx + 1) % modes.length]
      this.showToast(`已切换到${this.playModeTitle}`)
    },

    onMusicEnded() {
      if (this.playMode === 'single') {
        this.$refs.audioPlayer.currentTime = 0
        this.$refs.audioPlayer.play()
      } else {
        this.nextMusic()
      }
    },

    // ========== 歌词处理 ==========
    loadLyrics(music) {
      if (!music) return

      this.currentLyricIndex = -1
      this.lyricsOffset = 0
      this.lyricsAutoScroll = true

      if (music.lyrics) {
        this.currentLyrics = music.lyrics
        this.parseLyrics(music.lyrics)
      } else {
        this.currentLyrics = ''
        this.parsedLyrics = []
        const savedLyrics = localStorage.getItem(`lyrics_${music.id}`)
        if (savedLyrics) {
          this.currentLyrics = savedLyrics
          this.parseLyrics(savedLyrics)
        }
      }
      this.lyricsOffset = this.lrcOffset + (Number(music.lyrics_offset_ms) || 0) / 1000

      if (this.parsedLyrics.length > 0) {
        this.$nextTick(() => {
          this.observeLyricsWrappers()
          this.scheduleLyricsSync(this.currentTime, true)
        })
      }
    },

    parseLyrics(lyricsText) {
      const parsed = parseLrc(lyricsText || '')
      this.parsedLyrics = parsed.lines
      this.lrcOffset = parsed.offsetSeconds
    },

    isCurrentLyric(index) {
      const active = this.parsedLyrics[this.currentLyricIndex]
      return Boolean(active && this.parsedLyrics[index]?.time === active.time)
    },

    observeLyricsWrappers() {
      if (!this.lyricsResizeObserver) return
      const wrappers = [this.$refs.lyricsWrapper, this.$refs.fsLyricsWrapper].filter(Boolean)
      wrappers.forEach((wrapper) => this.lyricsResizeObserver.observe(wrapper))
    },

    scheduleLyricsSync(currentTime, force = false) {
      if (this.lyricsSyncFrame) cancelAnimationFrame(this.lyricsSyncFrame)
      this.lyricsSyncFrame = requestAnimationFrame(() => {
        this.lyricsSyncFrame = null
        const nextIndex = findActiveLyricIndex(this.parsedLyrics, currentTime, this.lyricsOffset)
        const changed = nextIndex !== this.currentLyricIndex
        this.currentLyricIndex = nextIndex
        if ((changed || force) && this.lyricsAutoScroll) this.scrollLyrics()
      })
    },

    scrollLyrics() {
      this.$nextTick(() => {
        const wrappers = [this.$refs.lyricsWrapper, this.$refs.fsLyricsWrapper].filter(Boolean)
        wrappers.forEach((wrapper) => {
          const activeLine = wrapper.querySelector('.active')
          if (!activeLine) return
          const target = getCenteredScrollTop(wrapper.clientHeight, wrapper.scrollHeight, activeLine.offsetTop, activeLine.clientHeight)
          this.lyricsProgrammaticScroll = true
          wrapper.scrollTo({ top: target, behavior: 'auto' })
          requestAnimationFrame(() => { this.lyricsProgrammaticScroll = false })
        })
      })
    },

    pauseLyricsFollow() {
      if (this.lyricsProgrammaticScroll) return
      this.lyricsAutoScroll = false
      if (this.lyricsScrollTimer) clearTimeout(this.lyricsScrollTimer)
      this.lyricsScrollTimer = setTimeout(() => this.resumeLyricsFollow(), 5000)
    },

    resumeLyricsFollow() {
      if (this.lyricsScrollTimer) clearTimeout(this.lyricsScrollTimer)
      this.lyricsAutoScroll = true
      this.scheduleLyricsSync(this.currentTime, true)
    },

    onLyricsScroll() {
      if (!this.lyricsProgrammaticScroll) this.pauseLyricsFollow()
    },

    onFsLyricsScroll(e) {
      e.stopPropagation()
      this.onLyricsScroll()
    },

    seekToLyric(time) {
      if (time === undefined) return
      const adjustedTime = time + this.lyricsOffset
      this.$refs.audioPlayer.currentTime = Math.max(0, adjustedTime)
      this.currentTime = adjustedTime
      this.resumeLyricsFollow()
    },

    adjustLyricsOffset(delta) {
      this.lyricsOffset = Math.max(-30, Math.min(30, this.lyricsOffset + delta))
      this.scheduleLyricsSync(this.currentTime, true)
      this.queueLyricsOffsetSave()
    },

    resetLyricsOffset() {
      this.lyricsOffset = this.lrcOffset
      this.scheduleLyricsSync(this.currentTime, true)
      this.queueLyricsOffsetSave()
    },

    queueLyricsOffsetSave() {
      if (!this.currentMusic) return
      if (this.lyricsOffsetSaveTimer) clearTimeout(this.lyricsOffsetSaveTimer)
      this.lyricsOffsetSaveTimer = setTimeout(() => this.saveLyricsOffset(), 500)
    },

    async saveLyricsOffset() {
      if (!this.currentMusic) return
      try {
        await axios.put(`/api/entertainment/music/${this.currentMusic.id}/lyrics`, {
          lyrics: this.currentLyrics || '',
          lyricsOffsetMs: Math.round((this.lyricsOffset - this.lrcOffset) * 1000)
        })
        this.currentMusic.lyrics_offset_ms = Math.round((this.lyricsOffset - this.lrcOffset) * 1000)
      } catch (_) {
        this.showToast('歌词偏移未能保存，请稍后重试', 'error')
      }
    },

    // ========== 音频事件 ==========

    updateTime() {
      const audio = this.$refs.audioPlayer
      this.currentTime = audio.currentTime
    },

    onMetadataLoaded() {
      this.totalDuration = this.$refs.audioPlayer.duration
    },

    onProgress() {
      const audio = this.$refs.audioPlayer
      if (audio.buffered.length > 0) {
        this.bufferedTime = audio.buffered.end(audio.buffered.length - 1)
      }
    },

    onBuffering() {
      this.isBuffering = true
    },

    onPlaying() {
      this.isBuffering = false
    },

    seekFromClick(e) {
      const rect = e.currentTarget.getBoundingClientRect()
      const percent = (e.clientX - rect.left) / rect.width
      const newTime = percent * this.totalDuration
      this.$refs.audioPlayer.currentTime = newTime
      this.currentTime = newTime
    },

    seekFromFsClick(e) {
      const rect = this.$refs.fsProgressBar.getBoundingClientRect()
      const percent = (e.clientX - rect.left) / rect.width
      const newTime = Math.max(0, Math.min(1, percent)) * this.totalDuration
      this.$refs.audioPlayer.currentTime = newTime
      this.currentTime = newTime
    },

    toggleMute() {
      const audio = this.$refs.audioPlayer
      if (this.isMuted) {
        this.volume = this.previousVolume || 80
        this.isMuted = false
      } else {
        this.previousVolume = this.volume
        this.volume = 0
        this.isMuted = true
      }
      this.saveVolumeSetting()
    },

    changeVolume() {
      this.saveVolumeSetting()
      if (this.volume > 0 && this.isMuted) this.isMuted = false
    },

    // ========== 导航和UI ==========

    goBack() {
      this.$router.push('/personal/entertainment')
    },

    // 关键修复：打开全屏播放器
    openFullscreenPlayer() {
      if (!this.currentMusic) return

      this.fullscreenPlayer = true
      document.body.style.overflow = 'hidden'

      this.lyricsAutoScroll = true

      this.$nextTick(() => {
        const wrapper = this.$refs.fsLyricsWrapper
        if (wrapper) wrapper.scrollTop = 0
        this.observeLyricsWrappers()
        requestAnimationFrame(() => this.scheduleLyricsSync(this.currentTime, true))
      })
    },

    closeFullscreenPlayer() {
      this.fullscreenPlayer = false
      this.showFsPlaylist = true
      document.body.style.overflow = ''
    },

    toggleLyricsSidebar(music) {
      if (!music) return
      if (this.showLyricsSidebar && this.currentMusic && this.currentMusic.id === music.id) {
        this.showLyricsSidebar = false
      } else {
        if (!this.currentMusic || this.currentMusic.id !== music.id) this.playMusic(music)
        else this.loadLyrics(music)
        this.showLyricsSidebar = true
        this.$nextTick(() => {
          this.observeLyricsWrappers()
          this.scheduleLyricsSync(this.currentTime, true)
        })
      }
    },

    toggleMiniPlaylist() {
      this.showMiniPlaylist = !this.showMiniPlaylist
    },

    startFilter() {
      this.isFiltering = true
      this.selectedMusic = []
    },

    cancelFilter() {
      this.isFiltering = false
      this.selectedMusic = []
    },

    handleMusicClick(music) {
      if (this.isFiltering) {
        const idx = this.selectedMusic.indexOf(music.id)
        if (idx > -1) {
          this.selectedMusic.splice(idx, 1)
        } else {
          this.selectedMusic.push(music.id)
        }
      } else {
        this.playMusic(music)
      }
    },

    showMusicInfo(music) {
      this.infoModalData = { ...music, play_count: music.play_count || 0 }
      this.showInfoModal = true
    },

    async downloadMusic(music) {
      try {
        const response = await axios.get(this.getMusicUrl(music), { responseType: 'blob' })
        const blob = new Blob([response.data])
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${music.title} - ${music.artist}${music.file_type}`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
        this.showToast('开始下载')
      } catch (err) {
        this.showToast('下载失败', 'error')
      }
    },

    deleteSingleMusic(music) {
      this.selectedMusic = [music.id]
      this.showDeleteConfirm = true
    },

    confirmDelete() {
      if (this.selectedMusic.length === 0) return
      this.showDeleteConfirm = true
    },

    async executeDelete() {
      try {
        await axios.delete('/api/entertainment/music', {
          data: { userId: this.userId, musicIds: this.selectedMusic }
        })

        if (this.currentMusic && this.selectedMusic.includes(this.currentMusic.id)) {
          const remainingMusic = this.musicList.filter(m => !this.selectedMusic.includes(m.id))
          if (remainingMusic.length > 0) {
            const currentIdx = this.musicList.findIndex(m => m.id === this.currentMusic.id)
            const nextMusic = this.musicList[currentIdx + 1] || remainingMusic[0]
            this.playMusic(nextMusic, false)
          } else {
            this.currentMusic = null
            this.isPlaying = false
          }
        }

        this.showToast(`成功删除 ${this.selectedMusic.length} 首歌曲`)
        this.showDeleteConfirm = false
        this.loadMusic()
        this.cancelFilter()
      } catch (err) {
        this.showToast('删除失败', 'error')
      }
    },

    validateTitle() {
      this.errors.title = this.uploadForm.title.trim() ? '' : '请输入歌曲名'
    },

    validateArtist() {
      this.errors.artist = this.uploadForm.artist.trim() ? '' : '请输入歌手名'
    },

    handleFileSelect(event) {
      const file = event.target.files[0]
      this.processFile(file)
    },

    handleFileDrop(e) {
      this.isDragging = false
      const file = e.dataTransfer.files[0]
      this.processFile(file)
    },

    processFile(file) {
      if (!file) return
      if (!file.type.startsWith('audio/')) {
        this.showToast('请选择音频文件', 'error')
        return
      }
      if (file.size > 100 * 1024 * 1024) {
        this.showToast('文件大小不能超过100MB', 'error')
        return
      }

      this.uploadForm.file = file

      const audio = new Audio()
      audio.preload = 'metadata'
      audio.src = URL.createObjectURL(file)
      audio.onloadedmetadata = () => {
        URL.revokeObjectURL(audio.src)
      }
    },

    async uploadMusic() {
      if (!this.uploadForm.file) return

      this.isUploading = true
      this.uploadProgress = 0

      const formData = new FormData()
      formData.append('music', this.uploadForm.file)
      formData.append('userId', this.userId)
      formData.append('title', this.uploadForm.title.trim())
      formData.append('artist', this.uploadForm.artist.trim())
      formData.append('album', this.uploadForm.album.trim())
      formData.append('releaseDate', this.uploadForm.releaseDate)

      try {
        await axios.post('/api/entertainment/music', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            this.uploadProgress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          }
        })

        this.uploadStep = 3
        this.loadMusic()
      } catch (err) {
        this.showToast(err.response?.data?.error || '上传失败', 'error')
        this.isUploading = false
      }
    },

    closeUpload() {
      this.showUpload = false
      this.uploadStep = 1
      this.uploadForm = { title: '', artist: '', album: '', releaseDate: '', file: null }
      this.errors = {}
      this.isUploading = false
      this.uploadProgress = 0
    },

    closeUploadAndRefresh() {
      this.closeUpload()
      this.loadMusic()
    },

    uploadAnother() {
      this.uploadStep = 1
      this.uploadForm = { title: '', artist: '', album: '', releaseDate: '', file: null }
      this.isUploading = false
      this.uploadProgress = 0
    },

    async saveLyrics() {
      if (!this.newLyricsText.trim() || !this.currentMusic) return

      try {
        await axios.put(`/api/entertainment/music/${this.currentMusic.id}/lyrics`, {
          lyrics: this.newLyricsText,
          lyricsOffsetMs: 0
        })

        localStorage.setItem(`lyrics_${this.currentMusic.id}`, this.newLyricsText)
        this.currentLyrics = this.newLyricsText
        this.parseLyrics(this.newLyricsText)
        this.showAddLyrics = false
        this.newLyricsText = ''
        this.showToast('歌词保存成功')
      } catch (err) {
        this.showToast(err.response?.data?.error || '歌词保存失败，请稍后重试', 'error')
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
.music-zone {
  /* Transitional aliases keep legacy selectors tied to the shared token system. */
  min-height: 100vh;
  padding: 20px;
  padding-bottom: 120px;
  transition: all 0.3s ease;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* 头部 */
.zone-header {
  margin-bottom: 20px;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  color: var(--text);
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: var(--shadow);
}

.back-btn:hover {
  transform: translateX(-4px);
  box-shadow: var(--shadow);
  border-color: var(--accent);
}

/* 描述区域 */
.zone-description {
  background: var(--surface);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: var(--shadow);
  border: 1px solid var(--border);
}

.zone-description h3 {
  margin: 0 0 16px 0;
  color: var(--text);
  font-size: 24px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 2px solid var(--accent);
}

.zone-description p {
  margin: 8px 0;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.6;
  padding-left: 8px;
  border-left: 3px solid var(--accent-soft);
}

/* 操作栏 */
.action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 16px 20px;
  background: var(--surface);
  border-radius: 12px;
  box-shadow: var(--shadow);
  border: 1px solid var(--border);
}

.list-header h4 {
  margin: 0;
  color: var(--text);
  font-size: 18px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 12px;
}

.selection-indicator-text {
  font-size: 14px;
  color: var(--subtle);
  font-weight: 400;
  background: var(--bg);
  padding: 4px 12px;
  border-radius: 20px;
}

.action-btns {
  display: flex;
  gap: 12px;
}

.action-btns button {
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
  border: none;
  display: flex;
  align-items: center;
  gap: 6px;
}

.filter-btn, .upload-btn {
  background: var(--accent);
  color: white;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.filter-btn:hover, .upload-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
}

.delete-btn {
  background: var(--danger);
  color: white;
}

.delete-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.cancel-btn {
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--border);
}

/* 音乐列表容器 */
.music-list-container {
  display: flex;
  gap: 20px;
  min-height: 500px;
}

.music-list-container.with-lyrics .music-list {
  flex: 1.5;
}

.music-list {
  flex: 1;
  background: var(--surface);
  border-radius: 16px;
  box-shadow: var(--shadow);
  border: 1px solid var(--border);
  overflow: hidden;
}

/* 音乐行 */
.music-row {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: all 0.3s;
  gap: 12px;
  position: relative;
}

.music-row:last-child {
  border-bottom: none;
}

.music-row:hover {
  background: var(--bg);
}

.music-row.playing {
  background: var(--accent-soft);
}

.music-row.playing .music-name {
  color: var(--accent);
  font-weight: 600;
}

.music-row.paused .music-name {
  color: var(--accent);
  opacity: 0.7;
}

.music-row.selectable {
  padding-left: 20px;
}

.music-row.selected {
  background: rgba(239, 68, 68, 0.1);
  border-left: 4px solid var(--danger);
}

.row-number {
  width: 28px;
  text-align: center;
  color: var(--subtle);
  font-size: 14px;
  font-weight: 500;
}

.row-selection-indicator {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid var(--subtle);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  flex-shrink: 0;
  transition: all 0.3s;
}

.music-row.selected .row-selection-indicator {
  background: var(--danger);
  border-color: var(--danger);
  color: white;
}

/* 封面 */
.music-cover {
  position: relative;
  width: 52px;
  height: 52px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  cursor: pointer;
  box-shadow: var(--shadow);
}

.music-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.music-row:hover .music-cover img {
  transform: scale(1.08);
}

.play-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 20px;
  opacity: 0;
  transition: opacity 0.3s;
}

.music-row:hover .play-overlay,
.music-row.playing .play-overlay {
  opacity: 1;
}

.disc-animation {
  width: 40px;
  height: 40px;
  animation: rotate 3s linear infinite;
}

.disc {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: var(--surface-raised);
  position: relative;
}

.disc::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 12px;
  height: 12px;
  background: var(--accent);
  border-radius: 50%;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.playing-waves {
  position: absolute;
  bottom: 4px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 2px;
  opacity: 0;
}

.music-row.playing .playing-waves {
  opacity: 1;
}

.playing-waves span {
  width: 3px;
  height: 12px;
  background: var(--accent);
  border-radius: 2px;
  animation: wave 1s ease-in-out infinite;
}

.playing-waves span:nth-child(2) { animation-delay: 0.1s; height: 16px; }
.playing-waves span:nth-child(3) { animation-delay: 0.2s; }
.playing-waves span:nth-child(4) { animation-delay: 0.3s; height: 14px; }

@keyframes wave {
  0%, 100% { transform: scaleY(0.5); }
  50% { transform: scaleY(1); }
}

/* 音乐详情 */
.music-details {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
  min-width: 0;
}

.music-name {
  font-weight: 500;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.3s;
}

.music-separator {
  color: var(--subtle);
  flex-shrink: 0;
}

.music-artist {
  color: var(--muted);
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.music-album {
  color: var(--subtle);
  font-size: 13px;
  white-space: nowrap;
  flex-shrink: 0;
}

/* 工具按钮 */
.music-tools {
  display: flex;
  gap: 6px;
  opacity: 0;
  transition: opacity 0.3s;
}

.music-row:hover .music-tools {
  opacity: 1;
}

.tool-btn {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: none;
  background: var(--surface-raised);
  color: var(--text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  transition: all 0.3s;
}

.tool-btn:hover {
  background: var(--accent);
  color: white;
  transform: scale(1.1);
}

.tool-btn.active {
  background: var(--accent);
  color: white;
}

.tool-btn.delete-tool:hover {
  background: var(--danger);
}

.play-pause-btn {
  font-size: 12px;
}

.more-btn {
  letter-spacing: -2px;
}

/* 音乐元信息 */
.music-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.music-quality {
  padding: 2px 8px;
  background: var(--accent-soft);
  color: var(--accent);
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
}

.music-duration {
  color: var(--subtle);
  font-size: 13px;
  font-family: 'SF Mono', monospace;
  min-width: 40px;
  text-align: right;
}

/* 空状态 */
.empty-music-list {
  text-align: center;
  padding: 80px 20px;
  color: var(--muted);
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-music-list p {
  margin-bottom: 24px;
  font-size: 16px;
}

.upload-empty-btn {
  padding: 12px 32px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  cursor: pointer;
  transition: all 0.3s;
}

.upload-empty-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3);
}

/* 歌词侧边栏 */
.lyrics-sidebar {
  flex: 1;
  background: var(--surface);
  border-radius: 16px;
  box-shadow: var(--shadow);
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  max-height: 700px;
}

.lyrics-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}

.lyrics-song-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.lyrics-cover {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  object-fit: cover;
}

.lyrics-song-info h5 {
  margin: 0;
  color: var(--text);
  font-size: 15px;
  font-weight: 600;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lyrics-song-info span {
  color: var(--muted);
  font-size: 13px;
}

.close-lyrics-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: var(--surface-raised);
  color: var(--muted);
  cursor: pointer;
  font-size: 16px;
  transition: all 0.3s;
}

.close-lyrics-btn:hover {
  background: var(--danger);
  color: white;
}

/* 关键修复：歌词滚动容器 */
.lyrics-scroll-wrapper {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: rgba(0,0,0,0.2) transparent;
}

.lyrics-scroll-wrapper::-webkit-scrollbar {
  width: 6px;
}

.lyrics-scroll-wrapper::-webkit-scrollbar-track {
  background: transparent;
}

.lyrics-scroll-wrapper::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.lyrics-scroll-wrapper::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}

.dark-mode .lyrics-scroll-wrapper {
  scrollbar-color: rgba(255,255,255,0.2) transparent;
}

.dark-mode .lyrics-scroll-wrapper::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
}

.dark-mode .lyrics-scroll-wrapper::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

.lyrics-content {
  padding: 200px 20px;
  min-height: 100%;
}

.lyrics-line {
  padding: 12px 8px;
  color: var(--muted);
  cursor: pointer;
  transition: all 0.3s;
  border-radius: 8px;
  margin: 4px 0;
  text-align: center;
  font-size: 15px;
  line-height: 1.6;
}

.lyrics-line:hover {
  background: var(--bg);
  color: var(--text);
}

.lyrics-line.active {
  color: var(--accent);
  font-size: 18px;
  font-weight: 600;
  background: var(--accent-soft);
  transform: scale(1.02);
}

.no-lyrics, .no-lyrics-playing {
  padding: 60px 20px;
  color: var(--subtle);
  text-align: center;
}

.add-lyrics-btn {
  margin-top: 16px;
  padding: 8px 20px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  font-size: 14px;
}

.lyrics-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--bg);
  border-top: 1px solid var(--border);
}

.lyrics-controls button {
  padding: 6px 12px;
  background: var(--surface-raised);
  border: none;
  border-radius: 6px;
  color: var(--muted);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.3s;
}

.lyrics-controls button:hover {
  background: var(--accent);
  color: white;
}

.lyrics-controls span {
  font-size: 12px;
  color: var(--muted);
  min-width: 80px;
  text-align: center;
}

/* 迷你播放器 */
.mini-player {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--surface);
  border-top: 1px solid var(--border);
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.1);
  z-index: 100;
  transition: all 0.3s;
}

.mini-player.is-playing {
  border-top-color: var(--accent);
}

.mini-progress {
  height: 3px;
  background: var(--bg);
  cursor: pointer;
  position: relative;
}

.progress-track {
  height: 100%;
  position: relative;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.1s linear;
  position: relative;
}

.progress-handle {
  position: absolute;
  right: -6px;
  top: 50%;
  transform: translateY(-50%);
  width: 12px;
  height: 12px;
  background: white;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  opacity: 0;
  transition: opacity 0.3s;
}

.mini-progress:hover .progress-handle {
  opacity: 1;
}

.progress-buffer {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: var(--surface-raised);
  opacity: 0.5;
  z-index: -1;
}

.mini-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  gap: 20px;
}

.mini-info {
  display: flex;
  align-items: center;
  gap: 16px;
  cursor: pointer;
  flex: 1;
  min-width: 0;
}

.mini-cover-wrapper {
  position: relative;
  width: 56px;
  height: 56px;
  flex-shrink: 0;
}

.mini-cover-wrapper img {
  width: 100%;
  height: 100%;
  border-radius: 8px;
  object-fit: cover;
  box-shadow: var(--shadow);
}

.mini-cover-wrapper img.rotating {
  animation: rotate 8s linear infinite;
}

.mini-visualizer {
  position: absolute;
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 2px;
  height: 16px;
  align-items: flex-end;
}

.mini-visualizer span {
  width: 3px;
  background: var(--accent);
  border-radius: 2px;
  animation: visualizer 0.8s ease-in-out infinite;
}

@keyframes visualizer {
  0%, 100% { height: 20%; }
  50% { height: 100%; }
}

.mini-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.mini-title {
  font-weight: 600;
  color: var(--text);
  font-size: 15px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mini-artist {
  color: var(--muted);
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mini-controls {
  display: flex;
  align-items: center;
  gap: 16px;
}

.mini-controls button {
  background: none;
  border: none;
  color: var(--muted);
  font-size: 20px;
  cursor: pointer;
  transition: all 0.3s;
  padding: 8px;
  border-radius: 50%;
}

.mini-controls button:hover:not(:disabled) {
  color: var(--accent);
  background: var(--accent-soft);
}

.mini-controls button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.main-play-btn {
  width: 48px !important;
  height: 48px;
  background: var(--accent) !important;
  color: white !important;
  font-size: 20px !important;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.main-play-btn:hover {
  transform: scale(1.1);
}

.mode-btn-mini {
  font-size: 16px !important;
}

.mini-extra {
  display: flex;
  align-items: center;
  gap: 16px;
}

.volume-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.volume-control button {
  background: none;
  border: none;
  color: var(--muted);
  font-size: 18px;
  cursor: pointer;
}

.volume-slider,
.fs-volume-slider {
  --volume-percent: 0%;
  --volume-track: var(--border);
  --volume-fill: var(--accent);
  --volume-thumb: var(--accent);
  width: 80px;
  height: 20px;
  padding: 0;
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  border: 0;
  border-radius: 999px;
  cursor: pointer;
}

.volume-slider:focus-visible,
.fs-volume-slider:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 4px;
}

.volume-slider::-webkit-slider-runnable-track,
.fs-volume-slider::-webkit-slider-runnable-track {
  height: 4px;
  background: linear-gradient(
    to right,
    var(--volume-fill) 0%,
    var(--volume-fill) var(--volume-percent),
    var(--volume-track) var(--volume-percent),
    var(--volume-track) 100%
  );
  border-radius: 999px;
}

.volume-slider::-webkit-slider-thumb,
.fs-volume-slider::-webkit-slider-thumb {
  width: 14px;
  height: 14px;
  margin-top: -5px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--volume-thumb);
  border: 2px solid var(--surface);
  border-radius: 50%;
  box-shadow: 0 0 0 1px var(--border);
  cursor: pointer;
}

.volume-slider:hover::-webkit-slider-thumb,
.fs-volume-slider:hover::-webkit-slider-thumb,
.volume-slider:focus-visible::-webkit-slider-thumb,
.fs-volume-slider:focus-visible::-webkit-slider-thumb {
  box-shadow: 0 0 0 2px var(--accent-soft), 0 0 0 3px var(--accent);
}

.volume-slider::-moz-range-track,
.fs-volume-slider::-moz-range-track {
  height: 4px;
  background: var(--volume-track);
  border: 0;
  border-radius: 999px;
}

.volume-slider::-moz-range-progress,
.fs-volume-slider::-moz-range-progress {
  height: 4px;
  background: var(--volume-fill);
  border-radius: 999px;
}

.volume-slider::-moz-range-thumb,
.fs-volume-slider::-moz-range-thumb {
  width: 10px;
  height: 10px;
  background: var(--volume-thumb);
  border: 2px solid var(--surface);
  border-radius: 50%;
  box-shadow: 0 0 0 1px var(--border);
  cursor: pointer;
}

.volume-slider:hover::-moz-range-thumb,
.fs-volume-slider:hover::-moz-range-thumb,
.volume-slider:focus-visible::-moz-range-thumb,
.fs-volume-slider:focus-visible::-moz-range-thumb {
  box-shadow: 0 0 0 2px var(--accent-soft), 0 0 0 3px var(--accent);
}

.fullscreen-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  transition: all 0.3s;
}

.fullscreen-btn:hover {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.mini-playlist {
  position: absolute;
  bottom: 100%;
  right: 24px;
  width: 320px;
  max-height: 400px;
  background: var(--surface);
  border-radius: 12px 12px 0 0;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
  overflow-y: auto;
  border: 1px solid var(--border);
  border-bottom: none;
}

.mini-playlist-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.3s;
  border-bottom: 1px solid var(--border);
}

.mini-playlist-item:hover, .mini-playlist-item.active {
  background: var(--accent-soft);
}

.mini-playlist-item img {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  object-fit: cover;
}

.mini-playlist-item .item-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.mini-playlist-item .item-title {
  font-size: 14px;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mini-playlist-item .item-artist {
  font-size: 12px;
  color: var(--muted);
}

.mini-playlist-item .item-duration {
  font-size: 12px;
  color: var(--subtle);
  font-family: monospace;
}

/* 全屏播放器 */
.fullscreen-music-player {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #0f0f0f;
}

.fs-background {
  position: absolute;
  top: -10%;
  left: -10%;
  right: -10%;
  bottom: -10%;
  background-size: cover;
  background-position: center;
  filter: blur(60px) brightness(0.3);
  transform: scale(1.2);

}

.fs-background-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
}

.fs-header {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 32px;
  z-index: 10;
}

.fs-header .back-btn {
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.fs-header-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.fs-mode-badge {
  padding: 4px 16px;
  background: var(--accent);
  color: white;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.fs-title {
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
  letter-spacing: 2px;
  text-transform: uppercase;
}

.fs-volume-control {
  display: flex;
  align-items: center;
  gap: 12px;
}

.fs-volume-control button {
  background: none;
  border: none;
  color: white;
  font-size: 24px;
  cursor: pointer;
}

.fs-volume-control .fs-volume-slider {
  width: 100px;
}

.fs-body {
  flex: 1;
  display: flex;
  position: relative;
  z-index: 10;
  padding: 0 32px;
  gap: 40px;
  min-height: 0;
  overflow: hidden;
}

.fs-album-section {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.album-disc {
  width: 360px;
  height: 360px;
  border-radius: 50%;
  overflow: hidden;
  position: relative;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}

.album-disc.playing {
  animation: rotate 20s linear infinite;
}

.album-disc img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.disc-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100px;
  height: 100px;
  background: #1a1a1a;
  border-radius: 50%;
  border: 4px solid rgba(255, 255, 255, 0.1);
}

.album-glow {
  position: absolute;
  width: 400px;
  height: 400px;
  background: var(--accent);
  border-radius: 50%;
  filter: blur(100px);
  opacity: 0.3;
  z-index: -1;

}

/* 关键修复：全屏歌词区域 */
.fs-lyrics-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  max-width: 600px;
  height: 100%;
  position: relative;
  overflow: hidden;
}

.fs-lyrics-section .lyrics-scroll-wrapper {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.2) transparent;
}

.fs-lyrics-section .lyrics-scroll-wrapper::-webkit-scrollbar {
  width: 6px;
}

.fs-lyrics-section .lyrics-scroll-wrapper::-webkit-scrollbar-track {
  background: transparent;
}

.fs-lyrics-section .lyrics-scroll-wrapper::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.fs-lyrics-section .lyrics-scroll-wrapper::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.4);
}

.fs-lyrics-section .lyrics-content {
  padding: 50vh 20px;
  min-height: 100%;
}

.fs-lyric-line {
  padding: 16px 24px;
  color: rgba(255, 255, 255, 0.35);
  font-size: 16px;
  text-align: center;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  line-height: 1.8;
  border-radius: 8px;
  margin: 8px 0;
  user-select: none;
}

.fs-lyric-line:hover {
  color: rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.05);
}

.fs-lyric-line.past {
  color: rgba(255, 255, 255, 0.2);
  font-size: 14px;
}

.fs-lyric-line.active {
  color: #fff;
  font-size: 24px;
  font-weight: 600;
  transform: scale(1.05);
  text-shadow: 0 0 20px rgba(255, 255, 255, 0.3);
  background: var(--accent-soft);
}

.fs-lyric-line.active .lyric-text {
  background: transparent;



}

.next-lyric {
  padding: 16px 20px;
  text-align: center;
  color: rgba(255, 255, 255, 0.4);
  font-size: 13px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
}

.next-lyric span {
  color: rgba(255, 255, 255, 0.25);
  margin-right: 8px;
}

.fs-no-lyrics {
  text-align: center;
  padding: 100px 20px;
  color: rgba(255, 255, 255, 0.5);
}

.no-lyrics-icon {
  font-size: 80px;
  margin-bottom: 24px;
  opacity: 0.3;
}

.add-lyrics-btn-large {
  margin-top: 24px;
  padding: 16px 32px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 30px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s;
}

.add-lyrics-btn-large:hover {
  transform: scale(1.05);
  box-shadow: 0 8px 24px rgba(59, 130, 246, 0.4);
}

.fs-playlist-section {
  width: 320px;
  display: flex;
  flex-direction: column;
  position: relative;
  transition: width 0.3s;
}

.fs-playlist-section.collapsed {
  width: 40px;
}

.playlist-toggle-btn {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 32px;
  height: 60px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 8px 0 0 8px;
  color: white;
  cursor: pointer;
  z-index: 10;
}

.fs-playlist-content {
  flex: 1;
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  margin-left: 16px;
}

.fs-playlist-content h4 {
  margin: 0;
  padding: 16px 20px;
  color: var(--text);
  font-size: 14px;
  border-bottom: 1px solid var(--border);
}

.fs-playlist-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.fs-playlist-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  margin-bottom: 4px;
}

.fs-playlist-item:hover {
  background: var(--accent-soft);
  color: var(--accent);
}

.fs-playlist-item.active {
  background: var(--accent);
  color: var(--on-accent);
}

.fs-playlist-item.played {
  color: var(--muted);
}

.playlist-number {
  width: 24px;
  text-align: center;
  color: var(--muted);
  font-size: 12px;
}

.fs-playlist-item.active .playlist-number {
  color: var(--on-accent);
}

.fs-playlist-item img {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  object-fit: cover;
}

.playlist-item-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.playlist-title {
  color: var(--text);
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.playlist-artist {
  color: var(--muted);
  font-size: 11px;
}

.playlist-duration {
  color: var(--muted);
  font-size: 11px;
  font-family: monospace;
}

.playing-indicator {
  display: flex;
  gap: 2px;
  align-items: flex-end;
  height: 12px;
}

.playing-indicator span {
  width: 3px;
  background: currentColor;
  border-radius: 2px;
  animation: playing-bar 0.6s ease-in-out infinite;
}

.playing-indicator span:nth-child(2) { animation-delay: 0.1s; height: 60%; }
.playing-indicator span:nth-child(3) { animation-delay: 0.2s; height: 40%; }
.playing-indicator span:nth-child(4) { animation-delay: 0.3s; height: 80%; }

@keyframes playing-bar {
  0%, 100% { transform: scaleY(0.5); }
  50% { transform: scaleY(1); }
}

.fs-controls {
  position: relative;
  z-index: 10;
  padding: 32px;
  background: var(--surface);
}

.fs-song-info {
  text-align: center;
  margin-bottom: 24px;
}

.fs-song-info h3 {
  margin: 0 0 8px 0;
  color: white;
  font-size: 24px;
  font-weight: 700;
}

.fs-song-info p {
  margin: 0;
  color: rgba(255, 255, 255, 0.6);
  font-size: 16px;
}

.fs-progress-section {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

.time-current, .time-total {
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
  font-family: monospace;
  min-width: 50px;
}

.time-current { text-align: right; }
.time-total { text-align: left; }

.fs-progress-bar {
  flex: 1;
  height: 6px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  cursor: pointer;
  position: relative;
}

.fs-progress-bar:hover {
  height: 8px;
}

.fs-progress-bar .progress-track {
  height: 100%;
  position: relative;
}

.fs-progress-bar .progress-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 3px;
  position: relative;
  transition: width 0.1s linear;
}

.progress-handle {
  position: absolute;
  right: -8px;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  background: white;
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  opacity: 0;
  transition: opacity 0.3s;
}

.fs-progress-bar:hover .progress-handle {
  opacity: 1;
}

.fs-buttons {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 40px;
}

.mode-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.3s;
}

.mode-btn:hover {
  color: white;
}

.mode-icon {
  font-size: 20px;
}

.mode-text {
  font-size: 11px;
}

.main-controls {
  display: flex;
  align-items: center;
  gap: 24px;
}

.nav-btn {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.2);
  background: transparent;
  color: white;
  font-size: 24px;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-btn:hover:not(:disabled) {
  border-color: var(--accent);
  background: var(--accent);
  transform: scale(1.1);
}

.nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.nav-btn.large {
  width: 64px;
  height: 64px;
  font-size: 28px;
}

.fs-play-btn {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: none;
  background: white;
  color: #1a1a1a;
  font-size: 32px;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.fs-play-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
}

.fs-play-btn.playing {
  background: var(--accent);
  color: white;
}

.extra-controls {
  display: flex;
  gap: 16px;
}

.extra-controls button {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.3s;
}

.extra-controls button:hover, .extra-controls button.active {
  background: var(--accent);
}

.slide-up-enter-active, .slide-up-leave-active {
  transition: all 0.3s ease;
}

.slide-up-enter-from, .slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

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
  z-index: 1100;
  padding: 20px;
}

.modal-overlay.info-overlay {
  z-index: 1200;
}

.info-modal.modern, .delete-modal.modern, .upload-modal.modern {
  background: var(--surface);
  border-radius: 24px;
  width: 100%;
  max-width: 480px;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  border: 1px solid var(--border);
}

.info-header {
  position: relative;
  height: 200px;
  overflow: hidden;
}

.info-header img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.info-header::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 100px;
  background: var(--surface);
}

.info-header-text {
  position: absolute;
  bottom: 20px;
  left: 24px;
  right: 24px;
  color: white;
  z-index: 2;
}

.info-header-text h3 {
  margin: 0 0 4px 0;
  font-size: 24px;
  font-weight: 700;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.info-header-text p {
  margin: 0;
  font-size: 16px;
  opacity: 0.9;
}

.info-body {
  padding: 24px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
}

.info-row:last-child {
  border-bottom: none;
}

.info-row label {
  color: var(--subtle);
  font-size: 14px;
}

.info-row span {
  color: var(--text);
  font-weight: 500;
  font-size: 14px;
}

.format-badge {
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.format-badge.mp3 {
  background: #dbeafe;
  color: #1e40af;
}

.format-badge.flac {
  background: #d1fae5;
  color: #065f46;
}

.format-badge.wav {
  background: #fef3c7;
  color: #92400e;
}

.format-badge.aac {
  background: #fce7f3;
  color: #9d174d;
}

.dark-mode .format-badge.mp3 {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
}

.dark-mode .format-badge.flac {
  background: rgba(16, 185, 129, 0.2);
  color: #34d399;
}

.dark-mode .format-badge.wav {
  background: rgba(245, 158, 11, 0.2);
  color: #fbbf24;
}

.dark-mode .format-badge.aac {
  background: rgba(236, 72, 153, 0.2);
  color: #f472b6;
}

.info-actions {
  display: flex;
  gap: 12px;
  padding: 0 24px 24px;
}

.info-actions button {
  flex: 1;
  padding: 14px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  border: none;
}

.info-actions button:not(.primary-btn) {
  background: var(--bg);
  color: var(--text);
}

.info-actions button:not(.primary-btn):hover {
  background: var(--surface-raised);
}

.primary-btn {
  background: var(--accent);
  color: white;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.primary-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
}

.primary-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.delete-icon {
  width: 80px;
  height: 80px;
  margin: 24px auto 16px;
  background: var(--danger);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
  color: white;
  animation: shake 0.5s ease-in-out;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-10px); }
  75% { transform: translateX(10px); }
}

.delete-modal h3 {
  margin: 0 0 8px 0;
  text-align: center;
  color: var(--text);
  font-size: 20px;
}

.delete-modal p {
  text-align: center;
  color: var(--muted);
  margin: 0 0 8px 0;
}

.delete-warning {
  color: var(--danger) !important;
  font-size: 13px;
  font-weight: 500;
}

.delete-modal .actions {
  display: flex;
  gap: 12px;
  padding: 24px;
}

.danger-btn {
  flex: 1;
  padding: 14px;
  background: var(--danger);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.danger-btn:hover {
  filter: brightness(1.1);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

.lyrics-input-modal {
  background: var(--surface);
  border-radius: 24px;
  width: 100%;
  max-width: 560px;
  padding: 32px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  border: 1px solid var(--border);
}

.lyrics-input-modal h3 {
  margin: 0 0 8px 0;
  color: var(--text);
  font-size: 22px;
}

.lyrics-input-modal .hint {
  color: var(--subtle);
  font-size: 13px;
  margin: 0 0 16px 0;
}

.lyrics-input-modal textarea {
  width: 100%;
  min-height: 300px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg);
  color: var(--text);
  font-size: 14px;
  line-height: 1.8;
  resize: vertical;
  font-family: 'SF Mono', monospace;
}

.lyrics-input-modal textarea:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.lyrics-input-modal .actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.upload-modal {
  max-width: 520px;
}

.upload-steps {
  display: flex;
  justify-content: space-between;
  padding: 0 24px;
  margin-bottom: 24px;
  position: relative;
}

.upload-steps::before {
  content: '';
  position: absolute;
  top: 14px;
  left: 60px;
  right: 60px;
  height: 2px;
  background: var(--border);
  z-index: 0;
}

.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  position: relative;
  z-index: 1;
  font-size: 12px;
  color: var(--subtle);
  font-weight: 500;
}

.step::before {
  content: attr(data-step);
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--surface-raised);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: var(--muted);
  font-weight: 600;
  border: 2px solid transparent;
}

.step.active {
  color: var(--accent);
}

.step.active::before {
  background: var(--accent);
  color: white;
  box-shadow: 0 0 0 4px var(--accent-soft);
}

.step.done {
  color: var(--accent);
}

.step.done::before {
  content: '✓';
  background: var(--accent);
  color: white;
}

.step-content {
  padding: 0 24px 24px;
}

.step-content.center {
  text-align: center;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: var(--text);
  font-size: 14px;
  font-weight: 500;
}

.form-group label .required {
  color: var(--danger);
  margin-left: 2px;
}

.form-group input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg);
  color: var(--text);
  font-size: 15px;
  transition: all 0.3s;
}

.form-group input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.error-msg {
  display: block;
  margin-top: 6px;
  color: var(--danger);
  font-size: 12px;
}

.file-drop-zone {
  border: 2px dashed var(--border);
  border-radius: 16px;
  padding: 40px;
  text-align: center;
  transition: all 0.3s;
  cursor: pointer;
  background: var(--bg);
}

.file-drop-zone.dragging {
  border-color: var(--accent);
  background: var(--accent-soft);
  transform: scale(1.02);
}

.drop-content {
  pointer-events: none;
}

.upload-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.drop-content p {
  margin: 0 0 8px 0;
  color: var(--text);
  font-size: 16px;
  font-weight: 500;
}

.drop-content .selected-file {
  color: var(--accent);
  font-weight: 600;
}

.file-hint {
  color: var(--subtle);
  font-size: 13px;
}

.file-info {
  margin-top: 20px;
  padding: 16px;
  background: var(--bg);
  border-radius: 12px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  font-size: 14px;
}

.info-item span:first-child {
  color: var(--muted);
}

.info-item span:last-child {
  color: var(--text);
  font-weight: 500;
}

.upload-success {
  padding: 40px 0;
}

.success-icon {
  width: 80px;
  height: 80px;
  margin: 0 auto 24px;
  background: var(--accent);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
  color: white;
  animation: scale-in 0.5s ease;
}

@keyframes scale-in {
  0% { transform: scale(0); opacity: 0; }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); opacity: 1; }
}

.upload-success h4 {
  margin: 0 0 8px 0;
  color: var(--text);
  font-size: 20px;
}

.upload-success p {
  margin: 0;
  color: var(--muted);
}

.upload-progress {
  padding: 0 24px 24px;
}

.progress-bar {
  height: 8px;
  background: var(--surface-raised);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 12px;
}

.progress-bar .progress-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.upload-progress span {
  display: block;
  text-align: center;
  color: var(--accent);
  font-weight: 600;
  font-size: 14px;
}

.secondary-btn {
  padding: 14px 24px;
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.secondary-btn:hover {
  background: var(--surface-raised);
}

.toast {
  position: fixed;
  top: 24px;
  left: 50%;
  transform: translateX(-50%) translateY(-100%);
  padding: 16px 32px;
  border-radius: 50px;
  font-weight: 600;
  font-size: 15px;
  z-index: 2000;
  opacity: 0;
  transition: all 0.3s ease;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.toast.show {
  transform: translateX(-50%) translateY(0);
  opacity: 1;
}

.toast.modern {
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
}

.toast.success {
  background: var(--accent);
  color: white;
  border: none;
}

.toast.error {
  background: var(--danger);
  color: white;
  border: none;
}

.shortcuts-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.shortcuts-modal {
  background: var(--surface);
  border-radius: 24px;
  padding: 32px;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  border: 1px solid var(--border);
}

.shortcuts-modal h3 {
  margin: 0 0 24px 0;
  color: var(--text);
  font-size: 20px;
  text-align: center;
}

.shortcut-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}

.shortcut-list div {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--bg);
  border-radius: 8px;
  color: var(--text);
  font-size: 14px;
}

.shortcut-list kbd {
  padding: 4px 12px;
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-family: 'SF Mono', monospace;
  font-size: 13px;
  color: var(--accent);
  font-weight: 600;
}

.shortcuts-modal button {
  width: 100%;
  padding: 14px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.shortcuts-modal button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.3);
}

.shortcuts-hint-btn {
  position: fixed;
  bottom: 140px;
  right: 24px;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--muted);
  font-size: 20px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: var(--shadow);
  z-index: 90;
}

.shortcuts-hint-btn:hover {
  background: var(--accent);
  color: white;
  transform: scale(1.1);
  border-color: var(--accent);
}

@media (max-width: 1200px) {
  .music-list-container.with-lyrics {
    flex-direction: column;
  }

  .lyrics-sidebar {
    max-height: 400px;
  }

  .fs-body {
    flex-direction: column;
    align-items: center;
    gap: 24px;
  }

  .fs-album-section {
    flex: none;
  }

  .album-disc {
    width: 280px;
    height: 280px;
  }

  .fs-lyrics-section {
    max-width: 100%;
    width: 100%;
  }

  .fs-playlist-section {
    position: fixed;
    right: 0;
    top: 80px;
    bottom: 180px;
    width: 300px;
    z-index: 100;
  }

  .fs-playlist-section.collapsed {
    width: 40px;
  }
}

@media (max-width: 768px) {
  .music-zone {
    padding: 12px;
    padding-bottom: 140px;
  }

  .zone-description h3 {
    font-size: 20px;
  }

  .action-bar {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }

  .action-btns {
    justify-content: center;
  }

  .music-row {
    padding: 10px 12px;
  }

  .music-cover {
    width: 44px;
    height: 44px;
  }

  .music-tools {
    opacity: 1;
    position: static;
    transform: none;
    background: none;
    box-shadow: none;
    padding: 0;
    margin-top: 8px;
    width: 100%;
    justify-content: flex-end;
  }

  .tool-btn {
    width: 32px;
    height: 32px;
  }

  .mini-content {
    padding: 8px 16px;
    gap: 12px;
  }

  .mini-info {
    gap: 12px;
  }

  .mini-cover-wrapper {
    width: 48px;
    height: 48px;
  }

  .mini-controls {
    gap: 12px;
  }

  .main-play-btn {
    width: 44px !important;
    height: 44px;
  }

  .mini-extra {
    display: none;
  }

  .fs-header {
    padding: 16px;
  }

  .fs-album-section {
    padding: 20px 0;
  }

  .album-disc {
    width: 240px;
    height: 240px;
  }

  .album-glow {
    width: 260px;
    height: 260px;
  }

  .fs-controls {
    padding: 20px;
  }

  .fs-buttons {
    gap: 24px;
  }

  .nav-btn {
    width: 48px;
    height: 48px;
    font-size: 20px;
  }

  .nav-btn.large {
    width: 56px;
    height: 56px;
  }

  .fs-play-btn {
    width: 64px;
    height: 64px;
    font-size: 24px;
  }

  .fs-song-info h3 {
    font-size: 20px;
  }

  .fs-lyric-line {
    font-size: 14px;
    padding: 12px 16px;
  }

  .fs-lyric-line.active {
    font-size: 20px;
  }

  .info-modal.modern,
  .delete-modal.modern,
  .upload-modal.modern,
  .lyrics-input-modal {
    margin: 16px;
    max-height: 90vh;
    overflow-y: auto;
  }

  .upload-steps::before {
    left: 40px;
    right: 40px;
  }
}

@media (max-width: 480px) {
  .zone-description {
    padding: 16px;
  }

  .zone-description p {
    font-size: 13px;
  }

  .music-details {
    flex-wrap: wrap;
  }

  .music-separator {
    display: none;
  }

  .music-artist {
    width: 100%;
    margin-top: 2px;
  }

  .music-album {
    display: none;
  }

  .music-meta {
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
  }

  .mini-playlist {
    width: 100%;
    right: 0;
    left: 0;
    border-radius: 12px 12px 0 0;
  }

  .album-disc {
    width: 200px;
    height: 200px;
  }

  .disc-center {
    width: 60px;
    height: 60px;
  }

  .fs-buttons {
    gap: 16px;
  }

  .mode-btn .mode-text {
    display: none;
  }

  .extra-controls {
    gap: 8px;
  }

  .shortcuts-hint-btn {
    bottom: 120px;
    right: 16px;
    width: 40px;
    height: 40px;
    font-size: 16px;
  }
}

::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--bg);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: var(--surface-raised);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--subtle);
}

::selection {
  background: var(--accent);
  color: white;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

button:focus-visible,
input:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

@media print {
  .mini-player,
  .music-tools,
  .action-btns,
  .back-btn {
    display: none !important;
  }

  .music-zone {
    padding-bottom: 20px;
  }
}

/* 统一媒体库视觉：不改队列、歌词、上传状态或音频行为，仅收敛旧的渐变和拟物效果。 */
.music-zone,
.music-zone.light-mode,
.music-zone.dark-mode {
  min-height: 0;
  padding: 0 0 104px;
  background: transparent;
  color: var(--text);
  font-family: inherit;
}
.music-zone button { font: inherit; }
.music-zone button:focus-visible,
.music-zone input:focus-visible,
.music-zone textarea:focus-visible,
.music-zone select:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--accent), transparent 68%);
  outline-offset: 2px;
}
.music-zone .zone-header { margin: 0 0 var(--space-3); }
.music-zone .back-btn,
.music-zone .filter-btn,
.music-zone .action-btn,
.music-zone .upload-empty-btn,
.music-zone .primary-btn,
.music-zone .secondary-btn,
.music-zone .info-actions > button,
.music-zone .lyrics-input-modal .actions > button,
.music-zone .delete-modal .actions > button,
.music-zone .shortcuts-modal > button {
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
  cursor: pointer;
  transition: border-color .15s ease, background .15s ease, color .15s ease;
}
.music-zone .back-btn:hover,
.music-zone .filter-btn:hover,
.music-zone .action-btn:hover:not(:disabled),
.music-zone .upload-empty-btn:hover,
.music-zone .secondary-btn:hover,
.music-zone .info-actions > button:hover,
.music-zone .lyrics-input-modal .actions > button:hover,
.music-zone .delete-modal .actions > button:hover,
.music-zone .shortcuts-modal > button:hover { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); box-shadow: none; transform: none; }
.music-zone .upload-btn,
.music-zone .primary-btn,
.music-zone .upload-empty-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: 38px;
  padding: 0 var(--space-3);
  border: 1px solid var(--accent);
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: #fff;
  box-shadow: none;
  cursor: pointer;
  font-weight: 650;
}
.music-zone .upload-btn:hover:not(:disabled),
.music-zone .primary-btn:hover:not(:disabled),
.music-zone .upload-empty-btn:hover:not(:disabled) { background: var(--accent-strong); color: #fff; box-shadow: none; transform: none; }
.music-zone .delete-btn,
.music-zone .danger-btn { border-color: var(--danger); background: var(--danger); color: #fff; }
.music-zone .delete-btn:hover:not(:disabled),
.music-zone .danger-btn:hover { background: color-mix(in srgb, var(--danger), #000 16%); color: #fff; box-shadow: none; }
.music-zone .zone-description {
  margin: 0 0 var(--space-5);
  padding: var(--space-5);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: none;
}
.music-zone .zone-eyebrow,
.music-zone .zone-description h3 { display: flex; align-items: center; gap: var(--space-2); }
.music-zone .zone-eyebrow { margin: 0 0 var(--space-2); color: var(--accent); font-size: .82rem; font-weight: 700; letter-spacing: .05em; }
.music-zone .zone-description h3 { margin: 0 0 var(--space-2); color: var(--text); font-size: 1.45rem; }
.music-zone .zone-description p { max-width: 68ch; margin: 0; color: var(--muted); line-height: 1.75; }
.music-zone .action-bar {
  min-height: auto;
  margin: 0 0 var(--space-4);
  padding: var(--space-3) 0;
  border: 0;
  background: transparent;
  box-shadow: none;
}
.music-zone .list-header h4 { margin: 0; color: var(--text); font-size: .95rem; }
.music-zone .selection-indicator-text { color: var(--muted); font-size: .85rem; font-weight: 400; }
.music-zone .music-list-container { gap: var(--space-4); }
.music-zone .music-list { overflow: hidden; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); box-shadow: none; }
.music-zone .music-row {
  min-height: 72px;
  padding: var(--space-2) var(--space-3);
  border-color: var(--border);
  background: transparent;
  color: var(--text);
  transition: background .15s ease, color .15s ease;
}
.music-zone .music-row:hover { background: var(--surface-raised); box-shadow: none; transform: none; }
.music-zone .music-row.playing,
.music-zone .music-row.selected { background: var(--accent-soft); }
.music-zone .music-row.playing .music-name,
.music-zone .music-row.paused .music-name { color: var(--accent); }
.music-zone .row-selection-indicator { display: grid; place-items: center; width: 26px; height: 26px; border: 1px solid var(--border); border-radius: 50%; background: var(--surface-raised); color: var(--accent); }
.music-zone .music-row.selected .row-selection-indicator { border-color: var(--accent); background: var(--accent); color: #fff; }
.music-zone .music-cover { width: 48px; height: 48px; border-radius: var(--radius-sm); background: var(--bg); box-shadow: none; }
.music-zone .music-cover img { transition: transform .15s ease; }
.music-zone .music-row:hover .music-cover img { transform: none; }
.music-zone .play-overlay { display: grid; place-items: center; background: rgb(20 25 23 / 46%); color: #fff; }
.music-zone .disc-animation { display: none; }
.music-zone .playing-waves { display: none; }
.music-zone .music-name { color: var(--text); font-weight: 650; }
.music-zone .music-artist,
.music-zone .music-separator,
.music-zone .music-album,
.music-zone .music-duration { color: var(--muted); }
.music-zone .music-quality { border: 1px solid var(--border); background: transparent; color: var(--muted); }
.music-zone .music-tools { gap: 4px; }
.music-zone .tool-btn,
.music-zone .close-lyrics-btn,
.music-zone .lyrics-controls button,
.music-zone .mini-controls button,
.music-zone .mini-extra button,
.music-zone .fs-header button,
.music-zone .fs-buttons button,
.music-zone .playlist-toggle-btn {
  display: inline-grid;
  place-items: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--muted);
  box-shadow: none;
  cursor: pointer;
}
.music-zone .tool-btn:hover,
.music-zone .close-lyrics-btn:hover,
.music-zone .lyrics-controls button:hover,
.music-zone .mini-controls button:hover:not(:disabled),
.music-zone .mini-extra button:hover,
.music-zone .fs-header button:hover,
.music-zone .fs-buttons button:hover:not(:disabled),
.music-zone .playlist-toggle-btn:hover { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); box-shadow: none; transform: none; }
.music-zone .delete-tool:hover { border-color: var(--danger); background: color-mix(in srgb, var(--danger), transparent 90%); color: var(--danger); }
.music-zone .empty-music-list { min-height: 220px; background: transparent; color: var(--muted); }
.music-zone .empty-icon { display: grid; place-items: center; color: var(--accent); }
.music-zone .lyrics-sidebar { border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); box-shadow: none; }
.music-zone .lyrics-header,
.music-zone .lyrics-controls { border-color: var(--border); background: transparent; }
.music-zone .lyrics-header h5 { color: var(--text); }
.music-zone .lyrics-header span,
.music-zone .lyrics-line { color: var(--muted); }
.music-zone .lyrics-line.active { color: var(--accent); }
.music-zone .lyrics-scroll-wrapper { scrollbar-color: var(--border) transparent; }
.music-zone .lyrics-scroll-wrapper::-webkit-scrollbar-thumb { background: var(--border); }
.music-zone .lyrics-content { padding-block: max(72px, 35vh); }
.music-zone .lyrics-line,
.music-zone .fs-lyric-line { transition: color .16s ease, background-color .16s ease; }
.music-zone .return-lyrics-btn { display: inline-flex; align-items: center; gap: var(--space-1); color: var(--accent); border: 1px solid var(--border); background: var(--surface-raised); }
.music-zone .return-lyrics-btn:hover { color: var(--accent-strong); border-color: var(--accent); background: var(--accent-soft); }
.music-zone .fs-return-lyrics-btn { position: absolute; right: var(--space-3); bottom: var(--space-3); }
.music-zone .mini-player {
  z-index: 30;
  border-top: 1px solid var(--border);
  background: var(--surface);
  box-shadow: 0 -6px 18px rgb(29 37 34 / 8%);
}
.music-zone .mini-player.is-playing { border-top-color: var(--accent); }
.music-zone .mini-content { max-width: 1200px; margin: 0 auto; }
.music-zone .mini-cover-wrapper,
.music-zone .mini-cover-wrapper img { border-radius: 6px; }
.music-zone .mini-cover-wrapper img.rotating { animation: none; }
.music-zone .mini-visualizer { display: none; }
.music-zone .mini-title { color: var(--text); }
.music-zone .mini-artist { color: var(--muted); }
.music-zone .progress-fill { background: var(--accent); }
.music-zone .progress-buffer { background: var(--border); }
.music-zone .mini-playlist { border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); box-shadow: var(--shadow); }
.music-zone .mini-playlist-item { color: var(--text); }
.music-zone .mini-playlist-item:hover,
.music-zone .mini-playlist-item.active { background: var(--accent-soft); color: var(--accent); }
.music-zone .fullscreen-music-player { z-index: 1000; background: var(--bg); color: var(--text); }
.music-zone .fs-background { opacity: .06; filter: grayscale(1) blur(18px); }
.music-zone .fs-background-overlay { background: var(--bg); opacity: .94; }
.music-zone .album-glow { display: none; }
.music-zone .fs-header,
.music-zone .fs-controls { border-color: var(--border); background: var(--surface); box-shadow: none; }
.music-zone .fs-title,
.music-zone .fs-song-info h3,
.music-zone .fs-playlist-content h4 { color: var(--text); }
.music-zone .fs-mode-badge { border-color: var(--border); background: var(--accent-soft); color: var(--accent); }
.music-zone .album-disc { border-color: var(--border); box-shadow: none; }
.music-zone .album-disc img { filter: grayscale(.15); }
.music-zone .fs-lyric-line { color: var(--muted); }
.music-zone .fs-lyric-line:hover { color: var(--text); background: var(--surface-raised); }
.music-zone .fs-lyric-line.past { color: var(--subtle); }
.music-zone .fs-lyric-line.active { color: var(--accent); }
.music-zone .fs-volume-control button { color: var(--text); }
.music-zone .fs-volume-control .fs-volume-slider {
  --volume-track: var(--border);
  --volume-fill: var(--accent);
  --volume-thumb: var(--accent);
}
.music-zone .fs-song-info p,
.music-zone .time-current,
.music-zone .time-total,
.music-zone .mode-btn,
.music-zone .next-lyric,
.music-zone .next-lyric span,
.music-zone .fs-no-lyrics { color: var(--muted); }
.music-zone .mode-btn:hover { color: var(--accent); }
.music-zone .nav-btn { border-color: var(--border); color: var(--text); }
.music-zone .extra-controls button { background: var(--surface-raised); color: var(--text); }
.music-zone .extra-controls button:hover,
.music-zone .extra-controls button.active { background: var(--accent-soft); color: var(--accent); }
.music-zone .fs-progress-bar { background: var(--border); }
.music-zone .progress-handle { background: var(--surface-raised); box-shadow: var(--shadow); }
.music-zone .fs-playlist-section,
.music-zone .fs-playlist-content { border-color: var(--border); background: var(--surface); }
.music-zone .fs-playlist-item { color: var(--text); opacity: 1; }
.music-zone .fs-playlist-item .playlist-title { color: var(--text); }
.music-zone .fs-playlist-item:hover,
.music-zone .fs-playlist-item.active { background: var(--accent-soft); color: var(--accent); }
.music-zone .fs-playlist-item.active .playlist-title,
.music-zone .fs-playlist-item.active .playlist-artist,
.music-zone .fs-playlist-item.active .playlist-duration,
.music-zone .fs-playlist-item.active .playlist-number { color: var(--accent); }
.music-zone .fs-playlist-item.active .playing-indicator { color: var(--accent); }
.music-zone .fs-play-btn { border-color: var(--accent); background: var(--accent); color: var(--on-accent); }
.music-zone .fs-play-btn:hover { background: var(--accent-strong); color: var(--on-accent); }
.music-zone .mode-btn { width: auto !important; padding: 0 var(--space-2) !important; }
.music-zone .mode-icon { display: block; }
.music-zone .modal-overlay,
.music-zone .shortcuts-overlay { z-index: 1100; background: rgb(20 25 23 / 56%); }
.music-zone .info-modal.modern,
.music-zone .lyrics-input-modal,
.music-zone .delete-modal.modern,
.music-zone .upload-modal.modern,
.music-zone .shortcuts-modal {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow);
}
.music-zone .info-header,
.music-zone .info-row,
.music-zone .upload-steps,
.music-zone .file-info { border-color: var(--border); }
.music-zone .info-row label,
.music-zone .hint,
.music-zone .file-hint,
.music-zone .info-item,
.music-zone .shortcuts-modal { color: var(--muted); }
.music-zone .info-header h3,
.music-zone .lyrics-input-modal h3,
.music-zone .delete-modal h3,
.music-zone .upload-modal h3,
.music-zone .shortcuts-modal h3 { color: var(--text); }
.music-zone .lyrics-input-modal textarea,
.music-zone .form-group input,
.music-zone .file-drop-zone { border-color: var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); color: var(--text); }
.music-zone .file-drop-zone:hover,
.music-zone .file-drop-zone.dragging { border-color: var(--accent); background: var(--accent-soft); }
.music-zone .upload-icon,
.music-zone .success-icon,
.music-zone .delete-icon { display: grid; place-items: center; color: var(--accent); }
.music-zone .delete-icon { color: var(--danger); background: color-mix(in srgb, var(--danger), transparent 90%); }
.music-zone .step { border-color: var(--border); background: var(--surface-raised); color: var(--muted); }
.music-zone .step.active,
.music-zone .step.done { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }
.music-zone .toast { border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); color: var(--text); box-shadow: var(--shadow); }
.music-zone .toast.success { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }
.music-zone .toast.error { border-color: var(--danger); background: color-mix(in srgb, var(--danger), transparent 92%); color: var(--danger); }
.music-zone .shortcuts-hint-btn { display: grid; place-items: center; border: 1px solid var(--border); background: var(--surface-raised); color: var(--accent); box-shadow: var(--shadow); }
.music-zone .shortcuts-hint-btn:hover { border-color: var(--accent); background: var(--accent-soft); transform: none; }
@media (max-width: 760px) {
  .music-zone { padding-bottom: 132px; }
  .music-zone .zone-description { padding: var(--space-4); }
  .music-zone .action-bar { align-items: stretch; flex-direction: column; gap: var(--space-3); }
  .music-zone .action-btns { width: 100%; }
  .music-zone .action-btns > button { flex: 1; }
  .music-zone .music-row { grid-template-columns: auto 48px minmax(0, 1fr) auto; }
  .music-zone .music-tools { grid-column: 2 / -1; justify-content: flex-end; opacity: 1; }
  .music-zone .music-meta { display: none; }
  .music-zone .mini-content { padding: var(--space-2) var(--space-3); }
  .music-zone .mini-extra { display: flex; align-items: center; gap: var(--space-2); }
  .music-zone .mini-extra .volume-control { display: none; }
  .music-zone .fullscreen-music-player { overflow: auto; }
  .music-zone .fs-body { grid-template-columns: 1fr; padding: var(--space-4); }
  .music-zone .fs-playlist-section { display: none; }
  .music-zone .info-modal.modern,
  .music-zone .lyrics-input-modal,
  .music-zone .delete-modal.modern,
  .music-zone .upload-modal.modern,
  .music-zone .shortcuts-modal { width: min(100% - 24px, 560px); }
}
</style>
