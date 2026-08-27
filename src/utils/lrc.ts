export interface LyricLine {
  time: number
  text: string
  sourceIndex: number
}

export interface ParsedLyrics {
  lines: LyricLine[]
  metadata: Record<string, string>
  offsetSeconds: number
}

const timestampPattern = /\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]/g
const metadataPattern = /^\[([a-zA-Z][\w-]*):(.*)]\s*$/

/** Parse the portable LRC subset without inventing content for missing lyrics. */
export function parseLrc(value: string): ParsedLyrics {
  const metadata: Record<string, string> = {}
  const lines: LyricLine[] = []
  let sourceIndex = 0

  for (const rawLine of value.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const metadataMatch = rawLine.match(metadataPattern)
    if (metadataMatch) {
      const key = metadataMatch[1]
      const metadataValue = metadataMatch[2]
      if (key !== undefined && metadataValue !== undefined) metadata[key.toLowerCase()] = metadataValue.trim()
      continue
    }

    const timestamps = [...rawLine.matchAll(timestampPattern)]
    if (!timestamps.length) continue

    const lastTimestamp = timestamps[timestamps.length - 1]
    if (!lastTimestamp || lastTimestamp.index === undefined || !lastTimestamp[0]) continue
    const text = rawLine.slice(lastTimestamp.index + lastTimestamp[0].length).trim()
    if (!text) continue

    for (const match of timestamps) {
      const minutes = Number(match[1])
      const seconds = Number(match[2])
      const fraction = (match[3] || '').padEnd(3, '0').slice(0, 3)
      if (!Number.isFinite(minutes) || seconds > 59) continue
      lines.push({
        time: minutes * 60 + seconds + (fraction ? Number(fraction) / 1000 : 0),
        text,
        sourceIndex: sourceIndex++,
      })
    }
  }

  lines.sort((left, right) => left.time - right.time || left.sourceIndex - right.sourceIndex)
  const offsetMilliseconds = Number(metadata.offset)
  return {
    lines,
    metadata,
    offsetSeconds: Number.isFinite(offsetMilliseconds) ? offsetMilliseconds / 1000 : 0,
  }
}

/** Returns the last matching row so duplicate timestamp translations stay grouped and stable. */
export function findActiveLyricIndex(lines: LyricLine[], playbackTime: number, offsetSeconds = 0): number {
  const target = playbackTime - offsetSeconds
  let low = 0
  let high = lines.length - 1
  let active = -1
  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    const candidate = lines[middle]
    if (candidate && candidate.time <= target) {
      active = middle
      low = middle + 1
    } else high = middle - 1
  }
  return active
}

export function getCenteredScrollTop(containerHeight: number, contentHeight: number, lineTop: number, lineHeight: number): number {
  const target = lineTop - containerHeight / 2 + lineHeight / 2
  return Math.max(0, Math.min(target, Math.max(0, contentHeight - containerHeight)))
}
