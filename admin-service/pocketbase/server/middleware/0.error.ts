import { defineEventHandler, setHeader } from 'h3'
import { createRequestLogger } from '../utils/error-handler'

export default defineEventHandler((event) => {
  const startTime = Date.now()
  const logger = createRequestLogger(event)

  event.context.logger = logger
  event.context.correlationId = logger.correlationId

  setHeader(event, 'X-Correlation-ID', logger.correlationId)

  logger.info('Request started')

  event.node.res.on('finish', () => {
    const duration = Date.now() - startTime
    const statusCode = event.node.res.statusCode
    const contentLength = event.node.res.getHeader('content-length')

    logger.info('Request completed', {
      statusCode,
      duration,
      contentLength: contentLength ? String(contentLength) : undefined
    })
  })
})

declare module 'h3' {
  interface H3EventContext {
    logger: ReturnType<typeof createRequestLogger>
    correlationId: string
  }
}
