import { describe, expect, it } from 'vitest'
import { createRateLimiter } from '../../api/lib/security.js'

describe('security middleware', () => {
  it('returns a structured 429 after the configured request budget', () => {
    let statusCode = 200
    let body: unknown
    const response = {
      setHeader: () => undefined,
      status(code: number) { statusCode = code; return this },
      json(value: unknown) { body = value; return this },
    }
    const limiter = createRateLimiter({ limit:1, key:() => 'unit-test-client' })
    const next = () => undefined
    limiter({ ip:'127.0.0.1' } as any, response as any, next)
    limiter({ ip:'127.0.0.1' } as any, response as any, next)
    expect(statusCode).toBe(429)
    expect(body).toEqual({ error:{ code:'RATE_LIMITED', message:'请求过于频繁，请稍后重试' } })
  })
})
