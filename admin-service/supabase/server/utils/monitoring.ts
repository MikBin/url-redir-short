import { serverSupabaseServiceRole } from '#supabase/server'
import { H3Event } from 'h3'

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  uptime: number
  version: string
  checks: {
    database: ComponentHealth
    memory: ComponentHealth
  }
}

export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  message?: string
  latencyMs?: number
  details?: Record<string, unknown>
}

export interface Metrics {
  timestamp: string
  uptime: number
  memory: {
    heapUsed: number
    heapTotal: number
    external: number
    rss: number
  }
  requests: {
    total: number
    errors: number
    avgDuration: number
  }
}

// In-memory metrics store
const metricsStore = {
  requestCount: 0,
  errorCount: 0,
  totalDuration: 0,
  startTime: Date.now()
}

export function recordRequest(duration: number, isError: boolean) {
  metricsStore.requestCount++
  metricsStore.totalDuration += duration
  if (isError) {
    metricsStore.errorCount++
  }
}

export async function checkDatabaseHealth(event: H3Event): Promise<ComponentHealth> {
  const startTime = Date.now()
  
  try {
    const client = serverSupabaseServiceRole(event)
    
    // Simple health check query
    const { error } = await client
      .from('links')
      .select('id', { count: 'exact', head: true })
      .limit(1)

    const latencyMs = Date.now() - startTime

    if (error) {
      return {
        status: latencyMs > 5000 ? 'unhealthy' : 'degraded',
        message: error.message,
        latencyMs
      }
    }

    return {
      status: latencyMs > 1000 ? 'degraded' : 'healthy',
      latencyMs,
      message: latencyMs > 1000 ? 'High latency detected' : undefined
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error',
      latencyMs: Date.now() - startTime
    }
  }
}

export function checkMemoryHealth(): ComponentHealth {
  const memoryUsage = process.memoryUsage()
  const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024
  const heapTotalMB = memoryUsage.heapTotal / 1024 / 1024
  const heapPercentage = (heapUsedMB / heapTotalMB) * 100

  let status: ComponentHealth['status'] = 'healthy'
  let message: string | undefined

  if (heapPercentage > 90) {
    status = 'unhealthy'
    message = 'Critical memory usage'
  } else if (heapPercentage > 75) {
    status = 'degraded'
    message = 'High memory usage'
  }

  return {
    status,
    message,
    details: {
      heapUsedMB: Math.round(heapUsedMB * 100) / 100,
      heapTotalMB: Math.round(heapTotalMB * 100) / 100,
      heapPercentage: Math.round(heapPercentage * 100) / 100
    }
  }
}

export async function getHealthStatus(event: H3Event): Promise<HealthStatus> {
  const [databaseHealth, memoryHealth] = await Promise.all([
    checkDatabaseHealth(event),
    Promise.resolve(checkMemoryHealth())
  ])

  const checks = { database: databaseHealth, memory: memoryHealth }
  
  // Determine overall status
  let overallStatus: HealthStatus['status'] = 'healthy'
  for (const check of Object.values(checks)) {
    if (check.status === 'unhealthy') {
      overallStatus = 'unhealthy'
      break
    }
    if (check.status === 'degraded') {
      overallStatus = 'degraded'
    }
  }

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - metricsStore.startTime) / 1000),
    version: process.env.APP_VERSION || '1.0.0',
    checks
  }
}

export function getMetrics(): Metrics {
  const memoryUsage = process.memoryUsage()

  return {
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - metricsStore.startTime) / 1000),
    memory: {
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      external: memoryUsage.external,
      rss: memoryUsage.rss
    },
    requests: {
      total: metricsStore.requestCount,
      errors: metricsStore.errorCount,
      avgDuration: metricsStore.requestCount > 0 
        ? Math.round(metricsStore.totalDuration / metricsStore.requestCount)
        : 0
    }
  }
}
