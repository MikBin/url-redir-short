import { metrics } from '../utils/metrics'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Content-Type', metrics.registry.contentType)
  return await metrics.registry.metrics()
})
