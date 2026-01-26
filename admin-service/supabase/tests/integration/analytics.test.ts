import { describe, it, expect } from 'vitest'
import { setup, fetch } from '@nuxt/test-utils'

describe('Analytics API', async () => {
  await setup({
    server: true
  })

  it('GET /api/analytics/stats returns 401 without auth', async () => {
    const res = await fetch('/api/analytics/stats')
    expect(res.status).toBe(401)
  })

  it('GET /api/metrics returns 401 without auth', async () => {
    const res = await fetch('/api/metrics')
    expect(res.status).toBe(401)
  })
})
