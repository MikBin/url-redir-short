import { describe, it, expect } from 'vitest'
import { setup, fetch } from '@nuxt/test-utils'

describe('Supabase Admin API Integration - Other', async () => {
  await setup({
    server: true,
    nuxtConfig: {
      supabase: {
        url: 'https://dummy.supabase.co',
        key: 'dummy-key'
      }
    }
  })

  it('GET /api/health works', async () => {
    const res = await fetch('/api/health')
    expect(res.status).toBe(200)
  })

  it('GET /api/qr returns 401 when unauthorized', async () => {
    const res = await fetch('/api/qr?text=test')
    expect(res.status).toBe(401)
  })

  it('GET /api/sync/stream returns 401 when unauthorized (bad sync API key)', async () => {
    const res = await fetch('/api/sync/stream')
    expect(res.status).toBe(401)
  })
})
