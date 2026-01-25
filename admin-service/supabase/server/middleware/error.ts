import { H3Event, createError } from 'h3'
import { createRequestLogger } from '../utils/error-handler'

export default defineEventHandler((event: H3Event) => {
  const startTime = Date.now()
  const logger = createRequestLogger(event)

  // Store logger on event for use in handlers
  event.context.logger = logger
  event.context.correlationId = logger.correlationId

  // Set correlation ID header for response
  event.node.res.setHeader('X-Correlation-ID', logger.correlationId)

  // Log request start
  logger.info('Request started')

  // Handle response completion
  event.node.res.on('finish', () => {
    const duration = Date.now() - startTime
    const statusCode = event.node.res.statusCode

    logger.info('Request completed', {
      statusCode,
      duration,
      contentLength: event.node.res.getHeader('content-length') as string | undefined
    })
  })

  // Global error handling is done via nitro error handler
  // This middleware sets up logging context
})

// Declare module augmentation for event context
declare module 'h3' {
  interface H3EventContext {
    logger: ReturnType<typeof createRequestLogger>
    correlationId: string
  }
}
