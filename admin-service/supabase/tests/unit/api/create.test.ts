// @vitest-environment node
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'

// Create standalone mock file to bypass h3 defineEventHandler errors
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
vi.mock('../../../server/utils/transformer', () => ({ transformLink: vi.fn() }))
vi.mock('../../../server/utils/cloudflare-kv', () => ({ publishRuleToKV: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@shared/utils/alias-generator', () => ({ generateUniqueAlias: vi.fn().mockResolvedValue('unique-alias') }))

import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server'

let handler: any;

describe('create.post.ts', () => {
  beforeAll(async () => {
     (globalThis as any).defineEventHandler = (fn: any) => fn;
     (globalThis as any).readBody = vi.fn();
     (globalThis as any).createError = vi.fn((err: any) => err);

     const module = await import('../../../server/api/links/create.post')
     handler = module.default
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when user is not authenticated', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue(null)
    try {
      await handler({} as any)
    } catch (e: any) {
      expect(e.statusCode).toBe(401)
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
    vi.mocked((globalThis as any).readBody).mockResolvedValue({ destination: 'https://example.com', slug: 'my-slug' })

    const mockDb = {
      from: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'link-123' }, error: null })
    }
    vi.mocked(serverSupabaseClient).mockResolvedValue(mockDb as any)

    const result = await handler({} as any)
    expect(result).toEqual({ id: 'link-123' })
  })

  it('returns 500 when database insert fails', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue({ id: 'user-123', role: 'user' })
    vi.mocked((globalThis as any).readBody).mockResolvedValue({ destination: 'https://example.com', slug: 'my-slug' })

    const mockDb = {
      from: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'db error' } })
    }
    vi.mocked(serverSupabaseClient).mockResolvedValue(mockDb as any)

    try {
      await handler({} as any)
    } catch (e: any) {
      expect(e.statusCode).toBe(500)
      expect(e.statusMessage).toBe('db error')
    }
  })
})
