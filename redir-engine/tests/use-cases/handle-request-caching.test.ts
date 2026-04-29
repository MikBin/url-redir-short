import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { HandleRequestUseCase } from '../../src/use-cases/handle-request';
import { RedirectRule } from '../../src/core/config/types';
import { UAParser } from 'ua-parser-js';
import { IRedirectStore } from '../../src/ports/IRedirectStore';

// Mock UAParser to spy on constructor calls
vi.mock('ua-parser-js', () => {
  const UAParserMock = vi.fn();
  UAParserMock.prototype.getDevice = vi.fn().mockReturnValue({ type: 'mobile' });
  UAParserMock.prototype.getOS = vi.fn().mockReturnValue({ name: 'iOS' });
  return { UAParser: UAParserMock };
});

describe('HandleRequestUseCase - Caching', () => {
  let useCase: HandleRequestUseCase;
  let mockStore: IRedirectStore;

  beforeEach(() => {
    mockStore = {
      getRedirect: vi.fn(),
      mightExist: vi.fn().mockResolvedValue(true),
    } as unknown as IRedirectStore;

    useCase = new HandleRequestUseCase(mockStore);

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

    (mockStore.getRedirect as Mock).mockResolvedValue(rule);

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
