import { z } from 'zod'

// Common validation schemas
export const schemas = {
  uuid: z.string().uuid(),
  email: z.string().email().max(254),
  url: z.string().url().max(2048),
  slug: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),
  path: z.string().min(1).max(2048),
  ipAddress: z.string().ip(),
  dateRange: z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional()
  }),
  pagination: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20)
  })
}

// Sanitize HTML to prevent XSS
export function sanitizeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

// Sanitize for SQL (basic - prefer parameterized queries)
export function sanitizeSqlIdentifier(input: string): string {
  return input.replace(/[^a-zA-Z0-9_]/g, '')
}

// Sanitize URL path
export function sanitizePath(input: string): string {
  return input
    .replace(/[<>'"]/g, '')
    .replace(/\.\./g, '')
    .replace(/\/+/g, '/')
    .trim()
}

// Sanitize user agent
export function sanitizeUserAgent(input: string | null | undefined): string | null {
  if (!input) return null
  return input.substring(0, 500).replace(/[<>]/g, '')
}

// Sanitize general text input
export function sanitizeText(input: string, maxLength = 1000): string {
  return input
    .substring(0, maxLength)
    .replace(/[<>]/g, '')
    .trim()
}

// Validate and parse query parameters
export function parseQueryParams<T extends z.ZodType>(
  query: Record<string, unknown>,
  schema: T
): z.infer<T> {
  return schema.parse(query)
}

// Validate request body
export function parseBody<T extends z.ZodType>(
  body: unknown,
  schema: T
): z.infer<T> {
  return schema.parse(body)
}

// Link creation/update schema
export const linkSchema = z.object({
  slug: schemas.slug,
  destination: schemas.url,
  domainId: schemas.uuid.optional(),
  isActive: z.boolean().optional().default(true),
  targeting: z.any().optional(),
  abTesting: z.any().optional(),
  hsts: z.any().optional(),
  passwordProtection: z.any().optional(),
  expiresAt: z.string().datetime().optional().nullable(),
  maxClicks: z.number().int().min(1).optional().nullable()
})

// Analytics query schema
export const analyticsQuerySchema = z.object({
  linkId: schemas.uuid.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  groupBy: z.enum(['hour', 'day', 'week', 'month']).optional()
})

// Export query schema
export const exportQuerySchema = z.object({
  format: z.enum(['csv', 'json']).default('json'),
  linkId: schemas.uuid.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional()
})

export type LinkInput = z.infer<typeof linkSchema>
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>
export type ExportQuery = z.infer<typeof exportQuerySchema>
