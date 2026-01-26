import { H3Event, createError } from 'h3'
import { createHash } from 'crypto'
import { checkRateLimit } from '../utils/rate-limit'

interface RateLimitConfig {
  windowMs: number
  maxRequests: number
}

// Rate limit configurations per endpoint pattern
const rateLimitConfigs: Record<string, RateLimitConfig> = {
  // Analytics endpoints - higher limits
  '/api/analytics': { windowMs: 60_000, maxRequests: 100 },
  
  // Admin/mutation endpoints - stricter limits
  '/api/admin': { windowMs: 60_000, maxRequests: 10 },
  '/api/bulk': { windowMs: 60_000, maxRequests: 5 },
  '/api/links': { windowMs: 60_000, maxRequests: 30 },
  
  // Auth endpoints - very strict
  '/api/auth': { windowMs: 60_000, maxRequests: 10 },
  
  // Health/metrics - relaxed
  '/api/health': { windowMs: 60_000, maxRequests: 1000 },
  '/api/metrics': { windowMs: 60_000, maxRequests: 60 },
  
  // Default for all other endpoints
  'default': { windowMs: 60_000, maxRequests: 60 }
}

function getClientIdentifier(event: H3Event): string {
  const forwarded = event.node.req.headers['x-forwarded-for']
  const ip = typeof forwarded === 'string' 
    ? forwarded.split(',')[0].trim()
    : event.node.req.socket.remoteAddress || 'unknown'
  
  // Hash the IP for privacy
  return createHash('sha256')
    .update(ip + (process.env.RATE_LIMIT_SALT || 'default-salt'))
    .digest('hex')
    .substring(0, 16)
}

function getConfig(path: string): RateLimitConfig {
  // Find matching config
  for (const [pattern, config] of Object.entries(rateLimitConfigs)) {
    if (pattern !== 'default' && path.startsWith(pattern)) {
      return config
    }
  }
  return rateLimitConfigs.default
}

export default defineEventHandler(async (event: H3Event) => {
  // Skip rate limiting for non-API routes
  if (!event.path.startsWith('/api/')) return

  const clientId = getClientIdentifier(event)
  const config = getConfig(event.path)

  // Group by path prefix (e.g. /api/analytics)
  const key = `${clientId}:${event.path.split('/').slice(0, 3).join('/')}`
  const windowSeconds = Math.ceil(config.windowMs / 1000)

  try {
    const result = await checkRateLimit(key, config.maxRequests, windowSeconds)

    // Set rate limit headers
    event.node.res.setHeader('X-RateLimit-Limit', result.limit.toString())
    event.node.res.setHeader('X-RateLimit-Remaining', result.remaining.toString())
    event.node.res.setHeader('X-RateLimit-Reset', result.reset.toString())

    // Check if limit exceeded
    if (!result.allowed) {
      const retryAfter = result.retryAfter || 60
      event.node.res.setHeader('Retry-After', retryAfter.toString())

      throw createError({
        statusCode: 429,
        statusMessage: 'Too Many Requests',
        data: {
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter
        }
      })
    }
  } catch (error: any) {
    // If it's the 429 error we just threw, rethrow it
    if (error.statusCode === 429) {
      throw error
    }
    
    // Log unexpected errors (e.g., Redis down) but fail open to avoid downtime
    console.error('Rate limit middleware error:', error)
  }
})
