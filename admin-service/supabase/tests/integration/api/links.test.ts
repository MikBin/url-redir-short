import { describe, it, expect } from 'vitest'
import { setup, fetch } from '@nuxt/test-utils'

describe('Supabase Admin API Integration - Links', async () => {
  await setup({
    server: true,
    nuxtConfig: {
      supabase: {
        url: 'https://dummy.supabase.co',
        key: 'dummy-key'
      }
    }
  })

  it('POST /api/links/create returns 401 when unauthorized', async () => {
    const res = await fetch('/api/links/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination: 'https://example.com' })
    })
    expect(res.status).toBe(401)
  })

  it('PATCH /api/links/:id returns 401 when unauthorized', async () => {
    const res = await fetch('/api/links/123-abc', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination: 'https://b.com' })
    })
    expect(res.status).toBe(401)
  })

  it('DELETE /api/links/:id returns 401 when unauthorized', async () => {
    const res = await fetch('/api/links/123-abc', {
      method: 'DELETE'
    })
    expect(res.status).toBe(401)
  })

  it('GET /api/links/:id/history returns 401 when unauthorized', async () => {
    const res = await fetch('/api/links/123-abc/history')
    expect(res.status).toBe(401)
  })
})
