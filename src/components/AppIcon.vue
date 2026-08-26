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
