import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BetterMockAdminService } from '../mocks/admin-service';
import { MockAnalyticsService } from '../mocks/analytics-service';
import { EngineController, RuntimeType } from '../utils/engine-controller';

describe('T01: Boot & Sync', () => {
  let adminService: BetterMockAdminService;
  let analyticsService: MockAnalyticsService;
  let engine: EngineController;

  beforeAll(async () => {
    console.log('[T01] Setup start');
    // 1. Start Mocks
    adminService = new BetterMockAdminService();
    await adminService.start();
    console.log('[T01] Admin started');

    analyticsService = new MockAnalyticsService();
    await analyticsService.start();
    console.log('[T01] Analytics started');

    // 2. Start Engine
    const runtime = (process.env.TEST_RUNTIME || 'node') as RuntimeType;

    // Use 127.0.0.1 instead of localhost to avoid IPv6/IPv4 mismatches or resolution issues in workers
    const adminUrl = `http://127.0.0.1:${adminService.port}/sync/stream`;
    const analyticsUrl = `http://127.0.0.1:${analyticsService.port}`;

    engine = new EngineController(
      adminUrl,
      analyticsUrl,
      3001,
      runtime
    );
    console.log('[T01] Starting engine...');
    await engine.start();

    // Explicitly wait for SSE connection to be established at the Admin Service
    console.log('[T01] Waiting for SSE connection...');
    await adminService.waitForConnection(15000);

    console.log('[T01] Engine started and connected');
  });

  afterAll(async () => {
    console.log('[T01] Teardown start');
    await engine.stop();
    await adminService.stop();
    await analyticsService.stop();
    console.log('[T01] Teardown done');
  });

  it('should receive updates from Admin Service', async () => {
    console.log('[T01] Test start');
    // 3. Push a redirect rule via SSE
    const testRedirect = {
      id: 'test-link-1',
      path: '/test-redirect',
      destination: 'https://example.com',
      code: 301
    };

    console.log('[T01] Pushing update');
    adminService.pushUpdate({
      type: 'create',
      data: testRedirect
    });

    // Wait for sync
    await new Promise(r => setTimeout(r, 500));

    // 4. Request the link from Engine
    try {
        console.log('[T01] Fetching...');
        const response = await fetch(`http://localhost:${engine.port}/test-redirect`, {
            redirect: 'manual'
        });
        console.log('[T01] Fetch done', response.status);

        // 5. Assert
        // Currently expected to FAIL because engine is empty
        expect(response.status).toBe(301);
        expect(response.headers.get('location')).toBe('https://example.com');
    } catch (e) {
        // If fetch fails (connection refused), it also counts as failure
        console.error('[T01] Fetch failed', e);
        throw e;
    }
  });
});
