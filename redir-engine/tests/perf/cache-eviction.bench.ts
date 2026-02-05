import { describe, it, beforeEach } from 'vitest';
import { CacheEvictionManager } from '../../src/adapters/cache/cache-eviction';
import { RedirectRule } from '../../src/core/config/types';

describe('CacheEvictionManager - Performance Benchmarks', () => {
  const createRule = (id: string, path: string): RedirectRule => ({
    id,
    path,
    destination: `https://example.com/${id}`,
    code: 301,
  });

  const CACHE_SIZE = 100_000;
  const EVICTION_BATCH_SIZE = 1_000;

  it('evictLRU performance with 100k items', () => {
    const manager = new CacheEvictionManager({
      maxHeapMB: 1000, // Large enough to hold items without auto-eviction during setup
      evictionBatchSize: EVICTION_BATCH_SIZE,
      enableMetrics: false
    });

    // Populate cache
    for (let i = 0; i < CACHE_SIZE; i++) {
      manager.recordAccess(`/path${i}`, createRule(`id-${i}`, `/path${i}`));
    }

    const start = performance.now();
    const evicted = manager.evictLRU();
    const elapsed = performance.now() - start;

    console.log(`  evictLRU (batch ${EVICTION_BATCH_SIZE} from ${CACHE_SIZE}): ${elapsed.toFixed(4)}ms`);

    // Verify we actually evicted something
    if (evicted.length !== EVICTION_BATCH_SIZE) {
        console.warn(`Warning: Expected to evict ${EVICTION_BATCH_SIZE} items, but evicted ${evicted.length}`);
    }
  });

  it('recordAccess performance (update existing)', () => {
     const manager = new CacheEvictionManager({
      maxHeapMB: 1000,
      evictionBatchSize: EVICTION_BATCH_SIZE,
      enableMetrics: false
    });

    // Populate cache
    for (let i = 0; i < 10_000; i++) {
      manager.recordAccess(`/path${i}`, createRule(`id-${i}`, `/path${i}`));
    }

    const start = performance.now();
    for (let i = 0; i < 10_000; i++) {
        // Access existing items in random order to simulate activity
        const idx = Math.floor(Math.random() * 10_000);
        manager.recordAccess(`/path${idx}`, createRule(`id-${idx}`, `/path${idx}`));
    }
    const elapsed = performance.now() - start;
    const opsPerSec = (10000 / (elapsed / 1000)).toFixed(0);

    console.log(`  recordAccess 10K updates: ${elapsed.toFixed(4)}ms (${opsPerSec} ops/sec)`);
  });
});
