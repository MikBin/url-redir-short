// @vitest-environment node
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'

vi.mock('h3', () => ({
  defineEventHandler: (fn: any) => fn,
  createError: vi.fn((err: any) => err)
}))

vi.mock('#supabase/server', () => ({
  serverSupabaseClient: vi.fn(),
  serverSupabaseUser: vi.fn()
}))

import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server'

let handler: any;

describe('overview.get.ts', () => {
  beforeAll(async () => {
     (globalThis as any).defineEventHandler = (fn: any) => fn;
     (globalThis as any).createError = vi.fn((err: any) => err);

     const module = await import('../../../../server/api/analytics/links/overview.get')
     handler = module.default
  })

  beforeEach(() => {
    vi.clearAllMocks();
  })

  it('returns 401 when unauthorized', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue(null)
    try {
      await handler({ context: {} } as any)
    } catch (e: any) {
      expect(e.statusCode).toBe(401)
    }
  })

  it('returns empty object when query fails', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue({ id: 'user-123' })

    const mockDb = {
      from: vi.fn(() => ({
         select: vi.fn().mockResolvedValue({ data: null, error: { message: 'db error' } })
      }))
    }
    vi.mocked(serverSupabaseClient).mockResolvedValue(mockDb as any)

    const result = await handler({ context: {} } as any)
    expect(result).toEqual({})
  })

  it('returns data when successful', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue({ id: 'user-123' })

    const mockDb = {
      from: vi.fn(() => ({
         select: vi.fn().mockResolvedValue({
            data: [
               { link_id: 'link1', total_clicks: 5 },
               { link_id: 'link2', total_clicks: '10' }
            ],
            error: null
         })
      }))
    }
    vi.mocked(serverSupabaseClient).mockResolvedValue(mockDb as any)

    const result = await handler({ context: {} } as any)
    expect(result).toEqual({ link1: 5, link2: 10 })
  })
})
