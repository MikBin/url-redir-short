import { H3Event, createError } from 'h3'
import { createHash } from 'crypto'

interface RateLimitConfig {
  windowMs: number
  maxRequests: number
}

interface RateLimitRecord {
  count: number
  resetTime: number
  blockedUntil?: number
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

// In-memory store (use Redis in production for distributed systems)
const rateLimitStore = new Map<string, RateLimitRecord>()

// Cleanup old entries periodically
const CLEANUP_INTERVAL = 5 * 60_000 // 5 minutes
let lastCleanup = Date.now()

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  
  lastCleanup = now
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime && (!record.blockedUntil || now > record.blockedUntil)) {
      rateLimitStore.delete(key)
    }
  }
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

export default defineEventHandler((event: H3Event) => {
  // Skip rate limiting for non-API routes
  if (!event.path.startsWith('/api/')) return

  cleanup()

  const clientId = getClientIdentifier(event)
  const config = getConfig(event.path)
  const key = `${clientId}:${event.path.split('/').slice(0, 3).join('/')}`
  const now = Date.now()

  let record = rateLimitStore.get(key)

  // Check if client is blocked
  if (record?.blockedUntil && now < record.blockedUntil) {
    const retryAfter = Math.ceil((record.blockedUntil - now) / 1000)
    event.node.res.setHeader('Retry-After', retryAfter.toString())
    event.node.res.setHeader('X-RateLimit-Limit', config.maxRequests.toString())
    event.node.res.setHeader('X-RateLimit-Remaining', '0')
    event.node.res.setHeader('X-RateLimit-Reset', Math.ceil(record.blockedUntil / 1000).toString())
    
    throw createError({
      statusCode: 429,
      statusMessage: 'Too Many Requests',
      data: {
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter
      }
    })
  }

  // Initialize or reset record
  if (!record || now > record.resetTime) {
    record = {
      count: 1,
      resetTime: now + config.windowMs
    }
    rateLimitStore.set(key, record)
  } else {
    record.count++
  }

  // Set rate limit headers
  const remaining = Math.max(0, config.maxRequests - record.count)
  event.node.res.setHeader('X-RateLimit-Limit', config.maxRequests.toString())
  event.node.res.setHeader('X-RateLimit-Remaining', remaining.toString())
  event.node.res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000).toString())

  // Check if limit exceeded
  if (record.count > config.maxRequests) {
    // Block for increasing duration based on violations
    const blockDuration = Math.min(60_000 * Math.pow(2, Math.floor(record.count / config.maxRequests)), 3600_000)
    record.blockedUntil = now + blockDuration
    
    const retryAfter = Math.ceil(blockDuration / 1000)
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
})
