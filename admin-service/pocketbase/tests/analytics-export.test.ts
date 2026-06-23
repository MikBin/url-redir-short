import { describe, it, expect, vi, beforeEach } from 'vitest'

import handler from '../server/api/analytics/export/[format].get'

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
    defineEventHandler: (fn: Parameters<typeof import('h3').defineEventHandler>[0]) => fn,
    sendStream: vi.fn((event, stream) => stream)
  }
})

describe('Analytics Export', () => {
  describe('Handler Format Validation', () => {
    let mockEvent: Partial<import('h3').H3Event>

    beforeEach(() => {
      vi.clearAllMocks()
      mockEvent = {
        context: {
          user: { id: 'user_123' }
        }
      }
    })

    it('rejects formats other than csv or json', async () => {
      const h3 = await import('h3')
      vi.mocked(h3.getRouterParam).mockReturnValue('pdf')
      vi.mocked(h3.getQuery).mockReturnValue({})

      const error = await handler(mockEvent as import('h3').H3Event)

      expect(error).toBeInstanceOf(Error)
      expect((error as { statusCode: number }).statusCode).toBe(400)
      expect(error.message).toBe('Invalid export format. Must be "csv" or "json".')
    })

    it('accepts json format', async () => {
      const h3 = await import('h3')
      vi.mocked(h3.getRouterParam).mockReturnValue('json')
      vi.mocked(h3.getQuery).mockReturnValue({})

      const { serverPocketBase } = await import('../server/utils/pocketbase')
      const pbMock = {
        collection: vi.fn().mockReturnValue({
          getFullList: vi.fn().mockResolvedValue([])
        })
      }
      vi.mocked(serverPocketBase).mockResolvedValue(pbMock as unknown as Record<string, ReturnType<typeof vi.fn>>)

      const result = await handler(mockEvent as import('h3').H3Event)

      expect(result).not.toBeInstanceOf(Error)
      expect(result).toHaveProperty('exportedAt')
      expect(result).toHaveProperty('data')
      expect(result.data).toEqual([])
    })

    it('rejects invalid query parameters', async () => {
      const h3 = await import('h3')
      vi.mocked(h3.getRouterParam).mockReturnValue('csv')
      vi.mocked(h3.getQuery).mockReturnValue({ from: 'invalid-date' })

      const error = await handler(mockEvent as import('h3').H3Event)

      expect(error).toBeInstanceOf(Error)
      expect((error as { statusCode: number }).statusCode).toBe(400)
      expect((error as Error).message).toBe('Invalid query parameters')
    })

    it('accepts json format and populates default data correctly', async () => {
      const h3 = await import('h3')
      vi.mocked(h3.getRouterParam).mockReturnValue('json')
      vi.mocked(h3.getQuery).mockReturnValue({})

      const { serverPocketBase } = await import('../server/utils/pocketbase')
      const pbMock = {
        collection: vi.fn().mockReturnValue({
          getFullList: vi.fn().mockResolvedValue([
            { id: '1', path: 'my-link', destination: 'https://example.com', timestamp: '2023-10-01T12:00:00Z', country: 'US', city: 'NY', device_type: 'Desktop', browser: 'Chrome', os: 'Windows', referrer: 'Google', status: 200 }
          ])
        })
      }
      vi.mocked(serverPocketBase).mockResolvedValue(pbMock as unknown as Record<string, ReturnType<typeof vi.fn>>)

      const result = await handler(mockEvent as import('h3').H3Event)

      expect(result).not.toBeInstanceOf(Error)
      expect(result).toHaveProperty('exportedAt')
      expect(result).toHaveProperty('data')
      const data = (result as { data: any[] }).data
      expect(data).toHaveLength(1)
      expect(data[0].id).toBe('1')
      expect(data[0].path).toBe('my-link')
    })

    it('returns 404 when link does not exist', async () => {
      const h3 = await import('h3')
      vi.mocked(h3.getRouterParam).mockReturnValue('csv')
      vi.mocked(h3.getQuery).mockReturnValue({ linkId: '123e4567-e89b-12d3-a456-426614174000' })

      const { serverPocketBase } = await import('../server/utils/pocketbase')
      const getOneMock = vi.fn().mockRejectedValue(new Error('Not found'))
      const pbMock = {
        collection: vi.fn((name) => {
          if (name === 'links') return { getOne: getOneMock }
          return { getFullList: vi.fn().mockResolvedValue([]), getList: vi.fn().mockResolvedValue({items: [], totalPages: 1}) }
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
      vi.mocked(h3.getRouterParam).mockReturnValue('json')
      vi.mocked(h3.getQuery).mockReturnValue({ linkId: '123e4567-e89b-12d3-a456-426614174000' })

      const { serverPocketBase } = await import('../server/utils/pocketbase')
      const getOneMock = vi.fn().mockResolvedValue({ id: '123e4567-e89b-12d3-a456-426614174000', owner_id: 'user_123' })
      const pbMock = {
        collection: vi.fn((name) => {
          if (name === 'links') return { getOne: getOneMock }
          return { getFullList: vi.fn().mockRejectedValue(new Error('Database connection failed')), getList: vi.fn().mockRejectedValue(new Error('Database connection failed')) }
        })
      }
      vi.mocked(serverPocketBase).mockResolvedValue(pbMock as unknown as Record<string, ReturnType<typeof vi.fn>>)

      const error = await handler(mockEvent as import('h3').H3Event)

      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toBe('Database connection failed')
    })

    it('returns 403 when user does not own the link', async () => {
      const h3 = await import('h3')
      vi.mocked(h3.getRouterParam).mockReturnValue('csv')
      vi.mocked(h3.getQuery).mockReturnValue({ linkId: '123e4567-e89b-12d3-a456-426614174000' })

      const { serverPocketBase } = await import('../server/utils/pocketbase')
      const getOneMock = vi.fn().mockResolvedValue({ id: '123e4567-e89b-12d3-a456-426614174000', owner_id: 'different_user' })
      const pbMock = {
        collection: vi.fn((name) => {
          if (name === 'links') return { getOne: getOneMock }
          return { getFullList: vi.fn().mockResolvedValue([]), getList: vi.fn().mockResolvedValue({items: [], totalPages: 1}) }
        })
      }
      vi.mocked(serverPocketBase).mockResolvedValue(pbMock as unknown as Record<string, ReturnType<typeof vi.fn>>)

      const error = await handler(mockEvent as import('h3').H3Event)

      expect(error).toBeInstanceOf(Error)
      expect((error as { statusCode: number }).statusCode).toBe(403)
      expect((error as Error).message).toBe('Forbidden: You do not own this link')
    })

    it('accepts csv format', async () => {
      const h3 = await import('h3')
      vi.mocked(h3.getRouterParam).mockReturnValue('csv')
      vi.mocked(h3.getQuery).mockReturnValue({
        linkId: '123e4567-e89b-12d3-a456-426614174000',
        from: '2023-10-01T00:00:00.000Z',
        to: '2023-10-05T00:00:00.000Z'
      })

      const { serverPocketBase } = await import('../server/utils/pocketbase')
      const pbMock = {
        collection: vi.fn((name) => {
          if (name === 'links') return { getOne: vi.fn().mockResolvedValue({ id: '123e4567-e89b-12d3-a456-426614174000', slug: 'my-link', owner_id: 'user_123' }) }
          if (name === 'analytics_events') {
            return {
              getFullList: vi.fn().mockResolvedValue([
                { id: '1', path: 'my-link', destination: 'https://example.com' }
              ]),
              getList: vi.fn().mockResolvedValue({
                items: [{ id: '1', path: 'my-link', destination: 'https://example.com' }],
                totalPages: 1
              })
            }
          }
          return {}
        })
      }
      vi.mocked(serverPocketBase).mockResolvedValue(pbMock as unknown as Record<string, ReturnType<typeof vi.fn>>)

      const result = await handler(mockEvent as import('h3').H3Event)

      expect(result).not.toBeInstanceOf(Error)

      // Consume the stream to check contents
      const stream = result as unknown as ReadableStream
      const reader = stream.getReader()
      let output = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        output += value
      }

      expect(output).toContain('"id","path","destination","timestamp","country","city","device_type","browser","os","referrer","status"')
      expect(output).toContain('1,my-link,https://example.com')
      expect(h3.sendStream).toHaveBeenCalled()
    })

    it('requires authentication', async () => {
      const unauthEvent = { context: {} } // no user
      const error = await handler(unauthEvent as unknown as import('h3').H3Event)

      expect(error).toBeInstanceOf(Error)
      expect((error as { statusCode: number }).statusCode).toBe(401)
      expect(error.message).toBe('Unauthorized')
    })
  })
})
