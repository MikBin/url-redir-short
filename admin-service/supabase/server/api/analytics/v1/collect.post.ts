
import { serverSupabaseServiceRole } from '#supabase/server'
import { createHash } from 'crypto'
import { z } from 'zod'

// Enhanced validation schema using Zod
const AnalyticsPayloadSchema = z.object({
  path: z.string().min(1).max(2048),
  destination: z.string().min(1).max(2048).url(),
  timestamp: z.string().datetime().optional(),
  ip: z.string().ip().optional(),
  user_agent: z.string().max(500).nullable().optional(),
  referrer: z.string().max(2048).url().nullable().optional(),
  referrer_source: z.enum(['explicit', 'implicit', 'none']).optional(),
  status: z.number().int().min(100).max(599),
  session_id: z.string().uuid().optional(),
  country: z.string().length(2).optional(),
  city: z.string().max(100).optional(),
  device_type: z.enum(['desktop', 'mobile', 'tablet', 'bot']).optional(),
  browser: z.string().max(50).optional(),
  os: z.string().max(50).optional()
})

type AnalyticsPayload = z.infer<typeof AnalyticsPayloadSchema>

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100 // requests per window per IP

// In-memory rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Helper function to hash IP addresses for privacy
function hashIP(ip: string): string {
  return createHash('sha256').update(ip + process.env.IP_HASH_SALT || 'default-salt').digest('hex')
}

// Helper function to validate and sanitize input
function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/[^\w\s\-._~:/?#[\]@!$&'()*+,;=]/g, '') // Keep URL-safe characters
    .trim()
}

// Rate limiting middleware
function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const key = hashIP(ip)
  const record = rateLimitStore.get(key)

  if (!record || now > record.resetTime) {
    // Reset window
    rateLimitStore.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return true
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false
  }

  record.count++
  return true
}

// Structured logging helper
function logAnalyticsEvent(level: 'info' | 'warn' | 'error', message: string, data?: any) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    service: 'analytics-ingestion',
    message,
    data
  }
  console.log(JSON.stringify(logEntry))
}

// Error response helper
function createErrorResponse(statusCode: number, message: string, details?: any) {
  logAnalyticsEvent('error', message, { statusCode, details })
  return createError({
    statusCode,
    statusMessage: message,
    data: details
  })
}

export default defineEventHandler(async (event) => {
  const startTime = Date.now()
  const clientIP = event.node.req.headers['x-forwarded-for'] || 
                   event.node.req.headers['x-real-ip'] || 
                   event.node.req.socket.remoteAddress || 'unknown'
  
  // Apply rate limiting
  if (!checkRateLimit(clientIP as string)) {
    throw createErrorResponse(429, 'Rate limit exceeded')
  }

  const client = serverSupabaseServiceRole(event)
  const body = await readBody<AnalyticsPayload>(event)

  try {
    // Validate input using Zod schema
    const validatedData = AnalyticsPayloadSchema.parse(body)

    // Sanitize string inputs
    const sanitizedData = {
      ...validatedData,
      path: sanitizeInput(validatedData.path),
      destination: sanitizeInput(validatedData.destination),
      user_agent: validatedData.user_agent ? sanitizeInput(validatedData.user_agent) : null,
      referrer: validatedData.referrer ? sanitizeInput(validatedData.referrer) : null
    }

    // Hash IP for privacy compliance
    const hashedIP = hashIP(sanitizedData.ip || clientIP as string)

    // Set default timestamp if not provided
    const timestamp = sanitizedData.timestamp || new Date().toISOString()

    // Prepare database record
    const dbRecord = {
      path: sanitizedData.path,
      destination: sanitizedData.destination,
      timestamp,
      ip: hashedIP,
      user_agent: sanitizedData.user_agent,
      referrer: sanitizedData.referrer,
      referrer_source: sanitizedData.referrer_source || 'none',
      status: sanitizedData.status,
      session_id: sanitizedData.session_id,
      country: sanitizedData.country,
      city: sanitizedData.city,
      device_type: sanitizedData.device_type,
      browser: sanitizedData.browser,
      os: sanitizedData.os
    }

    // Insert into database with retry logic
    let retryCount = 0
    const maxRetries = 3
    let dbError

    while (retryCount < maxRetries) {
      const { error } = await client
        .from('analytics_events')
        .insert(dbRecord)

      if (!error) {
        break
      }

      dbError = error
      retryCount++
      
      if (retryCount < maxRetries) {
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 100))
      }
    }

    if (dbError) {
      logAnalyticsEvent('error', 'Database insertion failed after retries', { 
        error: dbError, 
        retryCount,
        data: dbRecord 
      })
      throw createErrorResponse(500, 'Failed to store analytics data', { retryCount })
    }

    // Log successful ingestion
    const processingTime = Date.now() - startTime
    logAnalyticsEvent('info', 'Analytics event ingested successfully', {
      path: sanitizedData.path,
      processingTime,
      retryCount
    })

    return { 
      success: true,
      processingTime,
      timestamp
    }

  } catch (error) {
    if (error instanceof z.ZodError) {
      logAnalyticsEvent('warn', 'Validation failed', { 
        errors: error.errors,
        input: body 
      })
      throw createErrorResponse(400, 'Invalid payload format', error.errors)
    }

    if (error.statusCode) {
      // Re-throw known errors
      throw error
    }

    // Handle unexpected errors
    logAnalyticsEvent('error', 'Unexpected error in analytics ingestion', {
      error: error.message,
      stack: error.stack,
      input: body
    })
    throw createErrorResponse(500, 'Internal server error')
  }
})
