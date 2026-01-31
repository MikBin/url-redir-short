/**
 * Cache Performance Metrics Tracking
 * Monitors cache hit rate, latency improvements, and memory usage
 */

export interface CacheRequestMetric {
  path: string;
  cached: boolean;
  latency: number; // ms
  timestamp: number;
}

export interface CacheMetrics {
  totalRequests: number;
  hits: number;
  misses: number;
  hitRatio: number;
  cacheSize: number; // number of paths in cache
  heapUsedMB: number;
  avgCachedLatency: number;
  avgUncachedLatency: number;
  avgLatencyImprovement: number; // percentage
  p99CachedLatency: number;
  p99UncachedLatency: number;
  p95CachedLatency: number;
  p95UncachedLatency: number;
}

export class CacheMetricsCollector {
  private requests: CacheRequestMetric[] = [];
  private cacheSize: number = 0;

  recordRequest(
    path: string,
    cached: boolean,
    latency: number
  ): void {
    this.requests.push({
      path,
      cached,
      latency,
      timestamp: Date.now(),
    });
  }

  setCacheSize(size: number): void {
    this.cacheSize = size;
  }

  getMetrics(): CacheMetrics {
    const hits = this.requests.filter(r => r.cached).length;
    const misses = this.requests.filter(r => !r.cached).length;
    const total = this.requests.length;
    const hitRatio = total > 0 ? hits / total : 0;

    const cachedRequests = this.requests.filter(r => r.cached);
    const uncachedRequests = this.requests.filter(r => !r.cached);

    const avgCachedLatency =
      cachedRequests.length > 0
        ? cachedRequests.reduce((sum, r) => sum + r.latency, 0) / cachedRequests.length
        : 0;

    const avgUncachedLatency =
      uncachedRequests.length > 0
        ? uncachedRequests.reduce((sum, r) => sum + r.latency, 0) / uncachedRequests.length
        : 0;

    const avgLatencyImprovement =
      avgUncachedLatency > 0
        ? ((avgUncachedLatency - avgCachedLatency) / avgUncachedLatency) * 100
        : 0;

    // Calculate percentiles
    const sortedCached = cachedRequests.map(r => r.latency).sort((a, b) => a - b);
    const sortedUncached = uncachedRequests.map(r => r.latency).sort((a, b) => a - b);

    const p99CachedLatency =
      sortedCached.length > 0
        ? sortedCached[Math.floor(sortedCached.length * 0.99)]
        : 0;

    const p99UncachedLatency =
      sortedUncached.length > 0
        ? sortedUncached[Math.floor(sortedUncached.length * 0.99)]
        : 0;

    const p95CachedLatency =
      sortedCached.length > 0
        ? sortedCached[Math.floor(sortedCached.length * 0.95)]
        : 0;

    const p95UncachedLatency =
      sortedUncached.length > 0
        ? sortedUncached[Math.floor(sortedUncached.length * 0.95)]
        : 0;

    return {
      totalRequests: total,
      hits,
      misses,
      hitRatio,
      cacheSize: this.cacheSize,
      heapUsedMB: process.memoryUsage().heapUsed / 1024 / 1024,
      avgCachedLatency,
      avgUncachedLatency,
      avgLatencyImprovement,
      p99CachedLatency,
      p99UncachedLatency,
      p95CachedLatency,
      p95UncachedLatency,
    };
  }

  reset(): void {
    this.requests = [];
    this.cacheSize = 0;
  }

  printReport(): string {
    const metrics = this.getMetrics();
    return `
╔════════════════════════════════════════════════════════════╗
║                 Cache Performance Report                    ║
╚════════════════════════════════════════════════════════════╝

📊 Cache Hit Ratio
  Total Requests: ${metrics.totalRequests}
  Hits: ${metrics.hits} (${(metrics.hitRatio * 100).toFixed(1)}%)
  Misses: ${metrics.misses} (${((1 - metrics.hitRatio) * 100).toFixed(1)}%)

⚡ Latency Comparison
  Cached Avg: ${metrics.avgCachedLatency.toFixed(3)}ms
  Uncached Avg: ${metrics.avgUncachedLatency.toFixed(3)}ms
  Improvement: ${metrics.avgLatencyImprovement.toFixed(1)}%
  
  Cached P95: ${metrics.p95CachedLatency.toFixed(3)}ms
  Uncached P95: ${metrics.p95UncachedLatency.toFixed(3)}ms
  
  Cached P99: ${metrics.p99CachedLatency.toFixed(3)}ms
  Uncached P99: ${metrics.p99UncachedLatency.toFixed(3)}ms

💾 Memory
  Cache Size: ${metrics.cacheSize} paths
  Heap Used: ${metrics.heapUsedMB.toFixed(1)}MB
  Per-Path: ${(metrics.heapUsedMB * 1024 / (metrics.cacheSize || 1)).toFixed(2)}KB

════════════════════════════════════════════════════════════`;
  }
}
