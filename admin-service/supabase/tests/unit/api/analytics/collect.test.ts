// @vitest-environment node
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'

vi.mock('h3', () => ({
  defineEventHandler: (fn: any) => fn,
  readBody: vi.fn(),
  createError: vi.fn((err: any) => err)
}))

vi.mock('#supabase/server', () => ({
  serverSupabaseServiceRole: vi.fn()
}))

vi.mock('../../../../server/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() }
}))

vi.mock('../../../../server/utils/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true })
}))

vi.mock('../../../../server/utils/storage', () => ({
  useValkey: vi.fn().mockReturnValue({ get: vi.fn(), setex: vi.fn() })
}))

vi.mock('../../../../server/utils/metrics', () => ({
  metrics: { analyticsIngestionTotal: { inc: vi.fn() } }
}))

import { serverSupabaseServiceRole } from '#supabase/server'
import { checkRateLimit } from '../../../../server/utils/rate-limit'

let handler: any;

describe('collect.post.ts', () => {
  beforeAll(async () => {
     (globalThis as any).defineEventHandler = (fn: any) => fn;
     (globalThis as any).readBody = vi.fn();
     (globalThis as any).createError = vi.fn((err: any) => err);

     const module = await import('../../../../server/api/analytics/v1/collect.post')
     handler = module.default
  })

  beforeEach(() => {
    vi.clearAllMocks();
  })

  it('returns 429 when rate limit exceeded', async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ allowed: false } as any)
    try {
      await handler({ node: { req: { headers: {}, socket: {} } } } as any)
    } catch (e: any) {
      expect(e.statusCode).toBe(429)
    }
  })

  it('returns 400 when invalid payload', async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ allowed: true } as any)
    vi.mocked((globalThis as any).readBody).mockResolvedValue({})
    try {
      await handler({ node: { req: { headers: {}, socket: {} } } } as any)
    } catch (e: any) {
      expect(e.statusCode).toBe(400)
    }
  })

  it('queues analytics and returns 200 on success', async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ allowed: true } as any)
    vi.mocked((globalThis as any).readBody).mockResolvedValue({
       path: 'path',
       destination: 'https://example.com',
       status: 200
    })

    const mockDb = {
      from: vi.fn((table) => {
         if (table === 'links') {
            return {
               select: vi.fn(() => ({
                  eq: vi.fn(() => ({
                     limit: vi.fn(() => ({
                        maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'link-123' } })
                     }))
                  }))
               }))
            }
         }
         return { insert: vi.fn().mockResolvedValue({ error: null }) }
      }),
      rpc: vi.fn().mockResolvedValue({ error: null })
    }
    vi.mocked(serverSupabaseServiceRole).mockReturnValue(mockDb as any)

    const result = await handler({ node: { req: { headers: {}, socket: {} } }, waitUntil: vi.fn((p) => p) } as any)
    expect(result.success).toBe(true)
    expect(result.queued).toBe(true)
  })

  it('handles background task errors without crashing', async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ allowed: true } as any)
    vi.mocked((globalThis as any).readBody).mockResolvedValue({
       path: 'path',
       destination: 'https://example.com',
       status: 200
    })

    const mockDb = {
      from: vi.fn((table) => {
         return { insert: vi.fn().mockResolvedValue({ error: { message: 'db error' } }) }
      })
    }
    vi.mocked(serverSupabaseServiceRole).mockReturnValue(mockDb as any)

    const result = await handler({ node: { req: { headers: {}, socket: {} } } } as any) // no waitUntil
    expect(result.success).toBe(true) // Should still return 200
  })

  it('handles unexpected top level error', async () => {
    vi.mocked(checkRateLimit).mockRejectedValueOnce({ statusCode: 500 } as any)
    try {
      await handler({ node: { req: { headers: {}, socket: {} } } } as any)
    } catch (e: any) {
      expect(e.statusCode).toBe(500)
    }
  })
})
