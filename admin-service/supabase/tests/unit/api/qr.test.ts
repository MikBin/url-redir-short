/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'

vi.mock('h3', () => ({
  defineEventHandler: (fn: any) => fn,
  getQuery: vi.fn(),
  createError: vi.fn((err: any) => err),
  setResponseHeader: vi.fn(),
  send: vi.fn()
}))

vi.mock('#supabase/server', () => ({
  serverSupabaseClient: vi.fn(),
  serverSupabaseUser: vi.fn()
}))

vi.mock('../../../server/utils/qr', () => ({
  generateQRCode: vi.fn()
}))

import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server'
import { setResponseHeader, send, getQuery } from 'h3'
import { generateQRCode } from '../../../server/utils/qr'

let handler: any;

describe('qr.get.ts', () => {
  beforeAll(async () => {
     (globalThis as any).defineEventHandler = (fn: any) => fn;
     (globalThis as any).getQuery = vi.fn();
     (globalThis as any).createError = vi.fn((err: any) => err);

     const module = await import('../../../server/api/qr.get')
     handler = module.default
  })

  beforeEach(() => {
    vi.clearAllMocks();
  })

  it('returns 401 when unauthorized', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue(null)
    try {
      await handler({ context: {}, node: { res: { setHeader: vi.fn() } } } as any)
    } catch (e: any) {
      expect(e.statusCode).toBe(401)
    }
  })

  it('returns 400 when missing text', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue({ id: 'user-123' })
    vi.mocked((globalThis as any).getQuery).mockReturnValue({})
    try {
      await handler({ context: {}, node: { res: { setHeader: vi.fn() } } } as any)
    } catch (e: any) {
      expect(e.statusCode).toBe(400)
    }
  })

  it('generates and returns qr code data URL', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue({ id: 'user-123' })
    vi.mocked((globalThis as any).getQuery).mockReturnValue({ text: 'https://example.com' })
    vi.mocked(generateQRCode).mockResolvedValue('data:image/png;base64,mock')

    const result = await handler({ context: {}, node: { res: { setHeader: vi.fn() } } } as any)

    expect(result).toBe('data:image/png;base64,mock')
  })

  it('passes options correctly', async () => {
     vi.mocked(serverSupabaseUser).mockResolvedValue({ id: 'user-123' })
     vi.mocked((globalThis as any).getQuery).mockReturnValue({ text: 'https://example.com', width: '200', margin: '2', color: '#ff0000', bgcolor: '#ffffff' })
     vi.mocked(generateQRCode).mockResolvedValue('mock')

     await handler({ context: {}, node: { res: { setHeader: vi.fn() } } } as any)
     expect(generateQRCode).toHaveBeenCalledWith(
        'https://example.com',
        { width: 200, margin: 2, color: { dark: '#ff0000', light: '#ffffff' } }
     )
  })

  it('handles error during generation', async () => {
    vi.mocked(serverSupabaseUser).mockResolvedValue({ id: 'user-123' })
    vi.mocked((globalThis as any).getQuery).mockReturnValue({ text: 'https://example.com' })
    vi.mocked(generateQRCode).mockRejectedValue(new Error('gen error'))

    try {
      await handler({ context: {}, node: { res: { setHeader: vi.fn() } } } as any)
    } catch (e: any) {
      expect(e.statusCode).toBe(500)
    }
  })
})
