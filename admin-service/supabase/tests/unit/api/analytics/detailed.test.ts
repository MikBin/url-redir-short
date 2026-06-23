/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'

vi.mock('h3', () => ({
  defineEventHandler: (fn: any) => fn,
  getRouterParam: vi.fn(),
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

describe('detailed.get.ts', () => {
  beforeAll(async () => {
     (globalThis as any).defineEventHandler = (fn: any) => fn;
     (globalThis as any).getRouterParam = vi.fn();
     (globalThis as any).getQuery = vi.fn();
     (globalThis as any).createError = vi.fn((err: any) => err);

     const module = await import('../../../../server/api/analytics/links/[linkId]/detailed.get')
     handler = module.default
  })

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).getRouterParam.mockReturnValue('123e4567-e89b-12d3-a456-426614174000');
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

  it('returns 400 when missing link ID', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue({ id: 'user-123' })
    vi.mocked((globalThis as any).getRouterParam).mockReturnValue(undefined)
    try {
      await handler({ context: {}, node: { res: { setHeader: vi.fn() } } } as any)
    } catch (e: any) {
      expect(e.statusCode).toBe(400)
    }
  })

  it('returns 400 when invalid query params', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue({ id: 'user-123' })
    vi.mocked((globalThis as any).getQuery).mockReturnValue({ from: 'invalid-date' })
    try {
      await handler({ context: {}, node: { res: { setHeader: vi.fn() } } } as any)
    } catch (e: any) {
      expect(e.statusCode).toBe(400)
    }
  })

  it('returns 404 when link not found', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue({ id: 'user-123' })

    const mockDb = {
      from: vi.fn(() => ({
         select: vi.fn(() => ({
            eq: vi.fn(() => ({
               single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } })
            }))
         }))
      }))
    }
    vi.mocked(serverSupabaseClient).mockResolvedValue(mockDb as any)

    try {
      await handler({ context: {}, node: { res: { setHeader: vi.fn() } } } as any)
    } catch (e: any) {
      expect(e.statusCode).toBe(404)
    }
  })

  it('returns 403 when user does not own link', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue({ id: 'user-123' })

    const mockDb = {
      from: vi.fn(() => ({
         select: vi.fn(() => ({
            eq: vi.fn(() => ({
               single: vi.fn().mockResolvedValue({ data: { owner_id: 'other-user' }, error: null })
            }))
         }))
      }))
    }
    vi.mocked(serverSupabaseClient).mockResolvedValue(mockDb as any)

    try {
      await handler({ context: {}, node: { res: { setHeader: vi.fn() } } } as any)
    } catch (e: any) {
      expect(e.statusCode).toBe(403)
    }
  })

  it('returns data when successful', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue({ id: 'user-123' })

    const mockDb = {
      from: vi.fn(() => ({
         select: vi.fn(() => ({
            eq: vi.fn(() => ({
               single: vi.fn().mockResolvedValue({ data: { owner_id: 'user-123', id: 'link-1', slug: 's', destination: 'd' }, error: null })
            }))
         }))
      })),
      rpc: vi.fn().mockResolvedValue({
         data: {
             total_clicks: 10,
             unique_visitors: 5,
             time_series: [],
             countries: [],
             cities: [],
             devices: [],
             browsers: [],
             operating_systems: [],
             referrers: []
         },
         error: null
      })
    }
    vi.mocked(serverSupabaseClient).mockResolvedValue(mockDb as any)

    const setHeaderMock = vi.fn();
    const result = await handler({ context: {}, node: { res: { setHeader: setHeaderMock } } } as any)

    expect(result.summary.totalClicks).toBe(10)
    expect(setHeaderMock).toHaveBeenCalledWith('Cache-Control', 'private, max-age=60')
  })

  it('sets 1 hr cache for historical data', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue({ id: 'user-123' })
    // Query specifying a To date in the past
    vi.mocked((globalThis as any).getQuery).mockReturnValue({ to: new Date(Date.now() - 48 * 3600 * 1000).toISOString() })

    const mockDb = {
      from: vi.fn(() => ({
         select: vi.fn(() => ({
            eq: vi.fn(() => ({
               single: vi.fn().mockResolvedValue({ data: { owner_id: 'user-123', id: 'link-1', slug: 's', destination: 'd' }, error: null })
            }))
         }))
      })),
      rpc: vi.fn().mockResolvedValue({ data: {}, error: null })
    }
    vi.mocked(serverSupabaseClient).mockResolvedValue(mockDb as any)

    const setHeaderMock = vi.fn();
    await handler({ context: {}, node: { res: { setHeader: setHeaderMock } } } as any)

    expect(setHeaderMock).toHaveBeenCalledWith('Cache-Control', 'private, max-age=3600')
  })

  it('returns 500 when rpc fails', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue({ id: 'user-123' })

    const mockDb = {
      from: vi.fn(() => ({
         select: vi.fn(() => ({
            eq: vi.fn(() => ({
               single: vi.fn().mockResolvedValue({ data: { owner_id: 'user-123' }, error: null })
            }))
         }))
      })),
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'rpc error' } })
    }
    vi.mocked(serverSupabaseClient).mockResolvedValue(mockDb as any)

    try {
      await handler({ context: {}, node: { res: { setHeader: vi.fn() } } } as any)
    } catch (e: any) {
      expect(e.statusCode).toBe(500)
    }
  })
})
