import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

export class PrometheusExporter {
  private registry: Registry;
  
  // Metrics
  public requestsTotal: Counter;
  public requestDuration: Histogram;
  public cuckooLookups: Counter;
  public radixTreeSize: Gauge;
  public cacheHitRatio: Gauge;
  public cacheEntries: Gauge;
  public sseStatus: Gauge;
  public memoryHeap: Gauge;

  constructor() {
    this.registry = new Registry();
    
    // Only collect default metrics if cpuUsage and memoryUsage are implemented.
    // Cloudflare Workers unenv does not support process.cpuUsage.
    // Try to catch unenv throwing Not Implemented errors.
    try {
      if (typeof process !== 'undefined') {
        // Just calling process.cpuUsage() will throw if unenv hasn't implemented it.
        if (process.cpuUsage) process.cpuUsage();
        collectDefaultMetrics({ register: this.registry, prefix: 'engine_' });
      }
    } catch (e) {
      // Ignored: Not in a full Node environment
    }

    this.requestsTotal = new Counter({
      name: 'engine_requests_total',
      help: 'Total redirect requests by status code',
      labelNames: ['status', 'method'],
      registers: [this.registry]
    });

    this.requestDuration = new Histogram({
      name: 'engine_request_duration_seconds',
      help: 'Request latency distribution',
      labelNames: ['status'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.registry]
    });

    this.cuckooLookups = new Counter({
      name: 'engine_cuckoo_filter_lookups_total',
      help: 'Cuckoo filter lookups (hit/miss)',
      labelNames: ['result'],
      registers: [this.registry]
    });

    this.radixTreeSize = new Gauge({
      name: 'engine_radix_tree_size',
      help: 'Number of routes in radix tree',
      registers: [this.registry]
    });

    this.cacheHitRatio = new Gauge({
      name: 'engine_cache_hit_ratio',
      help: 'LRU cache hit ratio',
      registers: [this.registry]
    });

    this.cacheEntries = new Gauge({
      name: 'engine_cache_entries',
      help: 'Current cache entries',
      registers: [this.registry]
    });

    this.sseStatus = new Gauge({
      name: 'engine_sse_connection_status',
      help: 'SSE connection state (0=disconnected, 1=connected)',
      registers: [this.registry]
    });

    this.memoryHeap = new Gauge({
      name: 'engine_memory_heap_mb',
      help: 'Heap memory usage',
      registers: [this.registry]
    });
  }

  public async getMetrics(): Promise<string> {
    // Update memory gauge before returning
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      this.memoryHeap.set(usage.heapUsed / 1024 / 1024);
    }
    
    return await this.registry.metrics();
  }

  public getContentType(): string {
    return this.registry.contentType;
  }
}

// Singleton instance
export const metrics = new PrometheusExporter();
