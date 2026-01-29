import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { BetterMockAdminService } from '../mocks/admin-service';
import { MockAnalyticsService } from '../mocks/analytics-service';
import { EngineController, RuntimeType } from '../utils/engine-controller';

describe('T04: Analytics Emission', () => {
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
      3004,
      runtime
    );
    await engine.start();
  });

  afterAll(async () => {
    await engine.stop();
    await adminService.stop();
    await analyticsService.stop();
  });

  beforeEach(() => {
    analyticsService.clear();
  });

  it('should emit analytics event asynchronously after redirect', async () => {
    const rule = {
      id: 'analytics-test',
      path: '/track-me',
      destination: 'https://example.com',
      code: 301 as const
    };

    adminService.pushUpdate({ type: 'create', data: rule });
    // Wait for sync
    await new Promise(r => setTimeout(r, 200));

    // Perform the redirect
    await fetch(`http://127.0.0.1:${engine.port}/track-me`, {
        redirect: 'manual',
        headers: {
            'User-Agent': 'Test-Agent/1.0'
        }
    });

    // Wait a bit for async analytics emission
    await new Promise(r => setTimeout(r, 500));

    const events = analyticsService.getEvents();
    expect(events.length).toBe(1);

    const event = events[0];
    expect(event).toMatchObject({
        path: '/track-me',
        user_agent: 'Test-Agent/1.0',
        destination: 'https://example.com'
    });
    expect(event.timestamp).toBeDefined();
    expect(event.ip).toBeDefined(); // Will verify hashing in T08
  });
});
