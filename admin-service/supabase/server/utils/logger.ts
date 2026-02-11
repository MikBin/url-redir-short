import { randomUUID } from 'crypto'
import pino from 'pino'

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

const serviceName = process.env.SERVICE_NAME || 'admin-service'
const logLevel = (process.env.LOG_LEVEL as LogLevel) || 'info'

// Configure pino for asynchronous logging
const rootLogger = pino({
  level: logLevel,
  timestamp: pino.stdTimeFunctions.isoTime,
  messageKey: 'message',
  formatters: {
    level: (label) => ({ level: label }),
  },
  base: undefined, // Removes pid and hostname to match existing structure
}, pino.destination({ sync: false }))

export function generateCorrelationId(): string {
  return randomUUID()
}

export function createLogger(defaultContext?: LogContext) {
  const correlationId = defaultContext?.correlationId || generateCorrelationId()

  // Create a child logger with consistent bindings
  const bindings = {
    service: serviceName,
    correlationId,
  }

  const child = rootLogger.child(bindings)

  function log(level: LogLevel, message: string, context?: LogContext, error?: Error) {
    const mergedContext = { ...defaultContext, ...context }
    // Ensure context is not empty before adding it?
    // Existing logger always adds context field if I recall, wait.
    // Existing logger: `context: { ...defaultContext, ...context }`

    const logObject: any = {
      context: mergedContext
    }

    if (error) {
      logObject.error = {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    }

    // Call pino method
    // pino types might complain if level is not exactly one of the strings, but it is.
    (child as any)[level](logObject, message)
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
