import { describe, it, vi } from 'vitest';
import { buildAnalyticsPayload } from '../../src/core/analytics/payload-builder';

// Mock expensive crypto operation
vi.mock('../../src/core/analytics/payload-builder', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    anonymizeIp: async () => 'mock-ip-hash',
  };
});

describe('Payload Builder Performance', () => {
  const path = '/test-path';
  const destination = 'https://example.com/dest';
  const ip = '127.0.0.1';
  const headers = new Headers({
    'user-agent': 'Mozilla/5.0',
    'referer': 'https://google.com'
  });
  const status = 301;
  const originalUrl = 'https://short.ly/test-path?utm_source=twitter&ref=123';
  const url = new URL(originalUrl);

  it('measures buildAnalyticsPayload performance', async () => {
    const start = performance.now();
    const iterations = 1000;
    for (let i = 0; i < iterations; i++) {
        await buildAnalyticsPayload(
            path,
            destination,
            ip,
            headers,
            status,
            url
        );
    }
    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / (elapsed / 1000)).toFixed(0);
    console.log(`  buildAnalyticsPayload: ${elapsed.toFixed(2)}ms (${opsPerSec} ops/sec)`);
  });
});
