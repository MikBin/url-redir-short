import { describe, it, expect, vi } from 'vitest'
import { isTransientError, withRetry, createAppError } from '../server/utils/error-handler'

describe('Error Handler Utility', () => {
  it('isTransientError should return true for network errors', () => {
    expect(isTransientError(new Error('Network connection failed'))).toBe(true)
    expect(isTransientError(new Error('timeout exceeded'))).toBe(true)
    expect(isTransientError(new Error('ECONNRESET'))).toBe(true)
  })

  it('isTransientError should return false for normal errors', () => {
    expect(isTransientError(new Error('invalid credentials'))).toBe(false)
    expect(isTransientError(new Error('Not Found'))).toBe(false)
  })

  it('createAppError should format error correctly', () => {
    const error = createAppError(404, 'User not found', { code: 'NOT_FOUND', correlationId: 'abc-123' })
    expect(error.statusCode).toBe(404)
    expect(error.message).toBe('User not found')
    expect(error.code).toBe('NOT_FOUND')
    expect(error.correlationId).toBe('abc-123')
  })

  it('withRetry should retry on failure and eventually succeed', async () => {
    let attempts = 0
    const operation = vi.fn().mockImplementation(async () => {
      attempts++
      if (attempts < 2) throw new Error('network timeout')
      return 'success'
    })

    const result = await withRetry(operation, { baseDelayMs: 1 })
    expect(result).toBe('success')
    expect(attempts).toBe(2)
    expect(operation).toHaveBeenCalledTimes(2)
  })

  it('withRetry should throw after max retries', async () => {
    const operation = vi.fn().mockImplementation(async () => {
      throw new Error('network timeout')
    })

    await expect(withRetry(operation, { maxRetries: 2, baseDelayMs: 1 })).rejects.toThrow('network timeout')
    expect(operation).toHaveBeenCalledTimes(2)
  })
})
