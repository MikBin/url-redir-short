/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('config.ts', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = process.env
    process.env = { ...originalEnv }
    vi.resetModules()
  })

  it('exports default config values when env is empty', async () => {
    // Clear out env variables related to config
    delete process.env.CORS_ALLOWED_ORIGINS
    delete process.env.IP_HASH_SALT
    delete process.env.LOG_LEVEL

    const { config } = await import('../../../server/utils/config')
    expect(config.LOG_LEVEL).toBe('info')
    expect(config.IP_HASH_SALT).toBe('default-salt')
  })

  it('throws an error when env variables are invalid', async () => {
    process.env.LOG_LEVEL = 'invalid_level'

    try {
      await import('../../../server/utils/config')
      expect.fail('Should have thrown')
    } catch (e: any) {
      expect(e.message).toBe('Invalid environment variables')
    }
  })
})
