import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrometheusExporter } from '../../../src/adapters/metrics/prometheus';

describe('PrometheusExporter', () => {
  let exporter: PrometheusExporter;

  beforeEach(() => {
    // Reset any singleton state or clear registry by instantiating anew
    exporter = new PrometheusExporter();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize and register metrics', () => {
    expect(exporter.requestsTotal).toBeDefined();
    expect(exporter.requestDuration).toBeDefined();
    expect(exporter.cuckooLookups).toBeDefined();
    expect(exporter.radixTreeSize).toBeDefined();
    expect(exporter.cacheHitRatio).toBeDefined();
    expect(exporter.cacheEntries).toBeDefined();
    expect(exporter.sseStatus).toBeDefined();
    expect(exporter.memoryHeap).toBeDefined();
  });

  it('should increment requestsTotal counter', async () => {
    exporter.requestsTotal.inc({ status: 301, method: 'GET' });
    exporter.requestsTotal.inc({ status: 302, method: 'POST' });
    exporter.requestsTotal.inc({ status: 301, method: 'GET' });

    const metricsStr = await exporter.getMetrics();

    // Check if the output string contains expected lines
    expect(metricsStr).toContain('engine_requests_total{status="301",method="GET"} 2');
    expect(metricsStr).toContain('engine_requests_total{status="302",method="POST"} 1');
  });

  it('should observe requestDuration histogram', async () => {
    exporter.requestDuration.observe({ status: 200 }, 0.04);
    exporter.requestDuration.observe({ status: 200 }, 0.15);

    const metricsStr = await exporter.getMetrics();

    // Check if buckets are updated
    expect(metricsStr).toContain('engine_request_duration_seconds_bucket{le="0.05",status="200"} 1');
    expect(metricsStr).toContain('engine_request_duration_seconds_bucket{le="0.5",status="200"} 2');
    expect(metricsStr).toContain('engine_request_duration_seconds_sum{status="200"} 0.19');
    expect(metricsStr).toContain('engine_request_duration_seconds_count{status="200"} 2');
  });

  it('should set gauges correctly', async () => {
    exporter.radixTreeSize.set(42);
    exporter.cacheHitRatio.set(0.85);

    const metricsStr = await exporter.getMetrics();

    expect(metricsStr).toContain('engine_radix_tree_size 42');
    expect(metricsStr).toContain('engine_cache_hit_ratio 0.85');
  });

  it('should safely update memory metrics if process.memoryUsage is available', async () => {
    // Mock process.memoryUsage to return a specific predictable value
    const mockMemoryUsage = vi.spyOn(process, 'memoryUsage').mockReturnValue({
      heapUsed: 1048576 * 15, // 15 MB
      rss: 0,
      heapTotal: 0,
      external: 0,
      arrayBuffers: 0,
    });

    const metricsStr = await exporter.getMetrics();

    // Check if memoryHeap was set
    expect(mockMemoryUsage).toHaveBeenCalled();
    expect(metricsStr).toContain('engine_memory_heap_mb 15');
  });

  it('should not crash if process.memoryUsage throws an error', async () => {
    // Simulate the behavior of unenv in some cases where the stub throws
    const mockMemoryUsage = vi.spyOn(process, 'memoryUsage').mockImplementation(() => {
      throw new Error('Not implemented');
    });

    // Ensure getMetrics still works and the error is caught internally
    const metricsStr = await exporter.getMetrics();
    expect(typeof metricsStr).toBe('string');
  });

  it('should return the proper content type', () => {
    expect(exporter.getContentType()).toBe('text/plain; version=0.0.4; charset=utf-8');
  });
});
