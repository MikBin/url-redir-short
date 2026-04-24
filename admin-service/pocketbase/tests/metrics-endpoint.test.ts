import { describe, it, expect } from 'vitest';
import { getMetrics } from '../server/utils/monitoring';

describe('Metrics Endpoint Logic', () => {
  it('should return metrics structure with timestamp, uptime, memory, and requests fields', () => {
    // Test the `getMetrics()` function directly as requested
    const metrics = getMetrics();

    // Verify the structure matches the requirements
    expect(metrics).toHaveProperty('timestamp');
    expect(typeof metrics.timestamp).toBe('string');
    expect(new Date(metrics.timestamp).getTime()).not.toBeNaN(); // Valid ISO string

    expect(metrics).toHaveProperty('uptime');
    expect(typeof metrics.uptime).toBe('number');
    expect(metrics.uptime).toBeGreaterThanOrEqual(0);

    expect(metrics).toHaveProperty('requests');
    expect(metrics.requests).toHaveProperty('total');
    expect(metrics.requests).toHaveProperty('errors');
    expect(typeof metrics.requests.total).toBe('number');
    expect(typeof metrics.requests.errors).toBe('number');

    expect(metrics).toHaveProperty('memory');
    expect(metrics.memory).toHaveProperty('heapUsed');
    expect(metrics.memory).toHaveProperty('heapTotal');
    expect(metrics.memory).toHaveProperty('rss');
    expect(typeof metrics.memory.heapUsed).toBe('number');
    expect(typeof metrics.memory.heapTotal).toBe('number');
    expect(typeof metrics.memory.rss).toBe('number');
  });
});
