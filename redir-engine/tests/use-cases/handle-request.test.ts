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

  it('should propagate error if store.mightExist throws', async () => {
    const error = new Error('Database connection failed');
    (mockStore.mightExist as Mock).mockRejectedValue(error);

    await expect(useCase.execute('/error-path', mockHeaders, '127.0.0.1', new URL('http://localhost/error-path')))
      .rejects.toThrow('Database connection failed');
  });

  it('should propagate error if store.getRedirect throws', async () => {
    (mockStore.mightExist as Mock).mockResolvedValue(true);
    const error = new Error('Database query failed');
    (mockStore.getRedirect as Mock).mockRejectedValue(error);

    await expect(useCase.execute('/error-path', mockHeaders, '127.0.0.1', new URL('http://localhost/error-path')))
      .rejects.toThrow('Database query failed');
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

  it('should not expire if max clicks is defined but clicks count is missing', async () => {
    (mockStore.mightExist as Mock).mockResolvedValue(true);
    const missingClicksRule = { ...mockRule, maxClicks: 10, clicks: undefined };
    (mockStore.getRedirect as Mock).mockResolvedValue(missingClicksRule);

    const result = await useCase.execute('/test', mockHeaders, '127.0.0.1', new URL('http://localhost/test'));

    expect(result).toEqual({ type: 'redirect', rule: missingClicksRule });
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

  it('should apply targeting (Device - mobile, tablet, desktop, ios, android)', async () => {
    (mockStore.mightExist as Mock).mockResolvedValue(true);
    const targetingRule = {
      ...mockRule,
      targeting: {
        enabled: true,
        rules: [
          { id: 'd1', target: 'device' as const, value: 'mobile', destination: 'https://example.com/mobile' },
          { id: 'd2', target: 'device' as const, value: 'tablet', destination: 'https://example.com/tablet' },
          { id: 'd3', target: 'device' as const, value: 'desktop', destination: 'https://example.com/desktop' },
          { id: 'd4', target: 'device' as const, value: 'ios', destination: 'https://example.com/ios' },
          { id: 'd5', target: 'device' as const, value: 'android', destination: 'https://example.com/android' }
        ]
      }
    };
    (mockStore.getRedirect as Mock).mockResolvedValue(targetingRule);

    // Mobile
    const mobileHeaders = new Headers({ 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1' });
    const resMobile = await useCase.execute('/test', mobileHeaders, '127.0.0.1', new URL('http://localhost/test'));
    expect(resMobile?.type).toBe('redirect');
    if (resMobile?.type === 'redirect') expect(resMobile.rule.destination).toBe('https://example.com/mobile');

    // Tablet
    const tabletHeaders = new Headers({ 'user-agent': 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1' });
    const resTablet = await useCase.execute('/test', tabletHeaders, '127.0.0.1', new URL('http://localhost/test'));
    expect(resTablet?.type).toBe('redirect');
    if (resTablet?.type === 'redirect') expect(resTablet.rule.destination).toBe('https://example.com/tablet');

    // Desktop
    const desktopHeaders = new Headers({ 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36' });
    const resDesktop = await useCase.execute('/test', desktopHeaders, '127.0.0.1', new URL('http://localhost/test'));
    expect(resDesktop?.type).toBe('redirect');
    if (resDesktop?.type === 'redirect') expect(resDesktop.rule.destination).toBe('https://example.com/desktop');

    // Android (Since mobile matched first in the rule list, we remove mobile to test android)
    const androidOnlyRule = {
      ...mockRule,
      targeting: { enabled: true, rules: [{ id: 'a1', target: 'device' as const, value: 'android', destination: 'https://example.com/android' }] }
    };
    (mockStore.getRedirect as Mock).mockResolvedValue(androidOnlyRule);
    const androidHeaders = new Headers({ 'user-agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36' });
    const resAndroid = await useCase.execute('/test', androidHeaders, '127.0.0.1', new URL('http://localhost/test'));
    expect(resAndroid?.type).toBe('redirect');
    if (resAndroid?.type === 'redirect') expect(resAndroid.rule.destination).toBe('https://example.com/android');

    // iOS (Remove mobile to test iOS specifically)
    const iosOnlyRule = {
      ...mockRule,
      targeting: { enabled: true, rules: [{ id: 'i1', target: 'device' as const, value: 'ios', destination: 'https://example.com/ios' }] }
    };
    (mockStore.getRedirect as Mock).mockResolvedValue(iosOnlyRule);
    const iosHeaders = new Headers({ 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1' });
    const resIos = await useCase.execute('/test', iosHeaders, '127.0.0.1', new URL('http://localhost/test'));
    expect(resIos?.type).toBe('redirect');
    if (resIos?.type === 'redirect') expect(resIos.rule.destination).toBe('https://example.com/ios');
  });

  it('should apply targeting (Country)', async () => {
    (mockStore.mightExist as Mock).mockResolvedValue(true);
    const targetingRule = {
      ...mockRule,
      targeting: {
        enabled: true,
        rules: [
          { id: 'c1', target: 'country' as const, value: 'ca', destination: 'https://example.com/ca' }
        ]
      }
    };
    (mockStore.getRedirect as Mock).mockResolvedValue(targetingRule);

    // Match
    const caHeaders = new Headers({ 'cf-ipcountry': 'CA' }); // Testing case insensitivity
    const resCa = await useCase.execute('/test', caHeaders, '127.0.0.1', new URL('http://localhost/test'));
    expect(resCa?.type).toBe('redirect');
    if (resCa?.type === 'redirect') expect(resCa.rule.destination).toBe('https://example.com/ca');

    // No Match
    const usHeaders = new Headers({ 'cf-ipcountry': 'US' });
    const resUs = await useCase.execute('/test', usHeaders, '127.0.0.1', new URL('http://localhost/test'));
    expect(resUs?.type).toBe('redirect');
    if (resUs?.type === 'redirect') expect(resUs.rule.destination).toBe('https://example.com');
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

  it('should handle malformed A/B testing variations safely', async () => {
    (mockStore.mightExist as Mock).mockResolvedValue(true);
    // Malformed: missing the `variations` array despite being enabled
    const malformedAbRule = {
      ...mockRule,
      ab_testing: {
        enabled: true,
        // @ts-expect-error intentionally malformed configuration for testing
        variations: undefined
      }
    };
    (mockStore.getRedirect as Mock).mockResolvedValue(malformedAbRule);

    const result = await useCase.execute('/test', mockHeaders, '127.0.0.1', new URL('http://localhost/test'));

    // The optional chaining added in use-case should prevent a crash and default to the standard redirect
    expect(result?.type).toBe('redirect');
    if (result?.type === 'redirect') {
        expect(result.rule.destination).toBe('https://example.com');
    }
  });

  it('should handle requests missing expected headers gracefully', async () => {
    (mockStore.mightExist as Mock).mockResolvedValue(true);
    const targetingRule = {
      ...mockRule,
      targeting: {
        enabled: true,
        rules: [
          { id: 't1', target: 'language' as const, value: 'fr', destination: 'https://example.com/fr' },
          { id: 't2', target: 'device' as const, value: 'mobile', destination: 'https://example.com/mobile' },
          { id: 't3', target: 'country' as const, value: 'us', destination: 'https://example.com/us' }
        ]
      }
    };
    (mockStore.getRedirect as Mock).mockResolvedValue(targetingRule);

    const emptyHeaders = new Headers();
    const result = await useCase.execute('/test', emptyHeaders, '127.0.0.1', new URL('http://localhost/test'));

    // With empty headers, targeting shouldn't match, so it falls back to the default destination
    expect(result?.type).toBe('redirect');
    if (result?.type === 'redirect') {
        expect(result.rule.destination).toBe('https://example.com');
    }
  });
});
