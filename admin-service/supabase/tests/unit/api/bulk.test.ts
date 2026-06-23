/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'

vi.mock('h3', () => ({
  defineEventHandler: (fn: any) => fn,
  readBody: vi.fn(),
  createError: vi.fn((err: any) => err)
}))

vi.mock('#supabase/server', () => ({
  serverSupabaseClient: vi.fn(),
  serverSupabaseUser: vi.fn()
}))

vi.mock('../../../server/utils/audit', () => ({ logAudit: vi.fn() }))

import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server'

let handler: any;

describe('bulk.post.ts', () => {
  beforeAll(async () => {
     (globalThis as any).defineEventHandler = (fn: any) => fn;
     (globalThis as any).readBody = vi.fn();
     (globalThis as any).createError = vi.fn((err: any) => err);

     const module = await import('../../../server/api/bulk.post')
     handler = module.default
  })

  beforeEach(() => {
    vi.clearAllMocks();
  })

  it('returns 401 when unauthorized', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue(null)
    try {
      await handler({} as any)
    } catch (e: any) {
      expect(e.statusCode).toBe(401)
    }
  })

  it('returns success 0 and failed items when all invalid', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue({ id: 'user-123' })
    vi.mocked((globalThis as any).readBody).mockResolvedValue({ links: [{ destination: 'not-a-url' }] }) // missing slug

    const result = await handler({} as any)
    expect(result.success).toBe(0)
    expect(result.failed).toBe(1)
  })

  it('returns 400 when body is invalid', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue({ id: 'user-123' })
    vi.mocked((globalThis as any).readBody).mockResolvedValue("invalid-body")

    try {
      await handler({} as any)
    } catch (e: any) {
      expect(e.statusCode).toBe(400)
    }
  })

  it('inserts valid items and returns success', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue({ id: 'user-123', role: 'user' })
    vi.mocked((globalThis as any).readBody).mockResolvedValue([{ slug: 'slug-1', destination: 'https://example.com' }])

    const mockSelect = vi.fn().mockResolvedValue({ data: [{ id: 'new-id' }], error: null });
    const mockUpsert = vi.fn(() => ({ select: mockSelect }));
    const mockDb = {
      from: vi.fn(() => ({
          upsert: mockUpsert
      }))
    }
    vi.mocked(serverSupabaseClient).mockResolvedValue(mockDb as any)

    const result = await handler({} as any)
    expect(result.success).toBe(1)
    expect(result.failed).toBe(0)
  })

  it('returns 400 wrapping 500 when database insert fails', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue({ id: 'user-123', role: 'user' })
    vi.mocked((globalThis as any).readBody).mockResolvedValue([{ slug: 'slug-1', destination: 'https://example.com' }])

    const mockSelect = vi.fn().mockResolvedValue({ data: null, error: { message: 'db error' } });
    const mockUpsert = vi.fn(() => ({ select: mockSelect }));
    const mockDb = {
      from: vi.fn(() => ({
          upsert: mockUpsert
      }))
    }
    vi.mocked(serverSupabaseClient).mockResolvedValue(mockDb as any)

    try {
      await handler({} as any)
    } catch (e: any) {
      expect(e.statusCode).toBe(400)
    }
  })
})

  it('handles partial success where some data is ignored/null', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue({ id: 'user-123', role: 'user' })
    vi.mocked((globalThis as any).readBody).mockResolvedValue([{ slug: 'slug-1', destination: 'https://example.com' }, { destination: 'invalid' }])

    // Mock where data is null
    const mockSelect = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockUpsert = vi.fn(() => ({ select: mockSelect }));
    const mockDb = {
      from: vi.fn(() => ({
          upsert: mockUpsert
      }))
    }
    vi.mocked(serverSupabaseClient).mockResolvedValue(mockDb as any)

    const result = await handler({} as any)
    expect(result.success).toBe(0)
    expect(result.failed).toBe(1)
  })
