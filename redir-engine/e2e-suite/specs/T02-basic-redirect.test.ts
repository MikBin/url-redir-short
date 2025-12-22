import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BetterMockAdminService } from '../mocks/admin-service';
import { MockAnalyticsService } from '../mocks/analytics-service';
import { EngineController, RuntimeType } from '../utils/engine-controller';

describe('T02: Basic Redirect', () => {
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
      `http://localhost:${adminService.port}/sync/stream`,
      `http://localhost:${analyticsService.port}`,
      3002,
      runtime
    );
    await engine.start();
  });

  afterAll(async () => {
    await engine.stop();
    await adminService.stop();
    await analyticsService.stop();
  });

  it('should redirect with 301 for permanent links', async () => {
    const rule = {
      id: 'link-301',
      path: '/permanent',
      destination: 'https://example.com/perm',
      code: 301 as const
    };

    adminService.pushUpdate({ type: 'create', data: rule });
    await new Promise(r => setTimeout(r, 200));

    const response = await fetch(`http://localhost:${engine.port}/permanent`, { redirect: 'manual' });
    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe('https://example.com/perm');
  });

  it('should redirect with 302 for temporary links', async () => {
    const rule = {
      id: 'link-302',
      path: '/temp',
      destination: 'https://example.com/temp',
      code: 302 as const
    };

    adminService.pushUpdate({ type: 'create', data: rule });
    await new Promise(r => setTimeout(r, 200));

    const response = await fetch(`http://localhost:${engine.port}/temp`, { redirect: 'manual' });
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://example.com/temp');
  });
});
