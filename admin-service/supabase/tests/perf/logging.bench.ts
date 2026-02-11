import { bench, describe } from 'vitest'
import { logger } from '../../server/utils/logger'

const logEntry = {
  timestamp: new Date().toISOString(),
  level: 'info',
  service: 'admin-service',
  message: 'Analytics event ingested successfully',
  data: {
    path: '/some/path',
    processingTime: 12,
    retryCount: 0
  }
}

describe('Logging Performance', () => {
  bench('console.log(JSON.stringify)', () => {
    // Original implementation simulation
    console.log(JSON.stringify(logEntry))
  })

  bench('process.stdout.write(JSON.stringify)', () => {
    // Manual write simulation
    process.stdout.write(JSON.stringify(logEntry) + '\n')
  })

  bench('logger.info (pino)', () => {
    // New implementation
    // We pass the data object as context
    logger.info('Analytics event ingested successfully', {
      path: '/some/path',
      processingTime: 12,
      retryCount: 0
    })
  })
})
