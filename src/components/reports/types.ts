import { MAX_REPORT_DETAILS_LENGTH, type ReportReasonCode } from './constants'

export type ReportId = number | string
export type ReportTargetType = 'post' | 'comment'
export type ReportMediaStatus = 'pending' | 'uploading' | 'uploaded' | 'bound' | 'error'

export interface ReportMediaDraft {
  key: string
  file: File
  previewUrl: string
  id?: number
  status: ReportMediaStatus
  error?: string
}

export interface ReportPayload {
  postId: number
  commentId?: number
  reason_code: ReportReasonCode
  details: string
  mediaIds: number[]
}

export interface BuildReportPayloadInput {
  targetType: ReportTargetType
  targetId: ReportId
  postId: ReportId
  reasonCode: ReportReasonCode
  details: string
  mediaIds: number[]
}

export interface ReportSubmittedPayload extends ReportPayload {
  report?: Record<string, unknown>
}

function toPositiveInteger(value: ReportId) {
  const numberValue = typeof value === 'number' ? value : Number(value)
  return Number.isSafeInteger(numberValue) && numberValue > 0 ? numberValue : null
}

export function isReportDetailsValid(reasonCode: ReportReasonCode, details: string) {
  const normalized = details.trim()
  return normalized.length <= MAX_REPORT_DETAILS_LENGTH && (reasonCode !== 'other' || normalized.length > 0)
}

export function buildReportPayload(input: BuildReportPayloadInput): ReportPayload {
  const postId = toPositiveInteger(input.postId) ?? (input.targetType === 'post' ? toPositiveInteger(input.targetId) : null)
  if (!postId) throw new Error('文章标识无效')
  const payload: ReportPayload = {
    postId,
    reason_code: input.reasonCode,
    details: input.details.trim().slice(0, MAX_REPORT_DETAILS_LENGTH),
    mediaIds: [...input.mediaIds],
  }
  if (input.targetType === 'comment') {
    const commentId = toPositiveInteger(input.targetId)
    if (!commentId) throw new Error('评论标识无效')
    payload.commentId = commentId
  }
  return payload
}
