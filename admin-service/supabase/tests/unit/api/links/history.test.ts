/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
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

import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server'

let handler: any;

describe('[id]/history.get.ts', () => {
  beforeAll(async () => {
     (globalThis as any).defineEventHandler = (fn: any) => fn;
     (globalThis as any).getRouterParam = vi.fn();
     (globalThis as any).getQuery = vi.fn();
     (globalThis as any).createError = vi.fn((err: any) => err);

     const module = await import('../../../../server/api/links/[id]/history.get')
     handler = module.default
  })

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).getRouterParam.mockReturnValue('link-123');
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

  it('returns 400 when missing id', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue({ id: 'user-123' })
    vi.mocked((globalThis as any).getRouterParam).mockReturnValue(undefined)
    try {
      await handler({} as any)
    } catch (e: any) {
      expect(e.statusCode).toBe(400)
    }
  })

  it('returns 400 when invalid query', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue({ id: 'user-123' })
    vi.mocked((globalThis as any).getQuery).mockReturnValue({ page: 'invalid' })
    try {
      await handler({} as any)
    } catch (e: any) {
      expect(e.statusCode).toBe(400)
    }
  })

  it('returns data when successful', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue({ id: 'user-123', role: 'user' })

    // First query: fetch link
    const mockSingleSelect1 = vi.fn().mockResolvedValue({ data: { id: 'link-123' }, error: null });
    const mockEqSelect1 = vi.fn(() => ({ single: mockSingleSelect1 }));
    const mockSelect1 = vi.fn(() => ({ eq: mockEqSelect1 }));

    // Second query: fetch log
    const mockRange = vi.fn().mockResolvedValue({ data: [{ action: 'create' }], count: 1, error: null });
    const mockOrder = vi.fn(() => ({ range: mockRange }));
    const mockEqSelect2 = vi.fn(() => ({ order: mockOrder }));
     const mockSelect2 = vi.fn(() => ({ eq: mockEqSelect2 }));

    const mockDb = {
      from: vi.fn((table) => {
         if (table === 'links') {
            return { select: mockSelect1 }
         } else {
            return { select: mockSelect2 }
         }
      })
    }
    vi.mocked(serverSupabaseClient).mockResolvedValue(mockDb as any)

    const result = await handler({} as any)
    expect(result.entries).toEqual([{ action: 'create' }])
    expect(result.total).toBe(1)
  })

  it('returns 404 when link not found', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue({ id: 'user-123', role: 'user' })

    // First query: fetch link
    const mockSingleSelect1 = vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } });
    const mockEqSelect1 = vi.fn(() => ({ single: mockSingleSelect1 }));
    const mockSelect1 = vi.fn(() => ({ eq: mockEqSelect1 }));

    const mockDb = {
      from: vi.fn((table) => {
         return { select: mockSelect1 }
      })
    }
    vi.mocked(serverSupabaseClient).mockResolvedValue(mockDb as any)

    try {
      await handler({} as any)
    } catch (e: any) {
      expect(e.statusCode).toBe(404)
    }
  })

  it('returns 500 when log query fails', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue({ id: 'user-123', role: 'user' })

    // First query: fetch link
    const mockSingleSelect1 = vi.fn().mockResolvedValue({ data: { id: 'link-123' }, error: null });
    const mockEqSelect1 = vi.fn(() => ({ single: mockSingleSelect1 }));
    const mockSelect1 = vi.fn(() => ({ eq: mockEqSelect1 }));

    // Second query: fetch log
    const mockRange = vi.fn().mockResolvedValue({ data: null, count: 0, error: { message: 'db error' } });
    const mockOrder = vi.fn(() => ({ range: mockRange }));
    const mockEqSelect2 = vi.fn(() => ({ order: mockOrder }));
     const mockSelect2 = vi.fn(() => ({ eq: mockEqSelect2 }));

    const mockDb = {
      from: vi.fn((table) => {
         if (table === 'links') {
            return { select: mockSelect1 }
         } else {
            return { select: mockSelect2 }
         }
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

  it('filters by action query parameter correctly', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue({ id: 'user-123', role: 'user' })
    vi.mocked((globalThis as any).getQuery).mockReturnValue({ action: 'create' })

    // First query: fetch link
    const mockSingleSelect1 = vi.fn().mockResolvedValue({ data: { id: 'link-123' }, error: null });
    const mockEqSelect1 = vi.fn(() => ({ single: mockSingleSelect1 }));
    const mockSelect1 = vi.fn(() => ({ eq: mockEqSelect1 }));

    // Second query: fetch log
    const mockRange = vi.fn().mockResolvedValue({ data: [{ action: 'create' }], count: 1, error: null });
    const mockEqAction = vi.fn(() => ({ range: mockRange }));
    const mockOrder = vi.fn(() => ({ eq: mockEqAction, range: mockRange })); // the code calls order(), then optionally eq()
    const mockEqLinkId = vi.fn(() => ({ order: mockOrder }));
    const mockSelect2 = vi.fn(() => ({ eq: mockEqLinkId }));

    const mockDb = {
      from: vi.fn((table) => {
         if (table === 'links') {
            return { select: mockSelect1 }
         } else {
            return { select: mockSelect2 }
         }
      })
    }
    vi.mocked(serverSupabaseClient).mockResolvedValue(mockDb as any)

    const result = await handler({} as any)
    expect(result.entries).toEqual([{ action: 'create' }])
    expect(mockEqAction).toHaveBeenCalledWith('action', 'create')
  })
