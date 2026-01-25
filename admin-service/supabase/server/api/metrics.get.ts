import { serverSupabaseUser } from '#supabase/server'
import { getMetrics } from '../utils/monitoring'
import { createRequestLogger, handleError } from '../utils/error-handler'

export default defineEventHandler(async (event) => {
  const logger = event.context.logger || createRequestLogger(event)

  try {
    // Require authentication for metrics endpoint
    const user = await serverSupabaseUser(event)
    if (!user) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    // In production, you might want to check for admin role
    // if (!user.app_metadata?.role?.includes('admin')) {
    //   throw createError({ statusCode: 403, statusMessage: 'Forbidden - Admin access required' })
    // }

    const metrics = getMetrics()

    // No caching for real-time metrics
    event.node.res.setHeader('Cache-Control', 'no-store')

    return metrics
  } catch (error) {
    handleError(event, error, logger)
  }
})
