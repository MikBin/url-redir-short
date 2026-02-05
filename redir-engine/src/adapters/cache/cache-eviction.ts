/**
 * Cache Eviction Manager
 * Implements LRU-based eviction when memory threshold is exceeded
 */

import { RedirectRule } from '../../core/config/types';
import { DoublyLinkedList, ListNode } from './doubly-linked-list';

export interface EvictionConfig {
  maxHeapMB: number;           // Trigger eviction at this heap usage (MB)
  evictionBatchSize: number;   // Remove this many items per eviction
  checkIntervalMs: number;     // How often to check memory
  enableMetrics: boolean;      // Log eviction metrics
}

export interface EvictionMetrics {
  totalEvictions: number;
  totalItemsEvicted: number;
  lastEvictionTime: number;
  peakHeapMB: number;
  currentHeapMB: number;
}

// Track access times for LRU
interface CacheEntry {
  rule: RedirectRule;
  lastAccessTime: number;
  accessCount: number;
  node: ListNode<string>;
}

export class CacheEvictionManager {
  private config: EvictionConfig;
  private metrics: EvictionMetrics;
  private cacheMap: Map<string, CacheEntry> = new Map();
  private lruList: DoublyLinkedList<string> = new DoublyLinkedList<string>();
  private monitorInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<EvictionConfig> = {}) {
    this.config = {
      maxHeapMB: config.maxHeapMB ?? 500,           // Default 500MB
      evictionBatchSize: config.evictionBatchSize ?? 1000,
      checkIntervalMs: config.checkIntervalMs ?? 10000,
      enableMetrics: config.enableMetrics ?? true,
    };

    this.metrics = {
      totalEvictions: 0,
      totalItemsEvicted: 0,
      lastEvictionTime: 0,
      peakHeapMB: 0,
      currentHeapMB: 0,
    };
  }

  /**
   * Record a cache access for LRU tracking
   */
  public recordAccess(path: string, rule: RedirectRule): void {
    const now = Date.now();

    if (this.cacheMap.has(path)) {
      const entry = this.cacheMap.get(path)!;
      entry.lastAccessTime = now;
      entry.accessCount++;
      // Move to tail (most recently used)
      this.lruList.moveToTail(entry.node);
    } else {
      // Add to tail
      const node = this.lruList.push(path);
      this.cacheMap.set(path, {
        rule,
        lastAccessTime: now,
        accessCount: 1,
        node,
      });
    }
  }

  /**
   * Record item removal (e.g., via delete operation)
   */
  public recordRemoval(path: string): void {
    const entry = this.cacheMap.get(path);
    if (entry) {
      this.lruList.remove(entry.node);
      this.cacheMap.delete(path);
    }
  }

  /**
   * Start memory monitoring
   */
  public startMonitoring(): void {
    if (this.monitorInterval) return;

    this.monitorInterval = setInterval(() => {
      const heapUsedMB = process.memoryUsage().heapUsed / 1024 / 1024;
      this.metrics.currentHeapMB = heapUsedMB;

      if (heapUsedMB > this.metrics.peakHeapMB) {
        this.metrics.peakHeapMB = heapUsedMB;
      }

      if (heapUsedMB > this.config.maxHeapMB) {
        if (this.config.enableMetrics) {
          console.log(
            `[Cache] Memory threshold exceeded: ${heapUsedMB.toFixed(1)}MB > ${this.config.maxHeapMB}MB`
          );
        }
        this.evictLRU();
      }
    }, this.config.checkIntervalMs);
  }

  /**
   * Stop memory monitoring
   */
  public stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }

  /**
   * Evict least-recently-used items
   * Returns array of evicted paths
   */
  public evictLRU(): string[] {
    const evicted: string[] = [];
    const count = Math.min(this.config.evictionBatchSize, this.cacheMap.size);

    for (let i = 0; i < count; i++) {
      // Shift from head (least recently used)
      const path = this.lruList.shift();
      if (path !== undefined) {
        evicted.push(path);
        this.cacheMap.delete(path);
      } else {
        break;
      }
    }

    this.metrics.totalEvictions++;
    this.metrics.totalItemsEvicted += evicted.length;
    this.metrics.lastEvictionTime = Date.now();

    if (this.config.enableMetrics) {
      console.log(
        `[Cache] Evicted ${evicted.length} items (total: ${this.metrics.totalItemsEvicted})`
      );
    }

    return evicted;
  }

  /**
   * Get eviction metrics
   */
  public getMetrics(): EvictionMetrics {
    return { ...this.metrics };
  }

  /**
   * Get current cache size
   */
  public getCacheSize(): number {
    return this.cacheMap.size;
  }

  /**
   * Clear all tracked cache entries (for shutdown)
   */
  public clear(): void {
    this.cacheMap.clear();
    this.lruList.clear();
  }

  /**
   * Get cache info for debugging
   */
  public getCacheInfo(): {
    size: number;
    heapUsedMB: number;
    maxHeapMB: number;
    metrics: EvictionMetrics;
  } {
    return {
      size: this.cacheMap.size,
      heapUsedMB: this.metrics.currentHeapMB,
      maxHeapMB: this.config.maxHeapMB,
      metrics: this.getMetrics(),
    };
  }

  /**
   * Print cache report
   */
  public printReport(): string {
    const info = this.getCacheInfo();
    return `
╔════════════════════════════════════════════════════════════╗
║                    Cache Eviction Report                    ║
╚════════════════════════════════════════════════════════════╝

📊 Cache State
  Size: ${info.size.toLocaleString()} items
  Heap Used: ${info.heapUsedMB.toFixed(1)}MB / ${info.maxHeapMB}MB
  Usage: ${((info.heapUsedMB / info.maxHeapMB) * 100).toFixed(1)}%

📈 Eviction Metrics
  Total Evictions: ${info.metrics.totalEvictions}
  Items Evicted: ${info.metrics.totalItemsEvicted.toLocaleString()}
  Peak Heap: ${info.metrics.peakHeapMB.toFixed(1)}MB
  Last Eviction: ${info.metrics.lastEvictionTime > 0 ? new Date(info.metrics.lastEvictionTime).toISOString() : 'Never'}

════════════════════════════════════════════════════════════`;
  }
}
