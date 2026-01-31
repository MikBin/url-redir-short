import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BetterMockAdminService } from '../mocks/admin-service';
import { MockAnalyticsService } from '../mocks/analytics-service';
import { EngineController, RuntimeType } from '../utils/engine-controller';

describe('T10: HSTS', () => {
  let adminService: BetterMockAdminService;
  let analyticsService: MockAnalyticsService;
  let engine: EngineController;

  beforeAll(async () => {
    adminService = new BetterMockAdminService();
    await adminService.start();

    analyticsService = new MockAnalyticsService();
    await analyticsService.start();

    const runtime = (process.env.TEST_RUNTIME || 'node') as RuntimeType;
    engine = new EngineController(
      `http://127.0.0.1:${adminService.port}/sync/stream`,
      `http://127.0.0.1:${analyticsService.port}`,
      3010
    );
    await engine.start();
    // Wait for SSE connection
    await new Promise(r => setTimeout(r, 1000));
  });

  afterAll(async () => {
    await engine.stop();
    await adminService.stop();
    await analyticsService.stop();
  });

  it('should set Strict-Transport-Security header when enabled', async () => {
    const rule = {
      id: 'hsts-test-1',
      path: '/hsts-enabled',
      destination: 'https://example.com/hsts',
      code: 301 as const,
      hsts: {
        enabled: true,
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    };

    adminService.pushUpdate({ type: 'create', data: rule });
    await new Promise(r => setTimeout(r, 500));

    const response = await fetch(`http://127.0.0.1:${engine.port}/hsts-enabled`, { redirect: 'manual' });
    expect(response.status).toBe(301);

    const hsts = response.headers.get('Strict-Transport-Security');
    expect(hsts).toBeDefined();
    expect(hsts).toContain('max-age=31536000');
    expect(hsts).toContain('includeSubDomains');
    expect(hsts).toContain('preload');
  });

  it('should NOT set HSTS when disabled or missing', async () => {
    const rule = {
      id: 'hsts-test-2',
      path: '/hsts-disabled',
      destination: 'https://example.com/no-hsts',
      code: 301 as const
      // hsts missing
    };

    adminService.pushUpdate({ type: 'create', data: rule });
    await new Promise(r => setTimeout(r, 500));

    const response = await fetch(`http://127.0.0.1:${engine.port}/hsts-disabled`, { redirect: 'manual' });
    expect(response.status).toBe(301);
    expect(response.headers.get('Strict-Transport-Security')).toBeNull();
  });
});
