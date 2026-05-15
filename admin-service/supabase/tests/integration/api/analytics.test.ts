import { describe, it, expect } from 'vitest'
import { setup, fetch } from '@nuxt/test-utils'

describe('Supabase Admin API Integration - Analytics', async () => {
  await setup({
    server: true,
    nuxtConfig: {
      supabase: {
        url: 'https://dummy.supabase.co',
        key: 'dummy-key'
      }
    }
  })

  it('GET /api/analytics/dashboard returns 401 without auth', async () => {
    const res = await fetch('/api/analytics/dashboard')
    expect(res.status).toBe(401)
  })

  it('GET /api/analytics/stats returns 401 without auth', async () => {
    const res = await fetch('/api/analytics/stats')
    expect(res.status).toBe(401)
  })

  it('GET /api/analytics/links/overview returns 401 without auth', async () => {
    const res = await fetch('/api/analytics/links/overview')
    expect(res.status).toBe(401)
  })

  it('GET /api/analytics/links/:id/detailed returns 401 without auth', async () => {
    const res = await fetch('/api/analytics/links/123-abc/detailed')
    expect(res.status).toBe(401)
  })

  it('GET /api/analytics/export/csv returns 401 without auth', async () => {
    const res = await fetch('/api/analytics/export/csv')
    expect(res.status).toBe(401)
  })

  it('POST /api/analytics/v1/collect returns 400 for invalid payload', async () => {
    const res = await fetch('/api/analytics/v1/collect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '' }) // invalid
    })
    expect(res.status).toBe(400)
  })
})
