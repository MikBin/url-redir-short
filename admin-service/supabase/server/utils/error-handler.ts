import { H3Event, createError } from 'h3'
import { createLogger, Logger, generateCorrelationId } from './logger'

export interface AppError {
  statusCode: number
  statusMessage: string
  message: string
  code?: string
  correlationId: string
  details?: unknown
}

export interface RetryOptions {
  maxRetries?: number
  baseDelayMs?: number
  maxDelayMs?: number
  shouldRetry?: (error: unknown) => boolean
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelayMs: 100,
  maxDelayMs: 5000,
  shouldRetry: (error) => {
    // Retry on network errors and 5xx status codes
    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      return message.includes('network') ||
             message.includes('timeout') ||
             message.includes('connection') ||
             message.includes('econnreset')
    }
    return false
  }
}

export function isTransientError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return message.includes('network') ||
           message.includes('timeout') ||
           message.includes('connection') ||
           message.includes('econnreset') ||
           message.includes('temporarily unavailable')
  }
  return false
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
  logger?: Logger
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options }
  let lastError: unknown
  let attempt = 0

  while (attempt < opts.maxRetries) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      attempt++

      if (attempt >= opts.maxRetries || !opts.shouldRetry(error)) {
        break
      }

      // Exponential backoff with jitter
      const delay = Math.min(
        opts.baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 100,
        opts.maxDelayMs
      )

      logger?.warn('Operation failed, retrying', {
        attempt,
        maxRetries: opts.maxRetries,
        delayMs: delay,
        errorMessage: error instanceof Error ? error.message : String(error)
      })

      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

export function createAppError(
  statusCode: number,
  message: string,
  options?: {
    code?: string
    correlationId?: string
    details?: unknown
    cause?: Error
  }
): AppError {
  const correlationId = options?.correlationId || generateCorrelationId()

  return {
    statusCode,
    statusMessage: getStatusMessage(statusCode),
    message,
    code: options?.code,
    correlationId,
    details: options?.details
  }
}

export function handleError(
  event: H3Event,
  error: unknown,
  logger: Logger
): never {
  const correlationId = logger.correlationId

  if (error instanceof Error && 'statusCode' in error) {
    // Already an H3 error
    const h3Error = error as Error & { statusCode: number; statusMessage?: string; data?: unknown }
    logger.error('Request error', {
      statusCode: h3Error.statusCode,
      errorMessage: h3Error.message
    }, error)

    throw createError({
      statusCode: h3Error.statusCode,
      statusMessage: h3Error.statusMessage || h3Error.message,
      data: {
        correlationId,
        ...(h3Error.data as object || {})
      }
    })
  }

  if (error instanceof Error) {
    logger.error('Unhandled error', {
      errorType: error.name
    }, error)

    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      data: {
        correlationId,
        message: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
      }
    })
  }

  logger.error('Unknown error type', { error: String(error) })

  throw createError({
    statusCode: 500,
    statusMessage: 'Internal Server Error',
    data: {
      correlationId,
      message: 'An unexpected error occurred'
    }
  })
}

function getStatusMessage(statusCode: number): string {
  const messages: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout'
  }
  return messages[statusCode] || 'Unknown Error'
}

export function createRequestLogger(event: H3Event): Logger {
  const correlationId = (event.node.req.headers['x-correlation-id'] as string) || generateCorrelationId()
  
  return createLogger({
    correlationId,
    method: event.method,
    path: event.path
  })
}
