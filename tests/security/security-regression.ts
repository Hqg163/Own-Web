import { strict as assert } from 'node:assert'
import { magicType, validateUploadedFile } from '../../api/lib/security.js'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'own-web-security-'))
const png = path.join(directory, 'safe.png')
fs.writeFileSync(png, Buffer.from('89504e470d0a1a0a0000000d494844520000000100000001', 'hex'))
assert.equal(magicType(png, 'image/png'), 'image/png')
assert.doesNotThrow(() => validateUploadedFile({ path: png, originalname: 'safe.png', mimetype: 'image/png' }, { allowed: new Set(['image/png']), maxBytes: 1024 }))
const svg = path.join(directory, 'evil.svg')
fs.writeFileSync(svg, '<svg><script>alert(1)</script></svg>')
assert.throws(() => validateUploadedFile({ path: svg, originalname: 'evil.svg', mimetype: 'image/svg+xml' }, { allowed: new Set(['image/svg+xml']), maxBytes: 1024 }))
fs.rmSync(directory, { recursive: true, force: true })
console.log('security regression checks passed')
