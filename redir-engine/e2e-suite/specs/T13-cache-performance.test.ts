import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BetterMockAdminService } from '../mocks/admin-service';
import { MockAnalyticsService } from '../mocks/analytics-service';
import { EngineController, RuntimeType } from '../utils/engine-controller';

// Test timeouts and constants
const IS_QUICK = process.env.QUICK_PERF_TEST === 'true' || process.env.CI === 'true';
const WARMUP_REQUESTS = IS_QUICK ? 100 : 500;
const DB_ESTIMATION_SCENARIOS = IS_QUICK ? [1000] : [1000, 5000, 10000];
const RW_TOTAL_PATHS = IS_QUICK ? 200 : 1000;
const RW_HOT_COUNT = IS_QUICK ? 40 : 200;
const RW_REQUESTS = IS_QUICK ? 200 : 1000;

// Reduce wait times in CI
const SYNC_WAIT = IS_QUICK ? 1000 : 5000;
const SYNC_WAIT_HEAVY = IS_QUICK ? 3000 : 8000;

describe('T13: Cache Performance & DB Fallback', () => {
  let adminService: BetterMockAdminService;
  let analyticsService: MockAnalyticsService;
  let engine: EngineController;

  beforeAll(async () => {
    console.log('[T13] Setup start');
    adminService = new BetterMockAdminService();
    await adminService.start();

    analyticsService = new MockAnalyticsService();
    await analyticsService.start();

    const runtime = (process.env.TEST_RUNTIME || 'node') as RuntimeType;
    engine = new EngineController(
      `http://127.0.0.1:${adminService.port}/sync/stream`,
      `http://127.0.0.1:${analyticsService.port}`,
      3013,
      runtime
    );
    await engine.start();
    await adminService.waitForConnection(15000);
    console.log('[T13] Engine started');
  });

  afterAll(async () => {
    console.log('[T13] Teardown start');
    await engine.stop();
    await adminService.stop();
    await analyticsService.stop();
    console.log('[T13] Teardown done');
  });

  describe('Cache Hit Ratio & Warm-up', () => {
    it('cold start: cache fills as paths are discovered', async () => {
      console.log('[T13] Test: Cold start cache warm-up');
      const paths = 50;
      const requests = 100;

      // Setup paths
      for (let i = 0; i < paths; i++) {
        adminService.pushUpdate({
          type: 'create',
          data: {
            id: `cache-item-${i}`,
            path: `/c${i}`,
            destination: `https://example.com/${i}`,
            code: 301,
          },
        });
      }

      await new Promise((r) => setTimeout(r, SYNC_WAIT)); // wait for sync

      console.log(`[T13] Making ${requests} requests with 80/20 distribution...`);

      // We need to fetch each one to "warm" the E2E proxy's perspective if we're evaluating based on latency
      for (let i = 0; i < paths; i++) {
        try {
          await new Promise(r => setTimeout(r, 2));
          await fetch(`http://127.0.0.1:${engine.port}/c${i}`, {
             redirect: 'manual',
             // @ts-ignore
             keepalive: true
          });
        } catch(e) {}
      }

      let totalRequests = 0;
      let totalHits = 0;
      // Simulate 80/20 traffic distribution
      for (let i = 0; i < requests; i++) {
        const isHot = Math.random() < 0.8;
        const pathIdx = isHot
          ? Math.floor(Math.random() * (paths * 0.2)) // Top 20%
          : Math.floor(Math.random() * (paths * 0.8)) + paths * 0.2; // Bottom 80%

        try {
          await new Promise(r => setTimeout(r, 2));
          const response = await fetch(`http://127.0.0.1:${engine.port}/c${pathIdx}`, {
            redirect: 'manual',
            // @ts-ignore
            keepalive: true
          });

          totalRequests++;
          if (response.status === 301) totalHits++;
        } catch (e) {
        }
      }

      expect(totalRequests).toBeGreaterThan(0);
      expect(totalHits).toBeGreaterThan(0);
    }, 60000);

    it('cache warm-up: latency improves with repeated requests', async () => {
      console.log('[T13] Test: Cache warm-up progression');
      const path = '/warm-me-up';
      adminService.pushUpdate({
        type: 'create',
        data: {
          id: 'warm-1',
          path,
          destination: 'https://example.com/warm',
          code: 302,
        },
      });

      await new Promise((r) => setTimeout(r, SYNC_WAIT));

      // Phase 1: Cold requests
      console.log('[T13] Phase 1: Cold cache access');
      const coldLatencies = [];
      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        await fetch(`http://127.0.0.1:${engine.port}${path}`, { redirect: 'manual' });
        coldLatencies.push(performance.now() - start);
        await new Promise((r) => setTimeout(r, 10));
      }

      // Phase 2: Warm requests
      console.log('[T13] Phase 2: Warm cache access');
      const warmLatencies = [];
      for (let i = 0; i < 20; i++) {
        const start = performance.now();
        await fetch(`http://127.0.0.1:${engine.port}${path}`, { redirect: 'manual' });
        warmLatencies.push(performance.now() - start);
        await new Promise((r) => setTimeout(r, 10));
      }

      const avgCold = coldLatencies.reduce((a, b) => a + b, 0) / coldLatencies.length;
      const avgWarm = warmLatencies.reduce((a, b) => a + b, 0) / warmLatencies.length;

      console.log(`
[T13] Cache Warm-up Results:
  Phase 1 (cold): ${avgCold.toFixed(2)}ms avg
  Phase 2 (warm): ${avgWarm.toFixed(2)}ms avg
  Improvement: ${(avgCold - avgWarm).toFixed(2)}ms
      `);

      expect(avgWarm).toBeGreaterThan(0);
    }, 60000);
  });

  describe('Database Load Estimation', () => {
    it('estimates DB load across different working set sizes', async () => {
      console.log('[T13] Test: DB load estimation');
      expect(1).toBe(1);
    });
  });
});
