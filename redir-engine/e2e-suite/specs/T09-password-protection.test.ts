import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BetterMockAdminService } from '../mocks/admin-service';
import { MockAnalyticsService } from '../mocks/analytics-service';
import { EngineController, RuntimeType } from '../utils/engine-controller';

describe('T09: Password Protection', () => {
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
      3009,
      runtime // Unique port for this test
    );
    await engine.start();
  });

  afterAll(async () => {
    await engine.stop();
    await adminService.stop();
    await analyticsService.stop();
  });

  it('should serve a password form for protected links', async () => {
    const protectedRule = {
      id: 'protected-1',
      path: '/secret',
      destination: 'https://secret.com',
      code: 301,
      password_protection: {
        enabled: true,
        password: 'supersecretpass'
      }
    };

    adminService.pushUpdate({
      type: 'create',
      data: protectedRule
    });

    // Wait for sync
    await new Promise(r => setTimeout(r, 500));

    // 1. GET request should return HTML form
    const response = await fetch(`http://localhost:${engine.port}/secret`, {
      redirect: 'manual'
    });

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain('<form');
    expect(text).toContain('type="password"');
  });

  it('should reject incorrect password', async () => {
    // 2. POST with wrong password
    const params = new URLSearchParams();
    params.append('password', 'wrongpass');

    const response = await fetch(`http://localhost:${engine.port}/secret`, {
      method: 'POST',
      body: params,
      redirect: 'manual'
    });

    // Should stay on form (200) or return 401. Let's assume 401 for clarity or just check content.
    // Requirement says "validate", implies failure.
    // If we re-render form, it's 200.
    // Let's expect it NOT to be a redirect.
    expect(response.status).not.toBe(301);
    expect(response.status).not.toBe(302);

    // Ideally it re-renders the form
    const text = await response.text();
    expect(text).toContain('<form');
  });

  it('should redirect on correct password', async () => {
    // 3. POST with correct password
    const params = new URLSearchParams();
    params.append('password', 'supersecretpass');

    const response = await fetch(`http://localhost:${engine.port}/secret`, {
      method: 'POST',
      body: params,
      redirect: 'manual'
    });

    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe('https://secret.com');
  });
});
