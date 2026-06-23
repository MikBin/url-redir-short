import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PrometheusExporter } from '../../../src/adapters/metrics/prometheus';

describe('PrometheusExporter (extended branches)', () => {
  let originalProcess: NodeJS.Process;

  beforeEach(() => {
    // Save original process
    originalProcess = global.process;
  });

  afterEach(() => {
    // Restore original process
    global.process = originalProcess;
    vi.restoreAllMocks();
  });

  it('should instantiate successfully when process is undefined', () => {
    // Simulate CF worker without process global
    Object.defineProperty(global, 'process', { value: undefined, writable: true });

    let exporter: PrometheusExporter | undefined;
    expect(() => {
      exporter = new PrometheusExporter();
    }).not.toThrow();

    expect(exporter).toBeDefined();
    expect(exporter!.requestsTotal).toBeDefined();
  });

  it('should instantiate successfully when process.memoryUsage throws (e.g., unenv polyfill)', () => {
    vi.spyOn(process, 'memoryUsage').mockImplementation(() => {
      throw new Error('Not implemented');
    });

    let exporter: PrometheusExporter | undefined;
    expect(() => {
      exporter = new PrometheusExporter();
    }).not.toThrow();

    expect(exporter).toBeDefined();
  });

  it('should update memoryHeap during getMetrics if memoryUsage is available', async () => {
    const memorySpy = vi.spyOn(process, 'memoryUsage').mockReturnValue({
      heapUsed: 10 * 1024 * 1024, // 10 MB
      rss: 0,
      heapTotal: 0,
      external: 0,
      arrayBuffers: 0
    });

    const exporter = new PrometheusExporter();
    const metricsStr = await exporter.getMetrics();

    expect(memorySpy).toHaveBeenCalled();
    expect(metricsStr).toContain('engine_memory_heap_mb 10');
  });

  it('should ignore errors during getMetrics if memoryUsage throws', async () => {
    const exporter = new PrometheusExporter();

    vi.spyOn(process, 'memoryUsage').mockImplementation(() => {
      throw new Error('Not implemented');
    });

    // Should resolve without throwing error
    await expect(exporter.getMetrics()).resolves.toBeTypeOf('string');
  });
});
