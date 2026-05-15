import { describe, it, expect, vi, beforeEach } from 'vitest'

// We need to mock pino to spy on its methods
const mockChildLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

vi.mock('pino', () => {
  const pinoInstance = {
    child: vi.fn().mockReturnValue({
      debug: (...args: any[]) => mockChildLogger.debug(...args),
      info: (...args: any[]) => mockChildLogger.info(...args),
      warn: (...args: any[]) => mockChildLogger.warn(...args),
      error: (...args: any[]) => mockChildLogger.error(...args),
    }),
  }
  const pinoMock: any = vi.fn((opts) => {
    // Keep it in the mock function itself instead of a global
    pinoMock.opts = opts
    return pinoInstance
  })
  pinoMock.stdTimeFunctions = { isoTime: vi.fn() }
  pinoMock.destination = vi.fn()

  return {
    default: pinoMock,
  }
})

import pino from 'pino'
import { createLogger, generateCorrelationId } from '../server/utils/logger'

describe('logger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('generateCorrelationId returns a string', () => {
    const id = generateCorrelationId()
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('createLogger creates a logger with auto correlationId', () => {
    const logger = createLogger()
    expect(logger.correlationId).toBeDefined()
    expect(typeof logger.correlationId).toBe('string')
  })

  it('createLogger uses provided correlationId', () => {
    const defaultContext = { correlationId: 'test-corr-id' }
    const logger = createLogger(defaultContext)
    expect(logger.correlationId).toBe('test-corr-id')
  })

  it('logs debug messages', () => {
    const logger = createLogger({ correlationId: 'test' })
    logger.debug('debug message')
    expect(mockChildLogger.debug).toHaveBeenCalledWith(
      { context: { correlationId: 'test' } },
      'debug message'
    )
  })

  it('logs info messages with context', () => {
    const logger = createLogger({ correlationId: 'test' })
    logger.info('info message', { userId: '123' })
    expect(mockChildLogger.info).toHaveBeenCalledWith(
      { context: { correlationId: 'test', userId: '123' } },
      'info message'
    )
  })

  it('logs warn messages', () => {
    const logger = createLogger({ correlationId: 'test' })
    logger.warn('warn message')
    expect(mockChildLogger.warn).toHaveBeenCalledWith(
      { context: { correlationId: 'test' } },
      'warn message'
    )
  })

  it('logs error messages with error object', () => {
    const logger = createLogger({ correlationId: 'test' })
    const error = new Error('test error')
    error.stack = 'test stack'
    logger.error('error message', { path: '/' }, error)

    expect(mockChildLogger.error).toHaveBeenCalledWith(
      {
        context: { correlationId: 'test', path: '/' },
        error: {
          name: 'Error',
          message: 'test error',
          stack: 'test stack'
        }
      },
      'error message'
    )
  })

  it('logs error messages without error object', () => {
    const logger = createLogger({ correlationId: 'test' })
    logger.error('error message', { path: '/' })

    expect(mockChildLogger.error).toHaveBeenCalledWith(
      {
        context: { correlationId: 'test', path: '/' }
      },
      'error message'
    )
  })

  it('creates a child logger that inherits context', () => {
    const parent = createLogger({ correlationId: 'test', userId: 'u1' })
    const child = parent.child({ path: '/test' })

    child.info('child message', { extra: 'data' })

    expect(mockChildLogger.info).toHaveBeenCalledWith(
      { context: { correlationId: 'test', userId: 'u1', path: '/test', extra: 'data' } },
      'child message'
    )
    expect(child.correlationId).toBe(parent.correlationId)
  })

  it('exports a default logger instance', async () => {
    const module = await import('../server/utils/logger')
    expect(module.logger).toBeDefined()
    expect(module.logger.correlationId).toBeDefined()
  })

  it('formats level correctly in pino options', () => {
    const pinoMock = pino as any
    expect(pinoMock.opts).toBeDefined()
    const formatLevel = pinoMock.opts.formatters.level
    expect(formatLevel('info')).toEqual({ level: 'info' })
  })
})
