import { getHealthStatus } from '../utils/monitoring'

export default defineEventHandler(async (event) => {
  const health = await getHealthStatus(event)

  // Set appropriate status code based on health
  if (health.status === 'unhealthy') {
    event.node.res.statusCode = 503
  } else if (health.status === 'degraded') {
    event.node.res.statusCode = 200
  }

  // Allow caching for 10 seconds
  event.node.res.setHeader('Cache-Control', 'public, max-age=10')

  return health
})
