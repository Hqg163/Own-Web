export type CommentId = number

export interface CommentAuthor {
  id?: CommentId | null
  name?: string | null
  username?: string | null
  avatarUrl?: string | null
  avatar_url?: string | null
  isAuthor?: boolean
  authorBadge?: boolean
  badge?: string | null
}

export interface CommentMediaItem {
  id?: CommentId
  url: string
  alt?: string | null
  name?: string | null
  file?: File
}

export interface CommentData {
  id: CommentId
  parentId?: CommentId | null
  parent_id?: CommentId | null
  authorId?: CommentId | null
  author_id?: CommentId | null
  author?: CommentAuthor | null
  username: string
  author_name?: string | null
  avatarUrl?: string | null
  avatar_url?: string | null
  avatar_path?: string | null
  isAuthor?: boolean
  authorBadge?: boolean
  content: string
  createdAt?: string | null
  created_at: string
  deletedAt?: string | null
  deleted_at?: string | null
  deleted?: boolean
  likeCount?: number
  like_count?: number
  viewerLiked?: boolean
  viewer_liked?: boolean
  replyCount?: number
  reply_count?: number
  media?: CommentMediaItem[] | null
  attachments?: CommentMediaItem[] | null
  replies?: CommentData[]
  [key: string]: unknown
}

export interface CommentSubmitPayload {
  content: string
  media: CommentMediaItem[]
  parentId: CommentId | null
}
