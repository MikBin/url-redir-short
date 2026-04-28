import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createLogger, generateCorrelationId } from '../server/utils/logger'

describe('Logger Utility', () => {
  let consoleLogSpy: any
  let consoleErrorSpy: any

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('generateCorrelationId returns uuid format', () => {
    const id = generateCorrelationId()
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })

  it('createLogger returns object with methods', () => {
    const logger = createLogger()
    expect(logger.info).toBeDefined()
    expect(logger.error).toBeDefined()
    expect(logger.warn).toBeDefined()
    expect(logger.debug).toBeDefined()
    expect(logger.child).toBeDefined()
  })

  it('logger logs as JSON with expected fields', () => {
    const logger = createLogger({ userId: '123' })
    logger.info('test message', { action: 'test' })

    expect(consoleLogSpy).toHaveBeenCalled()
    const logStr = consoleLogSpy.mock.calls[0][0]
    const logObj = JSON.parse(logStr)

    expect(logObj.level).toBe('info')
    expect(logObj.message).toBe('test message')
    expect(logObj.correlationId).toBeDefined()
    expect(logObj.service).toBe('pb-admin-service')
    expect(logObj.context.userId).toBe('123')
    expect(logObj.context.action).toBe('test')
    expect(logObj.timestamp).toBeDefined()
  })

  it('logger error logs to console.error with error details', () => {
    const logger = createLogger()
    const err = new Error('test error')
    logger.error('failed', { path: '/' }, err)

    expect(consoleErrorSpy).toHaveBeenCalled()
    const logStr = consoleErrorSpy.mock.calls[0][0]
    const logObj = JSON.parse(logStr)

    expect(logObj.level).toBe('error')
    expect(logObj.message).toBe('failed')
    expect(logObj.error.message).toBe('test error')
    expect(logObj.error.name).toBe('Error')
    expect(logObj.error.stack).toBeDefined()
  })
})
