import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { HandleRequestUseCase } from '../../src/use-cases/handle-request';
import { AnalyticsCollector } from '../../src/core/analytics/collector';
import { RedirectRule } from '../../src/core/config/types';
import { IRedirectStore } from '../../src/ports/IRedirectStore';

describe('HandleRequestUseCase', () => {
  let useCase: HandleRequestUseCase;
  let mockStore: IRedirectStore;
  let mockAnalyticsCollector: AnalyticsCollector;

  const mockRule: RedirectRule = {
    id: '1',
    path: '/test',
    destination: 'https://example.com',
    code: 301,
  };

  const mockHeaders = new Headers({
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    'accept-language': 'en-US,en;q=0.9',
    'cf-ipcountry': 'US'
  });

  beforeEach(() => {
    // Manually mock dependencies
    mockStore = {
      getRedirect: vi.fn(),
      mightExist: vi.fn(),
    } as unknown as IRedirectStore;

    mockAnalyticsCollector = {
      collect: vi.fn(),
    };

    useCase = new HandleRequestUseCase(
      mockStore,
      mockAnalyticsCollector
    );
  });

  it('should return null if path is not in store mightExist check', async () => {
    (mockStore.mightExist as Mock).mockResolvedValue(false);

    const result = await useCase.execute('/unknown', mockHeaders, '127.0.0.1', new URL('http://localhost/unknown'));

    expect(result).toBeNull();
    expect(mockStore.getRedirect).not.toHaveBeenCalled();
  });

  it('should return null if path might exist but not found in getRedirect (False Positive)', async () => {
    (mockStore.mightExist as Mock).mockResolvedValue(true);
    (mockStore.getRedirect as Mock).mockResolvedValue(null);

    const result = await useCase.execute('/unknown', mockHeaders, '127.0.0.1', new URL('http://localhost/unknown'));

    expect(result).toBeNull();
    expect(mockStore.getRedirect).toHaveBeenCalledWith('/unknown');
  });

  it('should return redirect rule if found in both', async () => {
    (mockStore.mightExist as Mock).mockResolvedValue(true);
    (mockStore.getRedirect as Mock).mockResolvedValue(mockRule);

    const result = await useCase.execute('/test', mockHeaders, '127.0.0.1', new URL('http://localhost/test'));

    expect(result).toEqual({ type: 'redirect', rule: mockRule });

    // Wait for async analytics collection
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(mockAnalyticsCollector.collect).toHaveBeenCalled();
  });

  it('should handle expiration by time', async () => {
    (mockStore.mightExist as Mock).mockResolvedValue(true);
    const expiredRule = { ...mockRule, expiresAt: Date.now() - 1000 };
    (mockStore.getRedirect as Mock).mockResolvedValue(expiredRule);

    const result = await useCase.execute('/test', mockHeaders, '127.0.0.1', new URL('http://localhost/test'));

    expect(result).toBeNull();
  });

  it('should handle expiration by max clicks', async () => {
    (mockStore.mightExist as Mock).mockResolvedValue(true);
    const maxedRule = { ...mockRule, maxClicks: 10, clicks: 10 };
    (mockStore.getRedirect as Mock).mockResolvedValue(maxedRule);

    const result = await useCase.execute('/test', mockHeaders, '127.0.0.1', new URL('http://localhost/test'));

    expect(result).toBeNull();
  });

  it('should apply password protection', async () => {
    (mockStore.mightExist as Mock).mockResolvedValue(true);
    const protectedRule = {
      ...mockRule,
      password_protection: { enabled: true, password: 'secret' }
    };
    (mockStore.getRedirect as Mock).mockResolvedValue(protectedRule);

    // No password provided
    const result1 = await useCase.execute('/test', mockHeaders, '127.0.0.1', new URL('http://localhost/test'));
    expect(result1).toEqual({ type: 'password_required', rule: protectedRule });

    // Wrong password
    const result2 = await useCase.execute('/test', mockHeaders, '127.0.0.1', new URL('http://localhost/test'), () => 'wrong');
    expect(result2).toEqual({ type: 'password_required', rule: protectedRule, error: true });

    // Correct password
    const result3 = await useCase.execute('/test', mockHeaders, '127.0.0.1', new URL('http://localhost/test'), () => 'secret');
    expect(result3).toEqual({ type: 'redirect', rule: protectedRule });
  });

  it('should apply targeting (Language)', async () => {
    (mockStore.mightExist as Mock).mockResolvedValue(true);
    const targetingRule = {
      ...mockRule,
      targeting: {
        enabled: true,
        rules: [
          { id: 't1', target: 'language' as const, value: 'fr', destination: 'https://example.com/fr' }
        ]
      }
    };
    (mockStore.getRedirect as Mock).mockResolvedValue(targetingRule);

    // Match
    const frHeaders = new Headers({ 'accept-language': 'fr-FR' });
    const result1 = await useCase.execute('/test', frHeaders, '127.0.0.1', new URL('http://localhost/test'));
    expect(result1?.type).toBe('redirect');
    if (result1?.type === 'redirect') {
        expect(result1.rule.destination).toBe('https://example.com/fr');
    }

    // No Match
    const enHeaders = new Headers({ 'accept-language': 'en-US' });
    const result2 = await useCase.execute('/test', enHeaders, '127.0.0.1', new URL('http://localhost/test'));
    expect(result2?.type).toBe('redirect');
    if (result2?.type === 'redirect') {
        expect(result2.rule.destination).toBe('https://example.com'); // Default
    }
  });

  it('should apply A/B testing', async () => {
    (mockStore.mightExist as Mock).mockResolvedValue(true);
    const abRule = {
      ...mockRule,
      ab_testing: {
        enabled: true,
        variations: [
          { id: 'v1', destination: 'https://example.com/a', weight: 100 }
        ]
      }
    };
    (mockStore.getRedirect as Mock).mockResolvedValue(abRule);

    const result = await useCase.execute('/test', mockHeaders, '127.0.0.1', new URL('http://localhost/test'));
    expect(result?.type).toBe('redirect');
    if (result?.type === 'redirect') {
        expect(result.rule.destination).toBe('https://example.com/a');
    }
  });
});
