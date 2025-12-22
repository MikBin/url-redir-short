import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BetterMockAdminService } from '../mocks/admin-service';
import { MockAnalyticsService } from '../mocks/analytics-service';
import { EngineController, RuntimeType } from '../utils/engine-controller';

describe('T06: A/B Testing', () => {
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
      3006,
      runtime
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

  it('should distribute redirects according to weights', async () => {
    const rule = {
      id: 'ab-test-1',
      path: '/ab-test',
      destination: 'https://example.com/default',
      code: 302 as const,
      ab_testing: {
        enabled: true,
        variations: [
          { id: 'v1', destination: 'https://example.com/a', weight: 50 },
          { id: 'v2', destination: 'https://example.com/b', weight: 50 }
        ]
      }
    };

    adminService.pushUpdate({ type: 'create', data: rule });
    await new Promise(r => setTimeout(r, 500));

    let countA = 0;
    let countB = 0;
    const totalRequests = 100;

    for (let i = 0; i < totalRequests; i++) {
      const response = await fetch(`http://localhost:${engine.port}/ab-test`, { redirect: 'manual' });
      expect(response.status).toBe(302);
      const loc = response.headers.get('location');
      if (loc === 'https://example.com/a') countA++;
      else if (loc === 'https://example.com/b') countB++;
    }

    // With 50/50 split over 100 requests, we expect roughly 50 each.
    // Allow for some variance.
    console.log(`A: ${countA}, B: ${countB}`);
    expect(countA).toBeGreaterThan(30);
    expect(countB).toBeGreaterThan(30);
    expect(countA + countB).toBe(totalRequests);
  });
});
