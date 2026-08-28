const fs = require('fs');
const path = require('path');

function errorPayload(code, message, fields) {
  return { error: { code, message, ...(fields ? { fields } : {}) } };
}

function sendError(res, status, code, message, fields) {
  return res.status(status).json(errorPayload(code, message, fields));
}

function createRateLimiter({ windowMs = 60_000, limit = 60, key = (req) => req.ip || 'unknown', message = '请求过于频繁，请稍后重试' } = {}) {
  const buckets = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const bucketKey = String(key(req));
    const previous = buckets.get(bucketKey);
    const bucket = !previous || previous.expiresAt <= now ? { count: 0, expiresAt: now + windowMs } : previous;
    bucket.count += 1;
    buckets.set(bucketKey, bucket);
    if (buckets.size > 10_000) for (const [storedKey, value] of buckets) if (value.expiresAt <= now) buckets.delete(storedKey);
    res.setHeader('RateLimit-Limit', String(limit));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, limit - bucket.count)));
    res.setHeader('RateLimit-Reset', String(Math.ceil(bucket.expiresAt / 1000)));
    if (bucket.count > limit) return sendError(res, 429, 'RATE_LIMITED', message);
    return next();
  };
}

function originGuard(allowedOrigins) {
  const origins = new Set(allowedOrigins);
  return (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.get('Origin');
    const referer = req.get('Referer');
    if (origin && origins.has(origin)) return next();
    if (!origin && referer) {
      try { if (origins.has(new URL(referer).origin)) return next(); } catch (_) { /* fall through */ }
    }
    return sendError(res, 403, 'CSRF_ORIGIN_REQUIRED', '请求来源未通过校验');
  };
}

function magicType(filePath, declaredMime) {
  const head = fs.readFileSync(filePath).subarray(0, 16);
  const starts = (value) => head.subarray(0, value.length).equals(Buffer.isBuffer(value) ? value : Buffer.from(value));
  if (starts(Buffer.from('89504e470d0a1a0a', 'hex'))) return 'image/png';
  if (starts(Buffer.from('ffd8ff', 'hex'))) return 'image/jpeg';
  if (starts('RIFF') && head.subarray(8, 12).equals(Buffer.from('WEBP'))) return 'image/webp';
  if (starts('GIF87a') || starts('GIF89a')) return 'image/gif';
  if (starts('%PDF-')) return 'application/pdf';
  if (starts('PK\x03\x04') || starts('PK\x05\x06') || starts('PK\x07\x08')) return 'application/zip';
  if (starts('OggS')) return declaredMime?.startsWith('video/') ? 'video/ogg' : 'audio/ogg';
  if (starts('ID3') || (head[0] === 0xff && (head[1] & 0xe0) === 0xe0)) return 'audio/mpeg';
  if (starts(Buffer.from('1a45dfa3', 'hex'))) return 'video/webm';
  if (head.subarray(4, 8).equals(Buffer.from('ftyp'))) return declaredMime?.startsWith('audio/') ? 'audio/mp4' : 'video/mp4';
  if (head.length >= 8 && head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0) return 'application/msword';
  return null;
}

function imageDimensions(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) && buffer.length >= 24) {
    return { type:'png', width:buffer.readUInt32BE(16), height:buffer.readUInt32BE(20) };
  }
  if ((buffer.subarray(0, 6).toString() === 'GIF87a' || buffer.subarray(0, 6).toString() === 'GIF89a') && buffer.length >= 10) {
    return { type:'gif', width:buffer.readUInt16LE(6), height:buffer.readUInt16LE(8) };
  }
  if (buffer.subarray(0, 4).equals(Buffer.from('RIFF')) && buffer.subarray(8, 12).toString() === 'WEBP') {
    if (buffer.subarray(12, 16).toString() === 'VP8X' && buffer.length >= 30) return { type:'webp', width:1 + buffer.readUIntLE(24, 3), height:1 + buffer.readUIntLE(27, 3) };
    return { type:'webp', width:0, height:0 };
  }
  if (buffer.subarray(0, 2).equals(Buffer.from('ffd8', 'hex'))) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) { offset += 1; continue; }
      const marker = buffer[offset + 1]; offset += 2;
      if (marker === 0xd8 || marker === 0xd9) continue;
      if (offset + 2 > buffer.length) break;
      const segmentLength = buffer.readUInt16BE(offset);
      if (segmentLength < 2 || offset + segmentLength > buffer.length) break;
      if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
        if (segmentLength >= 7) return { type:'jpg', width:buffer.readUInt16BE(offset + 5), height:buffer.readUInt16BE(offset + 3) };
        break;
      }
      offset += segmentLength;
    }
  }
  return null;
}

function validateUploadedFile(file, { allowed, maxBytes, rejectSvg = true } = {}) {
  if (!file || !file.path || !fs.existsSync(file.path)) throw Object.assign(new Error('上传文件无效'), { status: 400, code: 'FILE_INVALID' });
  const size = fs.statSync(file.path).size;
  if (!size || (maxBytes && size > maxBytes)) throw Object.assign(new Error('文件大小不符合要求'), { status: 400, code: 'FILE_SIZE_INVALID' });
  const declared = String(file.mimetype || '').toLowerCase();
  if (rejectSvg && (declared === 'image/svg+xml' || path.extname(file.originalname || '').toLowerCase() === '.svg')) throw Object.assign(new Error('不支持 SVG 图片'), { status: 400, code: 'SVG_NOT_ALLOWED' });
  const detected = magicType(file.path, declared);
  if (!detected || !allowed?.has(detected) || (declared && !allowed.has(declared) && declared !== 'application/octet-stream') || (detected.startsWith('image/') && !declared.startsWith('image/'))) throw Object.assign(new Error('文件类型或内容签名不匹配'), { status: 400, code: 'FILE_TYPE_INVALID' });
  if (detected.startsWith('image/')) {
    const dimensions = imageDimensions(file.path);
    if (!dimensions || dimensions.width < 1 || dimensions.height < 1 || dimensions.width > 100_000 || dimensions.height > 100_000) throw Object.assign(new Error('图片尺寸无效'), { status:400, code:'FILE_DIMENSIONS_INVALID' });
  }
  return { ...file, detectedMime: detected, size };
}

module.exports = { errorPayload, sendError, createRateLimiter, originGuard, magicType, imageDimensions, validateUploadedFile };
