import { describe, it, expect } from 'vitest'
import { setup, fetch } from '@nuxt/test-utils'

describe('Health API', async () => {
  await setup({
    server: true
  })

  it('GET /api/health returns status', async () => {
    const res = await fetch('/api/health')
    // It handles the response, so we need to be careful with json() if it's not json
    const body = await res.json()

    // It might return 503 if DB is unhealthy, or 200 if healthy/degraded
    expect([200, 503]).toContain(res.status)
    expect(body).toHaveProperty('status')
    expect(body).toHaveProperty('checks')
  })
})
