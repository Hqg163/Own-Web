<template>
  <div :class="themeClass" class="music-zone">
    <!-- 头部 -->
    <div class="zone-header">
      <button class="back-btn" @click="goBack">
        <span>←</span> 返回
      </button>
    </div>

    <!-- 描述区域 -->
    <div class="zone-description">
      <h3>🎵 音乐专区</h3>
      <p>本专区为个人音乐专区，以常见的缩略图为封面的歌曲进行展示</p>
      <p>悬停歌曲所在位置会显示歌曲几大功能符号，包括开始/暂停、更多、显示歌词等</p>
      <p>点击歌曲缩略图封面可跳转全屏歌曲模式，该模式下歌曲占据整个页面、上下轮播歌词</p>
      <p>本页面音乐均可收听和下载，请放心食用</p>
    </div>

    <!-- 操作栏 -->
    <div class="action-bar">
      <div class="list-header">
        <h4>歌曲列表 <span class="selection-indicator-text">{{ selectionText }}</span></h4>
      </div>
      <div class="action-btns">
        <template v-if="!isFiltering">
          <button class="filter-btn" @click="startFilter">筛选歌曲</button>
          <button class="upload-btn" @click="showUpload = true">上传歌曲</button>
        </template>
        <template v-else>
          <button class="action-btn delete-btn" :disabled="selectedMusic.length === 0" @click="confirmDelete">
            批量删除
          </button>
          <button class="action-btn cancel-btn" @click="cancelFilter">取消筛选</button>
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
            <span v-if="selectedMusic.includes(music.id)">✓</span>
          </div>
          
          <!-- 序号 -->
          <span class="row-number" v-if="!isFiltering">{{ index + 1 }}</span>
          
          <div class="music-cover" @click.stop="playMusic(music)">
            <img :src="getMusicCover(music)" :alt="music.title" />
            <div class="play-overlay">
              <div class="disc-animation" v-if="currentMusic && currentMusic.id === music.id && isPlaying">
                <div class="disc"></div>
              </div>
              <span v-else-if="currentMusic && currentMusic.id === music.id && !isPlaying">⏸</span>
              <span v-else>▶</span>
            </div>
            <!-- 播放中的波纹效果 -->
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
              class="tool-btn play-pause-btn" 
              @click.stop="togglePlayMusic(music)"
              :title="isPlaying && currentMusic && currentMusic.id === music.id ? '暂停' : '播放'"
            >
              {{ isPlaying && currentMusic && currentMusic.id === music.id ? '⏸' : '▶' }}
            </button>
            <button class="tool-btn more-btn" @click.stop="showMusicInfo(music)" title="歌曲更多信息">⋮⋮⋮</button>
            <button 
              class="tool-btn lyrics-btn" 
              @click.stop="toggleLyricsSidebar(music)"
              :class="{ active: showLyricsSidebar && currentMusic && currentMusic.id === music.id }"
              title="侧边栏显示歌词"
            >
              ⤢
            </button>
            <button class="tool-btn download-btn" @click.stop="downloadMusic(music)" title="下载歌曲">⬇</button>
            <button class="tool-btn delete-tool" @click.stop="deleteSingleMusic(music)" title="删除">🗑</button>
          </div>
          
          <div class="music-meta">
            <span class="music-quality" v-if="music.file_type === '.flac' || music.file_type === '.wav'">无损</span>
            <span class="music-duration">{{ formatDuration(music.duration) }}</span>
          </div>
        </div>
        
        <!-- 空状态 -->
        <div v-if="musicList.length === 0" class="empty-music-list">
          <div class="empty-icon">🎵</div>
          <p>暂无歌曲，点击上传按钮添加音乐</p>
          <button class="upload-empty-btn" @click="showUpload = true">立即上传</button>
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
          <button class="close-lyrics-btn" @click="showLyricsSidebar = false">✕</button>
        </div>
        
        <div class="lyrics-content" ref="lyricsContainer" @scroll="onLyricsScroll">
          <div 
            v-for="(line, index) in parsedLyrics" 
            :key="index"
            :class="['lyrics-line', { active: currentLyricIndex === index }]"
            @click="seekToLyric(line.time)"
            :data-time="line.time"
          >
            {{ line.text }}
            <span v-if="currentLyricIndex === index" class="play-hint" title="点击从此处播放">▶</span>
          </div>
          
          <!-- 逐字歌词模式 -->
          <div v-if="parsedLyrics.length === 0 && currentMusic" class="lyrics-fallback">
            <div class="lyric-word" 
                 v-for="(word, idx) in fallbackLyrics" 
                 :key="idx"
                 :class="{ active: fallbackIndex === idx }">
              {{ word }}
            </div>
          </div>
          
          <div v-if="!currentMusic" class="no-lyrics-playing">
            <p>请选择一首歌曲播放</p>
          </div>
          <div v-else-if="parsedLyrics.length === 0 && !fallbackLyrics.length" class="no-lyrics">
            <p>该歌曲暂无可显示歌词</p>
            <button class="add-lyrics-btn" @click="showAddLyrics = true">添加歌词</button>
          </div>
        </div>
        
        <!-- 歌词控制 -->
        <div class="lyrics-controls">
          <button @click="adjustLyricsOffset(-0.5)" title="歌词提前0.5秒">−0.5s</button>
          <span>歌词偏移: {{ lyricsOffset.toFixed(1) }}s</span>
          <button @click="adjustLyricsOffset(0.5)" title="歌词延后0.5秒">+0.5s</button>
          <button @click="resetLyricsOffset" title="重置">↺</button>
        </div>
      </div>
    </div>

    <!-- 底部播放控制栏（迷你播放器） -->
    <transition name="slide-up">
      <div v-if="currentMusic && !fullscreenPlayer" class="mini-player" :class="{ 'is-playing': isPlaying }">
        <!-- 进度条 -->
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
            <button class="mode-btn-mini" @click="togglePlayMode" :title="playModeTitle">
              {{ playModeIcon }}
            </button>
            <button @click="prevMusic" :disabled="!canGoPrev" class="nav-btn">⏮</button>
            <button class="main-play-btn" @click="togglePlay">
              {{ isPlaying ? '⏸' : '▶' }}
            </button>
            <button @click="nextMusic" :disabled="!canGoNext" class="nav-btn">⏭</button>
            <button class="playlist-btn-mini" @click="toggleMiniPlaylist" title="播放列表">☰</button>
          </div>
          
          <div class="mini-extra">
            <div class="volume-control">
              <button @click="toggleMute">{{ isMuted ? '🔇' : volume > 50 ? '🔊' : volume > 0 ? '🔉' : '🔇' }}</button>
              <input type="range" v-model="volume" min="0" max="100" @input="changeVolume" class="volume-slider" />
            </div>
            <button class="fullscreen-btn" @click="openFullscreenPlayer" title="全屏模式">⛶</button>
          </div>
        </div>
        
        <!-- 迷你播放列表 -->
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
      <div v-if="fullscreenPlayer" class="fullscreen-music-player">
        <!-- 动态背景 -->
        <div class="fs-background" :style="fsBackgroundStyle"></div>
        <div class="fs-background-overlay"></div>
        
        <!-- 粒子效果 -->
        <div class="particles" v-if="isPlaying">
          <span v-for="n in 20" :key="n" :style="getParticleStyle(n)"></span>
        </div>
        
        <div class="fs-header">
          <button class="back-btn" @click="closeFullscreenPlayer">
            <span>←</span> 返回
          </button>
          <div class="fs-header-center">
            <span class="fs-mode-badge">{{ playModeTitle }}</span>
            <span class="fs-title">{{ isPlaying ? '正在播放' : '已暂停' }}</span>
          </div>
          <div class="fs-volume-control">
            <button @click="toggleMute">{{ isMuted ? '🔇' : '🔊' }}</button>
            <input type="range" v-model="volume" min="0" max="100" @input="changeVolume" />
          </div>
        </div>
        
        <div class="fs-body">
          <!-- 左侧专辑封面 -->
          <div class="fs-album-section">
            <div class="album-disc" :class="{ playing: isPlaying }">
              <img :src="getMusicCover(currentMusic)" />
              <div class="disc-center"></div>
            </div>
            <div class="album-glow"></div>
          </div>
          
          <!-- 中间歌词 -->
          <div class="fs-lyrics-section">
            <div class="lyrics-container" ref="fsLyricsContainer" @scroll="onFsLyricsScroll">
              <div class="lyrics-scroll-content">
                <div 
                  v-for="(line, index) in parsedLyrics" 
                  :key="index"
                  :class="['fs-lyric-line', { 
                    active: currentLyricIndex === index,
                    past: index < currentLyricIndex
                  }]"
                  @click="seekToLyric(line.time)"
                >
                  <span class="lyric-text">{{ line.text }}</span>
                  <span v-if="currentLyricIndex === index" class="now-playing-indicator">♪</span>
                </div>
                <div v-if="parsedLyrics.length === 0" class="fs-no-lyrics">
                  <div class="no-lyrics-icon">🎵</div>
                  <p>暂无歌词</p>
                  <button class="add-lyrics-btn-large" @click="showAddLyrics = true">添加歌词</button>
                </div>
              </div>
            </div>
            
            <!-- 歌词预览（下一句） -->
            <div class="next-lyric" v-if="parsedLyrics.length > 0 && currentLyricIndex < parsedLyrics.length - 1">
              <span>下一句：</span>
              {{ parsedLyrics[currentLyricIndex + 1] ? parsedLyrics[currentLyricIndex + 1].text : '' }}
            </div>
          </div>
          
          <!-- 右侧播放列表 -->
          <div class="fs-playlist-section" :class="{ collapsed: !showFsPlaylist }">
            <button class="playlist-toggle-btn" @click="showFsPlaylist = !showFsPlaylist">
              {{ showFsPlaylist ? '→' : '←' }}
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
                  :title="m.title + ' - ' + m.artist"
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
          <!-- 歌曲信息 -->
          <div class="fs-song-info">
            <h3>{{ currentMusic.title }}</h3>
            <p>{{ currentMusic.artist }} <span v-if="currentMusic.album">· {{ currentMusic.album }}</span></p>
          </div>
          
          <!-- 进度条 -->
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
          
          <!-- 控制按钮 -->
          <div class="fs-buttons">
            <button class="mode-btn" @click="togglePlayMode" :title="playModeTitle">
              <span class="mode-icon">{{ playModeIcon }}</span>
              <span class="mode-text">{{ playModeTitle }}</span>
            </button>
            
            <div class="main-controls">
              <button @click="prevMusic" :disabled="!canGoPrev" class="nav-btn large" title="上一首">
                <span>⏮</span>
              </button>
              <button class="fs-play-btn" @click="togglePlay" :class="{ playing: isPlaying }">
                <span v-if="!isPlaying">▶</span>
                <span v-else>⏸</span>
              </button>
              <button @click="nextMusic" :disabled="!canGoNext" class="nav-btn large" title="下一首">
                <span>⏭</span>
              </button>
            </div>
            
            <div class="extra-controls">
              <button 
                :class="['lyrics-toggle-btn', { active: showLyricsSidebar }]" 
                @click="toggleLyricsSidebar(currentMusic)"
                title="歌词"
              >
                词
              </button>
              <button class="playlist-toggle-fs" @click="showFsPlaylist = !showFsPlaylist" title="播放列表">
                ☰
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- 歌曲信息弹窗 -->
    <div v-if="showInfoModal" class="modal-overlay info-overlay" @click.self="showInfoModal = false">
      <div class="info-modal modern">
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
          <div class="info-row" v-if="infoModalData.play_count !== undefined">
            <label>播放次数</label>
            <span>{{ infoModalData.play_count }} 次</span>
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
      <div class="lyrics-input-modal">
        <h3>添加歌词</h3>
        <p class="hint">支持LRC格式：[mm:ss.xx]歌词内容</p>
        <textarea 
          v-model="newLyricsText" 
          placeholder="在此粘贴歌词..."
          rows="10"
        ></textarea>
        <div class="lyrics-preview" v-if="newLyricsText">
          <h4>预览</h4>
          <div class="preview-content">{{ newLyricsText.substring(0, 100) }}...</div>
        </div>
        <div class="actions">
          <button class="primary-btn" @click="saveLyrics">保存歌词</button>
          <button @click="showAddLyrics = false">取消</button>
        </div>
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <div v-if="showDeleteConfirm" class="modal-overlay" @click.self="showDeleteConfirm = false">
      <div class="delete-modal modern">
        <div class="delete-icon">🗑</div>
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
      <div class="upload-modal modern">
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
            <input 
              type="file" 
              ref="fileInput"
              accept="audio/*" 
              @change="handleFileSelect"
              hidden
            />
            <div class="drop-content" @click="$refs.fileInput.click()">
              <div class="upload-icon">📁</div>
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
            <div class="success-icon">✓</div>
            <h4>上传成功！</h4>
            <p>{{ uploadForm.title }} - {{ uploadForm.artist }}</p>
          </div>
          <div class="actions">
            <button class="primary-btn" @click="closeUploadAndRefresh">完成</button>
            <button @click="uploadAnother">继续上传</button>
          </div>
        </div>
        
        <!-- 上传进度 -->
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
    
    <!-- 键盘快捷键提示 -->
    <div v-if="showShortcuts" class="shortcuts-overlay" @click="showShortcuts = false">
      <div class="shortcuts-modal">
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
    
    <!-- 快捷键提示按钮 -->
    <button class="shortcuts-hint-btn" @click="showShortcuts = true" title="快捷键">?</button>
  </div>
</template>

<script>
import axios from 'axios'

export default {
  name: 'MusicZone',
  data() {
    return {
      themeClass: localStorage.getItem('theme') === 'dark' ? 'dark-mode' : 'light-mode',
      userId: null,
      musicList: [],
      
      // 播放状态
      currentMusic: null,
      isPlaying: false,
      currentTime: 0,
      totalDuration: 0,
      bufferedTime: 0,
      isBuffering: false,
      playMode: 'sequence', // 'sequence', 'random', 'single'
      volume: 80,
      isMuted: false,
      previousVolume: 80,
      playedHistory: [],
      
      // 歌词
      currentLyrics: '',
      parsedLyrics: [],
      currentLyricIndex: -1,
      lyricsOffset: 0,
      lyricsAutoScroll: true,
      lyricsScrollTimer: null,
      fallbackLyrics: [],
      fallbackIndex: 0,
      
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
      const icons = {
        'sequence': '🔁',
        'random': '🔀',
        'single': '🔂'
      }
      return icons[this.playMode]
    },
    playModeTitle() {
      const titles = {
        'sequence': '顺序播放',
        'random': '随机播放',
        'single': '单曲循环'
      }
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
      return {
        backgroundImage: `url(${this.getMusicCover(this.currentMusic)})`
      }
    }
  },
  watch: {
    currentTime(newVal) {
      this.updateCurrentLyric(newVal)
      this.updateFallbackIndex(newVal)
    },
    volume(newVal) {
      if (this.$refs.audioPlayer) {
        this.$refs.audioPlayer.volume = newVal / 100
        if (newVal > 0 && this.isMuted) {
          this.isMuted = false
        }
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
    this.setupThemeListener()
    this.setupKeyboardShortcuts()
    this.loadVolumeSetting()
  },
  beforeUnmount() {
    this.removeKeyboardShortcuts()
    if (this.$refs.audioPlayer) {
      this.$refs.audioPlayer.pause()
    }
  },
  methods: {
    setupThemeListener() {
      window.addEventListener('theme-changed', (e) => {
        this.themeClass = e.detail.theme === 'dark' ? 'dark-mode' : 'light-mode'
      })
    },
    
    loadVolumeSetting() {
      const saved = localStorage.getItem('musicVolume')
      if (saved !== null) {
        this.volume = parseInt(saved)
      }
    },
    
    saveVolumeSetting() {
      localStorage.setItem('musicVolume', this.volume)
    },
    
    // 键盘快捷键
    setupKeyboardShortcuts() {
      document.addEventListener('keydown', this.handleKeyDown)
    },
    
    removeKeyboardShortcuts() {
      document.removeEventListener('keydown', this.handleKeyDown)
    },
    
    handleKeyDown(e) {
      // 如果在输入框中，不处理
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      
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
          if (this.fullscreenPlayer) this.closeFullscreenPlayer()
          if (this.showUpload) this.closeUpload()
          if (this.showInfoModal) this.showInfoModal = false
          break
      }
    },
    
    // 数据加载
    async loadMusic() {
      try {
        const res = await axios.get(`/api/entertainment/music/${this.userId}`)
        this.musicList = res.data.music || []
        // 按添加时间倒序，但播放时按用户选择
      } catch (err) {
        this.showToast('加载音乐失败', 'error')
      }
    },
    
    getMusicCover(music) {
      if (!music) return ''
      if (music.cover_path) {
        return music.cover_path
      }
      // 使用歌曲标题生成渐变背景
      const colors = this.generateColorsFromString(music.title + music.artist)
      return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23${colors[0]}'/%3E%3Cstop offset='100%25' stop-color='%23${colors[1]}'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='300' height='300' fill='url(%23g)'/%3E%3Ccircle cx='150' cy='150' r='80' fill='rgba(255,255,255,0.1)'/%3E%3Ccircle cx='150' cy='150' r='40' fill='rgba(255,255,255,0.2)'/%3E%3Ccircle cx='150' cy='150' r='15' fill='rgba(255,255,255,0.3)'/%3E%3C/svg%3E`
    },
    
    generateColorsFromString(str) {
      let hash = 0
      for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash)
      }
      const c1 = Math.abs(hash % 360)
      const c2 = (c1 + 40) % 360
      return [
        this.hslToHex(c1, 70, 50),
        this.hslToHex(c2, 70, 40)
      ]
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
      if (music.file_path && music.file_path.startsWith('/uploads')) {
        return music.file_path
      }
      return `/api/entertainment/music-file/${music.id}?userId=${this.userId}`
    },
    
    formatDuration(duration) {
      if (!duration) return '0:00'
      if (typeof duration === 'string' && duration.includes(':')) {
        // 已经是 mm:ss 格式
        const parts = duration.split(':')
        if (parts.length === 2) return duration
        // hh:mm:ss 格式，转换为 mm:ss
        if (parts.length === 3) {
          const h = parseInt(parts[0])
          const m = parseInt(parts[1])
          const s = parts[2]
          return `${h * 60 + m}:${s}`
        }
      }
      // 秒数格式
      const seconds = parseInt(duration) || 0
      const m = Math.floor(seconds / 60)
      const s = seconds % 60
      return `${m}:${s.toString().padStart(2, '0')}`
    },
    
    formatFileSize(bytes) {
      if (!bytes) return '0 B'
      const units = ['B', 'KB', 'MB', 'GB']
      let size = bytes
      let unitIndex = 0
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
    
    // 播放控制
    playMusic(music, addToHistory = true) {
      if (!music) return
      
      if (this.currentMusic && this.currentMusic.id === music.id) {
        this.togglePlay()
        return
      }
      
      this.currentMusic = music
      const audio = this.$refs.audioPlayer
      
      // 添加播放历史
      if (addToHistory && !this.playedHistory.includes(music.id)) {
        this.playedHistory.push(music.id)
      }
      
      // 增加播放次数
      this.incrementPlayCount(music.id)
      
      audio.src = this.getMusicUrl(music)
      audio.load()
      
      audio.oncanplaythrough = () => {
        audio.play()
        this.isPlaying = true
        this.loadLyrics(music)
        this.generateFallbackLyrics(music)
      }
    },
    
    async incrementPlayCount(musicId) {
      try {
        await axios.post(`/api/entertainment/music/${musicId}/play`, { userId: this.userId })
      } catch (e) {
        // 静默处理
      }
    },
    
    togglePlay() {
      if (!this.currentMusic) {
        if (this.musicList.length > 0) {
          this.playMusic(this.musicList[0])
        }
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
        // 从播放历史中选择上一首，或随机选择
        if (this.playedHistory.length > 1) {
          this.playedHistory.pop() // 移除当前
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
        // 避免连续随机到同一首
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
    
    // 歌词处理
    loadLyrics(music) {
      if (!music) return
      if (music.lyrics) {
        this.currentLyrics = music.lyrics
        this.parseLyrics(music.lyrics)
      } else {
        this.currentLyrics = ''
        this.parsedLyrics = []
        // 尝试从本地存储加载
        const savedLyrics = localStorage.getItem(`lyrics_${music.id}`)
        if (savedLyrics) {
          this.currentLyrics = savedLyrics
          this.parseLyrics(savedLyrics)
        }
      }
    },
    
    parseLyrics(lyricsText) {
      if (!lyricsText) {
        this.parsedLyrics = []
        return
      }
      
      const lines = lyricsText.split('\n')
      const parsed = []
      const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/
      const enhancedRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](?:<(\d{2}):(\d{2})\.(\d{2,3})>)?(.+)/
      
      lines.forEach(line => {
        // 尝试解析增强格式
        let match = line.match(enhancedRegex)
        if (!match) {
          match = line.match(timeRegex)
        }
        
        if (match) {
          const minutes = parseInt(match[1])
          const seconds = parseInt(match[2])
          const ms = parseInt((match[3] || '0').toString().padEnd(3, '0').substring(0, 3))
          const time = minutes * 60 + seconds + ms / 1000
          const text = (match[7] || match[4] || '').trim()
          
          if (text) {
            parsed.push({ time, text })
          }
        }
      })
      
      this.parsedLyrics = parsed.sort((a, b) => a.time - b.time)
    },
    
    generateFallbackLyrics(music) {
      // 当没有LRC歌词时，生成逐字歌词
      const title = music.title || ''
      const artist = music.artist || ''
      const text = `${title} - ${artist}`
      this.fallbackLyrics = text.split('').filter(c => c.trim())
    },
    
    updateCurrentLyric(currentTime) {
      if (this.parsedLyrics.length === 0) {
        this.currentLyricIndex = -1
        return
      }
      
      const adjustedTime = currentTime - this.lyricsOffset
      let idx = 0
      
      for (let i = 0; i < this.parsedLyrics.length; i++) {
        if (adjustedTime >= this.parsedLyrics[i].time) {
          idx = i
        } else {
          break
        }
      }
      
      if (this.currentLyricIndex !== idx) {
        this.currentLyricIndex = idx
        if (this.lyricsAutoScroll) {
          this.scrollLyrics()
        }
      }
    },
    
    updateFallbackIndex(currentTime) {
      if (this.fallbackLyrics.length === 0) return
      const progress = currentTime / (this.totalDuration || 1)
      this.fallbackIndex = Math.floor(progress * this.fallbackLyrics.length)
    },
    
    scrollLyrics() {
      this.$nextTick(() => {
        const container = this.fullscreenPlayer ? this.$refs.fsLyricsContainer : this.$refs.lyricsContainer
        if (!container) return
        
        const activeLine = container.querySelector('.active') || container.querySelector('.lyric-word.active')
        if (activeLine) {
          const containerHeight = container.clientHeight
          const lineTop = activeLine.offsetTop
          const lineHeight = activeLine.clientHeight
          
          container.scrollTo({
            top: lineTop - containerHeight / 2 + lineHeight / 2,
            behavior: 'smooth'
          })
        }
      })
    },
    
    onLyricsScroll() {
      this.lyricsAutoScroll = false
      if (this.lyricsScrollTimer) clearTimeout(this.lyricsScrollTimer)
      this.lyricsScrollTimer = setTimeout(() => {
        this.lyricsAutoScroll = true
      }, 5000)
    },
    
    onFsLyricsScroll() {
      this.lyricsAutoScroll = false
      if (this.lyricsScrollTimer) clearTimeout(this.lyricsScrollTimer)
      this.lyricsScrollTimer = setTimeout(() => {
        this.lyricsAutoScroll = true
      }, 3000)
    },
    
    seekToLyric(time) {
      if (time === undefined) return
      const adjustedTime = time + this.lyricsOffset
      this.$refs.audioPlayer.currentTime = Math.max(0, adjustedTime)
      this.currentTime = adjustedTime
    },
    
    adjustLyricsOffset(delta) {
      this.lyricsOffset += delta
    },
    
    resetLyricsOffset() {
      this.lyricsOffset = 0
    },
    
    // 音频事件
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
    
    // 音量控制
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
      if (this.volume > 0 && this.isMuted) {
        this.isMuted = false
      }
    },
    
    // 导航和UI
    goBack() {
      this.$router.push('/personal/entertainment')
    },
    
    openFullscreenPlayer() {
      if (!this.currentMusic) return
      this.fullscreenPlayer = true
      this.loadLyrics(this.currentMusic)
      document.body.style.overflow = 'hidden'
    },
    
    closeFullscreenPlayer() {
      this.fullscreenPlayer = false
      this.showFsPlaylist = true
      document.body.style.overflow = ''
    },
    
    toggleLyricsSidebar(music) {
      if (this.showLyricsSidebar && this.currentMusic && this.currentMusic.id === music.id) {
        this.showLyricsSidebar = false
      } else {
        this.loadLyrics(music)
        this.showLyricsSidebar = true
        this.$nextTick(() => {
          this.scrollLyrics()
        })
      }
    },
    
    toggleMiniPlaylist() {
      this.showMiniPlaylist = !this.showMiniPlaylist
    },
    
    // 筛选
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
        // 非筛选模式下，点击行也播放
        this.playMusic(music)
      }
    },
    
    // 信息和操作
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
        
        // 处理删除后的播放状态
        if (this.currentMusic && this.selectedMusic.includes(this.currentMusic.id)) {
          // 尝试播放下一首
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
    
    // 上传
    validateTitle() {
      if (!this.uploadForm.title.trim()) {
        this.errors.title = '请输入歌曲名'
      } else {
        this.errors.title = ''
      }
    },
    
    validateArtist() {
      if (!this.uploadForm.artist.trim()) {
        this.errors.artist = '请输入歌手名'
      } else {
        this.errors.artist = ''
      }
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
      
      // 检查文件大小（最大100MB）
      if (file.size > 100 * 1024 * 1024) {
        this.showToast('文件大小不能超过100MB', 'error')
        return
      }
      
      this.uploadForm.file = file
      
      // 尝试读取元数据
      this.readAudioMetadata(file)
    },
    
    readAudioMetadata(file) {
      const audio = new Audio()
      audio.preload = 'metadata'
      audio.src = URL.createObjectURL(file)
      
      audio.onloadedmetadata = () => {
        // 获取时长
        const duration = audio.duration
        // 可以尝试提取其他元数据
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
    
    // 歌词编辑
    async saveLyrics() {
      if (!this.newLyricsText.trim() || !this.currentMusic) return
      
      try {
        await axios.put(`/api/entertainment/music/${this.currentMusic.id}/lyrics`, {
          userId: this.userId,
          lyrics: this.newLyricsText
        })
        
        // 同时保存到本地
        localStorage.setItem(`lyrics_${this.currentMusic.id}`, this.newLyricsText)
        
        this.currentLyrics = this.newLyricsText
        this.parseLyrics(this.newLyricsText)
        this.showAddLyrics = false
        this.newLyricsText = ''
        this.showToast('歌词保存成功')
      } catch (err) {
        // 如果API失败，至少保存到本地
        localStorage.setItem(`lyrics_${this.currentMusic.id}`, this.newLyricsText)
        this.currentLyrics = this.newLyricsText
        this.parseLyrics(this.newLyricsText)
        this.showAddLyrics = false
        this.newLyricsText = ''
        this.showToast('歌词已保存（本地）')
      }
    },
    
    // 视觉特效
    getParticleStyle(n) {
      const randomX = Math.random() * 100
      const randomDelay = Math.random() * 2
      const randomDuration = 3 + Math.random() * 4
      return {
        left: randomX + '%',
        animationDelay: randomDelay + 's',
        animationDuration: randomDuration + 's'
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
/* 主题变量 */
.light-mode {
  --bg-primary: #ffffff;
  --bg-secondary: #f8fafc;
  --bg-tertiary: #f1f5f9;
  --border-color: #e2e8f0;
  --text-primary: #1e293b;
  --text-secondary: #64748b;
  --text-tertiary: #94a3b8;
  --accent-color: #3b82f6;
  --accent-light: #dbeafe;
  --accent-gradient: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
  --danger-color: #ef4444;
  --success-color: #10b981;
  --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
}

.dark-mode {
  --bg-primary: #1e293b;
  --bg-secondary: #334155;
  --bg-tertiary: #475569;
  --border-color: #475569;
  --text-primary: #f8fafc;
  --text-secondary: #cbd5e1;
  --text-tertiary: #94a3b8;
  --accent-color: #60a5fa;
  --accent-light: rgba(96, 165, 250, 0.2);
  --accent-gradient: linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%);
  --danger-color: #f87171;
  --success-color: #34d399;
  --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.4);
}

.music-zone {
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
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: var(--shadow);
}

.back-btn:hover {
  transform: translateX(-4px);
  box-shadow: var(--shadow-lg);
  border-color: var(--accent-color);
}

/* 描述区域 */
.zone-description {
  background: var(--bg-primary);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: var(--shadow);
  border: 1px solid var(--border-color);
}

.zone-description h3 {
  margin: 0 0 16px 0;
  color: var(--text-primary);
  font-size: 24px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 2px solid var(--accent-color);
}

.zone-description p {
  margin: 8px 0;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.6;
  padding-left: 8px;
  border-left: 3px solid var(--accent-light);
}

/* 操作栏 */
.action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 16px 20px;
  background: var(--bg-primary);
  border-radius: 12px;
  box-shadow: var(--shadow);
  border: 1px solid var(--border-color);
}

.list-header h4 {
  margin: 0;
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 12px;
}

.selection-indicator-text {
  font-size: 14px;
  color: var(--text-tertiary);
  font-weight: 400;
  background: var(--bg-secondary);
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
  background: var(--accent-gradient);
  color: white;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.filter-btn:hover, .upload-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
}

.delete-btn {
  background: var(--danger-color);
  color: white;
}

.delete-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.cancel-btn {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
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
  background: var(--bg-primary);
  border-radius: 16px;
  box-shadow: var(--shadow);
  border: 1px solid var(--border-color);
  overflow: hidden;
}

/* 音乐行 */
.music-row {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  transition: all 0.3s;
  gap: 12px;
  position: relative;
}

.music-row:last-child {
  border-bottom: none;
}

.music-row:hover {
  background: var(--bg-secondary);
}

.music-row.playing {
  background: var(--accent-light);
}

.music-row.playing .music-name {
  color: var(--accent-color);
  font-weight: 600;
}

.music-row.paused .music-name {
  color: var(--accent-color);
  opacity: 0.7;
}

.music-row.selectable {
  padding-left: 20px;
}

.music-row.selected {
  background: rgba(239, 68, 68, 0.1);
  border-left: 4px solid var(--danger-color);
}

.row-number {
  width: 28px;
  text-align: center;
  color: var(--text-tertiary);
  font-size: 14px;
  font-weight: 500;
}

.row-selection-indicator {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid var(--text-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  flex-shrink: 0;
  transition: all 0.3s;
}

.music-row.selected .row-selection-indicator {
  background: var(--danger-color);
  border-color: var(--danger-color);
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
  backdrop-filter: blur(2px);
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
  background: conic-gradient(from 0deg, #333, #666, #333);
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
  background: var(--accent-color);
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
  background: var(--accent-color);
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
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.3s;
}

.music-separator {
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.music-artist {
  color: var(--text-secondary);
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.music-album {
  color: var(--text-tertiary);
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
  background: var(--bg-tertiary);
  color: var(--text-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  transition: all 0.3s;
}

.tool-btn:hover {
  background: var(--accent-color);
  color: white;
  transform: scale(1.1);
}

.tool-btn.active {
  background: var(--accent-color);
  color: white;
}

.tool-btn.delete-tool:hover {
  background: var(--danger-color);
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
  background: var(--accent-light);
  color: var(--accent-color);
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
}

.music-duration {
  color: var(--text-tertiary);
  font-size: 13px;
  font-family: 'SF Mono', monospace;
  min-width: 40px;
  text-align: right;
}

/* 空状态 */
.empty-music-list {
  text-align: center;
  padding: 80px 20px;
  color: var(--text-secondary);
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
  background: var(--accent-gradient);
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
  background: var(--bg-primary);
  border-radius: 16px;
  box-shadow: var(--shadow);
  border: 1px solid var(--border-color);
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
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
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
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 600;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lyrics-song-info span {
  color: var(--text-secondary);
  font-size: 13px;
}

.close-lyrics-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 16px;
  transition: all 0.3s;
}

.close-lyrics-btn:hover {
  background: var(--danger-color);
  color: white;
}

.lyrics-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px 16px;
  text-align: center;
  scroll-behavior: smooth;
  position: relative;
}

.lyrics-line {
  padding: 12px 8px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.3s;
  border-radius: 8px;
  margin: 4px 0;
  position: relative;
  font-size: 15px;
  line-height: 1.6;
}

.lyrics-line:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.lyrics-line.active {
  color: var(--accent-color);
  font-size: 18px;
  font-weight: 600;
  background: var(--accent-light);
  transform: scale(1.02);
}

.play-hint {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0;
  font-size: 12px;
  color: var(--accent-color);
  transition: opacity 0.3s;
}

.lyrics-line:hover .play-hint {
  opacity: 1;
}

/* 逐字歌词 */
.lyrics-fallback {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px;
  padding: 20px;
}

.lyric-word {
  padding: 8px 12px;
  background: var(--bg-secondary);
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 18px;
  transition: all 0.3s;
}

.lyric-word.active {
  background: var(--accent-color);
  color: white;
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.no-lyrics, .no-lyrics-playing {
  padding: 60px 20px;
  color: var(--text-tertiary);
}

.add-lyrics-btn {
  margin-top: 16px;
  padding: 8px 20px;
  background: var(--accent-color);
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
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
}

.lyrics-controls button {
  padding: 6px 12px;
  background: var(--bg-tertiary);
  border: none;
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.3s;
}

.lyrics-controls button:hover {
  background: var(--accent-color);
  color: white;
}

.lyrics-controls span {
  font-size: 12px;
  color: var(--text-secondary);
  min-width: 80px;
  text-align: center;
}

/* 迷你播放器 */
.mini-player {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--bg-primary);
  border-top: 1px solid var(--border-color);
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.1);
  z-index: 100;
  transition: all 0.3s;
}

.mini-player.is-playing {
  border-top-color: var(--accent-color);
}

.mini-progress {
  height: 3px;
  background: var(--bg-secondary);
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
  background: var(--accent-gradient);
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
  background: var(--bg-tertiary);
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
  background: var(--accent-color);
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
  color: var(--text-primary);
  font-size: 15px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mini-artist {
  color: var(--text-secondary);
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
  color: var(--text-secondary);
  font-size: 20px;
  cursor: pointer;
  transition: all 0.3s;
  padding: 8px;
  border-radius: 50%;
}

.mini-controls button:hover:not(:disabled) {
  color: var(--accent-color);
  background: var(--accent-light);
}

.mini-controls button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.main-play-btn {
  width: 48px !important;
  height: 48px;
  background: var(--accent-color) !important;
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
  color: var(--text-secondary);
  font-size: 18px;
  cursor: pointer;
}

.volume-slider {
  width: 80px;
  height: 4px;
  -webkit-appearance: none;
  background: var(--bg-tertiary);
  border-radius: 2px;
  outline: none;
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  background: var(--accent-color);
  border-radius: 50%;
  cursor: pointer;
}

.fullscreen-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.3s;
}

.fullscreen-btn:hover {
  background: var(--accent-color);
  color: white;
  border-color: var(--accent-color);
}

/* 迷你播放列表 */
.mini-playlist {
  position: absolute;
  bottom: 100%;
  right: 24px;
  width: 320px;
  max-height: 400px;
  background: var(--bg-primary);
  border-radius: 12px 12px 0 0;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-bottom: none;
}

.mini-playlist-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.3s;
  border-bottom: 1px solid var(--border-color);
}

.mini-playlist-item:hover, .mini-playlist-item.active {
  background: var(--accent-light);
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
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mini-playlist-item .item-artist {
  font-size: 12px;
  color: var(--text-secondary);
}

.mini-playlist-item .item-duration {
  font-size: 12px;
  color: var(--text-tertiary);
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
  animation: bg-pulse 10s ease-in-out infinite;
}

@keyframes bg-pulse {
  0%, 100% { transform: scale(1.2); }
  50% { transform: scale(1.25); }
}

.fs-background-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
}

/* 粒子效果 */
.particles {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  pointer-events: none;
}

.particles span {
  position: absolute;
  width: 4px;
  height: 4px;
  background: var(--accent-color);
  border-radius: 50%;
  opacity: 0;
  animation: particle-float 8s ease-in-out infinite;
}

@keyframes particle-float {
  0% {
    opacity: 0;
    transform: translateY(100vh) scale(0);
  }
  10% {
    opacity: 0.8;
  }
  90% {
    opacity: 0.8;
  }
  100% {
    opacity: 0;
    transform: translateY(-100vh) scale(1.5);
  }
}

/* 全屏头部 */
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
  backdrop-filter: blur(10px);
}

.fs-header-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.fs-mode-badge {
  padding: 4px 16px;
  background: var(--accent-color);
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

.fs-volume-control input {
  width: 100px;
  height: 4px;
  -webkit-appearance: none;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
}

.fs-volume-control input::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  background: white;
  border-radius: 50%;
  cursor: pointer;
}

/* 全屏主体 */
.fs-body {
  flex: 1;
  display: flex;
  position: relative;
  z-index: 10;
  padding: 0 32px;
  gap: 40px;
}

/* 专辑区域 */
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
  background: var(--accent-color);
  border-radius: 50%;
  filter: blur(100px);
  opacity: 0.3;
  z-index: -1;
  animation: glow-pulse 3s ease-in-out infinite;
}

@keyframes glow-pulse {
  0%, 100% { opacity: 0.3; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.1); }
}

/* 歌词区域 */
.fs-lyrics-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  max-width: 500px;
}

.lyrics-container {
  flex: 1;
  overflow-y: auto;
  padding: 40px 0;
  mask-image: linear-gradient(
    to bottom,
    transparent 0%,
    black 15%,
    black 85%,
    transparent 100%
  );
  -webkit-mask-image: linear-gradient(
    to bottom,
    transparent 0%,
    black 15%,
    black 85%,
    transparent 100%
  );
}

.lyrics-scroll-content {
  padding: 200px 0;
}

.fs-lyric-line {
  padding: 16px 24px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  line-height: 1.6;
}

.fs-lyric-line:hover {
  color: rgba(255, 255, 255, 0.7);
}

.fs-lyric-line.past {
  color: rgba(255, 255, 255, 0.2);
}

.fs-lyric-line.active {
  color: white;
  font-size: 28px;
  font-weight: 700;
  text-shadow: 0 2px 20px rgba(255, 255, 255, 0.3);
  transform: scale(1.05);
}

.fs-lyric-line.active .lyric-text {
  background: var(--accent-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.now-playing-indicator {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  color: var(--accent-color);
  font-size: 16px;
  animation: beat 1s ease-in-out infinite;
}

@keyframes beat {
  0%, 100% { transform: translateY(-50%) scale(1); }
  50% { transform: translateY(-50%) scale(1.2); }
}

.next-lyric {
  padding: 20px;
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
  font-size: 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.next-lyric span {
  color: rgba(255, 255, 255, 0.3);
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
  background: var(--accent-color);
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

/* 播放列表区域 */
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
  background: rgba(0, 0, 0, 0.3);
  border-radius: 12px;
  backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  margin-left: 16px;
}

.fs-playlist-content h4 {
  margin: 0;
  padding: 16px 20px;
  color: white;
  font-size: 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
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
  background: rgba(255, 255, 255, 0.1);
}

.fs-playlist-item.active {
  background: var(--accent-color);
}

.fs-playlist-item.played {
  opacity: 0.6;
}

.playlist-number {
  width: 24px;
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
}

.fs-playlist-item.active .playlist-number {
  color: white;
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
  color: white;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.playlist-artist {
  color: rgba(255, 255, 255, 0.6);
  font-size: 11px;
}

.playlist-duration {
  color: rgba(255, 255, 255, 0.5);
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
  background: white;
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

/* 全屏控制区域 */
.fs-controls {
  position: relative;
  z-index: 10;
  padding: 32px;
  background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%);
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

/* 进度条 */
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
  background: var(--accent-gradient);
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

/* 控制按钮 */
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
  border-color: var(--accent-color);
  background: var(--accent-color);
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
  background: var(--accent-color);
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
  background: var(--accent-color);
}

/* 过渡动画 */
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

/* 弹窗样式 */
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
  backdrop-filter: blur(8px);
  padding: 20px;
}

.modal-overlay.info-overlay {
  z-index: 1200;
}

/* 现代弹窗样式 */
.info-modal.modern, .delete-modal.modern, .upload-modal.modern {
  background: var(--bg-primary);
  border-radius: 24px;
  width: 100%;
  max-width: 480px;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  border: 1px solid var(--border-color);
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
  background: linear-gradient(to top, var(--bg-primary), transparent);
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
  border-bottom: 1px solid var(--border-color);
}

.info-row:last-child {
  border-bottom: none;
}

.info-row label {
  color: var(--text-tertiary);
  font-size: 14px;
}

.info-row span {
  color: var(--text-primary);
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
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.info-actions button:not(.primary-btn):hover {
  background: var(--bg-tertiary);
}

.primary-btn {
  background: var(--accent-gradient);
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

/* 删除确认弹窗 */
.delete-icon {
  width: 80px;
  height: 80px;
  margin: 24px auto 16px;
  background: var(--danger-color);
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
  color: var(--text-primary);
  font-size: 20px;
}

.delete-modal p {
  text-align: center;
  color: var(--text-secondary);
  margin: 0 0 8px 0;
}

.delete-warning {
  color: var(--danger-color) !important;
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
  background: var(--danger-color);
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

/* 歌词输入弹窗 */
.lyrics-input-modal {
  background: var(--bg-primary);
  border-radius: 24px;
  width: 100%;
  max-width: 560px;
  padding: 32px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  border: 1px solid var(--border-color);
}

.lyrics-input-modal h3 {
  margin: 0 0 8px 0;
  color: var(--text-primary);
  font-size: 22px;
}

.lyrics-input-modal .hint {
  color: var(--text-tertiary);
  font-size: 13px;
  margin: 0 0 16px 0;
}

.lyrics-input-modal textarea {
  width: 100%;
  min-height: 300px;
  padding: 16px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.8;
  resize: vertical;
  font-family: 'SF Mono', monospace;
}

.lyrics-input-modal textarea:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 3px var(--accent-light);
}

.lyrics-preview {
  margin: 16px 0;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: 12px;
}

.lyrics-preview h4 {
  margin: 0 0 12px 0;
  color: var(--text-primary);
  font-size: 14px;
}

.preview-content {
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.6;
  max-height: 100px;
  overflow: hidden;
}

.lyrics-input-modal .actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

/* 上传弹窗样式 */
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
  background: var(--border-color);
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
  color: var(--text-tertiary);
  font-weight: 500;
}

.step::before {
  content: attr(data-step);
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 600;
  border: 2px solid transparent;
}

.step.active {
  color: var(--accent-color);
}

.step.active::before {
  background: var(--accent-color);
  color: white;
  box-shadow: 0 0 0 4px var(--accent-light);
}

.step.done {
  color: var(--success-color);
}

.step.done::before {
  content: '✓';
  background: var(--success-color);
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
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 500;
}

.form-group label .required {
  color: var(--danger-color);
  margin-left: 2px;
}

.form-group input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 15px;
  transition: all 0.3s;
}

.form-group input:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 3px var(--accent-light);
}

.error-msg {
  display: block;
  margin-top: 6px;
  color: var(--danger-color);
  font-size: 12px;
}

.file-drop-zone {
  border: 2px dashed var(--border-color);
  border-radius: 16px;
  padding: 40px;
  text-align: center;
  transition: all 0.3s;
  cursor: pointer;
  background: var(--bg-secondary);
}

.file-drop-zone.dragging {
  border-color: var(--accent-color);
  background: var(--accent-light);
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
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 500;
}

.drop-content .selected-file {
  color: var(--accent-color);
  font-weight: 600;
}

.file-hint {
  color: var(--text-tertiary);
  font-size: 13px;
}

.file-info {
  margin-top: 20px;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: 12px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  font-size: 14px;
}

.info-item span:first-child {
  color: var(--text-secondary);
}

.info-item span:last-child {
  color: var(--text-primary);
  font-weight: 500;
}

.upload-success {
  padding: 40px 0;
}

.success-icon {
  width: 80px;
  height: 80px;
  margin: 0 auto 24px;
  background: var(--success-color);
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
  color: var(--text-primary);
  font-size: 20px;
}

.upload-success p {
  margin: 0;
  color: var(--text-secondary);
}

.upload-progress {
  padding: 0 24px 24px;
}

.progress-bar {
  height: 8px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 12px;
}

.progress-bar .progress-fill {
  height: 100%;
  background: var(--accent-gradient);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.upload-progress span {
  display: block;
  text-align: center;
  color: var(--accent-color);
  font-weight: 600;
  font-size: 14px;
}

.secondary-btn {
  padding: 14px 24px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.secondary-btn:hover {
  background: var(--bg-tertiary);
}

/* Toast提示 */
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
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  backdrop-filter: blur(10px);
}

.toast.success {
  background: var(--success-color);
  color: white;
  border: none;
}

.toast.error {
  background: var(--danger-color);
  color: white;
  border: none;
}

/* 快捷键提示 */
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
  backdrop-filter: blur(8px);
}

.shortcuts-modal {
  background: var(--bg-primary);
  border-radius: 24px;
  padding: 32px;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  border: 1px solid var(--border-color);
}

.shortcuts-modal h3 {
  margin: 0 0 24px 0;
  color: var(--text-primary);
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
  background: var(--bg-secondary);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 14px;
}

.shortcut-list kbd {
  padding: 4px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-family: 'SF Mono', monospace;
  font-size: 13px;
  color: var(--accent-color);
  font-weight: 600;
}

.shortcuts-modal button {
  width: 100%;
  padding: 14px;
  background: var(--accent-gradient);
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
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  font-size: 20px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: var(--shadow);
  z-index: 90;
}

.shortcuts-hint-btn:hover {
  background: var(--accent-color);
  color: white;
  transform: scale(1.1);
  border-color: var(--accent-color);
}

/* 响应式设计 */
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
    font-size: 16px;
    padding: 12px 16px;
  }
  
  .fs-lyric-line.active {
    font-size: 22px;
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

/* 滚动条样式 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--bg-secondary);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: var(--bg-tertiary);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--text-tertiary);
}

/* 歌词侧边栏滚动条 */
.lyrics-content::-webkit-scrollbar,
.fs-playlist-scroll::-webkit-scrollbar,
.mini-playlist::-webkit-scrollbar {
  width: 6px;
}

.lyrics-content::-webkit-scrollbar-thumb,
.fs-playlist-scroll::-webkit-scrollbar-thumb,
.mini-playlist::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

/* 选中文本样式 */
::selection {
  background: var(--accent-color);
  color: white;
}

/* 禁用状态 */
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 焦点样式 */
button:focus-visible,
input:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}

/* 加载动画 */
.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--bg-tertiary);
  border-top-color: var(--accent-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 音频可视化动画（迷你播放器） */
.mini-visualizer {
  display: flex;
  gap: 3px;
  align-items: flex-end;
  height: 20px;
}

.mini-visualizer span {
  width: 4px;
  background: var(--accent-color);
  border-radius: 2px;
  animation: visualizer-bar 0.8s ease-in-out infinite;
}

.mini-visualizer span:nth-child(1) { animation-delay: 0s; height: 30%; }
.mini-visualizer span:nth-child(2) { animation-delay: 0.1s; height: 60%; }
.mini-visualizer span:nth-child(3) { animation-delay: 0.2s; height: 40%; }
.mini-visualizer span:nth-child(4) { animation-delay: 0.3s; height: 80%; }

@keyframes visualizer-bar {
  0%, 100% { transform: scaleY(0.3); }
  50% { transform: scaleY(1); }
}

/* 额外的动画效果 */
.music-row {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.music-row.playing {
  animation: pulse-border 2s ease-in-out infinite;
}

@keyframes pulse-border {
  0%, 100% { border-left-color: transparent; }
  50% { border-left-color: var(--accent-color); }
}

/* 确保模态框在最上层 */
.modal-overlay {
  z-index: 1100;
}

.modal-overlay.info-overlay {
  z-index: 1200;
}

.fullscreen-music-player {
  z-index: 1000;
}

/* 打印样式 */
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
</style>