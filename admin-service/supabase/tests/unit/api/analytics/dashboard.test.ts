/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'

vi.mock('h3', () => ({
  defineEventHandler: (fn: any) => fn,
  getQuery: vi.fn(),
  createError: vi.fn((err: any) => err)
}))

vi.mock('#supabase/server', () => ({
  serverSupabaseClient: vi.fn(),
  serverSupabaseUser: vi.fn()
}))

vi.mock('../../../../server/utils/error-handler', () => ({
  handleError: vi.fn((event, err) => { throw err; }),
  createRequestLogger: vi.fn(() => ({ info: vi.fn(), error: vi.fn() }))
}))

import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server'

let handler: any;

describe('dashboard.get.ts', () => {
  beforeAll(async () => {
     (globalThis as any).defineEventHandler = (fn: any) => fn;
     (globalThis as any).getQuery = vi.fn();
     (globalThis as any).createError = vi.fn((err: any) => err);

     const module = await import('../../../../server/api/analytics/dashboard.get')
     handler = module.default
  })

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).getQuery.mockReturnValue({});
  })

  it('returns 401 when unauthorized', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue(null)
    try {
      await handler({ context: {}, node: { res: { setHeader: vi.fn() } } } as any)
    } catch (e: any) {
      expect(e.statusCode).toBe(401)
    }
  })

  it('returns data when successful', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue({ id: 'user-123' })

    const mockDb = {
      from: vi.fn(() => {
       return {
           select: vi.fn((s, opts) => {
               if (opts?.count) {
                   const gteMock = vi.fn().mockResolvedValue({ count: 5 });
                   const obj = Promise.resolve({ count: 10 }) as any;
                   obj.gte = gteMock;
                   return obj;
               } else {
                   return {
                       gte: vi.fn(() => ({ limit: vi.fn().mockResolvedValue({ data: [{ path: 'test', country: 'US', device_type: 'mobile', browser: 'chrome', timestamp: new Date().toISOString() }] }) }))
                   }
               }
           })
       }
      })
    }

    vi.mocked(serverSupabaseClient).mockResolvedValue(mockDb as any)

    const result = await handler({ context: {}, node: { res: { setHeader: vi.fn() } } } as any)
    expect(result).toHaveProperty('summary')
    expect(result).toHaveProperty('topLinks')
    expect(result).toHaveProperty('geoDistribution')
    expect(result).toHaveProperty('deviceDistribution')
    expect(result).toHaveProperty('browserDistribution')
  })

  it('returns data when raw events are empty', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue({ id: 'user-123' })

    const mockDb = {
      from: vi.fn(() => {
       return {
           select: vi.fn((s, opts) => {
               if (opts?.count) {
                   const gteMock = vi.fn().mockResolvedValue({ count: null });
                   const obj = Promise.resolve({ count: null }) as any;
                   obj.gte = gteMock;
                   return obj;
               } else {
                   return {
                       gte: vi.fn(() => ({ limit: vi.fn().mockResolvedValue({ data: null }) }))
                   }
               }
           })
       }
      })
    }

    vi.mocked(serverSupabaseClient).mockResolvedValue(mockDb as any)

    const result = await handler({ context: {}, node: { res: { setHeader: vi.fn() } } } as any)
    expect(result.summary.totalClicks).toBe(0)
  })

  it('returns 500 when database query fails', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue({ id: 'user-123' })

    const mockDb = {
      from: vi.fn(() => {
         return {
             select: vi.fn((s, opts) => {
                 if (opts?.count) {
                     const gteMock = vi.fn().mockRejectedValue(new Error('db error'));
                     const obj = Promise.reject(new Error('db error')) as any;
                     obj.gte = gteMock;
                     return obj;
                 } else {
                     return {
                         gte: vi.fn(() => ({ limit: vi.fn().mockRejectedValue(new Error('db error')) }))
                     }
                 }
             })
         }
      })
    }
    vi.mocked(serverSupabaseClient).mockResolvedValue(mockDb as any)

    try {
      await handler({ context: {}, node: { res: { setHeader: vi.fn() } } } as any)
    } catch (e: any) {
      expect(e.message).toBe('db error')
    }
  })
})
