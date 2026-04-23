import { describe, it, expect } from 'vitest';
import { checkMemoryHealth, getMetrics, recordRequest } from '../server/utils/monitoring';

describe('Monitoring Utilities', () => {
  it('should return valid memory health status', () => {
    const memoryHealth = checkMemoryHealth();

    expect(['healthy', 'degraded', 'unhealthy']).toContain(memoryHealth.status);

    if (memoryHealth.status !== 'healthy') {
      expect(memoryHealth.message).toBeDefined();
    }
  });

  it('should return a valid metrics structure', () => {
    const metrics = getMetrics();

    expect(metrics).toHaveProperty('requests');
    expect(typeof metrics.requests.total).toBe('number');
    expect(typeof metrics.requests.errors).toBe('number');

    expect(metrics).toHaveProperty('memory');
    expect(typeof metrics.memory.heapUsed).toBe('number');
    expect(typeof metrics.memory.heapTotal).toBe('number');
    expect(typeof metrics.memory.rss).toBe('number');
  });

  it('should increment request and error counters correctly', () => {
    const initialMetrics = getMetrics();
    const initialTotal = initialMetrics.requests.total;
    const initialErrors = initialMetrics.requests.errors;

    // Record successful request
    recordRequest(100, false);

    let currentMetrics = getMetrics();
    expect(currentMetrics.requests.total).toBe(initialTotal + 1);
    expect(currentMetrics.requests.errors).toBe(initialErrors);

    // Record errored request
    recordRequest(200, true);

    currentMetrics = getMetrics();
    expect(currentMetrics.requests.total).toBe(initialTotal + 2);
    expect(currentMetrics.requests.errors).toBe(initialErrors + 1);
  });
});
