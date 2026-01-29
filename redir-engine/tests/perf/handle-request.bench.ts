import { describe, it, beforeEach, afterEach, vi } from 'vitest';
import { HandleRequestUseCase } from '../../src/use-cases/handle-request';
import { RadixTree } from '../../src/core/routing/radix-tree';
import { CuckooFilter } from '../../src/core/filtering/cuckoo-filter';
import { RedirectRule } from '../../src/core/config/types';
import { AnalyticsCollector } from '../../src/core/analytics/collector';

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

describe('HandleRequestUseCase - Performance Benchmarks', () => {

    describe('Device Targeting Rules', () => {
        let useCase: HandleRequestUseCase;
        let radixTree: RadixTree;
        let cuckooFilter: CuckooFilter;

        const createDeviceTargetingRule = (count: number): RedirectRule => {
            const rules = [];
            // Add many rules that don't match first, so we keep checking
            for (let i = 0; i < count; i++) {
                rules.push({
                    id: `rule-${i}`,
                    target: 'device',
                    value: 'ios', // We will simulate Android so these fail
                    destination: 'https://example.com/ios'
                });
            }
            // Add one matching rule at the end
            rules.push({
                id: `rule-match`,
                target: 'device',
                value: 'android',
                destination: 'https://example.com/android'
            });

            return {
                id: 'perf-test',
                path: '/perf',
                destination: 'https://example.com/default',
                code: 301,
                targeting: {
                    enabled: true,
                    rules: rules as any
                }
            };
        };

        beforeEach(() => {
            radixTree = new RadixTree();
            cuckooFilter = new CuckooFilter();
            useCase = new HandleRequestUseCase(radixTree, cuckooFilter);
        });

        it('processes 1000 requests with 50 device targeting rules', async () => {
            const rule = createDeviceTargetingRule(50);
            radixTree.insert('/perf', rule);
            cuckooFilter.add('/perf');

            const headers = new Headers({
                'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36'
            });

            const start = performance.now();
            const iterations = 1000;
            for (let i = 0; i < iterations; i++) {
                await useCase.execute('/perf', headers, '127.0.0.1', 'https://short.ly/perf');
            }
            const elapsed = performance.now() - start;
            const opsPerSec = (iterations / (elapsed / 1000)).toFixed(0);
            console.log(`  HandleRequest (50 device rules): ${elapsed.toFixed(2)}ms (${opsPerSec} ops/sec)`);
        });
    });

    describe('Request Handling Latency', () => {
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
});
