const MAX_SOURCE_LENGTH = 12_000
const MAX_LINES = 120
const MAX_NODES = 50
const MAX_EDGES = 80

export type SafeMermaidResult = { ok: true; html: string } | { ok: false; reason: string; html: string }

function escapeHtml(value: string) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char] || char))
}

function fallback(source: string, reason: string): SafeMermaidResult {
  const safeSource = escapeHtml(source).replace(/javascript\s*:/gi, 'blocked-protocol:').replace(/data\s*:/gi, 'blocked-data:')
  return { ok:false, reason, html:`<pre class="mermaid-fallback" data-mermaid-error="true"><code>${safeSource}</code></pre>` }
}

/** Render a deliberately small, safe flowchart subset without evaluating Mermaid input. */
export function renderSafeMermaid(source: string): SafeMermaidResult {
  const startedAt = Date.now()
  const value = String(source || '').trim()
  if (!value) return fallback(value, 'empty')
  if (value.length > MAX_SOURCE_LENGTH) return fallback(value, 'source-too-large')
  if (/<|javascript\s*:|data\s*:|\b(click|script|callback|href|classDef|style)\b/i.test(value)) return fallback(value, 'unsafe-directive')
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (lines.length > MAX_LINES || !/^(flowchart|graph)\s+(TD|TB|LR|RL|BT)\b/i.test(lines[0] || '')) return fallback(value, 'unsupported-diagram')
  const nodes = new Map<string, string>()
  const edges: Array<[string, string]> = []
  const addNode = (id: string, label?: string) => {
    const normalized = id.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40)
    if (!normalized) return false
    if (!nodes.has(normalized)) nodes.set(normalized, (label || normalized).slice(0, 80))
    return nodes.size <= MAX_NODES
  }
  for (const line of lines.slice(1)) {
    if (Date.now() - startedAt > 50) return fallback(value, 'render-timeout')
    const match = line.match(/^([A-Za-z0-9_-]+)(?:\[([^\]]*)\]|\(([^)]*)\)|\{([^}]*)\})?\s*--?>\s*([A-Za-z0-9_-]+)(?:\[([^\]]*)\]|\(([^)]*)\)|\{([^}]*)\})?\s*$/)
    if (!match || edges.length >= MAX_EDGES) return fallback(value, 'unsupported-edge')
    const labels = [match[2], match[3], match[4], match[6], match[7], match[8]].filter(Boolean)
    if (labels.some((label) => String(label).length > 80)) return fallback(value, 'label-too-long')
    if (!addNode(match[1]!, match[2] || match[3] || match[4]) || !addNode(match[5]!, match[6] || match[7] || match[8])) return fallback(value, 'diagram-too-large')
    edges.push([match[1]!.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40), match[5]!.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40)])
  }
  if (!edges.length) return fallback(value, 'no-supported-edges')
  if (Date.now() - startedAt > 50) return fallback(value, 'render-timeout')
  const width = 720
  const rowHeight = 86
  const nodeWidth = 220
  const nodeHeight = 44
  const entries = [...nodes.entries()]
  const positions = new Map(entries.map(([id], index) => [id, { x: 40 + (index % 3) * 240, y: 36 + Math.floor(index / 3) * rowHeight }]))
  const height = Math.max(150, 80 + Math.ceil(entries.length / 3) * rowHeight)
  const linesHtml = edges.map(([from, to]) => {
    const a = positions.get(from); const b = positions.get(to); if (!a || !b) return ''
    return `<line x1="${a.x + nodeWidth / 2}" y1="${a.y + nodeHeight}" x2="${b.x + nodeWidth / 2}" y2="${b.y}" stroke="currentColor" stroke-width="2" marker-end="url(#own-web-arrow)" />`
  }).join('')
  const nodesHtml = entries.map(([id, label]) => { const position = positions.get(id)!; return `<g data-node="${escapeHtml(id)}"><rect x="${position.x}" y="${position.y}" width="${nodeWidth}" height="${nodeHeight}" rx="8" fill="currentColor" fill-opacity=".08" stroke="currentColor" /><text x="${position.x + nodeWidth / 2}" y="${position.y + 27}" text-anchor="middle" fill="currentColor" font-size="14">${escapeHtml(label)}</text></g>` }).join('')
  return { ok:true, html:`<svg class="safe-mermaid" data-mermaid-rendered="true" viewBox="0 0 ${width} ${height}" role="img" aria-label="安全流程图" xmlns="http://www.w3.org/2000/svg"><defs><marker id="own-web-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="currentColor" /></marker></defs>${linesHtml}${nodesHtml}</svg>` }
}

export function enhanceMermaid(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('pre[data-mermaid], pre.mermaid').forEach((pre) => {
    const source = pre.dataset.mermaid === 'true' ? pre.textContent || '' : pre.dataset.mermaid || pre.textContent || ''
    const result = renderSafeMermaid(source)
    const wrapper = document.createElement('div')
    wrapper.className = 'mermaid-container'
    wrapper.dataset.mermaidStatus = result.ok ? 'rendered' : 'source'
    wrapper.innerHTML = result.html
    pre.replaceWith(wrapper)
  })
}
