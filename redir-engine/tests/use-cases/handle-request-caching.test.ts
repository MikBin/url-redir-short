import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { HandleRequestUseCase } from '../../src/use-cases/handle-request';
import { RadixTree } from '../../src/core/routing/radix-tree';
import { CuckooFilter } from '../../src/core/filtering/cuckoo-filter';
import { RedirectRule } from '../../src/core/config/types';
import { UAParser } from 'ua-parser-js';

// Mock UAParser to spy on constructor calls
vi.mock('ua-parser-js', () => {
  const UAParserMock = vi.fn();
  UAParserMock.prototype.getDevice = vi.fn().mockReturnValue({ type: 'mobile' });
  UAParserMock.prototype.getOS = vi.fn().mockReturnValue({ name: 'iOS' });
  return { UAParser: UAParserMock };
});

describe('HandleRequestUseCase - Caching', () => {
  let useCase: HandleRequestUseCase;
  let mockRadixTree: RadixTree;
  let mockCuckooFilter: CuckooFilter;

  beforeEach(() => {
    mockRadixTree = {
      find: vi.fn(),
    } as unknown as RadixTree;

    mockCuckooFilter = {
      has: vi.fn().mockReturnValue(true),
    } as unknown as CuckooFilter;

    useCase = new HandleRequestUseCase(mockRadixTree, mockCuckooFilter);

    // Clear mock calls before each test
    (UAParser as unknown as Mock).mockClear();
  });

  it('should use LRU cache for User Agent parsing', async () => {
    const ua = `Mozilla/5.0 (Test-Unique-UA-${Date.now()})`;
    const rule: RedirectRule = {
      id: 'cache-test',
      path: '/cache-test',
      destination: 'https://example.com',
      code: 301,
      targeting: {
        enabled: true,
        rules: [
          { id: 't1', target: 'device', value: 'mobile', destination: 'https://m.example.com' }
        ]
      }
    };

    (mockRadixTree.find as Mock).mockReturnValue(rule);

    // First request: Should instantiate UAParser
    await useCase.execute('/cache-test', new Headers({ 'user-agent': ua }), '127.0.0.1', new URL('http://localhost/'));
    expect(UAParser).toHaveBeenCalledTimes(1);

    // Second request: Should NOT instantiate UAParser (Cache Hit)
    await useCase.execute('/cache-test', new Headers({ 'user-agent': ua }), '127.0.0.1', new URL('http://localhost/'));
    expect(UAParser).toHaveBeenCalledTimes(1);

    // Different UA: Should instantiate UAParser
    const ua2 = `Mozilla/5.0 (Another-UA-${Date.now()})`;
    await useCase.execute('/cache-test', new Headers({ 'user-agent': ua2 }), '127.0.0.1', new URL('http://localhost/'));
    expect(UAParser).toHaveBeenCalledTimes(2);
  });
});
