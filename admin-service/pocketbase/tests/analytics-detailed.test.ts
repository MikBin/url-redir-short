import { describe, it, expect } from 'vitest'
import { aggregateEvents } from '../server/api/analytics/links/[linkId]/detailed.get'

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

    const result = aggregateEvents(events as any)

    expect(result.countries).toEqual([
      { country: 'US', count: 1 }
    ])

    expect(result.browsers).toEqual([
      { browser: 'Chrome', count: 2 }
    ])
  })
})
