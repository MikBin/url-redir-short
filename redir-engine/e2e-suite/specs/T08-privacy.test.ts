import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { BetterMockAdminService } from '../mocks/admin-service';
import { MockAnalyticsService } from '../mocks/analytics-service';
import { EngineController, RuntimeType } from '../utils/engine-controller';
import crypto from 'crypto';

describe('T08: Privacy (IP Anonymization)', () => {
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
      3008,
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

  it('should hash the IP address before emitting analytics', async () => {
    const rule = {
      id: 'privacy-test',
      path: '/privacy',
      destination: 'https://example.com',
      code: 301 as const
    };

    adminService.pushUpdate({ type: 'create', data: rule });
    await new Promise(r => setTimeout(r, 200));

    // We can't easily spoof the source IP in a 127.0.0.1 test without more complex setup,
    // but the engine sees '127.0.0.1' or '::1'.
    // We expect the emitted IP to NOT be '127.0.0.1'.

    await fetch(`http://127.0.0.1:${engine.port}/privacy`, {
        redirect: 'manual'
    });

    await new Promise(r => setTimeout(r, 500));
    const events = analyticsService.getEvents();
    expect(events.length).toBe(1);

    const originalIp = '127.0.0.1'; // or ::1 depending on node version/OS
    const emittedIp = events[0].ip;

    expect(emittedIp).not.toBe(originalIp);
    expect(emittedIp).not.toBe('::1');

    // Check if it looks like a hash (hex string)
    expect(emittedIp).toMatch(/^[a-f0-9]{64}$/); // Assuming SHA-256
  });
});
