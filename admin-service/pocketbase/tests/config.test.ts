import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('Config Utility', () => {
  beforeEach(() => {
    vi.resetModules()
    // clear relevant process.env to test defaults
    delete process.env.CORS_ALLOWED_ORIGINS
    delete process.env.IP_HASH_SALT
    delete process.env.LOG_LEVEL
    delete process.env.SERVICE_NAME
    delete process.env.PB_URL
  })

  it('should load default values when process.env is empty', async () => {
    const { config } = await import('../server/utils/config')

    expect(config.CORS_ALLOWED_ORIGINS).toBe('http://localhost:3000')
    expect(config.IP_HASH_SALT).toBe('default-salt')
    expect(config.LOG_LEVEL).toBe('info')
    expect(config.SERVICE_NAME).toBe('pb-admin-service')
    expect(config.PB_URL).toBe('http://127.0.0.1:8090')
  })
})
