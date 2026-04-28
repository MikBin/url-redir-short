import { randomUUID } from 'crypto'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogContext {
  correlationId?: string
  userId?: string
  method?: string
  path?: string
  statusCode?: number
  duration?: number
  [key: string]: unknown
}

const serviceName = process.env.SERVICE_NAME || 'pb-admin-service'

export function generateCorrelationId(): string {
  return randomUUID()
}

export function createLogger(defaultContext?: LogContext) {
  const correlationId = defaultContext?.correlationId || generateCorrelationId()

  function log(level: LogLevel, message: string, context?: LogContext, error?: Error) {
    const timestamp = new Date().toISOString()
    const mergedContext = { ...defaultContext, ...context }

    const logEntry: any = {
      level,
      timestamp,
      service: serviceName,
      correlationId,
      message,
      context: mergedContext
    }

    if (error) {
      logEntry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    }

    if (level === 'error') {
      console.error(JSON.stringify(logEntry))
    } else {
      console.log(JSON.stringify(logEntry))
    }
  }

  return {
    correlationId,
    debug: (message: string, context?: LogContext) => log('debug', message, context),
    info: (message: string, context?: LogContext) => log('info', message, context),
    warn: (message: string, context?: LogContext) => log('warn', message, context),
    error: (message: string, context?: LogContext, err?: Error) => log('error', message, context, err),
    child: (childContext: LogContext) => createLogger({ ...defaultContext, ...childContext, correlationId })
  }
}

export type Logger = ReturnType<typeof createLogger>

// Global logger instance
export const logger = createLogger()
