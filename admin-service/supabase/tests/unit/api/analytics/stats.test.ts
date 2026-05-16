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

import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server'

let handler: any;

describe('stats.get.ts', () => {
  beforeAll(async () => {
     (globalThis as any).defineEventHandler = (fn: any) => fn;
     (globalThis as any).getQuery = vi.fn();
     (globalThis as any).createError = vi.fn((err: any) => err);

     const module = await import('../../../../server/api/analytics/stats.get')
     handler = module.default
  })

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).getQuery.mockReturnValue({});
  })

  it('returns 401 when unauthorized', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue(null)
    try {
      await handler({} as any)
    } catch (e: any) {
      expect(e.statusCode).toBe(401)
    }
  })

  it('returns stats on success', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue({ id: 'user-123' })

    // For the initial query: .from('analytics_events').select('*').order(...).limit(...)
    const mockLimitEvents = vi.fn().mockResolvedValue({ data: [{ id: 'evt-1' }], error: null });
    const mockOrderEvents = vi.fn(() => ({ limit: mockLimitEvents }));

    // For total clicks: .from('analytics_events').select('*', { count: 'exact', head: true })
    const mockSelectCount = vi.fn().mockResolvedValue({ count: 10, error: null });

    const mockDb = {
      from: vi.fn((table) => {
         return {
            select: vi.fn((selector, options) => {
               if (options && options.count === 'exact') {
                  return mockSelectCount()
               } else {
                  return { order: mockOrderEvents }
               }
            })
         }
      })
    }
    vi.mocked(serverSupabaseClient).mockResolvedValue(mockDb as any)

    const result = await handler({} as any)
    expect(result).toEqual({ events: [{ id: 'evt-1' }], totalClicks: 10 })
  })

  it('returns 500 when events query fails', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue({ id: 'user-123' })
    const mockLimitEvents = vi.fn().mockResolvedValue({ data: null, error: { message: 'db err' } });
    const mockOrderEvents = vi.fn(() => ({ limit: mockLimitEvents }));

    const mockDb = {
      from: vi.fn((table) => {
         return { select: vi.fn(() => ({ order: mockOrderEvents })) }
      })
    }
    vi.mocked(serverSupabaseClient).mockResolvedValue(mockDb as any)

    try {
      await handler({} as any)
    } catch (e: any) {
      expect(e.statusCode).toBe(500)
    }
  })
})
