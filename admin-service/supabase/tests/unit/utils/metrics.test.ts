// @vitest-environment node
import { describe, it, expect } from 'vitest'

describe('metrics.ts', () => {
  it('initializes prometheus metrics correctly', async () => {
    const { metrics } = await import('../../../server/utils/metrics')

    expect(metrics).toBeDefined()
    expect(metrics.registry).toBeDefined()
    expect(metrics.requestsTotal).toBeDefined()
    expect(metrics.requestDuration).toBeDefined()
    expect(metrics.sseClients).toBeDefined()
    expect(metrics.linksTotal).toBeDefined()
    expect(metrics.analyticsIngestionTotal).toBeDefined()
    expect(metrics.rateLimitRejections).toBeDefined()
  })
})
