<template>
  <span class="user-avatar" :style="{ width: `${size}px`, height: `${size}px` }">
    <img v-if="src && !failed" :src="src" :alt="`${name}的头像`" @error="failed = true">
    <span v-else class="user-avatar__fallback" :aria-label="`${name}的头像`">{{ initial }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(defineProps<{ src?: string | null; name?: string; size?: number }>(), { src: null, name: '用户', size: 40 })
const failed = ref(false)
const initial = computed(() => String(props.name || '用户').trim().slice(0, 1).toUpperCase() || '用')
watch(() => props.src, () => { failed.value = false })
</script>

<style scoped>
.user-avatar { display: inline-grid; overflow: hidden; flex: none; border: 1px solid var(--border); border-radius: 50%; background: var(--accent-soft); color: var(--accent); }
.user-avatar img { width: 100%; height: 100%; object-fit: cover; }
.user-avatar__fallback { display: grid; width: 100%; height: 100%; place-items: center; font-weight: 750; font-size: calc(var(--avatar-size, 40px) * .42); }
</style>
