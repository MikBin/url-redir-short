// @vitest-environment node
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'

vi.mock('h3', () => ({
  defineEventHandler: (fn: any) => fn,
  getRouterParam: vi.fn(),
  createError: vi.fn((err: any) => err),
  sendNoContent: vi.fn()
}))

vi.mock('#supabase/server', () => ({
  serverSupabaseClient: vi.fn(),
  serverSupabaseUser: vi.fn()
}))

vi.mock('../../../../server/utils/audit', () => ({ logAudit: vi.fn() }))
vi.mock('../../../../server/utils/cloudflare-kv', () => ({ deleteRuleFromKV: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../../../../server/utils/transformer', () => ({ transformLink: vi.fn(() => ({ path: 'some-path' })) }))

import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server'

let handler: any;

describe('[id].delete.ts', () => {
  beforeAll(async () => {
     (globalThis as any).defineEventHandler = (fn: any) => fn;
     (globalThis as any).getRouterParam = vi.fn();
     (globalThis as any).createError = vi.fn((err: any) => err);

     const module = await import('../../../../server/api/links/[id].delete')
     handler = module.default
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked((globalThis as any).getRouterParam).mockReturnValue('link-123')
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

  it('calls delete and returns success on success', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue({ id: 'user-123', role: 'user' })

    const mockEqDelete = vi.fn().mockResolvedValue({ error: null });
    const mockDelete = vi.fn(() => ({ eq: mockEqDelete }))

    const mockSingleSelect = vi.fn().mockResolvedValue({ data: { id: 'link-123' }, error: null });
    const mockEqSelect = vi.fn(() => ({ single: mockSingleSelect }));
    const mockSelect = vi.fn(() => ({ eq: mockEqSelect }));

    const mockDb = {
      from: vi.fn(() => ({
          select: mockSelect,
          delete: mockDelete
      }))
    }
    vi.mocked(serverSupabaseClient).mockResolvedValue(mockDb as any)

    const result = await handler({} as any)
    expect(result).toEqual({ success: true })
  })

  it('returns 500 when database delete fails', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue({ id: 'user-123', role: 'user' })

    const mockEqDelete = vi.fn().mockResolvedValue({ error: { message: 'db error' } });
    const mockDelete = vi.fn(() => ({ eq: mockEqDelete }))

    const mockSingleSelect = vi.fn().mockResolvedValue({ data: { id: 'link-123' }, error: null });
    const mockEqSelect = vi.fn(() => ({ single: mockSingleSelect }));
    const mockSelect = vi.fn(() => ({ eq: mockEqSelect }));

    const mockDb = {
      from: vi.fn(() => ({
          select: mockSelect,
          delete: mockDelete
      }))
    }
    vi.mocked(serverSupabaseClient).mockResolvedValue(mockDb as any)

    try {
      await handler({} as any)
    } catch (e: any) {
      expect(e.statusCode).toBe(500)
    }
  })

  it('returns 404 when item not found during fetch', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue({ id: 'user-123', role: 'user' })

    const mockSingleSelect = vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } });
    const mockEqSelect = vi.fn(() => ({ single: mockSingleSelect }));
    const mockSelect = vi.fn(() => ({ eq: mockEqSelect }));

    const mockDb = {
      from: vi.fn(() => ({
          select: mockSelect
      }))
    }
    vi.mocked(serverSupabaseClient).mockResolvedValue(mockDb as any)

    try {
      await handler({} as any)
    } catch (e: any) {
      expect(e.statusCode).toBe(404)
    }
  })
})
