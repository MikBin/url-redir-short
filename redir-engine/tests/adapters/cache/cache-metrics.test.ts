import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CacheMetricsCollector } from '../../../src/adapters/cache/cache-metrics';

describe('CacheMetricsCollector', () => {
  let collector: CacheMetricsCollector;

  beforeEach(() => {
    collector = new CacheMetricsCollector();
    // Provide a consistent memoryUsage for tests
    vi.spyOn(process, 'memoryUsage').mockReturnValue({
      heapUsed: 1024 * 1024 * 50, // 50MB
      rss: 0,
      heapTotal: 0,
      external: 0,
      arrayBuffers: 0
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with empty metrics', () => {
    const metrics = collector.getMetrics();
    expect(metrics.totalRequests).toBe(0);
    expect(metrics.hits).toBe(0);
    expect(metrics.misses).toBe(0);
    expect(metrics.hitRatio).toBe(0);
    expect(metrics.avgCachedLatency).toBe(0);
    expect(metrics.avgUncachedLatency).toBe(0);
    expect(metrics.avgLatencyImprovement).toBe(0);
    expect(metrics.p95CachedLatency).toBe(0);
    expect(metrics.p99UncachedLatency).toBe(0);
    expect(metrics.heapUsedMB).toBe(50);
  });

  it('should record requests correctly', () => {
    collector.recordRequest('/path1', true, 10);
    collector.recordRequest('/path2', false, 50);

    const metrics = collector.getMetrics();
    expect(metrics.totalRequests).toBe(2);
    expect(metrics.hits).toBe(1);
    expect(metrics.misses).toBe(1);
    expect(metrics.hitRatio).toBe(0.5);
    expect(metrics.avgCachedLatency).toBe(10);
    expect(metrics.avgUncachedLatency).toBe(50);
    expect(metrics.avgLatencyImprovement).toBe(80); // (50-10)/50 * 100
  });

  it('should calculate percentiles correctly', () => {
    // 100 requests to make percentiles easy
    for (let i = 1; i <= 100; i++) {
      collector.recordRequest(`/cached${i}`, true, i); // 1 to 100ms
      collector.recordRequest(`/uncached${i}`, false, i * 2); // 2 to 200ms
    }

    const metrics = collector.getMetrics();
    // length * 0.95 = 95. Array is 0-indexed, so index 95 is the 96th element.
    // Elements are 1 to 100, so index 95 has value 96.
    expect(metrics.p95CachedLatency).toBe(96);
    expect(metrics.p99CachedLatency).toBe(100);
    expect(metrics.p95UncachedLatency).toBe(192);
    expect(metrics.p99UncachedLatency).toBe(200);
  });

  it('should set and retrieve cache size', () => {
    collector.setCacheSize(42);
    expect(collector.getMetrics().cacheSize).toBe(42);
  });

  it('should reset state properly', () => {
    collector.recordRequest('/path', true, 10);
    collector.setCacheSize(100);
    collector.reset();

    const metrics = collector.getMetrics();
    expect(metrics.totalRequests).toBe(0);
    expect(metrics.cacheSize).toBe(0);
  });

  it('should format a string report correctly', () => {
    collector.recordRequest('/cached', true, 5);
    collector.recordRequest('/uncached', false, 25);
    collector.setCacheSize(100);

    const report = collector.printReport();

    expect(report).toContain('Total Requests: 2');
    expect(report).toContain('Hits: 1 (50.0%)');
    expect(report).toContain('Misses: 1 (50.0%)');
    expect(report).toContain('Cached Avg: 5.000ms');
    expect(report).toContain('Uncached Avg: 25.000ms');
    expect(report).toContain('Improvement: 80.0%');
    expect(report).toContain('Heap Used: 50.0MB');
    expect(report).toContain('Cache Size: 100');
  });
});
