export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  reset: number
  retryAfter?: number
}

const store = new Map<string, { count: number; resetAt: number }>()

// Clean up expired entries every minute to prevent memory leaks from one-off IPs
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of store.entries()) {
    if (now >= record.resetAt) {
      store.delete(key)
    }
  }
}, 60000).unref() // unref to not block process exit

export function checkRateLimit(key: string, limit: number, windowSeconds: number): RateLimitResult {
  const now = Date.now()

  let record = store.get(key)
  if (record && now >= record.resetAt) {
    store.delete(key)
    record = undefined
  }

  if (!record) {
    record = {
      count: 0,
      resetAt: now + windowSeconds * 1000
    }
  }

  const allowed = record.count < limit
  if (allowed) {
    record.count++
  }

  store.set(key, record)

  return {
    allowed,
    limit,
    remaining: Math.max(0, limit - record.count),
    reset: Math.ceil(record.resetAt / 1000),
    retryAfter: allowed ? undefined : Math.ceil((record.resetAt - now) / 1000)
  }
}

export function resetRateLimits(): void {
  store.clear()
}
