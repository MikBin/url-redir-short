import { describe, it, expect, vi, beforeEach } from 'vitest'
import handler, { aggregateEvents } from '../server/api/analytics/links/[linkId]/detailed.get'

// Mock dependencies
vi.mock('../server/utils/error-handler', () => ({
  createRequestLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
  })),
  handleError: vi.fn((event, error) => {
    return error
  })
}))

vi.mock('../server/utils/pocketbase', () => ({
  serverPocketBase: vi.fn()
}))

vi.mock('h3', async () => {
  const actual = await vi.importActual('h3')
  return {
    ...actual,
    getRouterParam: vi.fn(),
    getQuery: vi.fn(),
    setHeader: vi.fn(),
    createError: vi.fn((opts) => {
      const err = new Error(opts.message)
      Object.assign(err, opts)
      return err
    }),
    defineEventHandler: (fn: Parameters<typeof import('h3').defineEventHandler>[0]) => fn
  }
})

describe('Detailed Handler', () => {
  let mockEvent: Partial<import('h3').H3Event>

  beforeEach(() => {
    vi.clearAllMocks()
    mockEvent = {
      context: {
        user: { id: 'user_123' }
      }
    }
  })

  it('requires authentication', async () => {
    const unauthEvent = { context: {} } // no user
    const error = await handler(unauthEvent as unknown as import('h3').H3Event)

    expect(error).toBeInstanceOf(Error)
    expect((error as { statusCode: number }).statusCode).toBe(401)
    expect((error as Error).message).toBe('Unauthorized')
  })

  it('requires linkId', async () => {
    const h3 = await import('h3')
    vi.mocked(h3.getRouterParam).mockReturnValue('   ')

    const error = await handler(mockEvent as import('h3').H3Event)

    expect(error).toBeInstanceOf(Error)
    expect((error as { statusCode: number }).statusCode).toBe(400)
    expect((error as Error).message).toBe('Missing linkId')
  })

  it('validates query parameters', async () => {
    const h3 = await import('h3')
    vi.mocked(h3.getRouterParam).mockReturnValue('link_123')
    vi.mocked(h3.getQuery).mockReturnValue({ from: 'invalid-date' })

    const error = await handler(mockEvent as import('h3').H3Event)

    expect(error).toBeInstanceOf(Error)
    expect((error as { statusCode: number }).statusCode).toBe(400)
    expect((error as Error).message).toContain('Invalid query parameters:')
  })

  it('returns 404 when link not found', async () => {
    const h3 = await import('h3')
    vi.mocked(h3.getRouterParam).mockReturnValue('link_123')
    vi.mocked(h3.getQuery).mockReturnValue({})

    const { serverPocketBase } = await import('../server/utils/pocketbase')
    const pbMock = {
      collection: vi.fn().mockReturnValue({
        getOne: vi.fn().mockRejectedValue(new Error('Not found'))
      })
    }
    vi.mocked(serverPocketBase).mockResolvedValue(pbMock as unknown as Record<string, ReturnType<typeof vi.fn>>)

    const error = await handler(mockEvent as import('h3').H3Event)

    expect(error).toBeInstanceOf(Error)
    expect((error as { statusCode: number }).statusCode).toBe(404)
    expect((error as Error).message).toBe('Link not found')
  })

  it('returns 500 on unexpected database errors', async () => {
    const h3 = await import('h3')
    vi.mocked(h3.getRouterParam).mockReturnValue('link_123')
    vi.mocked(h3.getQuery).mockReturnValue({})

    const { serverPocketBase } = await import('../server/utils/pocketbase')
    const pbMock = {
      collection: vi.fn().mockReturnValue({
        getOne: vi.fn().mockResolvedValue({ id: 'link_123', slug: 'my-link', destination: 'https://example.com' }),
        getFullList: vi.fn().mockRejectedValue(new Error('Database connection failed'))
      })
    }
    vi.mocked(serverPocketBase).mockResolvedValue(pbMock as unknown as Record<string, ReturnType<typeof vi.fn>>)

    const error = await handler(mockEvent as import('h3').H3Event)

    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toBe('Database connection failed')
  })

  it('returns aggregated analytics successfully', async () => {
    const h3 = await import('h3')
    vi.mocked(h3.getRouterParam).mockReturnValue('link_123')
    vi.mocked(h3.getQuery).mockReturnValue({
      from: '2023-10-01T00:00:00.000Z',
      to: '2023-10-05T00:00:00.000Z'
    })

    const { serverPocketBase } = await import('../server/utils/pocketbase')
    const pbMock = {
      collection: vi.fn((name) => {
        if (name === 'links') {
          return {
            getOne: vi.fn().mockResolvedValue({ id: 'link_123', slug: 'my-link', destination: 'https://example.com' })
          }
        }
        if (name === 'analytics_events') {
          return {
            getFullList: vi.fn().mockResolvedValue([
              { session_id: 's1', country: 'US', timestamp: '2023-10-02T12:00:00Z' }
            ])
          }
        }
        return {}
      })
    }
    vi.mocked(serverPocketBase).mockResolvedValue(pbMock as unknown as Record<string, ReturnType<typeof vi.fn>>)

    const result = await handler(mockEvent as import('h3').H3Event)

    expect(result).not.toBeInstanceOf(Error)
    const res = result as Record<string, unknown>
    expect((res.link as any).id).toBe('link_123')
    expect((res.summary as any).totalClicks).toBe(1)
    expect((res.geographic as any).countries).toEqual([{ country: 'US', count: 1 }])

    expect(vi.mocked(h3.setHeader)).toHaveBeenCalledWith(mockEvent, 'Cache-Control', 'private, max-age=60')
  })

  it('handles empty query parameters by applying default date range', async () => {
    const h3 = await import('h3')
    vi.mocked(h3.getRouterParam).mockReturnValue('link_123')
    vi.mocked(h3.getQuery).mockReturnValue({})

    const { serverPocketBase } = await import('../server/utils/pocketbase')
    const getFullListMock = vi.fn().mockResolvedValue([])
    const pbMock = {
      collection: vi.fn((name) => {
        if (name === 'links') {
          return {
            getOne: vi.fn().mockResolvedValue({ id: 'link_123', slug: 'my-link', destination: 'https://example.com' })
          }
        }
        if (name === 'analytics_events') {
          return {
            getFullList: getFullListMock
          }
        }
        return {}
      })
    }
    vi.mocked(serverPocketBase).mockResolvedValue(pbMock as unknown as Record<string, ReturnType<typeof vi.fn>>)

    const result = await handler(mockEvent as import('h3').H3Event)

    expect(result).not.toBeInstanceOf(Error)
    expect(getFullListMock).toHaveBeenCalled()
    const callArgs = getFullListMock.mock.calls[0][0]
    expect(callArgs.filter).toContain('timestamp >=')
    expect(callArgs.filter).toContain('timestamp <=')
  })
})

describe('aggregateEvents', () => {
  it('aggregates an empty array correctly', () => {
    const result = aggregateEvents([])

    expect(result).toEqual({
      totalClicks: 0,
      uniqueVisitors: 0,
      timeSeries: [],
      countries: [],
      cities: [],
      devices: [],
      browsers: [],
      operatingSystems: [],
      referrers: []
    })
  })

  it('aggregates totalClicks and uniqueVisitors correctly', () => {
    const events = [
      { session_id: '1', timestamp: '2023-10-01T12:00:00Z' },
      { session_id: '1', timestamp: '2023-10-01T13:00:00Z' },
      { session_id: '2', timestamp: '2023-10-01T14:00:00Z' },
      { timestamp: '2023-10-01T15:00:00Z' } // Missing session_id
    ]

    const result = aggregateEvents(events)

    expect(result.totalClicks).toBe(4)
    expect(result.uniqueVisitors).toBe(2)
  })

  it('groups time series correctly', () => {
    const events = [
      { timestamp: '2023-10-01T10:00:00Z' },
      { timestamp: '2023-10-01T11:00:00Z' },
      { timestamp: '2023-10-02T12:00:00Z' },
      { timestamp: '2023-10-03T09:00:00Z' },
      { timestamp: '2023-10-03T10:00:00Z' }
    ]

    const result = aggregateEvents(events)

    expect(result.timeSeries).toEqual([
      { date: '2023-10-01', count: 2 },
      { date: '2023-10-02', count: 1 },
      { date: '2023-10-03', count: 2 }
    ])
  })

  it('groups dimensions correctly and sorts by count descending', () => {
    const events = [
      { country: 'US', city: 'New York', device_type: 'Mobile', browser: 'Chrome', os: 'iOS', referrer: 'google.com', timestamp: '2023-10-01T12:00:00Z' },
      { country: 'US', city: 'San Francisco', device_type: 'Desktop', browser: 'Chrome', os: 'Windows', referrer: 'google.com', timestamp: '2023-10-01T13:00:00Z' },
      { country: 'CA', city: 'Toronto', device_type: 'Mobile', browser: 'Safari', os: 'iOS', referrer: 'bing.com', timestamp: '2023-10-01T14:00:00Z' },
      { country: 'US', city: 'New York', device_type: 'Mobile', browser: 'Chrome', os: 'iOS', referrer: 'google.com', timestamp: '2023-10-01T15:00:00Z' }
    ]

    const result = aggregateEvents(events)

    expect(result.countries).toEqual([
      { country: 'US', count: 3 },
      { country: 'CA', count: 1 }
    ])

    expect(result.cities).toEqual([
      { city: 'New York', count: 2 },
      { city: 'San Francisco', count: 1 },
      { city: 'Toronto', count: 1 }
    ])

    expect(result.devices).toEqual([
      { device: 'Mobile', count: 3 },
      { device: 'Desktop', count: 1 }
    ])

    expect(result.browsers).toEqual([
      { browser: 'Chrome', count: 3 },
      { browser: 'Safari', count: 1 }
    ])

    expect(result.operatingSystems).toEqual([
      { os: 'iOS', count: 3 },
      { os: 'Windows', count: 1 }
    ])

    expect(result.referrers).toEqual([
      { referrer: 'google.com', count: 3 },
      { referrer: 'bing.com', count: 1 }
    ])
  })

  it('ignores missing/null dimension values', () => {
    const events = [
      { country: 'US', browser: 'Chrome', timestamp: '2023-10-01T12:00:00Z' },
      { browser: 'Chrome', timestamp: '2023-10-01T13:00:00Z' }, // no country
      { country: null, browser: null, timestamp: '2023-10-01T14:00:00Z' }
    ]

    const result = aggregateEvents(events as unknown[])

    expect(result.countries).toEqual([
      { country: 'US', count: 1 }
    ])

    expect(result.browsers).toEqual([
      { browser: 'Chrome', count: 2 }
    ])
  })
})
