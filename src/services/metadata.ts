export type MetadataInput = {
  title: string
  description?: string
  canonical?: string
  type?: string
  image?: string | null
  robots?: string
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>
}

const DEFAULT_TITLE = 'Own-Web | 个人网站与博客'
const DEFAULT_DESCRIPTION = 'Own-Web 是一个以个人写作、作品展示和长期积累为核心的网站。'

function absoluteUrl(value: string | null | undefined) {
  if (!value) return ''
  try { return new URL(value, window.location.origin).toString() } catch { return '' }
}

function upsertMeta(attribute: 'name' | 'property', key: string, content: string) {
  let node = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${CSS.escape(key)}"]`)
  if (!node) {
    node = document.createElement('meta')
    node.setAttribute(attribute, key)
    document.head.appendChild(node)
  }
  node.content = content
}

function upsertLink(rel: string, href: string) {
  let node = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!node) {
    node = document.createElement('link')
    node.rel = rel
    document.head.appendChild(node)
  }
  node.href = href
}

function clearManagedJsonLd() {
  document.head.querySelectorAll('script[data-own-web-jsonld]').forEach((node) => node.remove())
}

export function setPageMetadata(input: Partial<MetadataInput> = {}) {
  const title = input.title || DEFAULT_TITLE
  const description = input.description || DEFAULT_DESCRIPTION
  const canonical = absoluteUrl(input.canonical || `${window.location.origin}${window.location.pathname}`)
  const image = absoluteUrl(input.image)
  document.title = title
  upsertMeta('name', 'description', description)
  upsertMeta('name', 'robots', input.robots || 'index,follow')
  upsertMeta('property', 'og:title', title)
  upsertMeta('property', 'og:description', description)
  upsertMeta('property', 'og:type', input.type || 'website')
  upsertMeta('property', 'og:url', canonical)
  if (image) upsertMeta('property', 'og:image', image)
  else document.head.querySelector('meta[property="og:image"]')?.remove()
  upsertMeta('name', 'twitter:card', image ? 'summary_large_image' : 'summary')
  upsertMeta('name', 'twitter:title', title)
  upsertMeta('name', 'twitter:description', description)
  if (image) upsertMeta('name', 'twitter:image', image)
  else document.head.querySelector('meta[name="twitter:image"]')?.remove()
  upsertLink('canonical', canonical)
  clearManagedJsonLd()
  if (input.jsonLd) {
    for (const value of Array.isArray(input.jsonLd) ? input.jsonLd : [input.jsonLd]) {
      const script = document.createElement('script')
      script.type = 'application/ld+json'
      script.dataset.ownWebJsonld = 'true'
      script.textContent = JSON.stringify(value)
      document.head.appendChild(script)
    }
  }
}

export function resetPageMetadata() { setPageMetadata() }

export const defaultMetadata = { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION }
