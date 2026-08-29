<template>
  <section class="comment-section" aria-labelledby="comment-section-title" :aria-busy="loading">
    <header class="comment-section__header">
      <div>
        <h2 id="comment-section-title">评论 <span>{{ totalCount }}</span></h2>
        <p v-if="!canComment" class="comment-section__notice">作者已关闭评论。</p>
      </div>
      <label v-if="comments.length" class="comment-section__sort">
        <span>排序</span>
        <select :value="sort" aria-label="评论排序" @change="changeSort">
          <option v-for="option in sortOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
      </label>
    </header>

    <CommentComposer v-if="loggedIn && canComment" :model-value="modelValue" :media="media" :user="currentUser" :replying-to="activeReply ? commentAuthorName(activeReply) : null" :replying-to-id="activeReply?.id ?? null" :mode="composerMode" :disabled="composerDisabled" :submitting="submitting" :max-length="maxLength" :max-media="maxMedia" @update:model-value="$emit('update:modelValue', $event)" @update:media="$emit('update:media', $event)" @submit="submitComment" @cancel="cancelReply" @media-selected="(files, items) => $emit('media-selected', files, items)" @media-remove="(item, index) => $emit('media-remove', item, index)" @media-move="$emit('media-move', $event)" @preview="(item, index) => $emit('preview', item, index)" />
    <p v-else-if="canComment" class="comment-section__login">登录后参与讨论。</p>

    <p v-if="error" class="comment-section__error" role="alert">{{ error }}</p>
    <div v-if="loading" class="comment-section__state">正在载入评论…</div>
    <div v-else-if="!rootComments.length" class="comment-section__state">{{ emptyText }}</div>
    <div v-else class="comment-section__list">
      <div v-for="comment in rootComments" :key="comment.id" class="comment-section__thread">
        <CommentItem :comment="comment" :author-id="authorId" :current-user-id="currentUserId" :can-like="loggedIn" :can-reply="loggedIn && canComment" :can-report="loggedIn" :can-delete="resolveCanDelete(comment)" :deleting="isDeleting(comment.id)" @reply="startReply" @like="$emit('like', $event)" @delete="$emit('delete', $event)" @report="$emit('report', $event)" @preview="(item, index) => $emit('preview', item, index)" />
        <CommentReplies v-if="repliesFor(comment).length || replyCountFor(comment)" :replies="repliesFor(comment)" :reply-count="replyCountFor(comment)" :default-expanded="replyExpanded(comment.id)" :reply-limit="replyLimit" :has-more="hasMoreRepliesFor(comment.id)" :loading="isLoadingReplies(comment.id)" :author-id="authorId" :current-user-id="currentUserId" :can-like="loggedIn" :can-report="loggedIn" :can-delete="resolveReplyCanDelete" :deleting-id="deletingId" @update:expanded="setReplyExpanded(comment.id, $event)" @load-more="$emit('load-more-replies', comment)" @like="$emit('like', $event)" @delete="$emit('delete', $event)" @report="$emit('report', $event)" @preview="(item, index) => $emit('preview', item, index)" />
      </div>
    </div>
    <button v-if="hasMoreComments" class="button button-ghost comment-section__more" type="button" :disabled="loadingMore" @click="$emit('load-more')">{{ loadingMore ? '正在载入…' : '加载更多评论' }}</button>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import CommentComposer from './CommentComposer.vue'
import CommentItem from './CommentItem.vue'
import CommentReplies from './CommentReplies.vue'
import { commentAuthorName, commentReplyCount, sameCommentId } from './format'
import type { CommentData, CommentId, CommentMediaItem, CommentSubmitPayload } from './types'
import type { ComposerUser } from './CommentComposer.vue'
import { defaultCommentSortOptions, type CommentSortOption } from './constants'

const props = withDefaults(defineProps<{
  comments: CommentData[]
  modelValue?: string
  media?: CommentMediaItem[]
  currentUser?: ComposerUser | null
  currentUserId?: CommentId | null
  authorId?: CommentId | null
  replyingTo?: CommentData | null
  loggedIn?: boolean
  canComment?: boolean
  loading?: boolean
  loadingMore?: boolean
  error?: string
  emptyText?: string
  sort?: string
  sortOptions?: CommentSortOption[]
  total?: number
  hasMoreComments?: boolean
  replyLimit?: number
  repliesLoadingId?: CommentId | null
  deletingId?: CommentId | null
  hasMoreReplies?: Record<string, boolean> | ((commentId: CommentId) => boolean)
  canDelete?: boolean | ((comment: CommentData) => boolean)
  composerDisabled?: boolean
  submitting?: boolean
  composerMode?: 'compact' | 'focused'
  maxLength?: number
  maxMedia?: number
}>(), { modelValue: '', media: () => [], currentUser: null, currentUserId: null, authorId: null, replyingTo: undefined, loggedIn: false, canComment: true, loading: false, loadingMore: false, error: '', emptyText: '暂时还没有评论。', sort: 'newest', sortOptions: () => defaultCommentSortOptions, total: undefined, hasMoreComments: false, replyLimit: 3, repliesLoadingId: null, deletingId: null, hasMoreReplies: () => ({}), canDelete: undefined, composerDisabled: false, submitting: false, composerMode: 'compact', maxLength: 5000, maxMedia: 4 })

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:media': [items: CommentMediaItem[]]
  'update:sort': [sort: string]
  'update:replyingTo': [comment: CommentData | null]
  submit: [payload: CommentSubmitPayload]
  reply: [comment: CommentData]
  cancelReply: []
  like: [comment: CommentData]
  delete: [comment: CommentData]
  report: [comment: CommentData]
  'load-more': []
  'load-more-replies': [comment: CommentData]
  'media-selected': [files: File[], items: CommentMediaItem[]]
  'media-remove': [item: CommentMediaItem, index: number]
  'media-move': [payload: { from: number; to: number }]
  preview: [item: CommentMediaItem, index: number]
}>()

const internalReply = ref<CommentData | null>(null)
const expandedReplies = ref<Record<string, boolean>>({})
const activeReply = computed(() => props.replyingTo !== undefined ? props.replyingTo : internalReply.value)
const totalCount = computed(() => props.total ?? props.comments.length)
const roots = computed(() => props.comments.filter(comment => !comment.parentId && !comment.parent_id))
const rootComments = computed(() => [...roots.value].sort((left, right) => compareComments(left, right, props.sort)))

function compareComments(left: CommentData, right: CommentData, mode: string) {
  if (mode === 'popular') return commentScore(right) - commentScore(left) || timestamp(right) - timestamp(left)
  const difference = timestamp(right) - timestamp(left)
  return mode === 'oldest' ? -difference : difference
}

function timestamp(comment: CommentData) { return new Date(String(comment.createdAt || comment.created_at || '')).getTime() || 0 }
function commentScore(comment: CommentData) { return Number(comment.likeCount ?? comment.like_count ?? 0) || 0 }
function repliesFor(comment: CommentData) {
  const flatReplies = props.comments.filter(item => sameCommentId(item.parentId ?? item.parent_id, comment.id))
  return flatReplies.length ? flatReplies : (comment.replies || [])
}
function replyCountFor(comment: CommentData) { return Math.max(commentReplyCount(comment), repliesFor(comment).length) }
function replyExpanded(id: CommentId) { return expandedReplies.value[String(id)] ?? true }
function setReplyExpanded(id: CommentId, expanded: boolean) { expandedReplies.value[String(id)] = expanded }
function isLoadingReplies(id: CommentId) { return props.repliesLoadingId != null && sameCommentId(props.repliesLoadingId, id) }
function hasMoreRepliesFor(id: CommentId) {
  const explicit = typeof props.hasMoreReplies === 'function' ? props.hasMoreReplies(id) : Boolean(props.hasMoreReplies[String(id)])
  const comment = props.comments.find(item => sameCommentId(item.id, id))
  return explicit || Boolean(comment?.has_more_replies)
}
function isDeleting(id: CommentId) { return props.deletingId != null && sameCommentId(props.deletingId, id) }
function resolveCanDelete(comment: CommentData) { return typeof props.canDelete === 'function' ? props.canDelete(comment) : props.canDelete }
function resolveReplyCanDelete(comment: CommentData) { return props.canDelete === undefined ? undefined : Boolean(resolveCanDelete(comment)) }

function startReply(comment: CommentData) {
  internalReply.value = comment
  emit('update:replyingTo', comment)
  emit('reply', comment)
}

function cancelReply() {
  internalReply.value = null
  emit('update:replyingTo', null)
  emit('cancelReply')
}

function submitComment(payload: CommentSubmitPayload) {
  const parentId = activeReply.value?.id ?? null
  emit('submit', { ...payload, parentId })
  if (parentId != null) {
    internalReply.value = null
    emit('update:replyingTo', null)
  }
}

function changeSort(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  emit('update:sort', value)
}

</script>

<style scoped>
.comment-section { width: 100%; max-width: 100%; min-width: 0; overflow-wrap: anywhere; }
.comment-section__header { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-3); }
.comment-section__header h2 { margin: 0; font-size: 1.35rem; }
.comment-section__header h2 span { color: var(--subtle); font-size: 1rem; font-weight: 500; }
.comment-section__notice, .comment-section__login { margin: var(--space-1) 0 0; color: var(--muted); font-size: .88rem; }
.comment-section__sort { display: inline-flex; align-items: center; gap: var(--space-2); color: var(--muted); font-size: .82rem; }
.comment-section__sort select { min-height: 34px; padding: 0 var(--space-2); border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); color: var(--text); }
.comment-section__error { margin: var(--space-3) 0; padding: var(--space-3); border: 1px solid color-mix(in srgb, var(--danger), transparent 55%); border-radius: var(--radius-sm); background: color-mix(in srgb, var(--danger), transparent 93%); color: var(--danger); }
.comment-section__state { margin-top: var(--space-4); padding: var(--space-5); border: 1px dashed var(--border); border-radius: var(--radius-sm); color: var(--muted); text-align: center; }
.comment-section__list { margin-top: var(--space-3); }
.comment-section__thread { min-width: 0; border-bottom: 1px solid var(--border); }
.comment-section__more { display: flex; margin: var(--space-4) auto 0; }
@media (max-width: 640px) { .comment-section__header { align-items: flex-start; flex-direction: column; } }
@media (max-width: 390px) { .comment-section__sort { width: 100%; justify-content: space-between; } .comment-section__sort select { flex: 1; } }
</style>
