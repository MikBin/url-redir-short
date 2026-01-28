import { describe, it, vi, beforeEach, afterEach } from 'vitest';
import { HandleRequestUseCase } from '../../src/use-cases/handle-request';
import { RadixTree } from '../../src/core/routing/radix-tree';
import { CuckooFilter } from '../../src/core/filtering/cuckoo-filter';
import { AnalyticsCollector } from '../../src/core/analytics/collector';
import { RedirectRule } from '../../src/core/config/types';

// Mock payload builder to simulate slow operation
vi.mock('../../src/core/analytics/payload-builder', () => ({
  buildAnalyticsPayload: async () => {
    // Simulate 10ms latency for hashing/processing
    await new Promise((resolve) => setTimeout(resolve, 10));
    return { mock: 'payload' };
  },
  resolveReferrer: async () => ({ referrer: null, referrer_source: 'none' }),
  anonymizeIp: async () => 'anonymized-ip',
}));

describe('HandleRequestUseCase - Performance', () => {
  let useCase: HandleRequestUseCase;
  let mockCollector: AnalyticsCollector;

  beforeEach(() => {
    const radixTree = new RadixTree();
    const cuckooFilter = new CuckooFilter();

    // Setup a rule
    const rule: RedirectRule = {
      id: 'perf-test',
      path: '/fast',
      destination: 'https://example.com',
      code: 301
    };
    radixTree.insert('/fast', rule);
    cuckooFilter.add('/fast');

    mockCollector = {
      collect: vi.fn().mockResolvedValue(undefined)
    };

    useCase = new HandleRequestUseCase(radixTree, cuckooFilter, mockCollector);
  });

  afterEach(() => {
      vi.clearAllMocks();
  });

  it('measures request handling latency', async () => {
    const start = performance.now();
    const iterations = 50; // 50 * 10ms = 500ms total minimum

    for (let i = 0; i < iterations; i++) {
      await useCase.execute(
        '/fast',
        new Headers(),
        '127.0.0.1',
        'http://localhost/fast'
      );
    }

    const totalTime = performance.now() - start;
    const avgTime = totalTime / iterations;

    console.log(`Average execution time: ${avgTime.toFixed(2)}ms per request`);
  });
});
