<template>
  <main class="container page-section narrow" aria-labelledby="notifications-title">
    <p class="eyebrow">Notifications</p>
    <h1 id="notifications-title" class="page-title">通知</h1>
    <div v-if="!items.length" class="empty">暂时没有通知。</div>
    <div v-else class="list">
      <article v-for="item in items" :key="item.id" class="card notification" :class="{ unread: !item.is_read }" @click="read(item)">
        <b>{{ item.actor_name || '系统' }}</b>
        <span>{{ text(item.type) }}</span>
        <RouterLink v-if="item.type === 'report_update' && item.report_id" class="notification-link" :to="`/dashboard/reports/${item.report_id}`" @click="read(item)">查看举报详情</RouterLink>
        <RouterLink v-else-if="item.post_slug" class="notification-link" :to="`/posts/${item.post_slug}`">{{ item.post_title }}</RouterLink>
        <small :title="fullDate(item.created_at)">{{ date(item.created_at) }}</small>
      </article>
    </div>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import http from '@/services/http'

const items = ref<any[]>([])
const text = (type: string) => ({
  follow: '关注了你',
  like: '赞了你的文章',
  comment: '评论了你的文章',
  reply: '回复了你的评论',
  report_update: '你的举报已有处理结果',
}[type] || '有新动态')
const date = (value: string) => new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(new Date(value))
const fullDate = (value: string) => new Intl.DateTimeFormat('zh-CN', { dateStyle: 'full', timeStyle: 'short' }).format(new Date(value))

async function read(item: any) {
  if (!item.is_read) {
    try { await http.put(`/api/notifications/${item.id}/read`); item.is_read = true } catch { /* keep the notification unread when the request fails */ }
  }
}

onMounted(async () => {
  try { items.value = (await http.get('/api/notifications')).data.items || [] } catch { items.value = [] }
})
</script>

<style scoped>
.narrow { max-width: 760px; }
.list { display: grid; gap: var(--space-2); }
.notification { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-2); padding: 15px; }
.notification.unread { border-left: 3px solid var(--accent); }
.notification-link { color: var(--accent); text-underline-offset: 3px; }
.notification small { margin-left: auto; color: var(--muted); }
@media (max-width: 560px) { .notification small { width: 100%; margin-left: 0; } }
</style>
