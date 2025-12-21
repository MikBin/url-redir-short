import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { BetterMockAdminService } from '../mocks/admin-service';
import { MockAnalyticsService } from '../mocks/analytics-service';
import { EngineController } from '../utils/engine-controller';

describe('T05: Priority Logic', () => {
  let adminService: BetterMockAdminService;
  let analyticsService: MockAnalyticsService;
  let engine: EngineController;

  beforeAll(async () => {
    adminService = new BetterMockAdminService();
    await adminService.start();

    analyticsService = new MockAnalyticsService();
    await analyticsService.start();

    engine = new EngineController(
      `http://localhost:${adminService.port}/sync/stream`,
      `http://localhost:${analyticsService.port}`,
      3005
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

  const rule = {
    id: 'priority-test',
    path: '/priority',
    destination: 'https://example.com',
    code: 302 as const
  };

  it('should prioritize explicit query parameters (Priority 1)', async () => {
    adminService.pushUpdate({ type: 'create', data: rule });
    await new Promise(r => setTimeout(r, 200));

    // Request with explicit ?ref=... AND Referer header
    await fetch(`http://localhost:${engine.port}/priority?ref=twitter`, {
        redirect: 'manual',
        headers: {
            'Referer': 'https://google.com'
        }
    });

    await new Promise(r => setTimeout(r, 500));
    const events = analyticsService.getEvents();
    expect(events.length).toBe(1);
    expect(events[0].referrer).toBe('twitter');
    expect(events[0].referrer_source).toBe('explicit');
  });

  it('should fallback to Referer header (Priority 2)', async () => {
    // Request with NO query param, but WITH Referer header
    await fetch(`http://localhost:${engine.port}/priority`, {
        redirect: 'manual',
        headers: {
            'Referer': 'https://google.com'
        }
    });

    await new Promise(r => setTimeout(r, 500));
    const events = analyticsService.getEvents();
    expect(events.length).toBe(1);
    expect(events[0].referrer).toBe('https://google.com');
    expect(events[0].referrer_source).toBe('implicit');
  });

  it('should handle utm_source as explicit', async () => {
    await fetch(`http://localhost:${engine.port}/priority?utm_source=linkedin`, {
        redirect: 'manual'
    });

    await new Promise(r => setTimeout(r, 500));
    const events = analyticsService.getEvents();
    expect(events.length).toBe(1);
    expect(events[0].referrer).toBe('linkedin');
    expect(events[0].referrer_source).toBe('explicit');
  });

    it('should handle source as explicit', async () => {
    await fetch(`http://localhost:${engine.port}/priority?source=newsletter`, {
        redirect: 'manual'
    });

    await new Promise(r => setTimeout(r, 500));
    const events = analyticsService.getEvents();
    expect(events.length).toBe(1);
    expect(events[0].referrer).toBe('newsletter');
    expect(events[0].referrer_source).toBe('explicit');
  });
});
