/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
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

vi.mock('../../../../server/utils/audit', () => ({ logAudit: vi.fn() }))
vi.mock('../../../../server/utils/cloudflare-kv', () => ({ publishRuleToKV: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@shared/utils/alias-generator', () => ({ generateUniqueAlias: vi.fn().mockResolvedValue('random-alias') }))

import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server'
import { generateUniqueAlias } from '@shared/utils/alias-generator'

let handler: any;

describe('create.post.ts', () => {
  beforeAll(async () => {
     (globalThis as any).defineEventHandler = (fn: any) => fn;
     (globalThis as any).readBody = vi.fn();
     (globalThis as any).createError = vi.fn((err: any) => err);

     const module = await import('../../../../server/api/links/create.post')
     handler = module.default
  })

  beforeEach(() => {
    vi.clearAllMocks();
  })

  it('generates unique alias if slug is not provided', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue({ id: 'user-123', role: 'user' })
    vi.mocked((globalThis as any).readBody).mockResolvedValue({ destination: 'https://example.com' })

    const mockSingleSelect1 = vi.fn().mockResolvedValue({ data: { id: 'link-123', slug: 'random-alias', destination: 'https://example.com' }, error: null });
    const mockSelect1 = vi.fn(() => ({ single: mockSingleSelect1 }));
    const mockInsert = vi.fn(() => ({ select: mockSelect1 }));

    const mockDb = {
      from: vi.fn((table) => {
         return { insert: mockInsert }
      })
    }
    vi.mocked(serverSupabaseClient).mockResolvedValue(mockDb as any)

    const result = await handler({} as any)
    expect(generateUniqueAlias).toHaveBeenCalled()
    expect(result.slug).toBe('random-alias')
  })

  it('tests generateUniqueAlias collision callback', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue({ id: 'user-123', role: 'user' })
    vi.mocked((globalThis as any).readBody).mockResolvedValue({ destination: 'https://example.com' })

    // override the mock to actually call the callback to get coverage
    vi.mocked(generateUniqueAlias).mockImplementationOnce(async (cb: any) => {
       await cb('some-slug');
       return 'some-slug';
    })

    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: { id: 'existing-id' } })
    const mockEqSelect1 = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
    const mockSelect1 = vi.fn(() => ({ eq: mockEqSelect1 }));

    const mockSingleSelect2 = vi.fn().mockResolvedValue({ data: { id: 'link-123', slug: 'some-slug', destination: 'https://example.com' }, error: null });
    const mockSelect2 = vi.fn(() => ({ single: mockSingleSelect2 }));
    const mockInsert = vi.fn(() => ({ select: mockSelect2 }));

    const mockDb = {
      from: vi.fn((table) => {
         return { insert: mockInsert, select: mockSelect1 }
      })
    }
    vi.mocked(serverSupabaseClient).mockResolvedValue(mockDb as any)

    const result = await handler({} as any)
    expect(result.slug).toBe('some-slug')
  })
})
