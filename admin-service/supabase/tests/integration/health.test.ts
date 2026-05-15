import { describe, it, expect } from 'vitest'
import { setup, fetch } from '@nuxt/test-utils'

describe('Health API', async () => {
  await setup({
    server: true
  })

  it('GET /api/health returns status', async () => {
    const res = await fetch('/api/health')
    const body = await res.json()

    expect([200, 503]).toContain(res.status)
    expect(body).toHaveProperty('status')
    expect(body).toHaveProperty('checks')
  })
})
