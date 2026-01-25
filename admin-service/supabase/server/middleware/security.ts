import { H3Event } from 'h3'

// CORS allowed origins from environment
const getAllowedOrigins = (): string[] => {
  const originsEnv = process.env.CORS_ALLOWED_ORIGINS || ''
  if (!originsEnv) return []
  return originsEnv.split(',').map(o => o.trim()).filter(Boolean)
}

// Security headers configuration
const securityHeaders = {
  // HSTS - enforce HTTPS
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  
  // Prevent clickjacking
  'X-Frame-Options': 'DENY',
  
  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',
  
  // XSS protection (legacy but still useful)
  'X-XSS-Protection': '1; mode=block',
  
  // Referrer policy
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  
  // Permissions policy
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  
  // Content Security Policy
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Nuxt needs these
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ')
}

export default defineEventHandler((event: H3Event) => {
  const origin = event.node.req.headers.origin
  const allowedOrigins = getAllowedOrigins()

  // Apply security headers
  for (const [header, value] of Object.entries(securityHeaders)) {
    event.node.res.setHeader(header, value)
  }

  // CORS handling
  if (origin) {
    // Check if origin is allowed
    const isAllowed = allowedOrigins.length === 0 || // Allow all if not configured
                      allowedOrigins.includes(origin) ||
                      allowedOrigins.includes('*')

    if (isAllowed) {
      event.node.res.setHeader('Access-Control-Allow-Origin', origin)
      event.node.res.setHeader('Access-Control-Allow-Credentials', 'true')
      event.node.res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      event.node.res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Correlation-ID')
      event.node.res.setHeader('Access-Control-Max-Age', '86400')
    }
  }

  // Handle preflight requests
  if (event.method === 'OPTIONS') {
    event.node.res.statusCode = 204
    event.node.res.end()
    return
  }
})
