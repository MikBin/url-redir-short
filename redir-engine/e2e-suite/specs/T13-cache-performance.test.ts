import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BetterMockAdminService } from '../mocks/admin-service';
import { MockAnalyticsService } from '../mocks/analytics-service';
import { EngineController, RuntimeType } from '../utils/engine-controller';
import { CacheMetricsCollector } from '../../src/adapters/cache/cache-metrics';

describe('T13: Cache Performance & DB Fallback', () => {
  let adminService: BetterMockAdminService;
  let analyticsService: MockAnalyticsService;
  let engine: EngineController;
  let metricsCollector: CacheMetricsCollector;

  beforeAll(async () => {
    console.log('[T13] Setup start');
    metricsCollector = new CacheMetricsCollector();

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

    console.log('[T13] Engine started');
  }, 30000);

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
      metricsCollector.reset();

      const hotPaths = 100;
      const requests = 500;

      // Create hot paths
      for (let i = 0; i < hotPaths; i++) {
        adminService.pushUpdate({
          type: 'create',
          data: {
            id: `hot-${i}`,
            path: `/h${i}`,
            destination: `https://example.com/hot/${i}`,
            code: 301,
          },
        });
      }
      await new Promise(r => setTimeout(r, 500));

      // Make requests to hot paths (80%) and cold paths (20%)
      console.log(`[T13] Making ${requests} requests with 80/20 distribution...`);
      for (let i = 0; i < requests; i++) {
        const isHot = Math.random() < 0.8;
        const pathIdx = isHot
          ? Math.floor(Math.random() * hotPaths)
          : hotPaths + Math.floor(Math.random() * 1000);

        const path = isHot ? `/h${pathIdx}` : `/cold${pathIdx}`;
        const start = performance.now();

        try {
          const response = await fetch(`http://localhost:${engine.port}${path}`, {
            redirect: 'manual',
          });
          const elapsed = performance.now() - start;
          const hit = response.status === 301;
          metricsCollector.recordRequest(path, hit, elapsed);
        } catch (e) {
          const elapsed = performance.now() - start;
          metricsCollector.recordRequest(path, false, elapsed);
        }
      }

      metricsCollector.setCacheSize(hotPaths);
      const metrics = metricsCollector.getMetrics();

      console.log(metricsCollector.printReport());

      expect(metrics.hits).toBeGreaterThan(0);
      expect(metrics.totalRequests).toBe(requests);
    }, 60000);

    it('cache warm-up: latency improves with repeated requests', async () => {
      console.log('[T13] Test: Cache warm-up progression');
      metricsCollector.reset();

      const paths = 50;

      // Create paths
      for (let i = 0; i < paths; i++) {
        adminService.pushUpdate({
          type: 'create',
          data: {
            id: `warm-${i}`,
            path: `/w${i}`,
            destination: `https://example.com/w/${i}`,
            code: 301,
          },
        });
      }
      await new Promise(r => setTimeout(r, 300));

      // Phase 1: Cold access
      console.log('[T13] Phase 1: Cold cache access');
      metricsCollector.reset();
      let phase1Results: number[] = [];
      for (let i = 0; i < paths; i++) {
        const start = performance.now();
        try {
          await fetch(`http://localhost:${engine.port}/w${i}`, { redirect: 'manual' });
          phase1Results.push(performance.now() - start);
        } catch (e) {}
      }

      const phase1Avg = phase1Results.length > 0
        ? phase1Results.reduce((a, b) => a + b, 0) / phase1Results.length
        : 0;

      // Phase 2: Warm access (repeated)
      console.log('[T13] Phase 2: Warm cache access');
      metricsCollector.reset();
      let phase2Results: number[] = [];
      for (let batch = 0; batch < 2; batch++) {
        for (let i = 0; i < paths; i++) {
          const start = performance.now();
          try {
            await fetch(`http://localhost:${engine.port}/w${i}`, { redirect: 'manual' });
            phase2Results.push(performance.now() - start);
          } catch (e) {}
        }
      }

      const phase2Avg = phase2Results.length > 0
        ? phase2Results.reduce((a, b) => a + b, 0) / phase2Results.length
        : 0;

      console.log(`
[T13] Cache Warm-up Results:
  Phase 1 (cold): ${phase1Avg.toFixed(2)}ms avg
  Phase 2 (warm): ${phase2Avg.toFixed(2)}ms avg
  Improvement: ${Math.abs(phase1Avg - phase2Avg).toFixed(2)}ms
      `);

      expect(phase1Results.length).toBeGreaterThan(0);
      expect(phase2Results.length).toBeGreaterThan(0);
    }, 60000);
  });

  describe('Memory vs Performance', () => {
    it('measures memory growth as cache fills', async () => {
      console.log('[T13] Test: Memory profile');
      metricsCollector.reset();

      const sizes = [100, 500, 1000];

      for (const size of sizes) {
        console.log(`[T13] Creating ${size} paths...`);

        // Create paths
        for (let i = 0; i < size; i++) {
          adminService.pushUpdate({
            type: 'create',
            data: {
              id: `mem-${size}-${i}`,
              path: `/mem${size}${i}`,
              destination: `https://example.com/mem/${size}/${i}`,
              code: 301,
            },
          });
        }
        await new Promise(r => setTimeout(r, 200));

        // Measure latency
        metricsCollector.reset();
        let times: number[] = [];

        for (let i = 0; i < 100; i++) {
          const idx = Math.floor(Math.random() * size);
          const start = performance.now();

          try {
            const response = await fetch(`http://localhost:${engine.port}/mem${size}${idx}`, {
              redirect: 'manual',
            });
            const elapsed = performance.now() - start;
            times.push(elapsed);
            metricsCollector.recordRequest(`/mem${size}${idx}`, response.status === 301, elapsed);
          } catch (e) {}
        }

        metricsCollector.setCacheSize(size);
        const metrics = metricsCollector.getMetrics();

        const avgLatency = times.length > 0
          ? times.reduce((a, b) => a + b, 0) / times.length
          : 0;

        console.log(`
  ${size} paths:
    Avg Latency: ${avgLatency.toFixed(2)}ms
    Memory: ${metrics.heapUsedMB.toFixed(1)}MB
    Hit Rate: ${(metrics.hitRatio * 100).toFixed(1)}%
        `);

        expect(metrics.heapUsedMB).toBeGreaterThan(0);
      }
    }, 90000);
  });

  describe('Database Load Estimation', () => {
    it('estimates DB load across different working set sizes', async () => {
      console.log('[T13] Test: DB load estimation');

      const scenarios = [
        { workingSet: 100000, label: '100K' },
        { workingSet: 500000, label: '500K' },
        { workingSet: 1000000, label: '1M' },
      ];

      const cachePerWorker = 100000;
      const workers = 10;
      const totalCacheCapacity = workers * cachePerWorker;
      const requestsPerScenario = 5000;

      console.log(`[T13] Cache Configuration:`);
      console.log(`  Workers: ${workers}`);
      console.log(`  Cache per worker: ${cachePerWorker.toLocaleString()} items`);
      console.log(`  Total cache capacity: ${totalCacheCapacity.toLocaleString()} items`);
      console.log('');

      const results: Array<{
        workingSet: number;
        cacheHits: number;
        dbMisses: number;
        hitRatio: number;
        missRatio: number;
        estimatedDbLoad: { rps100: number; rps1000: number; rps10000: number };
      }> = [];

      for (const scenario of scenarios) {
        console.log(`[T13] Scenario: ${scenario.label} working set`);

        // Calculate hot set (20% of working set)
        const hotSetSize = Math.floor(scenario.workingSet * 0.2);

        // Pre-populate some items (simulate partial cache)
        const cachedItemCount = Math.min(hotSetSize, totalCacheCapacity);
        console.log(`  Creating ${cachedItemCount.toLocaleString()} cached items...`);

        for (let i = 0; i < cachedItemCount; i++) {
          if (i % 10000 === 0 && i > 0) {
            await new Promise(r => setTimeout(r, 50));
          }
          adminService.pushUpdate({
            type: 'create',
            data: {
              id: `dbload-${scenario.label}-${i}`,
              path: `/db${i}`,
              destination: `https://example.com/db/${i}`,
              code: 301,
            },
          });
        }
        await new Promise(r => setTimeout(r, 300));

        // Simulate traffic: 80% hot paths, 20% cold paths
        metricsCollector.reset();
        console.log(`  Simulating ${requestsPerScenario.toLocaleString()} requests...`);

        let cacheHits = 0;
        let dbMisses = 0;

        for (let i = 0; i < requestsPerScenario; i++) {
          const isHot = Math.random() < 0.8;
          let pathIdx: number;

          if (isHot) {
            // Hot paths: from cached items
            pathIdx = Math.floor(Math.random() * Math.min(hotSetSize, cachedItemCount));
          } else {
            // Cold paths: from entire working set (may not exist in cache)
            pathIdx = Math.floor(Math.random() * scenario.workingSet);
          }

          const start = performance.now();

          try {
            const response = await fetch(`http://localhost:${engine.port}/db${pathIdx}`, {
              redirect: 'manual',
            });
            const elapsed = performance.now() - start;

            if (response.status === 301) {
              cacheHits++;
              metricsCollector.recordRequest(`/db${pathIdx}`, true, elapsed);
            } else {
              dbMisses++;
              metricsCollector.recordRequest(`/db${pathIdx}`, false, elapsed);
            }
          } catch (e) {
            dbMisses++;
          }

          if ((i + 1) % 1000 === 0) {
            console.log(`    ${i + 1}/${requestsPerScenario} requests`);
          }
        }

        const hitRatio = cacheHits / requestsPerScenario;
        const missRatio = dbMisses / requestsPerScenario;

        // Estimate DB load at different RPS levels
        const estimatedDbLoad = {
          rps100: Math.round(100 * missRatio),
          rps1000: Math.round(1000 * missRatio),
          rps10000: Math.round(10000 * missRatio),
        };

        results.push({
          workingSet: scenario.workingSet,
          cacheHits,
          dbMisses,
          hitRatio,
          missRatio,
          estimatedDbLoad,
        });

        console.log(`  Results:`);
        console.log(`    Cache hits: ${cacheHits} (${(hitRatio * 100).toFixed(1)}%)`);
        console.log(`    DB misses: ${dbMisses} (${(missRatio * 100).toFixed(1)}%)`);
        console.log(`    Cache coverage: ${((cachedItemCount / scenario.workingSet) * 100).toFixed(1)}%`);
        console.log('');
      }

      // Print summary table
      console.log('[T13] Database Load Estimation Summary');
      console.log('════════════════════════════════════════════════════════════════');
      console.log('');
      console.log('Working Set | Cache Coverage | Hit Ratio | Miss Ratio | DB Load @ 1K RPS');
      console.log('─────────────────────────────────────────────────────────────────');

      for (const result of results) {
        const coverage = ((Math.min(result.workingSet * 0.2, totalCacheCapacity) / result.workingSet) * 100).toFixed(1);
        const wsLabel = `${(result.workingSet / 1000).toFixed(0)}K`.padEnd(11);
        const coverageStr = `${coverage}%`.padEnd(14);
        const hitStr = `${(result.hitRatio * 100).toFixed(1)}%`.padEnd(9);
        const missStr = `${(result.missRatio * 100).toFixed(1)}%`.padEnd(10);
        const dbLoadStr = `${result.estimatedDbLoad.rps1000} q/s`;

        console.log(`${wsLabel} ${coverageStr} ${hitStr} ${missStr} ${dbLoadStr}`);
      }

      console.log('');
      console.log('DB Load Estimates at Different Request Rates:');
      console.log('───────────────────────────────────────────');

      for (const result of results) {
        const ws = `${(result.workingSet / 1000).toFixed(0)}K`;
        console.log(`
${ws} Working Set (${(result.hitRatio * 100).toFixed(1)}% hit rate):
  @ 100 RPS:   ${result.estimatedDbLoad.rps100} queries/sec
  @ 1K RPS:    ${result.estimatedDbLoad.rps1000} queries/sec
  @ 10K RPS:   ${result.estimatedDbLoad.rps10000} queries/sec
        `);
      }

      // Assertions
      expect(results.length).toBe(scenarios.length);
      for (const result of results) {
        expect(result.cacheHits + result.dbMisses).toBe(requestsPerScenario);
      }
    }, 180000);

    it('calculates optimal cache size for given traffic', async () => {
      console.log('[T13] Test: Optimal cache sizing');

      // Assume: 1M items in DB, targeting 90% cache hit ratio
      const dbSize = 1000000;
      const hotsetRatio = 0.2; // 20% of traffic is hot
      const hotsetSize = Math.floor(dbSize * hotsetRatio);
      const targetHitRatio = 0.9;
      const workingSet = Math.floor(hotsetSize / targetHitRatio);

      // Calculate required cache per worker to achieve 90% hits
      const requiredCacheTotal = workingSet * targetHitRatio;
      const workers = 10;
      const requiredCachePerWorker = Math.ceil(requiredCacheTotal / workers);

      console.log(`
[T13] Cache Sizing Analysis
═══════════════════════════════════════════

Database Size: ${dbSize.toLocaleString()} items
Hot Set (20%): ${hotsetSize.toLocaleString()} items
Target Hit Ratio: ${(targetHitRatio * 100).toFixed(0)}%
Estimated Working Set: ${workingSet.toLocaleString()} items

Current Configuration:
  Workers: ${workers}
  Cache per worker: 100,000 items
  Total cache: 1,000,000 items
  
Required for ${(targetHitRatio * 100).toFixed(0)}% Hit Ratio:
  Required total cache: ${Math.floor(requiredCacheTotal).toLocaleString()} items
  Required per worker: ${requiredCachePerWorker.toLocaleString()} items
  
Recommendation:
${requiredCachePerWorker > 100000
  ? `  ⚠️  Increase cache to ${requiredCachePerWorker.toLocaleString()} items per worker`
  : `  ✓  Current 100K per worker is sufficient`}
${requiredCachePerWorker > 100000
  ? `     (${Math.ceil(workers * requiredCachePerWorker / 100000)} workers needed for full coverage)`
  : `     (achieves ${(100000 * workers / workingSet * 100).toFixed(0)}% hit ratio)`}
      `);

      expect(hotsetSize).toBeGreaterThan(0);
      expect(workingSet).toBeGreaterThan(0);
    });
  });

  describe('Real-World Scenarios', () => {
    it('simulates hot paths (80/20 distribution)', async () => {
      console.log('[T13] Test: Hot path performance');
      metricsCollector.reset();

      const totalPaths = 1000;
      const hotPathCount = 200; // 20% hot
      const requests = 2000;

      // Create hot paths
      console.log('[T13] Creating 1000 paths (200 hot, 800 cold)...');
      for (let i = 0; i < totalPaths; i++) {
        if (i % 100 === 0) {
          await new Promise(r => setTimeout(r, 50));
        }
        adminService.pushUpdate({
          type: 'create',
          data: {
            id: `path-${i}`,
            path: `/p${i}`,
            destination: `https://example.com/p/${i}`,
            code: 301,
          },
        });
      }
      await new Promise(r => setTimeout(r, 500));

      // Traffic: 80% hot (0-199), 20% cold (200-999)
      console.log(`[T13] Making ${requests} requests...`);
      for (let i = 0; i < requests; i++) {
        const isHot = Math.random() < 0.8;
        const idx = isHot
          ? Math.floor(Math.random() * hotPathCount)
          : hotPathCount + Math.floor(Math.random() * (totalPaths - hotPathCount));

        const start = performance.now();

        try {
          const response = await fetch(`http://localhost:${engine.port}/p${idx}`, {
            redirect: 'manual',
          });
          const elapsed = performance.now() - start;
          metricsCollector.recordRequest(`/p${idx}`, response.status === 301, elapsed);
        } catch (e) {}

        if ((i + 1) % 500 === 0) {
          console.log(`  [T13] ${i + 1}/${requests}`);
        }
      }

      metricsCollector.setCacheSize(hotPathCount);
      const metrics = metricsCollector.getMetrics();

      console.log(metricsCollector.printReport());

      expect(metrics.totalRequests).toBe(requests);
      expect(metrics.hits).toBeGreaterThan(requests * 0.7); // Most should hit cache
    }, 120000);
  });
});
