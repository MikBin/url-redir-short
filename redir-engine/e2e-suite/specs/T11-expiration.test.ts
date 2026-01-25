import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BetterMockAdminService } from '../mocks/admin-service';
import { MockAnalyticsService } from '../mocks/analytics-service';
import { EngineController, RuntimeType } from '../utils/engine-controller';

describe('T11: Expiration Logic', () => {
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
      3011, // Unique port for this test
      runtime
    );
    await engine.start();
  });

  afterAll(async () => {
    await engine.stop();
    await adminService.stop();
    await analyticsService.stop();
  });

  it('should return 404 if rule is expired by time', async () => {
    const rule = {
      id: 'link-expired-time',
      path: '/expired-time',
      destination: 'https://example.com/expired',
      code: 301 as const,
      expiresAt: Date.now() - 10000 // Expired 10s ago
    };

    adminService.pushUpdate({ type: 'create', data: rule });
    await new Promise(r => setTimeout(r, 200));

    const response = await fetch(`http://localhost:${engine.port}/expired-time`, { redirect: 'manual' });
    expect(response.status).not.toBe(301);
    expect(response.status).toBe(404);
  });

  it('should return 404 if rule is expired by max clicks', async () => {
    const rule = {
      id: 'link-expired-clicks',
      path: '/expired-clicks',
      destination: 'https://example.com/expired',
      code: 301 as const,
      maxClicks: 5,
      clicks: 5
    };

    adminService.pushUpdate({ type: 'create', data: rule });
    await new Promise(r => setTimeout(r, 200));

    const response = await fetch(`http://localhost:${engine.port}/expired-clicks`, { redirect: 'manual' });
    expect(response.status).not.toBe(301);
    expect(response.status).toBe(404);
  });

  it('should redirect if rule is valid (clicks < maxClicks)', async () => {
    const rule = {
      id: 'link-valid-clicks',
      path: '/valid-clicks',
      destination: 'https://example.com/valid',
      code: 301 as const,
      maxClicks: 5,
      clicks: 4
    };

    adminService.pushUpdate({ type: 'create', data: rule });
    await new Promise(r => setTimeout(r, 200));

    const response = await fetch(`http://localhost:${engine.port}/valid-clicks`, { redirect: 'manual' });
    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe('https://example.com/valid');
  });

  it('should redirect if rule is valid (future expiresAt)', async () => {
    const rule = {
      id: 'link-valid-time',
      path: '/valid-time',
      destination: 'https://example.com/valid',
      code: 301 as const,
      expiresAt: Date.now() + 10000 // Expires in 10s
    };

    adminService.pushUpdate({ type: 'create', data: rule });
    await new Promise(r => setTimeout(r, 200));

    const response = await fetch(`http://localhost:${engine.port}/valid-time`, { redirect: 'manual' });
    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe('https://example.com/valid');
  });
});
