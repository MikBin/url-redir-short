import { describe, it, expect } from 'vitest'
import { createRequestLogger } from '../server/utils/error-handler'
import { H3Event } from 'h3'

describe('error middleware', () => {
  it('createRequestLogger returns logger with correlationId and logging methods', () => {
    // Mock H3Event minimal required properties for createRequestLogger
    const mockEvent = {
      method: 'GET',
      path: '/test',
      node: {
        req: {
          headers: {}
        }
      }
    } as unknown as H3Event

    const logger = createRequestLogger(mockEvent)

    // Check that correlationId is a valid UUID
    expect(logger.correlationId).toBeDefined()
    expect(typeof logger.correlationId).toBe('string')

    // UUID regex format (v4)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    expect(logger.correlationId).toMatch(uuidRegex)

    // Check methods existence
    expect(typeof logger.info).toBe('function')
    expect(typeof logger.error).toBe('function')
    expect(typeof logger.warn).toBe('function')
    expect(typeof logger.debug).toBe('function')
  })
})
