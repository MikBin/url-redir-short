import { H3Event } from 'h3';
import { serverPocketBase } from './pocketbase';

export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  latencyMs?: number;
}

export interface Metrics {
  timestamp: string;
  uptime: number;
  requests: {
    total: number;
    errors: number;
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
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

let requestCount = 0;
let errorCount = 0;

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
  const memory = process.memoryUsage();
  const heapFraction = memory.heapUsed / memory.heapTotal;

  if (heapFraction > 0.9) {
    return { status: 'unhealthy', message: 'High memory usage' };
  }
  if (heapFraction > 0.75) {
    return { status: 'degraded', message: 'Elevated memory usage' };
  }
  return { status: 'healthy' };
}

export function getMetrics(): Metrics {
  const memory = process.memoryUsage();
  return {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    requests: {
      total: requestCount,
      errors: errorCount,
    },
    memory: {
      heapUsed: memory.heapUsed,
      heapTotal: memory.heapTotal,
      rss: memory.rss,
    },
  };
}

export function recordRequest(duration: number, isError: boolean = false): void {
  requestCount++;
  if (isError) {
    errorCount++;
  }
}

export async function getHealthStatus(event: H3Event): Promise<HealthStatus> {
  const [database, memory] = await Promise.all([
    checkDatabaseHealth(event),
    Promise.resolve(checkMemoryHealth()),
  ]);

  let status: HealthStatus['status'] = 'healthy';

  if (database.status === 'unhealthy' || memory.status === 'unhealthy') {
    status = 'unhealthy';
  } else if (database.status === 'degraded' || memory.status === 'degraded') {
    status = 'degraded';
  }

  return {
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.APP_VERSION || '1.0.0',
    checks: {
      database,
      memory,
    },
  };
}
