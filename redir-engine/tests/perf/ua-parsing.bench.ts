import { describe, it } from 'vitest';
import { UAParser } from 'ua-parser-js';
import { LRUCache } from '../../src/core/utils/lru-cache';

describe('User Agent Parsing Performance', () => {
  const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  const iterations = 10000;

  it('Baseline: Raw UAParser Instantiation', () => {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      const parser = new UAParser(userAgent);
      const result = {
        device: parser.getDevice(),
        os: parser.getOS(),
      };
    }
    const end = performance.now();
    const duration = end - start;
    const opsPerSec = (iterations / (duration / 1000)).toFixed(0);
    console.log(`Raw UAParser: ${duration.toFixed(2)}ms (${opsPerSec} ops/sec)`);
  });

  it('Optimized: LRU Cached Parsing', () => {
    const cache = new LRUCache<string, { device: any; os: any }>(1000);

    // Simulate cache warming (first run)
    const parser = new UAParser(userAgent);
    cache.set(userAgent, {
      device: parser.getDevice(),
      os: parser.getOS(),
    });

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      let data = cache.get(userAgent);
      if (!data) {
        const p = new UAParser(userAgent);
        data = {
          device: p.getDevice(),
          os: p.getOS(),
        };
        cache.set(userAgent, data);
      }
    }
    const end = performance.now();
    const duration = end - start;
    const opsPerSec = (iterations / (duration / 1000)).toFixed(0);
    console.log(`Cached UAParser: ${duration.toFixed(2)}ms (${opsPerSec} ops/sec)`);
  });
});
