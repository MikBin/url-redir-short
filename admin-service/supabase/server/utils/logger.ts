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

export interface LogEntry {
  timestamp: string
  level: LogLevel
  service: string
  message: string
  correlationId: string
  context?: LogContext
  error?: {
    name: string
    message: string
    stack?: string
  }
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
}

const currentLogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info'
const serviceName = process.env.SERVICE_NAME || 'admin-service'

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLogLevel]
}

function formatLogEntry(entry: LogEntry): string {
  return JSON.stringify(entry)
}

export function generateCorrelationId(): string {
  return randomUUID()
}

export function createLogger(defaultContext?: LogContext) {
  const correlationId = defaultContext?.correlationId || generateCorrelationId()

  function log(level: LogLevel, message: string, context?: LogContext, error?: Error) {
    if (!shouldLog(level)) return

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: serviceName,
      message,
      correlationId,
      context: { ...defaultContext, ...context }
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    }

    const formatted = formatLogEntry(entry)

    switch (level) {
      case 'error':
        console.error(formatted)
        break
      case 'warn':
        console.warn(formatted)
        break
      case 'debug':
        console.debug(formatted)
        break
      default:
        console.log(formatted)
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
