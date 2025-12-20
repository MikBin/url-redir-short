import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BetterMockAdminService } from '../mocks/admin-service';
import { MockAnalyticsService } from '../mocks/analytics-service';
import { EngineController } from '../utils/engine-controller';

describe('T01: Boot & Sync', () => {
  let adminService: BetterMockAdminService;
  let analyticsService: MockAnalyticsService;
  let engine: EngineController;

  beforeAll(async () => {
    // 1. Start Mocks
    adminService = new BetterMockAdminService();
    await adminService.start();

    analyticsService = new MockAnalyticsService();
    await analyticsService.start();

    // 2. Start Engine
    engine = new EngineController(
      `http://localhost:${adminService.port}`,
      `http://localhost:${analyticsService.port}`
    );
    await engine.start();
  });

  afterAll(async () => {
    await engine.stop();
    await adminService.stop();
    await analyticsService.stop();
  });

  it('should receive updates from Admin Service', async () => {
    // 3. Push a redirect rule via SSE
    const testRedirect = {
      id: 'test-link-1',
      path: '/test-redirect',
      destination: 'https://example.com',
      code: 301
    };

    adminService.pushUpdate({
      type: 'create',
      data: testRedirect
    });

    // Wait for sync
    await new Promise(r => setTimeout(r, 500));

    // 4. Request the link from Engine
    try {
        const response = await fetch(`http://localhost:${engine.port}/test-redirect`, {
            redirect: 'manual'
        });

        // 5. Assert
        // Currently expected to FAIL because engine is empty
        expect(response.status).toBe(301);
        expect(response.headers.get('location')).toBe('https://example.com');
    } catch (e) {
        // If fetch fails (connection refused), it also counts as failure
        throw e;
    }
  });
});
