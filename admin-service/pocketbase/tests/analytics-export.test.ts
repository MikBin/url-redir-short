import { describe, it, expect, vi, beforeEach } from 'vitest'
import { convertToCSV } from '../server/api/analytics/export/[format].get'
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
    defineEventHandler: (fn: any) => fn
  }
})

describe('Analytics Export', () => {
  describe('convertToCSV', () => {
    it('returns "No data available" for empty array', () => {
      expect(convertToCSV([])).toBe('No data available')
    })

    it('returns "No data available" for null data', () => {
      expect(convertToCSV(null as any)).toBe('No data available')
    })

    it('formats simple data correctly', () => {
      const data = [
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' }
      ]
      const expected = '"id","name"\n1,John\n2,Jane'
      expect(convertToCSV(data)).toBe(expected)
    })

    it('escapes quotes by doubling them', () => {
      const data = [
        { id: 1, text: 'Hello "World"' }
      ]
      const expected = '"id","text"\n1,"Hello ""World"""'
      expect(convertToCSV(data)).toBe(expected)
    })

    it('wraps fields in quotes if they contain commas', () => {
      const data = [
        { id: 1, text: 'Hello, World' }
      ]
      const expected = '"id","text"\n1,"Hello, World"'
      expect(convertToCSV(data)).toBe(expected)
    })

    it('wraps fields in quotes if they contain newlines', () => {
      const data = [
        { id: 1, text: 'Hello\nWorld' }
      ]
      const expected = '"id","text"\n1,"Hello\nWorld"'
      expect(convertToCSV(data)).toBe(expected)
    })

    it('handles null or undefined values as empty strings', () => {
      const data = [
        { id: 1, text: null, other: undefined }
      ]
      const expected = '"id","text","other"\n1,,'
      expect(convertToCSV(data)).toBe(expected)
    })
  })

  describe('Handler Format Validation', () => {
    let mockEvent: any

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

      const error = await handler(mockEvent)

      expect(error).toBeInstanceOf(Error)
      expect((error as any).statusCode).toBe(400)
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
      vi.mocked(serverPocketBase).mockResolvedValue(pbMock as any)

      const result = await handler(mockEvent)

      expect(result).not.toBeInstanceOf(Error)
      expect(result).toHaveProperty('exportedAt')
      expect(result).toHaveProperty('data')
      expect(result.data).toEqual([])
    })

    it('accepts csv format', async () => {
      const h3 = await import('h3')
      vi.mocked(h3.getRouterParam).mockReturnValue('csv')
      vi.mocked(h3.getQuery).mockReturnValue({})

      const { serverPocketBase } = await import('../server/utils/pocketbase')
      const pbMock = {
        collection: vi.fn().mockReturnValue({
          getFullList: vi.fn().mockResolvedValue([])
        })
      }
      vi.mocked(serverPocketBase).mockResolvedValue(pbMock as any)

      const result = await handler(mockEvent)

      expect(result).toBe('No data available')
    })

    it('requires authentication', async () => {
      const unauthEvent = { context: {} } // no user
      const error = await handler(unauthEvent as any)

      expect(error).toBeInstanceOf(Error)
      expect((error as any).statusCode).toBe(401)
      expect(error.message).toBe('Unauthorized')
    })
  })
})
