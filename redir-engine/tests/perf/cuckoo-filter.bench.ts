import { describe, it, expect, beforeEach } from 'vitest';
import { CuckooFilter } from '../../src/core/filtering/cuckoo-filter';

describe('CuckooFilter - Performance Benchmarks', () => {
  describe('Insert Operations', () => {
    it('insert 1K items', () => {
      const filter = new CuckooFilter(2000, 4, 2);
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        filter.add(`/path/${i}`);
      }
      const elapsed = performance.now() - start;
      const opsPerSec = (1000 / (elapsed / 1000)).toFixed(0);
      console.log(`  insert 1K items: ${elapsed.toFixed(2)}ms (${opsPerSec} ops/sec)`);
    });

    it('insert 10K items', () => {
      const filter = new CuckooFilter(20000, 4, 2);
      const start = performance.now();
      for (let i = 0; i < 10000; i++) {
        filter.add(`/path/${i}`);
      }
      const elapsed = performance.now() - start;
      const opsPerSec = (10000 / (elapsed / 1000)).toFixed(0);
      console.log(`  insert 10K items: ${elapsed.toFixed(2)}ms (${opsPerSec} ops/sec)`);
    });

    it('insert 100K items', () => {
      const filter = new CuckooFilter(200000, 4, 2);
      const start = performance.now();
      for (let i = 0; i < 100000; i++) {
        filter.add(`/path/${i}`);
      }
      const elapsed = performance.now() - start;
      const opsPerSec = (100000 / (elapsed / 1000)).toFixed(0);
      console.log(`  insert 100K items: ${elapsed.toFixed(2)}ms (${opsPerSec} ops/sec)`);
    });
  });

  describe('Lookup Operations', () => {
    let filter1K: CuckooFilter;
    let filter10K: CuckooFilter;
    let filter100K: CuckooFilter;

    beforeEach(() => {
      filter1K = new CuckooFilter(2000, 4, 2);
      for (let i = 0; i < 1000; i++) {
        filter1K.add(`/path/${i}`);
      }

      filter10K = new CuckooFilter(20000, 4, 2);
      for (let i = 0; i < 10000; i++) {
        filter10K.add(`/path/${i}`);
      }

      filter100K = new CuckooFilter(200000, 4, 2);
      for (let i = 0; i < 100000; i++) {
        filter100K.add(`/path/${i}`);
      }
    });

    it('lookup in 1K items (hit)', () => {
      const start = performance.now();
      for (let i = 0; i < 10000; i++) {
        filter1K.has('/path/500');
      }
      const elapsed = performance.now() - start;
      const opsPerSec = (10000 / (elapsed / 1000)).toFixed(0);
      console.log(`  lookup 1K items (hit): ${(elapsed / 10000).toFixed(4)}ms/op (${opsPerSec} ops/sec)`);
    });

    it('lookup in 10K items (hit)', () => {
      const start = performance.now();
      for (let i = 0; i < 10000; i++) {
        filter10K.has('/path/5000');
      }
      const elapsed = performance.now() - start;
      const opsPerSec = (10000 / (elapsed / 1000)).toFixed(0);
      console.log(`  lookup 10K items (hit): ${(elapsed / 10000).toFixed(4)}ms/op (${opsPerSec} ops/sec)`);
    });

    it('lookup in 100K items (hit)', () => {
      const start = performance.now();
      for (let i = 0; i < 10000; i++) {
        filter100K.has('/path/50000');
      }
      const elapsed = performance.now() - start;
      const opsPerSec = (10000 / (elapsed / 1000)).toFixed(0);
      console.log(`  lookup 100K items (hit): ${(elapsed / 10000).toFixed(4)}ms/op (${opsPerSec} ops/sec)`);
    });

    it('lookup in 1K items (miss)', () => {
      const start = performance.now();
      for (let i = 0; i < 10000; i++) {
        filter1K.has('/path/missing-9999');
      }
      const elapsed = performance.now() - start;
      const opsPerSec = (10000 / (elapsed / 1000)).toFixed(0);
      console.log(`  lookup 1K items (miss): ${(elapsed / 10000).toFixed(4)}ms/op (${opsPerSec} ops/sec)`);
    });

    it('lookup in 10K items (miss)', () => {
      const start = performance.now();
      for (let i = 0; i < 10000; i++) {
        filter10K.has('/path/missing-99999');
      }
      const elapsed = performance.now() - start;
      const opsPerSec = (10000 / (elapsed / 1000)).toFixed(0);
      console.log(`  lookup 10K items (miss): ${(elapsed / 10000).toFixed(4)}ms/op (${opsPerSec} ops/sec)`);
    });

    it('lookup in 100K items (miss)', () => {
      const start = performance.now();
      for (let i = 0; i < 10000; i++) {
        filter100K.has('/path/missing-999999');
      }
      const elapsed = performance.now() - start;
      const opsPerSec = (10000 / (elapsed / 1000)).toFixed(0);
      console.log(`  lookup 100K items (miss): ${(elapsed / 10000).toFixed(4)}ms/op (${opsPerSec} ops/sec)`);
    });

    it('batch lookup 100 in 10K items', () => {
      const start = performance.now();
      for (let batch = 0; batch < 100; batch++) {
        for (let i = 0; i < 10; i++) {
          filter10K.has(`/path/${i * 1000}`);
        }
      }
      const elapsed = performance.now() - start;
      const opsPerSec = (1000 / (elapsed / 1000)).toFixed(0);
      console.log(`  batch lookup 100 in 10K: ${elapsed.toFixed(2)}ms total (${opsPerSec} ops/sec)`);
    });

    it('batch lookup 100 in 100K items', () => {
      const start = performance.now();
      for (let batch = 0; batch < 100; batch++) {
        for (let i = 0; i < 10; i++) {
          filter100K.has(`/path/${i * 10000}`);
        }
      }
      const elapsed = performance.now() - start;
      const opsPerSec = (1000 / (elapsed / 1000)).toFixed(0);
      console.log(`  batch lookup 100 in 100K: ${elapsed.toFixed(2)}ms total (${opsPerSec} ops/sec)`);
    });
  });

  describe('Remove Operations', () => {
    it('remove 1K items from 1K', () => {
      const filter = new CuckooFilter(2000, 4, 2);
      for (let i = 0; i < 1000; i++) {
        filter.add(`/path/${i}`);
      }
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        filter.remove(`/path/${i}`);
      }
      const elapsed = performance.now() - start;
      const opsPerSec = (1000 / (elapsed / 1000)).toFixed(0);
      console.log(`  remove 1K from 1K: ${elapsed.toFixed(2)}ms (${opsPerSec} ops/sec)`);
    });

    it('remove 1K items from 10K', () => {
      const filter = new CuckooFilter(20000, 4, 2);
      for (let i = 0; i < 10000; i++) {
        filter.add(`/path/${i}`);
      }
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        filter.remove(`/path/${i}`);
      }
      const elapsed = performance.now() - start;
      const opsPerSec = (1000 / (elapsed / 1000)).toFixed(0);
      console.log(`  remove 1K from 10K: ${elapsed.toFixed(2)}ms (${opsPerSec} ops/sec)`);
    });
  });

  describe('Mixed Workload', () => {
    it('mixed operations (60% insert, 30% lookup, 10% remove) - 1K total', () => {
      const filter = new CuckooFilter(5000, 4, 2);
      const total = 1000;
      const insertCount = Math.floor(total * 0.6); // 600
      const lookupCount = Math.floor(total * 0.3); // 300
      const removeCount = total - insertCount - lookupCount; // 100

      const start = performance.now();
      // Inserts
      for (let i = 0; i < insertCount; i++) {
        filter.add(`/path/${i}`);
      }

      // Lookups
      for (let i = 0; i < lookupCount; i++) {
        filter.has(`/path/${Math.floor((i * insertCount) / lookupCount)}`);
      }

      // Removes
      for (let i = 0; i < removeCount; i++) {
        filter.remove(`/path/${i}`);
      }
      const elapsed = performance.now() - start;
      const opsPerSec = (total / (elapsed / 1000)).toFixed(0);
      console.log(`  mixed ops 1K (60% ins, 30% look, 10% rem): ${elapsed.toFixed(2)}ms (${opsPerSec} ops/sec)`);
    });

    it('mixed operations (60% insert, 30% lookup, 10% remove) - 10K total', () => {
      const filter = new CuckooFilter(50000, 4, 2);
      const total = 10000;
      const insertCount = Math.floor(total * 0.6); // 6000
      const lookupCount = Math.floor(total * 0.3); // 3000
      const removeCount = total - insertCount - lookupCount; // 1000

      const start = performance.now();
      for (let i = 0; i < insertCount; i++) {
        filter.add(`/path/${i}`);
      }

      for (let i = 0; i < lookupCount; i++) {
        filter.has(`/path/${Math.floor((i * insertCount) / lookupCount)}`);
      }

      for (let i = 0; i < removeCount; i++) {
        filter.remove(`/path/${i}`);
      }
      const elapsed = performance.now() - start;
      const opsPerSec = (total / (elapsed / 1000)).toFixed(0);
      console.log(`  mixed ops 10K (60% ins, 30% look, 10% rem): ${elapsed.toFixed(2)}ms (${opsPerSec} ops/sec)`);
    });
  });

  describe('Memory & Fill Factor', () => {
    it('memory usage at 50% fill (5K/10K)', () => {
      const filter = new CuckooFilter(10000, 4, 2);
      const memBefore = process.memoryUsage().heapUsed;
      for (let i = 0; i < 5000; i++) {
        filter.add(`/path/${i}`);
      }
      const memAfter = process.memoryUsage().heapUsed;
      const memUsed = (memAfter - memBefore) / 1024 / 1024;
      console.log(`  memory at 50% fill: ${memUsed.toFixed(2)} MB`);
      expect(memUsed).toBeGreaterThan(0);
    });

    it('memory usage at 80% fill (8K/10K)', () => {
      const filter = new CuckooFilter(10000, 4, 2);
      const memBefore = process.memoryUsage().heapUsed;
      for (let i = 0; i < 8000; i++) {
        filter.add(`/path/${i}`);
      }
      const memAfter = process.memoryUsage().heapUsed;
      const memUsed = (memAfter - memBefore) / 1024 / 1024;
      console.log(`  memory at 80% fill: ${memUsed.toFixed(2)} MB`);
      expect(memUsed).toBeGreaterThan(0);
    });
  });
});
