export const REPORT_MEDIA_ACCEPT = 'image/png,image/jpeg,image/webp'
export const REPORT_MEDIA_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const
export const MAX_REPORT_MEDIA_COUNT = 3
export const MAX_REPORT_MEDIA_SIZE = 5 * 1024 * 1024
export const MAX_REPORT_DETAILS_LENGTH = 2000

export const REPORT_REASON_OPTIONS = [
  { code: 'spam', label: '垃圾广告' },
  { code: 'harassment', label: '骚扰 / 辱骂' },
  { code: 'hate', label: '仇恨 / 歧视' },
  { code: 'sexual', label: '色情 / 不适内容' },
  { code: 'violence', label: '暴力 / 危险行为' },
  { code: 'illegal', label: '违法内容' },
  { code: 'copyright', label: '侵权 / 抄袭' },
  { code: 'privacy', label: '隐私泄露' },
  { code: 'misinformation', label: '虚假 / 误导信息' },
  { code: 'other', label: '其他' },
] as const

export type ReportReasonCode = (typeof REPORT_REASON_OPTIONS)[number]['code']

export function isAllowedReportFile(file: File) {
  return REPORT_MEDIA_TYPES.includes(file.type as (typeof REPORT_MEDIA_TYPES)[number]) && file.size <= MAX_REPORT_MEDIA_SIZE
}
