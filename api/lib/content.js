const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;
const MAX_NODE_COUNT = 1000;
const MAX_TEXT_LENGTH = 20000;
const SAFE_CODE_LANGUAGES = new Set(['text', 'plaintext', 'javascript', 'typescript', 'json', 'html', 'css', 'bash', 'shell', 'sql', 'python', 'java', 'go', 'rust', 'vue', 'markdown', 'yaml']);
const SAFE_EMBED_HOSTS = new Set(['www.youtube.com', 'youtu.be', 'www.bilibili.com', 'open.spotify.com']);
const MAX_MERMAID_LINES = 120;
const MAX_MERMAID_NODES = 50;
const MAX_MERMAID_EDGES = 80;
const NODE_TYPES = new Set([
  'doc', 'paragraph', 'heading', 'text', 'hardBreak', 'bulletList', 'orderedList', 'taskList', 'listItem',
  'blockquote', 'horizontalRule', 'codeBlock', 'image', 'gallery', 'attachment', 'audio', 'video', 'table',
  'tableRow', 'tableHeader', 'tableCell', 'callout', 'details', 'embed', 'bookmarkCard', 'mathInline',
  'mathBlock', 'mermaid', 'footnote'
]);
const MARK_TYPES = new Set(['bold', 'italic', 'strike', 'code', 'link', 'underline']);

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

function safeMathValue(value) {
  const source = String(value ?? '').replace(/\r\n?/g, '\n').trim();
  if (!source || source.length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(source)) return null;
  if (/\\(?:htmlClass|htmlId|htmlStyle|htmlData|href|url|includeGraphics|class|style|command|def|gdef|newcommand|renewcommand|let|futurelet|csname|special|write|input|include)\b/i.test(source)) return null;
  return source;
}

function mathNodeHtml(kind, value) {
  const block = kind === 'block';
  const className = block ? 'math-block' : 'math-inline';
  const marker = block ? 'data-math-block' : 'data-math-inline';
  return `<${block ? 'div' : 'span'} class="${className}" ${marker}="true" data-math="${escapeHtml(value)}">${escapeHtml(value)}</${block ? 'div' : 'span'}>`;
}

function invalid(message, fields) {
  return Object.assign(new Error(message), { status: 400, code: 'INVALID_CONTENT', fields });
}

function safeHttpUrl(value, { allowMedia = false } = {}) {
  const raw = String(value || '').trim();
  if (allowMedia) return /^\/api\/public\/media\/\d+(?:\?share=[a-f0-9]{64})?$/.test(raw) ? raw : null;
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    return url.toString();
  } catch (_) {
    return null;
  }
}

function safeEmbedUrl(value) {
  const normalized = safeHttpUrl(value);
  if (!normalized) return null;
  const url = new URL(normalized);
  return url.protocol === 'https:' && SAFE_EMBED_HOSTS.has(url.hostname) ? normalized : null;
}

function safeMermaidSource(value) {
  const source = String(value || '').trim();
  if (!source || source.length > 12000 || /<|\b(click|callback|javascript|data|script|href|classDef|style)\b/i.test(source)) return null;
  const lines = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length > MAX_MERMAID_LINES || !/^(flowchart|graph)\s+(TD|TB|LR|RL|BT)\b/i.test(lines[0] || '')) return null;
  const nodes = new Set();
  const edgePattern = /^([A-Za-z0-9_-]+)(?:\[([^\]]*)\]|\(([^)]*)\)|\{([^}]*)\})?\s*--?>\s*([A-Za-z0-9_-]+)(?:\[([^\]]*)\]|\(([^)]*)\)|\{([^}]*)\})?\s*$/;
  for (const line of lines.slice(1)) {
    const match = line.match(edgePattern);
    if (!match || lines.length > MAX_MERMAID_EDGES + 1) return null;
    const labels = [match[2], match[3], match[4], match[6], match[7], match[8]].filter(Boolean);
    if (labels.some((label) => String(label).length > 80)) return null;
    nodes.add(match[1]); nodes.add(match[5]);
    if (nodes.size > MAX_MERMAID_NODES) return null;
  }
  if (!nodes.size) return null;
  return source;
}

function normalizeBlocks(value) {
  let doc = value;
  if (typeof doc === 'string') {
    try { doc = JSON.parse(doc); } catch (_) { throw invalid('文章块内容不是有效 JSON'); }
  }
  if (!doc || typeof doc !== 'object' || doc.type !== 'doc' || !Array.isArray(doc.content)) throw invalid('文章块结构无效');
  let bytes;
  try { bytes = Buffer.byteLength(JSON.stringify(doc), 'utf8'); } catch (_) { throw invalid('文章块结构无效'); }
  if (bytes > MAX_DOCUMENT_BYTES) throw invalid('文章块内容过大');
  let count = 0;
  const walk = (source) => {
    if (!source || typeof source !== 'object' || !NODE_TYPES.has(source.type)) throw invalid('文章包含不支持的内容块');
    const node = { ...source };
    node.attrs = source.attrs && typeof source.attrs === 'object' ? { ...source.attrs } : {};
    if (++count > MAX_NODE_COUNT) throw invalid('文章块数量过多');
    if (node.type === 'text' && (typeof node.text !== 'string' || node.text.length > MAX_TEXT_LENGTH)) throw invalid('文本块无效');
    if (node.type === 'heading' && ![1, 2, 3, 4].includes(Number(node.attrs.level))) throw invalid('标题级别必须为 H1-H4');
    if (node.type === 'codeBlock') {
      const language = String(node.attrs.language || 'text').toLowerCase();
      if (!SAFE_CODE_LANGUAGES.has(language)) throw invalid('代码语言不在允许列表中');
      node.attrs.language = language;
    }
    if (node.type === 'image') {
      if (!safeHttpUrl(node.attrs.src, { allowMedia: true }) || !String(node.attrs.alt || '').trim()) throw invalid('图片必须使用已上传媒体并提供替代文本');
      node.attrs.alt = String(node.attrs.alt).trim().slice(0, 255);
      node.attrs.caption = String(node.attrs.caption || '').slice(0, 500);
      node.attrs.align = ['left', 'center', 'right'].includes(node.attrs.align) ? node.attrs.align : 'center';
      node.attrs.width = Math.min(100, Math.max(20, Number(node.attrs.width) || 100));
    }
    if (node.type === 'gallery') {
      const items = Array.isArray(node.attrs.items) ? node.attrs.items.slice(0, 20) : [];
      if (!items.length || items.length > 20 || items.some((item) => !safeHttpUrl(item?.src, { allowMedia: true }) || !String(item?.alt || '').trim())) throw invalid('图库必须由不超过 20 张带替代文本的已上传图片组成');
      node.attrs.items = items.map((item) => ({ src: safeHttpUrl(item.src, { allowMedia: true }), alt: String(item.alt).trim().slice(0, 255), caption: String(item.caption || '').slice(0, 500) }));
    }
    if (['attachment', 'audio', 'video'].includes(node.type)) {
      if (!safeHttpUrl(node.attrs.src, { allowMedia: true }) || !String(node.attrs.label || '').trim()) throw invalid('媒体块必须使用已上传文件并提供名称');
      node.attrs.label = String(node.attrs.label).trim().slice(0, 255);
    }
    if (node.type === 'callout' && !['info', 'note', 'warning', 'success'].includes(String(node.attrs.tone || 'info'))) throw invalid('提示卡类型无效');
    if (node.type === 'details' && (String(node.attrs.summary || '').trim().length > 120 || String(node.attrs.body || '').length > 5000)) throw invalid('折叠内容无效');
    if (['mathInline', 'mathBlock'].includes(node.type)) {
      const value = safeMathValue(node.attrs.value || node.text);
      if (!value) throw invalid('公式内容无效');
      node.attrs = { value };
      delete node.text;
      delete node.marks;
      delete node.content;
    }
    if (node.type === 'mermaid') {
      const value = safeMermaidSource(node.attrs.value);
      if (!value) throw invalid('Mermaid 图表内容无效');
      node.attrs.value = value;
    }
    if (['embed', 'bookmarkCard'].includes(node.type)) {
      const url = safeEmbedUrl(node.attrs.url);
      if (!url) throw invalid('仅支持允许列表中的 HTTPS 嵌入地址');
      node.attrs = { ...node.attrs, url, provider: new URL(url).hostname, title: String(node.attrs.title || '').slice(0, 180), description: String(node.attrs.description || '').slice(0, 500) };
    }
    if (node.type === 'footnote' && String(node.attrs.text || '').length > 2000) throw invalid('脚注内容过长');
    if (Array.isArray(node.marks)) {
      node.marks = node.marks.map((mark) => {
        if (!mark || !MARK_TYPES.has(mark.type)) throw invalid('文章包含不支持的文本格式');
        const normalized = { ...mark, attrs: mark.attrs && typeof mark.attrs === 'object' ? { ...mark.attrs } : {} };
        if (mark.type === 'link') {
          const href = safeHttpUrl(mark.attrs?.href);
          if (!href) throw invalid('链接仅支持不含登录信息的 HTTP 或 HTTPS 地址');
          normalized.attrs.href = href;
        }
        return normalized;
      });
    }
    if (source.content !== undefined) {
      if (!Array.isArray(source.content)) throw invalid('文章块子内容无效');
      node.content = source.content.map(walk);
    }
    return node;
  };
  return walk(doc);
}

function parseStoredBlocks(value) {
  if (!value) return null;
  try { return normalizeBlocks(value); } catch (_) { return null; }
}

function inlineMarkdown(value) {
  const placeholders = [];
  const hold = (content) => { const key = `\u0000${placeholders.length}\u0000`; placeholders.push(content); return key; };
  let source = String(value ?? '');
  source = source.replace(/`([^`\n]+)`/g, (_m, code) => hold(`<code>${escapeHtml(code)}</code>`));
  source = source.replace(/!\[([^\]]*)\]\((\/api\/public\/media\/\d+(?:\?share=[a-f0-9]{64})?)\)/g, (_m, alt, src) => hold(`<img src="${src}" alt="${escapeHtml(alt)}">`));
  source = source.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi, (_m, label, href) => hold(`<a href="${escapeHtml(href)}" rel="nofollow noopener" target="_blank">${escapeHtml(label)}</a>`));
  source = source.replace(/\\\(([^\n]+?)\\\)/g, (_m, formula) => {
    const safeValue = safeMathValue(formula);
    return safeValue ? hold(mathNodeHtml('inline', safeValue)) : _m;
  });
  let html = escapeHtml(source);
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/~~([^~]+)~~/g, '<s>$1</s>').replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  html = html.replace(/\[\^([a-z0-9_-]{1,30})\]/gi, '<sup data-footnote-ref="$1">$1</sup>');
  return html.replace(/\u0000(\d+)\u0000/g, (_m, index) => placeholders[Number(index)]);
}

function renderMarkdown(markdown) {
  const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n');
  const html = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }
    const fence = line.match(/^```([a-z0-9+#.-]*)\s*$/i);
    if (fence) {
      const language = SAFE_CODE_LANGUAGES.has((fence[1] || 'text').toLowerCase()) ? (fence[1] || 'text').toLowerCase() : 'text';
      const code = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index])) code.push(lines[index++]);
      if (index < lines.length) index += 1;
      if ((fence[1] || '').toLowerCase() === 'mermaid') {
        const source = code.join('\n');
        const safeSource = safeMermaidSource(source);
        if (safeSource) html.push(`<pre class="mermaid" data-mermaid="${escapeHtml(safeSource)}"><code>${escapeHtml(safeSource)}</code></pre>`);
        else html.push(`<pre class="mermaid-fallback" data-mermaid-error="true"><code>${escapeHtml(source.replace(/javascript:/gi, 'blocked-protocol:').replace(/data:/gi, 'blocked-data:').replace(/<\/?(script|iframe)[^>]*>/gi, '[blocked-html]'))}</code></pre>`);
      }
      else html.push(`<pre data-language="${language}"><code>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }
    if (/^\s*\$\$/.test(line)) {
      const singleLine = line.match(/^\s*\$\$([\s\S]+?)\$\$\s*$/);
      const start = index;
      let value = singleLine ? singleLine[1] : null;
      if (!singleLine && /^\s*\$\$\s*$/.test(line)) {
        const formula = [];
        index += 1;
        while (index < lines.length && !/^\s*\$\$\s*$/.test(lines[index])) formula.push(lines[index++]);
        if (index < lines.length) { value = formula.join('\n'); index += 1; }
        else { value = null; index = start; }
      }
      if (value !== null) {
        const safeValue = safeMathValue(value);
        if (safeValue) html.push(mathNodeHtml('block', safeValue));
        else html.push(`<p>${escapeHtml(lines.slice(start, index + (singleLine ? 1 : 0)).join('\n')).replace(/\n/g, '<br>')}</p>`);
        if (singleLine) index += 1;
        continue;
      }
    }
    const callout = line.match(/^:::callout(?:\s+(info|note|warning|success))?\s*$/i);
    if (callout) {
      const body = []; index += 1;
      while (index < lines.length && !/^:::\s*$/.test(lines[index])) body.push(lines[index++]);
      if (index < lines.length) index += 1;
      html.push(`<aside data-callout="${callout[1]?.toLowerCase() || 'info'}"><p>${inlineMarkdown(body.join('\n')).replace(/\n/g, '<br>')}</p></aside>`);
      continue;
    }
    const details = line.match(/^:::details\s+(.+)$/i);
    if (details) {
      const body = []; index += 1;
      while (index < lines.length && !/^:::\s*$/.test(lines[index])) body.push(lines[index++]);
      if (index < lines.length) index += 1;
      html.push(`<details><summary>${escapeHtml(details[1])}</summary><p>${inlineMarkdown(body.join('\n')).replace(/\n/g, '<br>')}</p></details>`);
      continue;
    }
    const bookmark = line.match(/^@\[(bookmark|embed)\]\((https:\/\/[^\s)]+)\)(?:\s+(.+))?$/i);
    if (bookmark) {
      const url = safeEmbedUrl(bookmark[2]);
      if (url) {
        const title = escapeHtml(bookmark[3] || (bookmark[1].toLowerCase() === 'embed' ? '受控嵌入' : 'Bookmark Card'));
        html.push(`<a data-${bookmark[1].toLowerCase() === 'embed' ? 'embed' : 'bookmark-card'} href="${escapeHtml(url)}" rel="nofollow noopener" target="_blank"><strong>${title}</strong><span>${escapeHtml(url)}</span></a>`);
        index += 1;
        continue;
      }
      html.push(`<p>${escapeHtml(line)}</p>`);
      index += 1;
      continue;
    }
    const footnote = line.match(/^\[\^([a-z0-9_-]{1,30})\]:\s*(.+)$/i);
    if (footnote) { html.push(`<aside data-footnote><sup>${escapeHtml(footnote[1])}</sup> ${inlineMarkdown(footnote[2])}</aside>`); index += 1; continue; }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) { const level = heading[1].length; html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`); index += 1; continue; }
    if (/^\s*(---+|\*\*\*+)\s*$/.test(line)) { html.push('<hr>'); index += 1; continue; }
    if (/^>\s?/.test(line)) {
      const quote = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) quote.push(inlineMarkdown(lines[index++].replace(/^>\s?/, '')));
      html.push(`<blockquote><p>${quote.join('<br>')}</p></blockquote>`);
      continue;
    }
    if (/^\s*[-*+]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const items = [];
      while (index < lines.length && (ordered ? /^\s*\d+[.)]\s+/.test(lines[index]) : /^\s*[-*+]\s+/.test(lines[index]))) items.push(inlineMarkdown(lines[index++].replace(ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*+]\s+/, '')));
      html.push(`<${ordered ? 'ol' : 'ul'}>${items.map((item) => `<li>${item}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`);
      continue;
    }
    if (line.includes('|') && index + 1 < lines.length && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[index + 1])) {
      const parseRow = (row) => row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => inlineMarkdown(cell.trim()));
      const headers = parseRow(line); index += 2; const rows = [];
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) rows.push(parseRow(lines[index++]));
      html.push(`<div class="table-wrap"><table><thead><tr>${headers.map((cell) => `<th>${cell}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    const paragraph = [line]; index += 1;
    while (index < lines.length && lines[index].trim() && !/^```/.test(lines[index]) && !/^(#{1,4})\s+/.test(lines[index]) && !/^\s*[-*+]\s+/.test(lines[index]) && !/^>\s?/.test(lines[index])) paragraph.push(lines[index++]);
    html.push(`<p>${inlineMarkdown(paragraph.join('\n')).replace(/\n/g, '<br>')}</p>`);
  }
  return html.join('');
}

function blocksToMarkdown(doc) {
  const source = normalizeBlocks(doc);
  const render = (node) => {
    const children = (node.content || []).map(render).join('');
    if (node.type === 'text') {
      let value = node.text || '';
      for (const mark of node.marks || []) {
        if (mark.type === 'bold') value = `**${value}**`;
        else if (mark.type === 'italic') value = `*${value}*`;
        else if (mark.type === 'strike') value = `~~${value}~~`;
        else if (mark.type === 'code') value = `\`${value}\``;
        else if (mark.type === 'link') value = `[${value}](${mark.attrs.href})`;
      }
      return value;
    }
    if (node.type === 'heading') return `${'#'.repeat(node.attrs.level)} ${children}\n\n`;
    if (node.type === 'paragraph') return `${children}\n\n`;
    if (node.type === 'blockquote') return children.split('\n').filter(Boolean).map((line) => `> ${line}`).join('\n') + '\n\n';
    if (node.type === 'bulletList' || node.type === 'taskList') return (node.content || []).map((item) => `- ${render(item).trim()}\n`).join('') + '\n';
    if (node.type === 'orderedList') return (node.content || []).map((item, itemIndex) => `${itemIndex + 1}. ${render(item).trim()}\n`).join('') + '\n';
    if (node.type === 'listItem') return children;
    if (node.type === 'horizontalRule') return '---\n\n';
    if (node.type === 'codeBlock') return `\`\`\`${node.attrs.language || 'text'}\n${children}\n\`\`\`\n\n`;
    if (node.type === 'hardBreak') return '\n';
    if (node.type === 'image') return `![${node.attrs.alt}](${node.attrs.src})\n\n`;
    if (node.type === 'gallery') return node.attrs.items.map((item) => `![${item.alt}](${item.src})`).join('\n\n') + '\n\n';
    if (['attachment', 'audio', 'video'].includes(node.type)) return `[${node.attrs.label}](${node.attrs.src})\n\n`;
    if (node.type === 'callout') return `:::callout ${node.attrs.tone || 'info'}\n${children.replace(/\n+/g, '\n').trim()}\n:::\n\n`;
    if (node.type === 'details') return `:::details ${node.attrs.summary || '展开阅读'}\n${String(node.attrs.body || children).replace(/\n+/g, '\n').trim()}\n:::\n\n`;
    if (node.type === 'embed' || node.type === 'bookmarkCard') return `@[${node.type === 'embed' ? 'embed' : 'bookmark'}](${node.attrs.url})${node.attrs.title ? ` ${node.attrs.title}` : ''}\n\n`;
    if (node.type === 'mathInline') return `\\(${node.attrs.value}\\)`;
    if (node.type === 'mathBlock') return `$$\n${node.attrs.value}\n$$\n\n`;
    if (node.type === 'mermaid') return `\`\`\`mermaid\n${node.attrs.value}\n\`\`\`\n\n`;
    if (node.type === 'footnote') return `[^${node.attrs.label || 'note'}]: ${node.attrs.text || ''}\n\n`;
    if (node.type === 'table') return children + '\n';
    if (node.type === 'tableRow') return `| ${children} |\n`;
    if (node.type === 'tableHeader' || node.type === 'tableCell') return `${children} | `;
    return children;
  };
  return render(source).trim();
}

function blocksToSafeHtml(doc) {
  const source = normalizeBlocks(doc);
  const render = (node) => {
    const children = (node.content || []).map(render).join('');
    if (node.type === 'text') {
      let value = escapeHtml(node.text || '');
      for (const mark of node.marks || []) {
        if (mark.type === 'bold') value = `<strong>${value}</strong>`;
        else if (mark.type === 'italic') value = `<em>${value}</em>`;
        else if (mark.type === 'strike') value = `<s>${value}</s>`;
        else if (mark.type === 'code') value = `<code>${value}</code>`;
        else if (mark.type === 'underline') value = `<u>${value}</u>`;
        else if (mark.type === 'link') value = `<a href="${escapeHtml(mark.attrs.href)}" rel="nofollow noopener" target="_blank">${value}</a>`;
      }
      return value;
    }
    if (node.type === 'paragraph') return `<p>${children}</p>`;
    if (node.type === 'heading') return `<h${node.attrs.level} id="${escapeHtml(String(node.attrs.id || '').replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, '-'))}">${children}</h${node.attrs.level}>`;
    if (node.type === 'blockquote') return `<blockquote>${children}</blockquote>`;
    if (node.type === 'bulletList' || node.type === 'taskList') return `<ul>${children}</ul>`;
    if (node.type === 'orderedList') return `<ol>${children}</ol>`;
    if (node.type === 'listItem') return `<li>${children}</li>`;
    if (node.type === 'horizontalRule') return '<hr>';
    if (node.type === 'codeBlock') return `<pre data-language="${escapeHtml(node.attrs.language || 'text')}"><code>${children}</code></pre>`;
    if (node.type === 'hardBreak') return '<br>';
    if (node.type === 'image') return `<figure data-align="${node.attrs.align}" style="--media-width:${node.attrs.width}%"><img src="${escapeHtml(node.attrs.src)}" alt="${escapeHtml(node.attrs.alt)}">${node.attrs.caption ? `<figcaption>${escapeHtml(node.attrs.caption)}</figcaption>` : ''}</figure>`;
    if (node.type === 'gallery') return `<div data-gallery>${node.attrs.items.map((item) => `<figure><img src="${escapeHtml(item.src)}" alt="${escapeHtml(item.alt)}">${item.caption ? `<figcaption>${escapeHtml(item.caption)}</figcaption>` : ''}</figure>`).join('')}</div>`;
    if (node.type === 'attachment') return `<p><a href="${escapeHtml(node.attrs.src)}" download>${escapeHtml(node.attrs.label)}</a></p>`;
    if (node.type === 'audio') return `<figure><audio controls src="${escapeHtml(node.attrs.src)}"></audio><figcaption>${escapeHtml(node.attrs.label)}</figcaption></figure>`;
    if (node.type === 'video') return `<figure><video controls src="${escapeHtml(node.attrs.src)}"></video><figcaption>${escapeHtml(node.attrs.label)}</figcaption></figure>`;
    if (node.type === 'callout') return `<aside data-callout="${escapeHtml(node.attrs.tone || 'info')}">${children}</aside>`;
    if (node.type === 'details') return `<details><summary>${escapeHtml(node.attrs.summary || '展开阅读')}</summary><p>${escapeHtml(node.attrs.body || children)}</p></details>`;
    if (node.type === 'embed') return `<a data-embed href="${escapeHtml(node.attrs.url)}" rel="nofollow noopener" target="_blank"><strong>${escapeHtml(node.attrs.title || '受控嵌入')}</strong><span>${escapeHtml(node.attrs.description || node.attrs.url)}</span></a>`;
    if (node.type === 'bookmarkCard') return `<a data-bookmark-card href="${escapeHtml(node.attrs.url)}" rel="nofollow noopener" target="_blank"><strong>${escapeHtml(node.attrs.title || '受控链接')}</strong><span>${escapeHtml(node.attrs.description || node.attrs.url)}</span></a>`;
    if (node.type === 'mathInline') return mathNodeHtml('inline', node.attrs.value);
    if (node.type === 'mathBlock') return mathNodeHtml('block', node.attrs.value);
    if (node.type === 'mermaid') return `<pre class="mermaid" data-mermaid="${escapeHtml(node.attrs.value)}"><code>${escapeHtml(node.attrs.value)}</code></pre>`;
    if (node.type === 'footnote') return `<aside data-footnote><sup>${escapeHtml(node.attrs.label || '注')}</sup> ${escapeHtml(node.attrs.text || '')}</aside>`;
    if (node.type === 'table') return `<div class="table-wrap"><table>${children}</table></div>`;
    if (node.type === 'tableRow') return `<tr>${children}</tr>`;
    if (node.type === 'tableHeader') return `<th>${children}</th>`;
    if (node.type === 'tableCell') return `<td>${children}</td>`;
    return children;
  };
  return render(source);
}

function plainTextFromMarkdown(markdown) {
  return String(markdown || '').replace(/```[\s\S]*?```/g, ' ').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[[^\]]+\]\([^)]*\)/g, '$1').replace(/[#>*_`~]/g, ' ').replace(/\s+/g, ' ').trim();
}

module.exports = {
  MAX_DOCUMENT_BYTES, SAFE_CODE_LANGUAGES, SAFE_EMBED_HOSTS, escapeHtml, safeHttpUrl, safeEmbedUrl,
  safeMathValue, validateBlocks: normalizeBlocks, parseStoredBlocks, renderMarkdown, blocksToMarkdown, blocksToSafeHtml, plainTextFromMarkdown, safeMermaidSource
};
