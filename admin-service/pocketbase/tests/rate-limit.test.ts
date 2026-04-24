import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { checkRateLimit, resetRateLimits } from '../server/utils/rate-limit'

describe('Rate Limiter', () => {
  beforeEach(() => {
    resetRateLimits()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows requests under the limit', () => {
    const key = 'test-key'
    const limit = 5
    const windowSeconds = 60

    for (let i = 0; i < 4; i++) {
      const result = checkRateLimit(key, limit, windowSeconds)
      expect(result.allowed).toBe(true)
      expect(result.limit).toBe(limit)
      expect(result.remaining).toBe(limit - (i + 1))
      expect(result.retryAfter).toBeUndefined()
    }
  })

  it('blocks requests over the limit', () => {
    const key = 'test-key-block'
    const limit = 2
    const windowSeconds = 60

    // Request 1
    let result = checkRateLimit(key, limit, windowSeconds)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(1)

    // Request 2
    result = checkRateLimit(key, limit, windowSeconds)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(0)

    // Request 3 - should be blocked
    result = checkRateLimit(key, limit, windowSeconds)
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.retryAfter).toBeDefined()
    expect(result.retryAfter).toBeGreaterThan(0)
  })

  it('resets the counter after the window expires', () => {
    const key = 'test-key-reset'
    const limit = 1
    const windowSeconds = 10

    // Set current time
    vi.setSystemTime(1000000000)

    // Request 1
    let result = checkRateLimit(key, limit, windowSeconds)
    expect(result.allowed).toBe(true)

    // Request 2 - blocked
    result = checkRateLimit(key, limit, windowSeconds)
    expect(result.allowed).toBe(false)

    // Fast-forward past the window
    vi.advanceTimersByTime((windowSeconds + 1) * 1000)

    // Request 3 - allowed again
    result = checkRateLimit(key, limit, windowSeconds)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(0)
  })

  it('resetRateLimits clears the state', () => {
    const key = 'test-key-clear'
    const limit = 1
    const windowSeconds = 60

    // Request 1
    let result = checkRateLimit(key, limit, windowSeconds)
    expect(result.allowed).toBe(true)

    // Request 2 - blocked
    result = checkRateLimit(key, limit, windowSeconds)
    expect(result.allowed).toBe(false)

    // Clear state
    resetRateLimits()

    // Request 3 - allowed again because state is cleared
    result = checkRateLimit(key, limit, windowSeconds)
    expect(result.allowed).toBe(true)
  })
})
