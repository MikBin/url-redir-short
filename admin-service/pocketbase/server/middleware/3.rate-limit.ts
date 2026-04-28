import { defineEventHandler, setHeader, setResponseStatus, createError } from 'h3'
import { fnv1a64 } from '../utils/hash'
import { checkRateLimit } from '../utils/rate-limit'

const rateLimits: Record<string, { limit: number; windowSeconds: number }> = {
  '/api/analytics': { limit: 100, windowSeconds: 60 },
  '/api/bulk': { limit: 5, windowSeconds: 60 },
  '/api/links': { limit: 30, windowSeconds: 60 },
  '/api/auth': { limit: 10, windowSeconds: 60 },
  '/api/health': { limit: 1000, windowSeconds: 60 },
  '/api/metrics': { limit: 60, windowSeconds: 60 },
  'default': { limit: 60, windowSeconds: 60 }
}

function getClientIp(event: any): string {
  const xForwardedFor = event.node.req.headers['x-forwarded-for']
  if (xForwardedFor) {
    if (typeof xForwardedFor === 'string') {
      return xForwardedFor.split(',')[0].trim()
    } else if (Array.isArray(xForwardedFor)) {
      return xForwardedFor[0].split(',')[0].trim()
    }
  }
  return event.node.req.socket?.remoteAddress || 'unknown-ip'
}

export default defineEventHandler((event) => {
  if (!event.path.startsWith('/api/')) {
    return
  }

  try {
    const ip = getClientIp(event)
    const clientHash = fnv1a64(ip)

    const pathSegments = event.path.split('?')[0].split('/').filter(Boolean)
    // We want the first 2 segments for the prefix like /api/links since the path starts with /api/
    // segments: ['api', 'links', 'etc']
    const pathPrefix = `/${pathSegments.slice(0, 2).join('/')}`

    const config = rateLimits[pathPrefix] || rateLimits['default']
    const key = `${clientHash}:${pathPrefix}`

    const result = checkRateLimit(key, config.limit, config.windowSeconds)

    setHeader(event, 'X-RateLimit-Limit', result.limit.toString())
    setHeader(event, 'X-RateLimit-Remaining', result.remaining.toString())
    setHeader(event, 'X-RateLimit-Reset', result.reset.toString())

    if (!result.allowed) {
      if (result.retryAfter !== undefined) {
        setHeader(event, 'Retry-After', result.retryAfter.toString())
      }
      setResponseStatus(event, 429)
      throw createError({ statusCode: 429, statusMessage: 'Too Many Requests' })
    }
  } catch (err: any) {
    if (err.statusCode === 429) {
      throw err
    }
    console.error('Rate limit middleware error:', err)
    // Fail open if something goes wrong
  }
})
