<template>
  <section v-if="replyTotal > 0 || replies.length" class="comment-replies" :aria-label="`${replyTotal} 条回复`">
    <button class="comment-replies__toggle" type="button" :aria-expanded="expanded" @click="toggle">
      <AppIcon :name="expanded ? 'chevron-down' : 'arrow-right'" :size="15" />
      {{ expanded ? '收起回复' : `查看 ${replyTotal} 条回复` }}
    </button>
    <div v-if="expanded" class="comment-replies__list">
      <p v-if="!visibleReplies.length && loading" class="comment-replies__status">正在载入回复…</p>
      <p v-else-if="!visibleReplies.length" class="comment-replies__status">暂无已加载回复。</p>
      <CommentItem v-for="reply in visibleReplies" :key="reply.id" :comment="reply" :compact="true" :author-id="authorId" :current-user-id="currentUserId" :can-like="canLike" :can-report="canReport" :can-delete="canDelete ? canDelete(reply) : undefined" :deleting="deletingId != null && String(deletingId) === String(reply.id)" @like="$emit('like', $event)" @delete="$emit('delete', $event)" @report="$emit('report', $event)" @preview="(item, index) => $emit('preview', item, index)" />
      <button v-if="hasMoreVisible || hasMore" class="comment-replies__more" type="button" :disabled="loading" @click="loadMore">{{ loading ? '正在载入…' : '加载更多回复' }}</button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import CommentItem from './CommentItem.vue'
import type { CommentData, CommentId, CommentMediaItem } from './types'

const props = withDefaults(defineProps<{
  replies: CommentData[]
  replyCount?: number
  defaultExpanded?: boolean
  replyLimit?: number
  hasMore?: boolean
  loading?: boolean
  authorId?: CommentId | null
  currentUserId?: CommentId | null
  canLike?: boolean
  canReport?: boolean
  canDelete?: (comment: CommentData) => boolean | undefined
  deletingId?: CommentId | null
}>(), { replyCount: 0, defaultExpanded: true, replyLimit: 3, hasMore: false, loading: false, authorId: null, currentUserId: null, canLike: false, canReport: false, deletingId: null })

const emit = defineEmits<{
  'update:expanded': [expanded: boolean]
  'load-more': []
  like: [comment: CommentData]
  delete: [comment: CommentData]
  report: [comment: CommentData]
  preview: [item: CommentMediaItem, index: number]
}>()
const expanded = ref(props.defaultExpanded)
const visibleCount = ref(props.replyLimit)
const replyTotal = computed(() => Math.max(props.replyCount, props.replies.length))
const visibleReplies = computed(() => props.replies.slice(0, visibleCount.value))
const hasMoreVisible = computed(() => visibleCount.value < props.replies.length)

watch(() => props.defaultExpanded, value => { expanded.value = value })
watch(() => props.replies.length, () => { if (!props.replies.length) visibleCount.value = props.replyLimit })

function toggle() {
  expanded.value = !expanded.value
  emit('update:expanded', expanded.value)
}

function loadMore() {
  if (hasMoreVisible.value) visibleCount.value += props.replyLimit
  if (props.hasMore) emit('load-more')
}
</script>

<style scoped>
.comment-replies { margin-left: calc(36px + var(--space-3)); padding-left: var(--space-4); border-left: 2px solid var(--border); }
.comment-replies__toggle, .comment-replies__more { display: inline-flex; align-items: center; gap: var(--space-1); min-height: 32px; padding: 0; border: 0; background: transparent; color: var(--accent); font-size: .82rem; font-weight: 700; }
.comment-replies__toggle:hover, .comment-replies__more:hover:not(:disabled) { color: var(--accent-strong); }
.comment-replies__list { display: grid; }
.comment-replies__status { margin: var(--space-3) 0; color: var(--muted); font-size: .84rem; }
.comment-replies__more { margin: var(--space-2) 0 var(--space-2) 0; }
@media (max-width: 390px) { .comment-replies { margin-left: 0; padding-left: var(--space-3); } }
</style>
