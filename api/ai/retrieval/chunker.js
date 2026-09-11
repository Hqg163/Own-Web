const crypto = require('crypto');
const { normalizeMarkdown, estimateTokens } = require('./normalizer');
const { createHeadingId } = require('./heading');

const hash = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

function uuidFromHash(value) {
  const hex = hash(value).slice(0, 32).split('');
  hex[12] = '4';
  hex[16] = ['8', '9', 'a', 'b'][parseInt(hex[16], 16) % 4];
  return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20).join('')}`;
}

function paragraphBlocks(lines) {
  const blocks = [];
  let current = [];
  let fence = null;
  let math = false;
  const flush = () => { if (current.length) { blocks.push(current.join('\n').trim()); current = []; } };

  for (const line of lines) {
    if (/^\s*```/.test(line) || /^\s*~~~/.test(line)) {
      const marker = line.trim().slice(0, 3);
      if (!fence) { flush(); fence = marker; current.push(line); }
      else { current.push(line); if (marker === fence) { flush(); fence = null; } }
      continue;
    }
    if (fence) { current.push(line); continue; }
    if (/^\s*\$\$\s*$/.test(line)) {
      if (!math) { flush(); math = true; current.push(line); }
      else { current.push(line); flush(); math = false; }
      continue;
    }
    if (math) { current.push(line); continue; }
    if (!line.trim()) { flush(); continue; }
    current.push(line);
  }
  flush();
  return blocks;
}

function splitOversizedBlock(block, maximum) {
  if (estimateTokens(block) <= maximum || /^\s*(```|~~~|\$\$)/.test(block)) return [block];
  // A paragraph is allowed to flow across chunks; code, Mermaid and display
  // math are not. Prefer sentence boundaries, then fall back to word groups
  // for text without punctuation (including common CJK prose).
  let units = block.split(/(?<=[。！？.!?；;])\s+|\n+/).filter(Boolean);
  if (units.length < 2) units = block.match(/\S+\s*/g) || [block];
  const pieces = [];
  let current = '';
  for (const unit of units) {
    const next = `${current}${current ? ' ' : ''}${unit}`.trim();
    if (current && estimateTokens(next) > maximum) {
      pieces.push(current.trim());
      current = unit.trim();
    } else {
      current = next;
    }
  }
  if (current) pieces.push(current);
  return pieces;
}

function splitSection(section, options) {
  const blocks = paragraphBlocks(section.lines).flatMap((block) => splitOversizedBlock(block, options.maxTokens));
  const chunks = [];
  let current = [];
  let currentTokens = 0;
  let hasFreshContent = false;
  const target = options.targetTokens;
  const maximum = options.maxTokens;
  const overlap = options.overlapTokens;

  const flush = () => {
    if (!current.length || !hasFreshContent) return;
    chunks.push(current.join('\n\n').trim());
    const tail = [];
    let tokens = 0;
    for (let index = current.length - 1; index >= 0; index -= 1) {
      const size = estimateTokens(current[index]);
      if (tokens + size > overlap) break;
      tail.unshift(current[index]); tokens += size;
    }
    current = tail;
    currentTokens = tokens;
    hasFreshContent = false;
  };

  for (const block of blocks) {
    const size = estimateTokens(block);
    if (hasFreshContent && (currentTokens + size > maximum || (currentTokens >= target && currentTokens + size > target))) flush();
    // Do not let a small overlap push an otherwise valid next block over its
    // hard limit. Losing overlap is preferable to producing an oversized
    // ordinary-text chunk; atomic code/formula blocks remain exempt.
    if (!hasFreshContent && current.length && currentTokens + size > maximum) {
      current = [];
      currentTokens = 0;
    }
    current.push(block); currentTokens += size; hasFreshContent = true;
    if (currentTokens >= target) flush();
  }
  if (current.length && hasFreshContent) chunks.push(current.join('\n\n').trim());
  return chunks.filter(Boolean);
}

function parseSections(markdown) {
  const lines = normalizeMarkdown(markdown).split('\n');
  const used = new Set();
  const stack = [];
  const sections = [];
  let active = { heading: '文章开头', headingPath: '文章开头', headingAnchor: 'section-1', level: 0, lines: [] };
  const finish = () => { if (active.lines.some((line) => line.trim())) sections.push(active); };
  let headingNumber = 0;

  for (const line of lines) {
    const match = line.match(/^(#{1,4})\s+(.+?)\s*#*\s*$/);
    if (!match) { active.lines.push(line); continue; }
    finish();
    headingNumber += 1;
    const level = match[1].length;
    const heading = match[2].trim();
    while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
    const anchor = createHeadingId(heading, used, headingNumber);
    stack.push({ level, heading, anchor });
    active = {
      heading, level, headingAnchor: anchor,
      headingPath: stack.map((entry) => entry.heading).join(' → '), lines: [line],
    };
  }
  finish();
  return sections;
}

function createChunks(post, options = {}) {
  const settings = { targetTokens: options.targetTokens || 700, maxTokens: options.maxTokens || 1000, overlapTokens: options.overlapTokens || 100 };
  const chunks = [];
  for (const section of parseSections(post.content_markdown)) {
    const parts = splitSection(section, settings);
    parts.forEach((content, index) => {
      const contentHash = hash(content);
      const key = [post.id, section.headingPath, index, contentHash].join('\u0000');
      chunks.push({
        chunkId: uuidFromHash(key), postId: Number(post.id), content, contentHash, chunkIndex: index,
        heading: section.heading, headingPath: section.headingPath, headingAnchor: section.headingAnchor,
        tokenEstimate: estimateTokens(content),
      });
    });
  }
  return chunks;
}

module.exports = { createChunks, parseSections, splitOversizedBlock, uuidFromHash, hash };
