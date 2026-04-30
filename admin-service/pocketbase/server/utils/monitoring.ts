import { H3Event } from 'h3';
import { serverPocketBase } from './pocketbase';

export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  latencyMs?: number;
  details?: Record<string, unknown>;
}

export interface Metrics {
  timestamp: string;
  uptime: number;
  requests: {
    total: number;
    errors: number;
    avgDuration: number;
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    database: ComponentHealth;
    memory: ComponentHealth;
  };
}

// In-memory metrics store
const metricsStore = {
  requestCount: 0,
  errorCount: 0,
  totalDuration: 0,
  startTime: Date.now()
};

export async function checkDatabaseHealth(event: H3Event): Promise<ComponentHealth> {
  const start = performance.now();
  try {
    const pb = await serverPocketBase(event);
    await pb.health.check();
    const latencyMs = Math.round(performance.now() - start);

    if (latencyMs > 1000) {
      return { status: 'degraded', message: 'High database latency', latencyMs };
    }

    return { status: 'healthy', latencyMs };
  } catch (error: any) {
    const latencyMs = Math.round(performance.now() - start);
    return { status: 'unhealthy', message: error.message || 'Database unreachable', latencyMs };
  }
}

export function checkMemoryHealth(): ComponentHealth {
  const memoryUsage = process.memoryUsage();
  const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
  const heapTotalMB = memoryUsage.heapTotal / 1024 / 1024;
  const heapPercentage = (heapUsedMB / heapTotalMB) * 100;

  let status: ComponentHealth['status'] = 'healthy';
  let message: string | undefined;

  if (heapPercentage > 90) {
    status = 'unhealthy';
    message = 'Critical memory usage';
  } else if (heapPercentage > 75) {
    status = 'degraded';
    message = 'High memory usage';
  }

  return {
    status,
    message,
    details: {
      heapUsedMB: Math.round(heapUsedMB * 100) / 100,
      heapTotalMB: Math.round(heapTotalMB * 100) / 100,
      heapPercentage: Math.round(heapPercentage * 100) / 100
    }
  };
}

export function getMetrics(): Metrics {
  const memoryUsage = process.memoryUsage();
  return {
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - metricsStore.startTime) / 1000),
    requests: {
      total: metricsStore.requestCount,
      errors: metricsStore.errorCount,
      avgDuration: metricsStore.requestCount > 0
        ? Math.round(metricsStore.totalDuration / metricsStore.requestCount)
        : 0
    },
    memory: {
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      external: memoryUsage.external,
      rss: memoryUsage.rss,
    },
  };
}

export function recordRequest(duration: number, isError: boolean = false): void {
  metricsStore.requestCount++;
  metricsStore.totalDuration += duration;
  if (isError) {
    metricsStore.errorCount++;
  }
}

export async function getHealthStatus(event: H3Event): Promise<HealthStatus> {
  const [database, memory] = await Promise.all([
    checkDatabaseHealth(event),
    Promise.resolve(checkMemoryHealth()),
  ]);

  const checks = { database, memory };

  // Determine overall status
  let overallStatus: HealthStatus['status'] = 'healthy';
  for (const check of Object.values(checks)) {
    if (check.status === 'unhealthy') {
      overallStatus = 'unhealthy';
      break;
    }
    if (check.status === 'degraded') {
      overallStatus = 'degraded';
    }
  }

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - metricsStore.startTime) / 1000),
    version: process.env.APP_VERSION || '1.0.0',
    checks
  };
}
