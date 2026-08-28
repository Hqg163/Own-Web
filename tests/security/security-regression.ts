import { strict as assert } from 'node:assert'
import { magicType, validateUploadedFile } from '../../api/lib/security.js'
import { renderSafeMermaid } from '../../src/utils/mermaid'
import { renderMarkdown, validateBlocks } from '../../api/lib/content.js'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'own-web-security-'))
const png = path.join(directory, 'safe.png')
fs.writeFileSync(png, Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000000020001e221bc330000000049454e44ae426082', 'hex'))
assert.equal(magicType(png, 'image/png'), 'image/png')
assert.doesNotThrow(() => validateUploadedFile({ path: png, originalname: 'safe.png', mimetype: 'image/png' }, { allowed: new Set(['image/png']), maxBytes: 1024 }))
const polyglot = path.join(directory, 'polyglot.png')
fs.writeFileSync(polyglot, Buffer.concat([fs.readFileSync(png), Buffer.from('<script>alert(1)</script>')]))
assert.throws(() => validateUploadedFile({ path: polyglot, originalname: 'polyglot.png', mimetype: 'image/png' }, { allowed: new Set(['image/png']), maxBytes: 2048 }), (error: any) => error.code === 'FILE_CONTENT_INVALID')
const corrupt = path.join(directory, 'corrupt.png')
fs.writeFileSync(corrupt, Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489', 'hex'))
assert.throws(() => validateUploadedFile({ path: corrupt, originalname: 'corrupt.png', mimetype: 'image/png' }, { allowed: new Set(['image/png']), maxBytes: 1024 }), (error: any) => error.code === 'FILE_CONTENT_INVALID')
const svg = path.join(directory, 'evil.svg')
fs.writeFileSync(svg, '<svg><script>alert(1)</script></svg>')
assert.throws(() => validateUploadedFile({ path: svg, originalname: 'evil.svg', mimetype: 'image/svg+xml' }, { allowed: new Set(['image/svg+xml']), maxBytes: 1024 }))
assert.equal(renderSafeMermaid('flowchart TD\nA[安全] --> B[内容]').ok, true)
assert.equal(renderSafeMermaid('flowchart TD\nA --> B\nclick A "javascript:alert(1)"').ok, false)
assert.throws(() => validateBlocks({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'data:text/html,<script>' } }] }] }] }))
assert.match(renderMarkdown('@[embed](https://evil.example/iframe) unsafe'), /&lt;|unsafe/)
fs.rmSync(directory, { recursive: true, force: true })
console.log('security regression checks passed')
