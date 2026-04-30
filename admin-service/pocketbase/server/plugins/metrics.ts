import { metrics } from '../utils/metrics'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', (event) => {
    event.context._start = Date.now()
  })

  nitroApp.hooks.hook('beforeResponse', (event) => {
    const start = event.context._start
    if (!start) return

    const duration = (Date.now() - start) / 1000
    const path = event.path || 'unknown'
    const status = event.res.statusCode || event.node.res.statusCode
    const method = event.method

    // Ignore metrics endpoint for stats
    if (path !== '/api/metrics') {
      metrics.requestsTotal.inc({ status })
      metrics.requestDuration.observe({ status }, duration)
    }
  })
})
