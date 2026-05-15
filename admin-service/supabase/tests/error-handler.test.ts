import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  isTransientError,
  withRetry,
  createAppError,
  handleError,
  createRequestLogger
} from '../server/utils/error-handler'
import * as h3 from 'h3'

// Mock h3 module
vi.mock('h3', () => {
  return {
    createError: vi.fn((opts) => {
      const err = new Error(opts.statusMessage || 'Error')
      Object.assign(err, opts)
      return err
    }),
  }
})

describe('error-handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('isTransientError', () => {
    it('returns true for network related errors', () => {
      expect(isTransientError(new Error('Network request failed'))).toBe(true)
      expect(isTransientError(new Error('Connection timeout'))).toBe(true)
      expect(isTransientError(new Error('ECONNRESET'))).toBe(true)
      expect(isTransientError(new Error('Temporarily unavailable'))).toBe(true)
    })

    it('returns false for other errors', () => {
      expect(isTransientError(new Error('Validation failed'))).toBe(false)
      expect(isTransientError(new Error('User not found'))).toBe(false)
      expect(isTransientError('String error')).toBe(false)
      expect(isTransientError(null)).toBe(false)
    })
  })

  describe('withRetry', () => {
    it('returns successfully on first try', async () => {
      const operation = vi.fn().mockResolvedValue('success')
      const result = await withRetry(operation)
      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('retries on default transient errors', async () => {
      let count = 0
      const operation = vi.fn().mockImplementation(async () => {
        count++
        if (count === 1) throw new Error('network error')
        if (count === 2) throw new Error('timeout')
        return 'success'
      })

      const result = await withRetry(operation, { baseDelayMs: 0, maxDelayMs: 0 })

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(3)
    })

    it('throws if max retries exceeded', async () => {
      let count = 0;
      const operation = vi.fn().mockImplementation(async () => {
        count++;
        throw new Error(`network error ${count}`)
      })

      const promise = withRetry(operation, { maxRetries: 2, baseDelayMs: 0, maxDelayMs: 0 })
      await expect(promise).rejects.toThrow('network error 2')
      expect(operation).toHaveBeenCalledTimes(2)
    })

    it('does not retry if shouldRetry returns false', async () => {
      const operation = vi.fn().mockImplementation(async () => {
        throw new Error('validation error')
      })

      const promise = withRetry(operation, { maxRetries: 3 })
      await expect(promise).rejects.toThrow('validation error')
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('logs warning when retrying', async () => {
      let count = 0;
      const operation = vi.fn().mockImplementation(async () => {
        count++;
        if (count === 1) throw new Error('network error 1')
        return 'success'
      })

      const mockLogger = { warn: vi.fn() } as any
      await withRetry(operation, { baseDelayMs: 0, maxDelayMs: 0 }, mockLogger)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Operation failed, retrying',
        expect.objectContaining({
          attempt: 1,
          errorMessage: 'network error 1'
        })
      )
    })

    it('logs warning for non-Error throws', async () => {
      let count = 0;
      const operation = vi.fn().mockImplementation(async () => {
        count++;
        if (count === 1) throw 'string error network 1'
        return 'success'
      })

      const mockLogger = { warn: vi.fn() } as any
      await withRetry(operation, {
        baseDelayMs: 0, maxDelayMs: 0,
        shouldRetry: () => true
      }, mockLogger)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Operation failed, retrying',
        expect.objectContaining({
          errorMessage: 'string error network 1'
        })
      )
    })

    it('returns false in default shouldRetry for non-Errors', async () => {
      const operation = vi.fn().mockImplementation(async () => {
        throw 'string error network'
      })

      const promise = withRetry(operation, { maxRetries: 2, baseDelayMs: 0, maxDelayMs: 0 })
      await expect(promise).rejects.toEqual('string error network')

      // Only 1 attempt because it shouldn't retry non-Error objects
      expect(operation).toHaveBeenCalledTimes(1)
    })
  })

  describe('createAppError', () => {
    it('creates an AppError with default correlationId', () => {
      const err = createAppError(404, 'Resource not found')
      expect(err.statusCode).toBe(404)
      expect(err.message).toBe('Resource not found')
      expect(err.statusMessage).toBe('Not Found')
      expect(err.correlationId).toBeDefined()
    })

    it('creates an AppError with specific status messages', () => {
      expect(createAppError(400, '').statusMessage).toBe('Bad Request')
      expect(createAppError(401, '').statusMessage).toBe('Unauthorized')
      expect(createAppError(403, '').statusMessage).toBe('Forbidden')
      expect(createAppError(409, '').statusMessage).toBe('Conflict')
      expect(createAppError(422, '').statusMessage).toBe('Unprocessable Entity')
      expect(createAppError(429, '').statusMessage).toBe('Too Many Requests')
      expect(createAppError(500, '').statusMessage).toBe('Internal Server Error')
      expect(createAppError(502, '').statusMessage).toBe('Bad Gateway')
      expect(createAppError(503, '').statusMessage).toBe('Service Unavailable')
      expect(createAppError(504, '').statusMessage).toBe('Gateway Timeout')
      expect(createAppError(999, '').statusMessage).toBe('Unknown Error')
    })

    it('includes options in AppError', () => {
      const err = createAppError(400, 'Bad', {
        code: 'BAD_CODE',
        correlationId: 'test-id',
        details: { field: 'value' },
        cause: new Error('cause error')
      })
      expect(err.code).toBe('BAD_CODE')
      expect(err.correlationId).toBe('test-id')
      expect(err.details).toEqual({ field: 'value' })
    })
  })

  describe('handleError', () => {
    const mockLogger = {
      correlationId: 'log-id',
      error: vi.fn()
    } as any

    it('handles existing H3 errors', () => {
      const h3Error = new Error('Already H3')
      ;(h3Error as any).statusCode = 403
      ;(h3Error as any).statusMessage = 'Forbidden Custom'
      ;(h3Error as any).data = { foo: 'bar' }

      expect(() => handleError({} as any, h3Error, mockLogger)).toThrow('Forbidden Custom')

      expect(mockLogger.error).toHaveBeenCalledWith('Request error', {
        statusCode: 403,
        errorMessage: 'Already H3'
      }, h3Error)

      expect(h3.createError).toHaveBeenCalledWith({
        statusCode: 403,
        statusMessage: 'Forbidden Custom',
        data: {
          correlationId: 'log-id',
          foo: 'bar'
        }
      })
    })

    it('handles existing H3 errors missing statusMessage or data', () => {
      const h3Error = new Error('Already H3 missing fields')
      ;(h3Error as any).statusCode = 401

      expect(() => handleError({} as any, h3Error, mockLogger)).toThrow('Already H3 missing fields')

      expect(h3.createError).toHaveBeenCalledWith({
        statusCode: 401,
        statusMessage: 'Already H3 missing fields',
        data: {
          correlationId: 'log-id'
        }
      })
    })

    it('handles regular Error objects', () => {
      const error = new Error('Regular error')

      expect(() => handleError({} as any, error, mockLogger)).toThrow('Internal Server Error')

      expect(mockLogger.error).toHaveBeenCalledWith('Unhandled error', {
        errorType: 'Error'
      }, error)

      expect(h3.createError).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 500,
        statusMessage: 'Internal Server Error',
        data: expect.objectContaining({ correlationId: 'log-id' })
      }))
    })

    it('includes message in development mode', () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      const error = new Error('Dev error message')
      try {
        handleError({} as any, error, mockLogger)
      } catch (e: any) {
        expect(h3.createError).toHaveBeenCalledWith(expect.objectContaining({
          data: {
            correlationId: 'log-id',
            message: 'Dev error message'
          }
        }))
      }

      process.env.NODE_ENV = originalEnv
    })

    it('handles unknown error types', () => {
      expect(() => handleError({} as any, 'string error', mockLogger)).toThrow('Internal Server Error')

      expect(mockLogger.error).toHaveBeenCalledWith('Unknown error type', {
        error: 'string error'
      })

      expect(h3.createError).toHaveBeenCalledWith({
        statusCode: 500,
        statusMessage: 'Internal Server Error',
        data: {
          correlationId: 'log-id',
          message: 'An unexpected error occurred'
        }
      })
    })
  })

  describe('createRequestLogger', () => {
    it('creates a logger from event headers', () => {
      const mockEvent = {
        method: 'POST',
        path: '/api/test',
        node: {
          req: {
            headers: {
              'x-correlation-id': 'header-id'
            }
          }
        }
      } as any

      const logger = createRequestLogger(mockEvent)
      expect(logger.correlationId).toBe('header-id')
    })

    it('creates a logger with new correlationId if header is missing', () => {
      const mockEvent = {
        method: 'GET',
        path: '/api/test',
        node: {
          req: {
            headers: {}
          }
        }
      } as any

      const logger = createRequestLogger(mockEvent)
      expect(logger.correlationId).toBeDefined()
      expect(logger.correlationId).not.toBe('header-id')
    })
  })
})
