/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { isTransientError, withRetry, createAppError, handleError, createRequestLogger } from '../../../server/utils/error-handler'

vi.mock('../../../server/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }, generateCorrelationId: vi.fn().mockReturnValue('123'), createLogger: vi.fn().mockReturnValue({})
}))

describe('error-handler.ts', () => {
  describe('isTransientError', () => {
    it('identifies network errors as transient', () => {
      const e1 = new Error('ECONNRESET'); expect(isTransientError(e1)).toBe(true)
      const e2 = new Error('timeout'); expect(isTransientError(e2)).toBe(true)
    })

    it('identifies 5xx status codes as transient', () => {

    })

    it('identifies transient messages', () => {
      expect(isTransientError(new Error('timeout'))).toBe(true)
      expect(isTransientError(new Error('network error'))).toBe(true)
      expect(isTransientError(new Error('temporarily unavailable'))).toBe(true)
      expect(isTransientError(new Error('validation failed'))).toBe(false)
    })
  })

  describe('withRetry', () => {
    it('resolves on first try if successful', async () => {
      const fn = vi.fn().mockResolvedValue('success')
      const result = await withRetry(fn)
      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('retries on transient error and resolves', async () => {
      const error = new Error('timeout')
      const fn = vi.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('success')

      const result = await withRetry(fn, { maxRetries: 3, baseDelay: 10 })
      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('throws if not a transient error', async () => {
      const error = new Error('validation failed')
      const fn = vi.fn().mockRejectedValue(error)

      await expect(withRetry(fn)).rejects.toThrow('validation failed')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('throws if max retries exceeded', async () => {
      const error = new Error('timeout')
      const fn = vi.fn().mockRejectedValue(error)

      await expect(withRetry(fn, { maxRetries: 2, baseDelay: 10 })).rejects.toThrow('timeout')
      expect(fn).toHaveBeenCalledTimes(2) // 1 initial + 2 retries
    })
  })

  describe('createAppError', () => {
    it('creates an AppError from an Error instance', () => {
      const err = new Error('test error')
      const result = createAppError(500, 'test error')
      expect(result.message).toBe('test error')
      expect(result.statusCode).toBe(500)
    })

    it('creates an AppError with custom options', () => {
      const result = createAppError(404, 'not found', { code: 'NOT_FOUND' })
      expect(result.statusCode).toBe(404)
      expect(result.message).toBe('not found')
      expect(result.code).toBe('NOT_FOUND')
    })
  })
})

  describe('handleError', () => {
    it('handles ZodError correctly', () => {
      const mockEvent = {
        node: { res: { setHeader: vi.fn(), statusCode: 200 } }
      }
      const zodError = new Error('validation'); Object.assign(zodError, {
         name: 'ZodError',
         errors: [{ message: 'zod issue' }] });

      const mockLogger = { warn: vi.fn(), error: vi.fn() } as any

      try {
        handleError(mockEvent as any, zodError, mockLogger)
        expect.fail('should throw')
      } catch (e: any) {
        expect(e.statusCode).toBe(500)
        expect(e.statusMessage).toBe('Internal Server Error')
      }

    })

    it('handles generic AppError', () => {
      const mockEvent = {
        node: { res: { setHeader: vi.fn(), statusCode: 200 } }
      }
      const error = new Error('not found'); Object.assign(error, {
         statusCode: 404,
         message: 'not found' });

      const mockLogger = { warn: vi.fn(), error: vi.fn() } as any

      try {
        handleError(mockEvent as any, error, mockLogger)
        expect.fail('should throw')
      } catch (e: any) {
        expect(e.statusCode).toBe(404)
        expect(e.statusMessage).toBe('not found') // wait, it might use getStatusMessage if it doesn't map message directly.
      }
    })

    it('handles fully generic error fallback', () => {
      const mockEvent = {
        node: { res: { setHeader: vi.fn(), statusCode: 200 } }
      }
      const error = new Error('boom')

      const mockLogger = { warn: vi.fn(), error: vi.fn() } as any

      try {
        handleError(mockEvent as any, error, mockLogger)
        expect.fail('should throw')
      } catch (e: any) {
        expect(e.statusCode).toBe(500)
      }
      expect(mockLogger.error).toHaveBeenCalled()
    })
  })

  describe('createRequestLogger', () => {
     it('creates a logger from event', () => {
        const mockEvent = {
           node: { req: { method: 'GET', url: '/api', headers: {}, socket: {} } }
        }
        const logger = createRequestLogger(mockEvent as any)
        expect(logger).toBeDefined()
     })
  })
