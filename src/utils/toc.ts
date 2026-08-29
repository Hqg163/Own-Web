export type TocHeading = { id: string; level: number; text: string }

function headingSlug(value: string): string {
  return String(value || '')
    .replace(/\$\$([\s\S]*?)\$\$/g, '$1')
    .replace(/\\\(([\s\S]*?)\\\)/g, '$1')
    .replace(/(^|[^\\])\$([^$\n]+)\$/g, '$1$2')
    .replace(/\\([a-zA-Z]+)/g, '$1')
    .replace(/[{}_^]/g, '-')
    .replace(/[^\p{L}\p{N}\u4e00-\u9fff]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
    .toLowerCase()
}

export function createHeadingId(text: string, used: Set<string>, fallbackIndex = 1): string {
  const base = headingSlug(text) || `section-${fallbackIndex}`
  let id = base
  let suffix = 2
  while (used.has(id)) id = `${base}-${suffix++}`
  used.add(id)
  return id
}

export function collectHeadings(root: ParentNode): TocHeading[] {
  const used = new Set<string>()
  return [...root.querySelectorAll<HTMLElement>('h1,h2,h3,h4')].map((heading, index) => {
    const text = heading.textContent?.trim() || `section-${index + 1}`
    const id = createHeadingId(text, used, index + 1)
    heading.id = id
    return { id, level: Number(heading.tagName.slice(1)), text }
  })
}

export function scrollToHeading(id: string, options: { headerOffset?: number; behavior?: ScrollBehavior } = {}): boolean {
  if (typeof document === 'undefined') return false
  const heading = document.getElementById(id)
  if (!heading) return false
  const header = document.querySelector<HTMLElement>('[data-sticky-header]')
  const offset = options.headerOffset ?? (header?.getBoundingClientRect().height || 0) + 16
  const top = Math.max(0, window.scrollY + heading.getBoundingClientRect().top - offset)
  window.scrollTo({ top, behavior: options.behavior ?? 'smooth' })
  if (window.location.hash !== `#${id}`) history.replaceState(null, '', `#${id}`)
  return true
}
