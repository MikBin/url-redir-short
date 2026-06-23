/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'

vi.mock('h3', () => ({
  defineEventHandler: (fn: any) => fn,
  readBody: vi.fn(),
  getRouterParam: vi.fn(),
  createError: vi.fn((err: any) => err)
}))

vi.mock('#supabase/server', () => ({
  serverSupabaseClient: vi.fn(),
  serverSupabaseUser: vi.fn()
}))

vi.mock('../../../../server/utils/audit', () => ({ logAudit: vi.fn() }))
vi.mock('../../../../server/utils/transformer', () => ({ transformLink: vi.fn() }))
vi.mock('../../../../server/utils/cloudflare-kv', () => ({ publishRuleToKV: vi.fn().mockResolvedValue(undefined) }))

import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server'

let handler: any;

describe('[id].patch.ts', () => {
  beforeAll(async () => {
     (globalThis as any).defineEventHandler = (fn: any) => fn;
     (globalThis as any).readBody = vi.fn();
     (globalThis as any).getRouterParam = vi.fn();
     (globalThis as any).createError = vi.fn((err: any) => err);

     const module = await import('../../../../server/api/links/[id].patch')
     handler = module.default
  })

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).getRouterParam.mockReturnValue('link-123')
  })

  it('returns 401 when user is not authenticated', async () => {
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

  it('returns 400 when payload is invalid', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue({ id: 'user-123' })
    vi.mocked((globalThis as any).readBody).mockResolvedValue({ destination: 'not-a-url' })
    try {
      await handler({} as any)
    } catch (e: any) {
      expect(e.statusCode).toBe(400)
    }
  })

  it('returns 200 and data on success', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue({ id: 'user-123', role: 'user' })
    vi.mocked((globalThis as any).readBody).mockResolvedValue({ destination: 'https://example.com' })

    const mockSingleSelect = vi.fn().mockResolvedValue({ data: { id: 'link-123' }, error: null });
    const mockEqSelect = vi.fn(() => ({ single: mockSingleSelect }));
    const mockSelect = vi.fn(() => ({ eq: mockEqSelect }));

    const mockSingleUpdate = vi.fn().mockResolvedValue({ data: { id: 'link-123', destination: 'https://example.com' }, error: null });
    const mockSelectUpdate = vi.fn(() => ({ single: mockSingleUpdate }));
    const mockEqUpdate = vi.fn(() => ({ select: mockSelectUpdate }));
    const mockUpdate = vi.fn(() => ({ eq: mockEqUpdate }));

    const mockDb = {
      from: vi.fn(() => ({
          select: mockSelect,
          update: mockUpdate
      }))
    }
    vi.mocked(serverSupabaseClient).mockResolvedValue(mockDb as any)

    const result = await handler({} as any)
    expect(result).toEqual({ id: 'link-123', destination: 'https://example.com' })
  })

  it('returns 500 when database update fails', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue({ id: 'user-123', role: 'user' })
    vi.mocked((globalThis as any).readBody).mockResolvedValue({ destination: 'https://example.com' })

    const mockSingleSelect = vi.fn().mockResolvedValue({ data: { id: 'link-123' }, error: null });
    const mockEqSelect = vi.fn(() => ({ single: mockSingleSelect }));
    const mockSelect = vi.fn(() => ({ eq: mockEqSelect }));

    const mockSingleUpdate = vi.fn().mockResolvedValue({ data: null, error: { message: 'db error' } });
    const mockSelectUpdate = vi.fn(() => ({ single: mockSingleUpdate }));
    const mockEqUpdate = vi.fn(() => ({ select: mockSelectUpdate }));
    const mockUpdate = vi.fn(() => ({ eq: mockEqUpdate }));

    const mockDb = {
      from: vi.fn(() => ({
          select: mockSelect,
          update: mockUpdate
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
    vi.mocked((globalThis as any).readBody).mockResolvedValue({ destination: 'https://example.com' })

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
