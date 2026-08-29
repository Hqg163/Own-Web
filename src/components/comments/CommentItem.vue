<template>
  <article class="comment-item" :class="{ 'comment-item--reply': compact }">
    <UserAvatar :src="view.avatar" :name="view.authorName" :size="compact ? 32 : 36" />
    <div class="comment-item__body">
      <header class="comment-item__meta">
        <span class="comment-item__author">{{ view.authorName }}</span>
        <span v-if="view.isAuthor" class="comment-item__badge">作者</span>
        <time :datetime="view.createdAt || undefined" :title="view.absoluteTime">{{ view.relativeTime }}</time>
      </header>
      <p v-if="view.deleted" class="comment-item__deleted">这条评论已删除。</p>
      <p v-else class="comment-item__text">{{ view.content }}</p>
      <CommentMedia v-if="!view.deleted && view.media.length" :items="view.media" @preview="(item, index) => $emit('preview', item, index)" />
      <div v-if="!view.deleted" class="comment-item__actions" aria-label="评论操作">
        <button v-if="canLike" class="comment-item__action" :class="{ 'is-active': view.liked }" type="button" :aria-pressed="view.liked" @click="$emit('like', comment)">
          <AppIcon name="heart" :size="15" /> <span>喜欢</span><span v-if="view.likeCount" class="comment-item__count">{{ view.likeCount }}</span>
        </button>
        <button v-if="canReply && !compact" class="comment-item__action" type="button" @click="$emit('reply', comment)">回复</button>
        <details v-if="mayDelete || canReport" ref="moreMenu" class="comment-item__more" @keydown.esc.prevent.stop="closeMore">
          <summary aria-label="更多评论操作">更多</summary>
          <div class="comment-item__more-menu" role="menu" aria-label="更多评论操作">
            <button v-if="mayDelete" class="comment-item__action comment-item__action--danger" type="button" role="menuitem" :disabled="deleting" @click="closeMore(); $emit('delete', comment)"><AppIcon name="trash" :size="15" />{{ deleting ? '删除中…' : '删除' }}</button>
            <button v-if="canReport" class="comment-item__action" type="button" role="menuitem" @click="closeMore(); $emit('report', comment)"><AppIcon name="info" :size="15" />举报</button>
          </div>
        </details>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import CommentMedia from './CommentMedia.vue'
import { absoluteTime, commentAuthorAvatar, commentAuthorId, commentAuthorName, commentContent, commentCreatedAt, commentIsAuthor, commentIsDeleted, commentIsLiked, commentLikeCount, commentMedia, relativeTime, sameCommentId } from './format'
import type { CommentData, CommentId, CommentMediaItem } from './types'

const props = withDefaults(defineProps<{
  comment: CommentData
  authorId?: CommentId | null
  currentUserId?: CommentId | null
  compact?: boolean
  canLike?: boolean
  canReply?: boolean
  canReport?: boolean
  canDelete?: boolean
  deleting?: boolean
}>(), { authorId: null, currentUserId: null, compact: false, canLike: false, canReply: false, canReport: false, canDelete: undefined, deleting: false })

const moreMenu = ref<HTMLDetailsElement | null>(null)
function closeMore() { if (moreMenu.value) moreMenu.value.open = false }

defineEmits<{
  like: [comment: CommentData]
  reply: [comment: CommentData]
  delete: [comment: CommentData]
  report: [comment: CommentData]
  preview: [item: CommentMediaItem, index: number]
}>()

const view = computed(() => {
  const comment = props.comment
  return {
    authorName: commentAuthorName(comment),
    avatar: commentAuthorAvatar(comment),
    isAuthor: commentIsAuthor(comment, props.authorId),
    authorId: commentAuthorId(comment),
    content: commentContent(comment),
    createdAt: commentCreatedAt(comment),
    relativeTime: relativeTime(commentCreatedAt(comment)),
    absoluteTime: absoluteTime(commentCreatedAt(comment)),
    deleted: commentIsDeleted(comment),
    likeCount: commentLikeCount(comment),
    liked: commentIsLiked(comment),
    media: commentMedia(comment),
  }
})

const mayDelete = computed(() => props.canDelete ?? sameCommentId(view.value.authorId, props.currentUserId))
</script>

<style scoped>
.comment-item { display: flex; min-width: 0; gap: var(--space-3); padding: var(--space-4) 0; }
.comment-item--reply { padding: var(--space-3) 0; }
.comment-item__body { min-width: 0; flex: 1; }
.comment-item__meta { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); min-width: 0; font-size: .88rem; }
.comment-item__author { max-width: 100%; overflow-wrap: anywhere; font-weight: 700; }
.comment-item__meta time { color: var(--subtle); font-size: .8rem; }
.comment-item__badge { padding: 1px 6px; border: 1px solid color-mix(in srgb, var(--accent), transparent 55%); border-radius: 999px; color: var(--accent); font-size: .72rem; font-weight: 700; }
.comment-item__text, .comment-item__deleted { max-width: 100%; margin: var(--space-2) 0 0; white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; }
.comment-item__deleted { color: var(--muted); font-style: italic; }
.comment-item__actions { display: flex; flex-wrap: wrap; gap: var(--space-3); margin-top: var(--space-2); }
.comment-item__action { display: inline-flex; align-items: center; gap: 4px; min-height: 28px; padding: 0; border: 0; background: transparent; color: var(--muted); font-size: .8rem; }
.comment-item__action:hover:not(:disabled), .comment-item__action.is-active { color: var(--accent); }
.comment-item__action--danger:hover:not(:disabled) { color: var(--danger); }
.comment-item__count { color: var(--subtle); }
.comment-item__more { position: relative; }
.comment-item__more summary { min-height: 28px; padding: 0; color: var(--muted); cursor: pointer; font-size: .8rem; list-style: none; }
.comment-item__more summary::-webkit-details-marker { display: none; }
.comment-item__more summary::after { content: '⋯'; margin-left: 3px; }
.comment-item__more summary:hover { color: var(--accent); }
.comment-item__more-menu { position: absolute; z-index: 2; right: 0; bottom: calc(100% + var(--space-2)); display: grid; min-width: 112px; gap: var(--space-1); padding: var(--space-2); border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-raised); box-shadow: var(--shadow); }
.comment-item__more-menu .comment-item__action { width: 100%; justify-content: flex-start; padding: 0 var(--space-2); }
@media (max-width: 390px) { .comment-item { gap: var(--space-2); } .comment-item__actions { gap: var(--space-2); } }
</style>
