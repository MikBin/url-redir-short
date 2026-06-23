/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../server/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}))

describe('cloudflare-kv.ts', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = process.env
    process.env = { ...originalEnv }
    vi.resetModules()
    globalThis.fetch = vi.fn() as any
  })

  it('skips operations if config is missing', async () => {
    delete process.env.CF_ACCOUNT_ID

    const { publishRuleToKV, deleteRuleFromKV } = await import('../../../server/utils/cloudflare-kv')

    await publishRuleToKV({ path: '/test', destination: 'https://example.com' } as any)
    await deleteRuleFromKV('/test')

    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('publishes rule to KV successfully', async () => {
    process.env.CF_ACCOUNT_ID = 'account-1'
    process.env.CF_KV_NAMESPACE_ID = 'ns-1'
    process.env.CF_API_TOKEN = 'token-1'

    vi.mocked(globalThis.fetch).mockResolvedValue({ ok: true } as any)

    const { publishRuleToKV } = await import('../../../server/utils/cloudflare-kv')
    await publishRuleToKV({ path: '/test', destination: 'https://example.com' } as any)

    expect(globalThis.fetch).toHaveBeenCalledWith(
       expect.stringContaining('https://api.cloudflare.com/client/v4/accounts/account-1/storage/kv/namespaces/ns-1/values/%2Ftest'),
       expect.objectContaining({ method: 'PUT' })
    )
  })

  it('handles publish warning if not ok', async () => {
    process.env.CF_ACCOUNT_ID = 'account-1'
    process.env.CF_KV_NAMESPACE_ID = 'ns-1'
    process.env.CF_API_TOKEN = 'token-1'

    vi.mocked(globalThis.fetch).mockResolvedValue({ ok: false, text: vi.fn().mockResolvedValue('error text'), status: 400 } as any)

    const { publishRuleToKV } = await import('../../../server/utils/cloudflare-kv')
    await publishRuleToKV({ path: '/test', destination: 'https://example.com' } as any)

    // We expect it to finish without throwing because it is fire-and-forget
    expect(globalThis.fetch).toHaveBeenCalled()
  })

  it('handles publish network error', async () => {
    process.env.CF_ACCOUNT_ID = 'account-1'
    process.env.CF_KV_NAMESPACE_ID = 'ns-1'
    process.env.CF_API_TOKEN = 'token-1'

    vi.mocked(globalThis.fetch).mockRejectedValue(new Error('Network error'))

    const { publishRuleToKV } = await import('../../../server/utils/cloudflare-kv')
    await publishRuleToKV({ path: '/test', destination: 'https://example.com' } as any)

    // We expect it to finish without throwing
    expect(globalThis.fetch).toHaveBeenCalled()
  })

  it('deletes rule from KV successfully', async () => {
    process.env.CF_ACCOUNT_ID = 'account-1'
    process.env.CF_KV_NAMESPACE_ID = 'ns-1'
    process.env.CF_API_TOKEN = 'token-1'

    vi.mocked(globalThis.fetch).mockResolvedValue({ ok: true } as any)

    const { deleteRuleFromKV } = await import('../../../server/utils/cloudflare-kv')
    await deleteRuleFromKV('/test')

    expect(globalThis.fetch).toHaveBeenCalledWith(
       expect.stringContaining('https://api.cloudflare.com/client/v4/accounts/account-1/storage/kv/namespaces/ns-1/values/%2Ftest'),
       expect.objectContaining({ method: 'DELETE' })
    )
  })

  it('handles delete warning if not ok', async () => {
    process.env.CF_ACCOUNT_ID = 'account-1'
    process.env.CF_KV_NAMESPACE_ID = 'ns-1'
    process.env.CF_API_TOKEN = 'token-1'

    vi.mocked(globalThis.fetch).mockResolvedValue({ ok: false, text: vi.fn().mockResolvedValue('error text'), status: 400 } as any)

    const { deleteRuleFromKV } = await import('../../../server/utils/cloudflare-kv')
    await deleteRuleFromKV('/test')

    // We expect it to finish without throwing
    expect(globalThis.fetch).toHaveBeenCalled()
  })

  it('handles delete network error', async () => {
    process.env.CF_ACCOUNT_ID = 'account-1'
    process.env.CF_KV_NAMESPACE_ID = 'ns-1'
    process.env.CF_API_TOKEN = 'token-1'

    vi.mocked(globalThis.fetch).mockRejectedValue(new Error('Network error'))

    const { deleteRuleFromKV } = await import('../../../server/utils/cloudflare-kv')
    await deleteRuleFromKV('/test')

    // We expect it to finish without throwing
    expect(globalThis.fetch).toHaveBeenCalled()
  })
})
