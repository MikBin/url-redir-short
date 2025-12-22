import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BetterMockAdminService } from '../mocks/admin-service';
import { MockAnalyticsService } from '../mocks/analytics-service';
import { EngineController, RuntimeType } from '../utils/engine-controller';

describe('T03: Fast 404', () => {
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
      3003,
      runtime
    );
    await engine.start();
  });

  afterAll(async () => {
    await engine.stop();
    await adminService.stop();
    await analyticsService.stop();
  });

  it('should return 404 for unknown paths', async () => {
    const response = await fetch(`http://localhost:${engine.port}/unknown-link`);
    expect(response.status).toBe(404);
  });

  it('should return 404 for deleted paths', async () => {
    // 1. Create
    const rule = {
      id: 'deleted-link',
      path: '/to-be-deleted',
      destination: 'https://example.com',
      code: 302 as const
    };
    adminService.pushUpdate({ type: 'create', data: rule });
    await new Promise(r => setTimeout(r, 200));

    // Verify it exists
    const res1 = await fetch(`http://localhost:${engine.port}/to-be-deleted`, { redirect: 'manual' });
    expect(res1.status).toBe(302);

    // 2. Delete
    adminService.pushUpdate({ type: 'delete', data: rule });
    await new Promise(r => setTimeout(r, 200));

    // 3. Verify 404
    const res2 = await fetch(`http://localhost:${engine.port}/to-be-deleted`, { redirect: 'manual' });
    expect(res2.status).toBe(404);
  });
});
