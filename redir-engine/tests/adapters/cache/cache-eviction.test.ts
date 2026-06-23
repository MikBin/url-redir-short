import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CacheEvictionManager } from '../../../src/adapters/cache/cache-eviction';
import { RedirectRule } from '../../../src/core/config/types';

describe('CacheEvictionManager', () => {
  let manager: CacheEvictionManager;
  const mockRule: RedirectRule = { path: '/test', destination: 'http://dest', code: 301 };

  beforeEach(() => {
    manager = new CacheEvictionManager({
      maxHeapMB: 10,
      evictionBatchSize: 2,
      checkIntervalMs: 100,
      enableMetrics: true,
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    manager.stopMonitoring();
    manager.clear();
    vi.restoreAllMocks();
  });

  it('should initialize and register accesses accurately', () => {
    manager.recordAccess('/first', mockRule);
    manager.recordAccess('/second', mockRule);
    manager.recordAccess('/first', mockRule);

    const metrics = manager.getMetrics();
    // 2 unique misses (creates), 1 hit
    expect(metrics.misses).toBe(2);
    expect(metrics.hits).toBe(1);
    expect(manager.getCacheSize()).toBe(2);
  });

  it('should evict LRU items', () => {
    manager.recordAccess('/first', mockRule); // Least recent
    manager.recordAccess('/second', mockRule);
    manager.recordAccess('/third', mockRule);
    manager.recordAccess('/second', mockRule); // More recent than third

    const evicted = manager.evictLRU();

    // Batch size is 2, so it should evict /first and /third (in that order based on LRU)
    expect(evicted.length).toBe(2);
    expect(evicted).toEqual(['/first', '/third']);
    expect(manager.getCacheSize()).toBe(1);
  });

  it('should handle recordRemoval properly', () => {
    manager.recordAccess('/test', mockRule);
    expect(manager.getCacheSize()).toBe(1);

    manager.recordRemoval('/test');
    expect(manager.getCacheSize()).toBe(0);

    // Removing non-existent shouldn't throw
    expect(() => manager.recordRemoval('/unknown')).not.toThrow();
  });

  it('should monitor memory and trigger eviction when threshold exceeded', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    manager.recordAccess('/first', mockRule);
    manager.recordAccess('/second', mockRule);
    manager.recordAccess('/third', mockRule);

    vi.spyOn(process, 'memoryUsage').mockReturnValue({
      heapUsed: 15 * 1024 * 1024, // 15MB (> 10MB threshold)
      rss: 0,
      heapTotal: 0,
      external: 0,
      arrayBuffers: 0
    });

    manager.startMonitoring();

    // Should trigger interval
    vi.advanceTimersByTime(150);

    // Should have evicted batchSize (2) items
    expect(manager.getCacheSize()).toBe(1);
    const metrics = manager.getMetrics();
    expect(metrics.totalEvictions).toBe(1);
    expect(metrics.totalItemsEvicted).toBe(2);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[Cache] Memory threshold exceeded'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[Cache] Evicted 2 items'));
  });

  it('should fallback gracefully when process.memoryUsage is not available', () => {
    const processMemorySpy = vi.spyOn(process, 'memoryUsage').mockImplementation(() => {
      throw new Error('Not implemented');
    });

    // Provide a way to override process property safely via defining property
    const originalProcess = global.process;
    Object.defineProperty(global, 'process', { value: undefined, writable: true });

    manager.startMonitoring();
    vi.advanceTimersByTime(150);

    // Shouldn't trigger eviction since heap fallback is 0
    expect(manager.getMetrics().totalEvictions).toBe(0);

    Object.defineProperty(global, 'process', { value: originalProcess, writable: true });
    processMemorySpy.mockRestore();
  });

  it('should generate report correctly', () => {
    manager.recordAccess('/first', mockRule);
    vi.spyOn(process, 'memoryUsage').mockReturnValue({
      heapUsed: 5 * 1024 * 1024, // 5MB
      rss: 0,
      heapTotal: 0,
      external: 0,
      arrayBuffers: 0
    });

    manager.startMonitoring();
    vi.advanceTimersByTime(150);

    const report = manager.printReport();
    expect(report).toContain('Size: 1 items');
    expect(report).toContain('Heap Used: 5.0MB / 10MB');
    expect(report).toContain('Usage: 50.0%');
    expect(report).toContain('Total Evictions: 0');
  });

  it('should stop monitoring and clear cleanly', () => {
    manager.startMonitoring();
    manager.recordAccess('/first', mockRule);

    manager.stopMonitoring();
    manager.clear();

    expect(manager.getCacheSize()).toBe(0);

    // Calling stop again should not throw
    expect(() => manager.stopMonitoring()).not.toThrow();
  });
});
