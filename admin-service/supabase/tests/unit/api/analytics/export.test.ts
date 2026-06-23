/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'

vi.mock('h3', () => ({
  defineEventHandler: (fn: any) => fn,
  getRouterParam: vi.fn(),
  getQuery: vi.fn(),
  createError: vi.fn((err: any) => err),
  setResponseHeader: vi.fn(),
  setResponseStatus: vi.fn()
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
import { setResponseHeader, setResponseStatus } from 'h3'

let handler: any;

describe('export/[format].get.ts', () => {
  beforeAll(async () => {
     (globalThis as any).defineEventHandler = (fn: any) => fn;
     (globalThis as any).getRouterParam = vi.fn();
     (globalThis as any).getQuery = vi.fn();
     (globalThis as any).createError = vi.fn((err: any) => err);

     const module = await import('../../../../server/api/analytics/export/[format].get')
     handler = module.default
  })

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).getRouterParam.mockReturnValue('csv');
    (globalThis as any).getQuery.mockReturnValue({});
  })

  it('returns 401 when unauthorized', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue(null)
    try {
      await handler({ context: {} } as any)
    } catch (e: any) {
      expect(e.statusCode).toBe(401)
    }
  })

  it('returns 400 when format is unsupported', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue({ id: 'user-123' })
    vi.mocked((globalThis as any).getRouterParam).mockReturnValue('xml')
    try {
      await handler({ context: {} } as any)
    } catch (e: any) {
      expect(e.statusCode).toBe(400)
    }
  })

  it('returns 500 when database fails', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue({ id: 'user-123' })

    const mockLimit = vi.fn().mockResolvedValue({ data: null, error: { message: 'db error' } });
    const mockOrder = vi.fn(() => ({ limit: mockLimit }));
    const mockLte = vi.fn(() => ({ order: mockOrder }));
    const mockGte = vi.fn(() => ({ lte: mockLte }));
    const mockSelect = vi.fn(() => ({ gte: mockGte }));

    const mockDb = {
      from: vi.fn(() => ({
         select: mockSelect
      }))
    }
    vi.mocked(serverSupabaseClient).mockResolvedValue(mockDb as any)

    try {
      await handler({ context: {} } as any)
    } catch (e: any) {
      expect(e.statusCode).toBe(500)
    }
  })

  it('returns 404 when link not found', async () => {
     vi.mocked(serverSupabaseUser).mockResolvedValue({ id: 'user-123' })
     vi.mocked((globalThis as any).getQuery).mockReturnValue({ linkId: '123e4567-e89b-12d3-a456-426614174000' })

     const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } });
     const mockEqLink = vi.fn(() => ({ single: mockSingle }));
     const mockSelectLink = vi.fn(() => ({ eq: mockEqLink }));

     const mockLimit = vi.fn().mockResolvedValue({ data: [], error: null });
     const mockOrder = vi.fn(() => ({ limit: mockLimit }));
     const mockLte = vi.fn(() => ({ order: mockOrder }));
     const mockGte = vi.fn(() => ({ lte: mockLte }));
     const mockSelectEvents = vi.fn(() => ({ gte: mockGte }));

     const mockDb = {
       from: vi.fn((table) => {
          if (table === 'links') return { select: mockSelectLink }
          return { select: mockSelectEvents }
       })
     }
     vi.mocked(serverSupabaseClient).mockResolvedValue(mockDb as any)

     try {
       await handler({ context: {} } as any)
     } catch (e: any) {
       expect(e.statusCode).toBe(404)
     }
  })

  it('returns 403 when user does not own linkId', async () => {
     vi.mocked(serverSupabaseUser).mockResolvedValue({ id: 'user-123' })
     vi.mocked((globalThis as any).getQuery).mockReturnValue({ linkId: '123e4567-e89b-12d3-a456-426614174000' })

     const mockSingle = vi.fn().mockResolvedValue({ data: { owner_id: 'other-user', slug: 'link' }, error: null });
     const mockEqLink = vi.fn(() => ({ single: mockSingle }));
     const mockSelectLink = vi.fn(() => ({ eq: mockEqLink }));

     const mockLimit = vi.fn().mockResolvedValue({ data: [], error: null });
     const mockOrder = vi.fn(() => ({ limit: mockLimit }));
     const mockLte = vi.fn(() => ({ order: mockOrder }));
     const mockGte = vi.fn(() => ({ lte: mockLte }));
     const mockSelectEvents = vi.fn(() => ({ gte: mockGte }));

     const mockDb = {
       from: vi.fn((table) => {
          if (table === 'links') return { select: mockSelectLink }
          return { select: mockSelectEvents }
       })
     }
     vi.mocked(serverSupabaseClient).mockResolvedValue(mockDb as any)

     try {
       await handler({ context: {} } as any)
     } catch (e: any) {
       expect(e.statusCode).toBe(403)
     }
  })

  it('filters by linkId correctly and returns data', async () => {
     vi.mocked(serverSupabaseUser).mockResolvedValue({ id: 'user-123' })
     vi.mocked((globalThis as any).getQuery).mockReturnValue({ linkId: '123e4567-e89b-12d3-a456-426614174000', from: '2023-01-01T00:00:00Z', to: '2023-01-31T00:00:00Z' })

     const mockSingle = vi.fn().mockResolvedValue({ data: { owner_id: 'user-123', slug: 'link' }, error: null });
     const mockEqLink = vi.fn(() => ({ single: mockSingle }));
     const mockSelectLink = vi.fn(() => ({ eq: mockEqLink }));

     const mockLimit = vi.fn().mockResolvedValue({ data: [{ id: '1' }], error: null });
     const mockOrder = vi.fn(() => ({ limit: mockLimit }));
     const mockLte = vi.fn(() => ({ order: mockOrder }));
     const mockGte = vi.fn(() => ({ lte: mockLte }));
     const mockEqPath = vi.fn(() => ({ gte: mockGte }));
     const mockSelectEvents = vi.fn(() => ({ eq: mockEqPath, gte: mockGte })); // It calls eq('path', ...) then gte, lte, order, limit. Wait, the code calls select, gte, lte, order, limit, THEN optionally eq.
     // In the code: queryBuilder = queryBuilder.eq('path', path)
     // So limit() returns the queryBuilder. eq() is called on the object returned by limit()

     const mockEqEvents = vi.fn().mockResolvedValue({ data: [{ id: '1', path: 'link' }], error: null })
     mockLimit.mockReturnValue({ eq: mockEqEvents })

     const mockDb = {
       from: vi.fn((table) => {
          if (table === 'links') return { select: mockSelectLink }
          return { select: mockSelectEvents }
       })
     }
     vi.mocked(serverSupabaseClient).mockResolvedValue(mockDb as any)

     const setHeaderMock = vi.fn()
     const result = await handler({ context: {}, node: { res: { setHeader: setHeaderMock } } } as any)
     expect(result).toContain('link')
  })

  it('returns csv data successfully', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue({ id: 'user-123' })
    const mockData = [
       { id: '1', path: 'path1', created_at: '2023-01-01', browser: 'chrome', country: 'US', os: 'mac', device_type: 'desktop', user_agent: 'agent' },
       { id: '2', path: 'p,2' } // tests escaping
    ]

    const mockLimit = vi.fn().mockResolvedValue({ data: mockData, error: null });
    const mockOrder = vi.fn(() => ({ limit: mockLimit }));
    const mockLte = vi.fn(() => ({ order: mockOrder }));
    const mockGte = vi.fn(() => ({ lte: mockLte }));
    const mockSelect = vi.fn(() => ({ gte: mockGte }));

    const mockDb = {
      from: vi.fn(() => ({
         select: mockSelect
      }))
    }
    vi.mocked(serverSupabaseClient).mockResolvedValue(mockDb as any)

    const setHeaderMock = vi.fn()
    const result = await handler({ context: {}, node: { res: { setHeader: setHeaderMock } } } as any)

    expect(setHeaderMock).toHaveBeenCalledWith('Content-Type', 'text/csv')
    expect(setHeaderMock).toHaveBeenCalledWith('Content-Disposition', expect.stringContaining('attachment; filename="analytics-export-'))
    expect(result).toContain('id,path,destination,timestamp,country')
    expect(result).toContain('path1')
    expect(result).toContain('"p,2"')
  })

  it('returns json data successfully', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue({ id: 'user-123' })
    vi.mocked((globalThis as any).getRouterParam).mockReturnValue('json')
    const mockData = [
       { id: '1', path: 'path1' }
    ]
    const mockLimit = vi.fn().mockResolvedValue({ data: mockData, error: null });
    const mockOrder = vi.fn(() => ({ limit: mockLimit }));
    const mockLte = vi.fn(() => ({ order: mockOrder }));
    const mockGte = vi.fn(() => ({ lte: mockLte }));
    const mockSelect = vi.fn(() => ({ gte: mockGte }));

    const mockDb = {
      from: vi.fn(() => ({
         select: mockSelect
      }))
    }
    vi.mocked(serverSupabaseClient).mockResolvedValue(mockDb as any)

    const setHeaderMock = vi.fn()
    const result = await handler({ context: {}, node: { res: { setHeader: setHeaderMock } } } as any)

    expect(setHeaderMock).toHaveBeenCalledWith('Content-Type', 'application/json')
    expect(result.data).toEqual(mockData)
  })

  it('returns No data available when empty', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue({ id: 'user-123' })

    const mockLimit = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockOrder = vi.fn(() => ({ limit: mockLimit }));
    const mockLte = vi.fn(() => ({ order: mockOrder }));
    const mockGte = vi.fn(() => ({ lte: mockLte }));
    const mockSelect = vi.fn(() => ({ gte: mockGte }));

    const mockDb = {
      from: vi.fn(() => ({
         select: mockSelect
      }))
    }
    vi.mocked(serverSupabaseClient).mockResolvedValue(mockDb as any)

    const setHeaderMock = vi.fn()
    const result = await handler({ context: {}, node: { res: { setHeader: setHeaderMock } } } as any)

    expect(result).toBe('No data available')
  })
})

  it('returns 400 when query parameters are invalid', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue({ id: 'user-123' })
    vi.mocked((globalThis as any).getRouterParam).mockReturnValue('csv')

    // Provide an invalid from date format to trigger Zod parsing error on lines 22-23
    vi.mocked((globalThis as any).getQuery).mockReturnValue({ from: 'invalid-date' })

    try {
      await handler({ context: {} } as any)
      expect.fail('Should have thrown')
    } catch (e: any) {
      expect(e.statusCode).toBe(400)
      expect(e.statusMessage).toBe('Invalid query parameters')
    }
  })
