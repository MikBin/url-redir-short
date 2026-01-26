import { useValkey } from './storage'

export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  reset: number // Unix timestamp in seconds
  retryAfter?: number // Seconds
}

/**
 * Checks rate limit for a given key using Valkey/Redis.
 * Implements a fixed window counter with exponential backoff blocking for repeated violations.
 *
 * @param key Unique identifier for the client (e.g., IP address)
 * @param limit Maximum number of requests allowed in the window
 * @param windowSeconds Duration of the window in seconds
 * @returns RateLimitResult
 */
export const checkRateLimit = async (
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> => {
  const redis = useValkey()
  const now = Math.floor(Date.now() / 1000)

  // Keys
  const countKey = `rl:count:${key}`
  const blockKey = `rl:block:${key}`
  const violationKey = `rl:violations:${key}` // For exponential backoff

  // 1. Check if blocked
  const blockedTTL = await redis.ttl(blockKey)
  if (blockedTTL > 0) {
    return {
      allowed: false,
      limit,
      remaining: 0,
      reset: now + blockedTTL,
      retryAfter: blockedTTL
    }
  }

  // 2. Increment count
  // We use a script or multi-command to ensure atomicity is not strictly required for basic counting but good for expire
  const multi = redis.multi()
  multi.incr(countKey)
  multi.ttl(countKey)

  const results = await multi.exec()

  if (!results) {
      // Fallback if transaction fails
      return { allowed: false, limit, remaining: 0, reset: now + windowSeconds }
  }

  // ioredis results are [error, result] tuples
  const countErr = results[0][0]
  const countRes = results[0][1] as number

  const ttlErr = results[1][0]
  const ttlRes = results[1][1] as number

  if (countErr) {
     console.error('Rate limit redis error', countErr)
     return { allowed: true, limit, remaining: limit, reset: now + windowSeconds } // Fail open or closed? Open for resiliency?
  }

  let ttl = ttlRes

  // If key was just created (ttl is -1) or has no expire, set it
  if (countRes === 1 || ttl === -1) {
    await redis.expire(countKey, windowSeconds)
    ttl = windowSeconds
  }

  // 3. Check limit
  if (countRes > limit) {
    // Limit exceeded
    // Increment violation count to calculate backoff
    const violations = await redis.incr(violationKey)
    await redis.expire(violationKey, 3600) // Keep violation history for an hour

    // Backoff: window * 2^(violations-1)
    // Example: 60s window. 1st violation: 60s. 2nd: 120s. 3rd: 240s.
    // Cap at 1 hour (3600s)
    const backoffDuration = Math.min(
      windowSeconds * Math.pow(2, violations - 1),
      3600
    )

    await redis.setex(blockKey, backoffDuration, '1')

    return {
      allowed: false,
      limit,
      remaining: 0,
      reset: now + backoffDuration,
      retryAfter: backoffDuration
    }
  }

  return {
    allowed: true,
    limit,
    remaining: Math.max(0, limit - countRes),
    reset: now + (ttl > 0 ? ttl : windowSeconds)
  }
}
