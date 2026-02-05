import { describe, it, beforeEach, afterEach, vi } from 'vitest';
import { HandleRequestUseCase } from '../../src/use-cases/handle-request';
import { RadixTree } from '../../src/core/routing/radix-tree';
import { CuckooFilter } from '../../src/core/filtering/cuckoo-filter';
import { RedirectRule } from '../../src/core/config/types';

// Mock payload builder
vi.mock('../../src/core/analytics/payload-builder', () => ({
  buildAnalyticsPayload: async () => ({ mock: 'payload' }),
  resolveReferrer: async () => ({ referrer: null, referrer_source: 'none' }),
  anonymizeIp: async () => 'anonymized-ip',
}));

describe('Language Targeting Performance', () => {
  let useCase: HandleRequestUseCase;
  let radixTree: RadixTree;
  let cuckooFilter: CuckooFilter;

  const createLanguageTargetingRule = (count: number): RedirectRule => {
    const rules = [];
    // Add many rules that don't match first
    for (let i = 0; i < count; i++) {
      rules.push({
        id: `rule-${i}`,
        target: 'language',
        value: `lang-${i}`, // These won't match "en" or "fr"
        destination: `https://example.com/lang-${i}`
      });
    }
    // Add one matching rule at the end
    rules.push({
      id: `rule-match`,
      target: 'language',
      value: 'fr',
      destination: 'https://example.com/fr'
    });

    return {
      id: 'perf-test',
      path: '/lang-perf',
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

  it('processes requests with heavy language parsing', async () => {
    const ruleCount = 100;
    const rule = createLanguageTargetingRule(ruleCount);
    radixTree.insert('/lang-perf', rule);
    cuckooFilter.add('/lang-perf');

    // Complex Accept-Language header
    const complexHeader = 'en-US,en;q=0.9,de;q=0.8,ja;q=0.7,es;q=0.6,pt;q=0.5,zh-CN;q=0.4,fr;q=0.3';

    const headers = new Headers({
      'accept-language': complexHeader
    });

    const start = performance.now();
    const iterations = 5000;

    for (let i = 0; i < iterations; i++) {
      await useCase.execute('/lang-perf', headers, '127.0.0.1', 'https://short.ly/lang-perf');
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / (elapsed / 1000)).toFixed(0);

    console.log(`\nLanguage Parsing Benchmark:`);
    console.log(`  Rules: ${ruleCount} language targets`);
    console.log(`  Header: ${complexHeader}`);
    console.log(`  Result: ${elapsed.toFixed(2)}ms (${opsPerSec} ops/sec)`);
  });
});
