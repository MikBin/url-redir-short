import { describe, it, expect } from 'vitest'
import { setup, fetch } from '@nuxt/test-utils'

describe('Supabase Admin API Integration - Bulk', async () => {
  await setup({
    server: true,
    nuxtConfig: {
      supabase: {
        url: 'https://dummy.supabase.co',
        key: 'dummy-key'
      }
    }
  })

  it('POST /api/bulk returns 401 when unauthorized', async () => {
    const res = await fetch('/api/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ links: [{ slug: 'a', destination: 'https://a.com' }] })
    })
    expect(res.status).toBe(401)
  })
})
