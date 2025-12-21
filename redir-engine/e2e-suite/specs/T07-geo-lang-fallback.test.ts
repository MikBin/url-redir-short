import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BetterMockAdminService } from '../mocks/admin-service';
import { MockAnalyticsService } from '../mocks/analytics-service';
import { EngineController } from '../utils/engine-controller';

describe('T07: Geo/Lang Fallback', () => {
  let adminService: BetterMockAdminService;
  let analyticsService: MockAnalyticsService;
  let engine: EngineController;

  beforeAll(async () => {
    adminService = new BetterMockAdminService();
    await adminService.start();

    analyticsService = new MockAnalyticsService();
    await analyticsService.start();

    engine = new EngineController(
      `http://localhost:${adminService.port}/sync/stream`,
      `http://localhost:${analyticsService.port}`,
      3007
    );
    await engine.start();
    // Wait for SSE connection to be established ensuring no events are missed
    await new Promise(r => setTimeout(r, 1000));
  });

  afterAll(async () => {
    await engine.stop();
    await adminService.stop();
    await analyticsService.stop();
  });

  it('should redirect based on Accept-Language header', async () => {
    const rule = {
      id: 'lang-test-1',
      path: '/lang-test',
      destination: 'https://example.com/en',
      code: 302 as const,
      targeting: {
        enabled: true,
        rules: [
          { id: 't1', target: 'language', value: 'fr', destination: 'https://example.com/fr' },
          { id: 't2', target: 'language', value: 'es', destination: 'https://example.com/es' }
        ]
      }
    };

    adminService.pushUpdate({ type: 'create', data: rule });
    await new Promise(r => setTimeout(r, 500));

    // Test Default
    let response = await fetch(`http://localhost:${engine.port}/lang-test`, { redirect: 'manual' });
    expect(response.headers.get('location')).toBe('https://example.com/en');

    // Test French
    response = await fetch(`http://localhost:${engine.port}/lang-test`, {
      redirect: 'manual',
      headers: { 'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8' }
    });
    expect(response.headers.get('location')).toBe('https://example.com/fr');

    // Test Spanish
    response = await fetch(`http://localhost:${engine.port}/lang-test`, {
      redirect: 'manual',
      headers: { 'Accept-Language': 'es' }
    });
    expect(response.headers.get('location')).toBe('https://example.com/es');
  });

  it('should redirect based on Device (User-Agent)', async () => {
    const rule = {
      id: 'device-test-1',
      path: '/device-test',
      destination: 'https://example.com/desktop',
      code: 302 as const,
      targeting: {
        enabled: true,
        rules: [
          { id: 't1', target: 'device', value: 'mobile', destination: 'https://example.com/mobile' }
        ]
      }
    };

    adminService.pushUpdate({ type: 'create', data: rule });
    await new Promise(r => setTimeout(r, 500));

    // Test Desktop (Default)
    let response = await fetch(`http://localhost:${engine.port}/device-test`, {
        redirect: 'manual',
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    expect(response.headers.get('location')).toBe('https://example.com/desktop');

    // Test Mobile
    response = await fetch(`http://localhost:${engine.port}/device-test`, {
        redirect: 'manual',
        headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)' }
    });
    expect(response.headers.get('location')).toBe('https://example.com/mobile');
  });
});
