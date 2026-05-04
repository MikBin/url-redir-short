import { describe, it, expect } from 'vitest'
import { setup, fetch } from '@nuxt/test-utils'

describe('Create Link API Integration', async () => {
  process.env.SUPABASE_URL = 'https://dummy.supabase.co'
  process.env.SUPABASE_KEY = 'dummy-key'

  await setup({
    server: true
  })

  // We can at least assert that without a slug or with a slug, the request hits the endpoint.
  // We expect a 401 Unauthorized because we provided dummy credentials.
  it('POST /api/links/create returns 401 when creating without a slug without auth', async () => {
    const res = await fetch('/api/links/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination: 'https://example.com' })
    })
    expect(res.status).toBe(401)
  })

  it('POST /api/links/create returns 401 when creating with a slug without auth', async () => {
    const res = await fetch('/api/links/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'custom-slug', destination: 'https://example.com' })
    })
    expect(res.status).toBe(401)
  })
})
