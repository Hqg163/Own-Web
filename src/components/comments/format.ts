import type { CommentData, CommentId, CommentMediaItem } from './types'

export function sameCommentId(left: CommentId | null | undefined, right: CommentId | null | undefined) {
  return left != null && right != null && String(left) === String(right)
}

export function commentAuthorName(comment: CommentData) {
  const author = comment.author
  return String(author?.name || author?.username || comment.username || comment.author_name || '用户')
}

export function commentAuthorAvatar(comment: CommentData) {
  return authorValue(comment, 'avatarUrl') || authorValue(comment, 'avatar_url') || comment.avatarUrl || comment.avatar_url || comment.avatar_path || null
}

function authorValue(comment: CommentData, key: 'avatarUrl' | 'avatar_url') {
  const value = comment.author?.[key]
  return value ? String(value) : null
}

export function commentAuthorId(comment: CommentData) {
  return comment.authorId ?? comment.author_id ?? comment.author?.id ?? null
}

export function commentIsAuthor(comment: CommentData, authorId?: CommentId | null) {
  if (comment.author?.isAuthor || comment.author?.authorBadge || comment.isAuthor || comment.authorBadge || Boolean(comment.author?.badge) || comment.is_post_author === true) return true
  return sameCommentId(commentAuthorId(comment), authorId)
}

export function commentContent(comment: CommentData) {
  return String(comment.content || '')
}

export function commentCreatedAt(comment: CommentData) {
  return String(comment.createdAt || comment.created_at || '')
}

export function commentIsDeleted(comment: CommentData) {
  return Boolean(comment.deleted || comment.deletedAt || comment.deleted_at)
}

export function commentLikeCount(comment: CommentData) {
  return Math.max(0, Number(comment.likeCount ?? comment.like_count ?? 0) || 0)
}

export function commentIsLiked(comment: CommentData) {
  return Boolean(comment.viewerLiked ?? comment.viewer_liked)
}

export function commentReplyCount(comment: CommentData) {
  return Math.max(0, Number(comment.replyCount ?? comment.reply_count ?? comment.replies?.length ?? 0) || 0)
}

export function commentMedia(comment: CommentData): CommentMediaItem[] {
  const source = comment.media || comment.attachments || []
  return source.filter((item): item is CommentMediaItem => Boolean(item && typeof item.url === 'string' && item.url)).map((item) => ({ ...item, alt: item.alt || String((item as any).alt_text || '') || null }))
}

export function relativeTime(value: string) {
  const date = new Date(value)
  if (!value || Number.isNaN(date.getTime())) return '刚刚'

  const seconds = (date.getTime() - Date.now()) / 1000
  const absolute = Math.abs(seconds)
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
    ['second', 1],
  ]
  const selected = units.find(([, unitSize]) => absolute >= unitSize) ?? (['second', 1] as [Intl.RelativeTimeFormatUnit, number])
  const [unit, size] = selected
  const amount = Math.round(seconds / size)
  return new Intl.RelativeTimeFormat('zh-CN', { numeric: 'auto' }).format(amount, unit)
}

export function absoluteTime(value: string) {
  const date = new Date(value)
  if (!value || Number.isNaN(date.getTime())) return '时间未知'
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
