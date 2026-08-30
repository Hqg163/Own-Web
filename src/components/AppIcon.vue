<template>
  <svg class="app-icon" :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path v-if="name === 'search'" d="m21 21-4.4-4.4m2.4-5.1a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" />
    <path v-else-if="name === 'menu'" d="M4 7h16M4 12h16M4 17h16" />
    <path v-else-if="name === 'close'" d="M6 6l12 12M18 6 6 18" />
    <path v-else-if="name === 'sun'" d="M12 3v2m0 14v2M3 12h2m14 0h2m-3.6-6.4-1.4 1.4M7 17.4l-1.4 1.4m0-13.2L7 7m10 10 1.4 1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />
    <path v-else-if="name === 'moon'" d="M20.4 15.1A8.5 8.5 0 0 1 8.9 3.6 8.5 8.5 0 1 0 20.4 15.1Z" />
    <path v-else-if="name === 'pen'" d="m14.5 5.5 4 4M4 20l4.3-1 10.9-10.9a2.8 2.8 0 0 0-4-4L4.3 15z" />
    <path v-else-if="name === 'user'" d="M20 21a8 8 0 0 0-16 0M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
    <path v-else-if="name === 'heart'" d="M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 21l8.8-8.8a5.4 5.4 0 0 0 0-7.6Z" />
    <path v-else-if="name === 'bookmark'" d="M6 3h12v18l-6-4-6 4z" />
    <path v-else-if="name === 'bell'" d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 22h4" />
    <path v-else-if="name === 'home'" d="m3 11 9-8 9 8v10H3zM9 21v-6h6v6" />
    <path v-else-if="name === 'settings'" d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm0-12.5v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4m0-12.8L17 7M7 17l-1.4 1.4" />
    <path v-else-if="name === 'book'" d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22zM4 5.5V22m4-14h8m-8 4h8" />
    <path v-else-if="name === 'folder'" d="M3 6.5h6l2 2h10v10.5A2 2 0 0 1 19 21H5a2 2 0 0 1-2-2z" />
    <path v-else-if="name === 'image'" d="M4 4h16v16H4zM4 16l4.5-4.5 3.5 3.5 2.5-2.5L20 18M8 8h.01" />
    <path v-else-if="name === 'video'" d="M4 6h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4zM17 10l4-2v8l-4 2z" />
    <path v-else-if="name === 'music'" d="M9 18V5l10-2v13M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3Zm10-2a3 3 0 1 1-3-3 3 3 0 0 1 3 3Z" />
    <path v-else-if="name === 'grid'" d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
    <path v-else-if="name === 'upload'" d="M12 16V4m0 0L7 9m5-5 5 5M5 20h14" />
    <path v-else-if="name === 'download'" d="M12 4v12m0 0 5-5m-5 5-5-5M5 20h14" />
    <path v-else-if="name === 'plus'" d="M12 5v14M5 12h14" />
    <path v-else-if="name === 'check'" d="m5 12 4.2 4.2L19 6.5" />
    <path v-else-if="name === 'trash'" d="M4 7h16M10 11v6m4-6v6M9 7l1-3h4l1 3m-9 0 1 14h10l1-14" />
    <path v-else-if="name === 'mail'" d="M4 5h16v14H4zM4 7l8 6 8-6" />
    <path v-else-if="name === 'inbox'" d="M4 4h16v12l-3 4H7l-3-4zM4 15h5l1.5 2h3L15 15h5" />
    <path v-else-if="name === 'file'" d="M6 3h8l4 4v14H6zM14 3v5h5" />
    <path v-else-if="name === 'code'" d="m9 18-6-6 6-6m6 0 6 6-6 6M13 4l-2 16" />
    <path v-else-if="name === 'archive'" d="M4 7h16v13H4zM3 4h18v3H3zM10 12h4" />
    <path v-else-if="name === 'arrow-left'" d="M19 12H5m6-6-6 6 6 6" />
    <path v-else-if="name === 'arrow-right'" d="M5 12h14m-6-6 6 6-6 6" />
    <path v-else-if="name === 'arrow-down'" d="M12 5v14m-6-6 6 6 6-6" />
    <path v-else-if="name === 'chevron-down'" d="m6 9 6 6 6-6" />
    <path v-else-if="name === 'paperclip'" d="m8.5 12.5 6.7-6.7a3.5 3.5 0 0 1 5 5l-8.1 8.1a5 5 0 0 1-7.1-7.1l7.4-7.4" />
    <path v-else-if="name === 'rotate-cw'" d="M20 11a8 8 0 1 0 2 5m-2-5V5m0 6h-6" />
    <path v-else-if="name === 'rotate-ccw'" d="M4 13a8 8 0 1 0-2-5m2 5v6m0-6h6" />
    <path v-else-if="name === 'flip-horizontal'" d="M12 4v16M4 7l6 5-6 5zM20 7l-6 5 6 5z" />
    <path v-else-if="name === 'flip-vertical'" d="M4 12h16M7 4l5 6 5-6M7 20l5-6 5 6" />
    <path v-else-if="name === 'crop'" d="M6 3v12a3 3 0 0 0 3 3h12M18 21V9a3 3 0 0 0-3-3H3" />
    <path v-else-if="name === 'play'" d="m9 5 10 7-10 7z" />
    <path v-else-if="name === 'pause'" d="M8 5v14M16 5v14" />
    <path v-else-if="name === 'more'" d="M5 12h.01M12 12h.01M19 12h.01" stroke-width="3" />
    <path v-else-if="name === 'maximize'" d="M8 3H3v5m13-5h5v5M8 21H3v-5m18 0v5h-5" />
    <path v-else-if="name === 'sliders'" d="M4 6h16M8 6v5m-4 7h16m-5-5v5M4 12h16m-9-5v5" />
    <path v-else-if="name === 'volume'" d="M4 10h4l5-4v12l-5-4H4zM17 9a4 4 0 0 1 0 6m2.5-8.5a7 7 0 0 1 0 11" />
    <path v-else-if="name === 'tag'" d="M20 13 13 20 4 11V4h7zM8 8h.01" />
    <path v-else-if="name === 'scissors'" d="M6.5 6.5 18 18M18 6 6.5 17.5M7 9a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Zm0 11a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z" />
    <path v-else-if="name === 'droplet'" d="M12 3s6 6.2 6 11a6 6 0 0 1-12 0c0-4.8 6-11 6-11Z" />
    <path v-else-if="name === 'skip-back'" d="M19 20 9 12l10-8zM5 5v14" />
    <path v-else-if="name === 'skip-forward'" d="m5 4 10 8L5 20zM19 5v14" />
    <path v-else-if="name === 'shuffle'" d="M16 3h5v5M4 20 9 15m4-4 8-8M16 21h5v-5M4 4l5 5m4 4 8 8" />
    <path v-else-if="name === 'repeat'" d="M17 2l4 4-4 4M3 11V7a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v4a3 3 0 0 1-3 3H3" />
    <path v-else-if="name === 'repeat-1'" d="M17 2l4 4-4 4M3 11V7a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v4a3 3 0 0 1-3 3H3M12 9v6m-2-4 2-2 2 2" />
    <path v-else-if="name === 'volume-x'" d="M4 10h4l5-4v12l-5-4H4zM17 10l4 4m0-4-4 4" />
    <path v-else-if="name === 'list'" d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" stroke-width="2.6" />
    <path v-else-if="name === 'panel-right'" d="M4 4h16v16H4zM14 4v16M7 8h4M7 12h4" />
    <path v-else-if="name === 'keyboard'" d="M4 6h16v12H4zM7 10h.01M10 10h.01M13 10h.01M16 10h.01M7 14h6m3 0h.01" stroke-width="2.4" />
    <path v-else-if="name === 'eye'" d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Zm9.5 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
    <path v-else-if="name === 'eye-off'" d="m3 3 18 18M10.6 6.3A10.5 10.5 0 0 1 12 6c6.1 0 9.5 6 9.5 6a18 18 0 0 1-3.1 4M6.1 6.4A18.7 18.7 0 0 0 2.5 12S5.9 18 12 18a10 10 0 0 0 2.6-.4M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    <path v-else-if="name === 'calendar'" d="M5 5h14v15H5zM8 3v4m8-4v4M5 10h14" />
    <path v-else-if="name === 'external-link'" d="M14 4h6v6m0-6-9 9M18 13v6H4V5h6" />
    <path v-else-if="name === 'shield'" d="M12 3 20 6v5c0 5-3.4 8.2-8 10-4.6-1.8-8-5-8-10V6zM9 12l2 2 4-4" />
    <path v-else-if="name === 'info'" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-10v5m0-8h.01" />
    <path v-else-if="name === 'github'" d="M9 19c-4 1.2-4-2-5.5-2.5M14.5 22v-3.1a2.7 2.7 0 0 0-.8-2.1c2.7-.3 5.5-1.3 5.5-6A4.7 4.7 0 0 0 18 7.5 4.4 4.4 0 0 0 17.9 4S16.8 3.7 14.5 5.2a12.4 12.4 0 0 0-5 0C7.2 3.7 6.1 4 6.1 4A4.4 4.4 0 0 0 6 7.5a4.7 4.7 0 0 0-1.2 3.3c0 4.7 2.8 5.7 5.5 6a2.7 2.7 0 0 0-.8 2.1V22" />
    <path v-else-if="name === 'chevron-right'" d="m9 18 6-6-6-6" />
    <path v-else d="M4 6h16M4 12h16M4 18h10" />
  </svg>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ name: string; size?: number }>(), { size: 20 })
</script>

<style scoped>
.app-icon { display: block; flex: none; }
</style>
