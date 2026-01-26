import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BetterMockAdminService } from '../mocks/admin-service';
import { MockAnalyticsService } from '../mocks/analytics-service';
import { EngineController, RuntimeType } from '../utils/engine-controller';

describe('T12: Performance & Load Testing', () => {
  let adminService: BetterMockAdminService;
  let analyticsService: MockAnalyticsService;
  let engine: EngineController;

  beforeAll(async () => {
    console.log('[T12] Setup start');
    adminService = new BetterMockAdminService();
    await adminService.start();

    analyticsService = new MockAnalyticsService();
    await analyticsService.start();

    const runtime = (process.env.TEST_RUNTIME || 'node') as RuntimeType;
    const adminUrl = `http://127.0.0.1:${adminService.port}/sync/stream`;
    const analyticsUrl = `http://127.0.0.1:${analyticsService.port}`;

    engine = new EngineController(adminUrl, analyticsUrl, 3001, runtime);
    await engine.start();
    await adminService.waitForConnection(15000);

    console.log('[T12] Engine started');
  });

  afterAll(async () => {
    console.log('[T12] Teardown start');
    await engine.stop();
    await adminService.stop();
    await analyticsService.stop();
    console.log('[T12] Teardown done');
  });

  describe('Routing Table Size Scaling', () => {
    it('should handle 1K redirects with acceptable latency', async () => {
      console.log('[T12] Populating 1K redirects');
      
      // Create 1K redirects
      for (let i = 0; i < 1000; i++) {
        adminService.pushUpdate({
          type: 'create',
          data: {
            id: `redirect-${i}`,
            path: `/r${i}`,
            destination: `https://example.com/${i}`,
            code: 301,
          },
        });
      }

      await new Promise(r => setTimeout(r, 1000)); // Wait for sync

      // Measure latency of lookups across the table
      const times: number[] = [];
      for (let i = 0; i < 100; i++) {
        const idx = Math.floor(Math.random() * 1000);
        const start = performance.now();
        const response = await fetch(`http://localhost:${engine.port}/r${idx}`, {
          redirect: 'manual',
        });
        const end = performance.now();
        times.push(end - start);
        expect(response.status).toBe(301);
      }

      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];
      const p99 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.99)];

      console.log(`[T12] 1K redirects - Avg: ${avg.toFixed(2)}ms, P95: ${p95.toFixed(2)}ms, P99: ${p99.toFixed(2)}ms`);

      // Assert reasonable performance thresholds
      expect(avg).toBeLessThan(100); // Average < 100ms
      expect(p99).toBeLessThan(200); // P99 < 200ms
    });

    it('should handle 10K redirects with acceptable latency', async () => {
      console.log('[T12] Populating 10K redirects');
      
      // Create additional 9K redirects (1K already exist)
      for (let i = 1000; i < 10000; i++) {
        adminService.pushUpdate({
          type: 'create',
          data: {
            id: `redirect-${i}`,
            path: `/r${i}`,
            destination: `https://example.com/${i}`,
            code: 301,
          },
        });
      }

      await new Promise(r => setTimeout(r, 2000)); // Wait for sync

      const times: number[] = [];
      for (let i = 0; i < 100; i++) {
        const idx = Math.floor(Math.random() * 10000);
        const start = performance.now();
        const response = await fetch(`http://localhost:${engine.port}/r${idx}`, {
          redirect: 'manual',
        });
        const end = performance.now();
        times.push(end - start);
        expect(response.status).toBe(301);
      }

      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];
      const p99 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.99)];

      console.log(`[T12] 10K redirects - Avg: ${avg.toFixed(2)}ms, P95: ${p95.toFixed(2)}ms, P99: ${p99.toFixed(2)}ms`);

      expect(avg).toBeLessThan(150);
      expect(p99).toBeLessThan(300);
    });
  });

  describe('Concurrent Request Load', () => {
    it('should handle concurrent requests (10 parallel)', async () => {
      console.log('[T12] Testing 10 concurrent requests');
      
      const times: number[] = [];
      const batchSize = 10;

      for (let batch = 0; batch < 10; batch++) {
        const start = performance.now();
        
        const promises = Array.from({ length: batchSize }, async (_, i) => {
          const idx = Math.floor(Math.random() * 10000);
          return fetch(`http://localhost:${engine.port}/r${idx}`, {
            redirect: 'manual',
          });
        });

        const responses = await Promise.all(promises);
        const end = performance.now();

        times.push((end - start) / batchSize); // Average per request in batch
        
        for (const response of responses) {
          expect(response.status).toBe(301);
        }
      }

      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const max = Math.max(...times);

      console.log(`[T12] 10 concurrent - Avg/req: ${avg.toFixed(2)}ms, Max: ${max.toFixed(2)}ms`);
      expect(avg).toBeLessThan(200);
    });

    it('should handle concurrent requests (50 parallel)', async () => {
      console.log('[T12] Testing 50 concurrent requests');
      
      const times: number[] = [];
      const batchSize = 50;

      for (let batch = 0; batch < 5; batch++) {
        const start = performance.now();
        
        const promises = Array.from({ length: batchSize }, async (_, i) => {
          const idx = Math.floor(Math.random() * 10000);
          return fetch(`http://localhost:${engine.port}/r${idx}`, {
            redirect: 'manual',
          });
        });

        const responses = await Promise.all(promises);
        const end = performance.now();

        times.push((end - start) / batchSize);
        
        for (const response of responses) {
          expect(response.status).toBe(301);
        }
      }

      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const max = Math.max(...times);

      console.log(`[T12] 50 concurrent - Avg/req: ${avg.toFixed(2)}ms, Max: ${max.toFixed(2)}ms`);
      expect(avg).toBeLessThan(300);
    });

    it('should handle concurrent requests (100 parallel)', async () => {
      console.log('[T12] Testing 100 concurrent requests');
      
      const times: number[] = [];
      const batchSize = 100;

      for (let batch = 0; batch < 3; batch++) {
        const start = performance.now();
        
        const promises = Array.from({ length: batchSize }, async (_, i) => {
          const idx = Math.floor(Math.random() * 10000);
          return fetch(`http://localhost:${engine.port}/r${idx}`, {
            redirect: 'manual',
          });
        });

        const responses = await Promise.all(promises);
        const end = performance.now();

        times.push((end - start) / batchSize);
        
        for (const response of responses) {
          expect(response.status).toBe(301);
        }
      }

      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const max = Math.max(...times);

      console.log(`[T12] 100 concurrent - Avg/req: ${avg.toFixed(2)}ms, Max: ${max.toFixed(2)}ms`);
      expect(avg).toBeLessThan(500);
    });
  });

  describe('404 Rejection Performance (Cuckoo Filter)', () => {
    it('should reject 404s efficiently with 10K valid redirects', async () => {
      console.log('[T12] Testing 404 rejection rate');
      
      const times: number[] = [];

      // Test mix of hits and misses
      for (let i = 0; i < 200; i++) {
        const idx = Math.floor(Math.random() * 10000);
        const isValid = Math.random() > 0.5;
        const path = isValid ? `/r${idx}` : `/missing-${idx}`;

        const start = performance.now();
        const response = await fetch(`http://localhost:${engine.port}${path}`, {
          redirect: 'manual',
        });
        const end = performance.now();
        times.push(end - start);

        if (isValid) {
          expect(response.status).toBe(301);
        } else {
          expect(response.status).toBe(404);
        }
      }

      const hitTimes = times.slice(0, 100);
      const missTimes = times.slice(100);

      const hitAvg = hitTimes.reduce((a, b) => a + b, 0) / hitTimes.length;
      const missAvg = missTimes.reduce((a, b) => a + b, 0) / missTimes.length;

      console.log(`[T12] 404 rejection - Hit avg: ${hitAvg.toFixed(2)}ms, Miss avg: ${missAvg.toFixed(2)}ms`);

      // 404s should be faster (rejected by Cuckoo filter quickly)
      expect(missAvg).toBeLessThan(hitAvg + 10); // Allow some variance
    });
  });

  describe('Hot Path Performance', () => {
    it('should maintain performance on hot paths (80/20 rule)', async () => {
      console.log('[T12] Testing hot path performance');
      
      // 80% of traffic goes to 20% of redirects
      const hotPathCount = Math.floor(10000 * 0.2); // 2000 redirects
      const times: number[] = [];

      for (let i = 0; i < 200; i++) {
        const isHotPath = Math.random() < 0.8;
        const idx = isHotPath 
          ? Math.floor(Math.random() * hotPathCount) // 0-2000 (hot)
          : Math.floor(Math.random() * 10000); // Full range

        const start = performance.now();
        const response = await fetch(`http://localhost:${engine.port}/r${idx}`, {
          redirect: 'manual',
        });
        const end = performance.now();
        times.push(end - start);

        expect(response.status).toBe(301);
      }

      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const p99 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.99)];

      console.log(`[T12] Hot paths - Avg: ${avg.toFixed(2)}ms, P99: ${p99.toFixed(2)}ms`);
      expect(avg).toBeLessThan(150);
    });
  });

  describe('Real-world Simulation', () => {
    it('should handle simulated traffic pattern (requests over 10 seconds)', async () => {
      console.log('[T12] Simulating 10s traffic burst');
      
      const duration = 10000; // 10 seconds
      const targetRPS = 50; // 50 requests per second
      const requestsPerBatch = Math.floor(targetRPS / 10); // 10 batches per second
      const batchDelayMs = 100;

      const times: number[] = [];
      const startTime = Date.now();

      while (Date.now() - startTime < duration) {
        const batchStart = performance.now();
        
        const promises = Array.from({ length: requestsPerBatch }, async () => {
          const idx = Math.floor(Math.random() * 10000);
          return fetch(`http://localhost:${engine.port}/r${idx}`, {
            redirect: 'manual',
          });
        });

        const responses = await Promise.all(promises);
        const batchEnd = performance.now();

        times.push(batchEnd - batchStart);

        for (const response of responses) {
          expect(response.status).toBe(301);
        }

        // Sleep for batch delay
        await new Promise(r => setTimeout(r, batchDelayMs));
      }

      const totalRequests = times.length * requestsPerBatch;
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const max = Math.max(...times);
      const p99 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.99)];

      console.log(`[T12] Real-world sim - ${totalRequests} requests over 10s`);
      console.log(`[T12] Avg batch: ${avg.toFixed(2)}ms, P99: ${p99.toFixed(2)}ms, Max: ${max.toFixed(2)}ms`);

      expect(avg).toBeLessThan(200);
      expect(p99).toBeLessThan(400);
    });
  });
});
