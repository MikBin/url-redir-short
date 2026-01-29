import { describe, it, beforeEach, vi } from 'vitest';
import { createApp } from '../../src/adapters/http/server';
import { HandleRequestUseCase } from '../../src/use-cases/handle-request';
import { RadixTree } from '../../src/core/routing/radix-tree';
import { CuckooFilter } from '../../src/core/filtering/cuckoo-filter';
import { RedirectRule } from '../../src/core/config/types';

// Mock everything else to isolate server handling
vi.mock('../../src/core/analytics/collector', () => ({
    AnalyticsCollector: class {
        collect() { return Promise.resolve(); }
    }
}));
vi.mock('../../src/core/analytics/payload-builder', () => ({
    buildAnalyticsPayload: async () => ({}),
    resolveReferrer: async () => ({}),
    anonymizeIp: async () => '127.0.0.1',
}));

describe('Server Body Parsing Performance', () => {
  let app: any;
  let useCase: HandleRequestUseCase;

  beforeEach(() => {
    const radixTree = new RadixTree();
    const cuckooFilter = new CuckooFilter();

    // Rule without password
    const noPassRule: RedirectRule = {
      id: 'no-pass',
      path: '/nopass',
      destination: 'https://example.com',
      code: 301
    };
    radixTree.insert('/nopass', noPassRule);
    cuckooFilter.add('/nopass');

    // Rule with password
    const passRule: RedirectRule = {
      id: 'pass',
      path: '/pass',
      destination: 'https://example.com/secret',
      code: 301,
      password_protection: {
        enabled: true,
        password: 'secret'
      }
    };
    radixTree.insert('/pass', passRule);
    cuckooFilter.add('/pass');

    useCase = new HandleRequestUseCase(radixTree, cuckooFilter);
    app = createApp(useCase);
  });

  const createLargeBody = (sizeBytes: number) => {
    // Approx size
    const chunk = 'x'.repeat(1024);
    const count = Math.ceil(sizeBytes / 1024);
    const params = new URLSearchParams();
    for (let i = 0; i < count; i++) {
        params.append(`k${i}`, chunk);
    }
    return params.toString();
  };

  it('POST to non-password route with large body (Should Skip Parse)', async () => {
    const bodyStr = createLargeBody(1024 * 1024); // 1MB
    console.log(`Payload size: ${(bodyStr.length / 1024 / 1024).toFixed(2)} MB`);

    const start = performance.now();
    const iterations = 50;
    for(let i=0; i<iterations; i++) {
        const res = await app.request('http://localhost/nopass', {
            method: 'POST',
            body: bodyStr,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'x-forwarded-for': '127.0.0.1'
            }
        });
        if (res.status !== 301) throw new Error(`Failed: ${res.status}`);
    }
    const end = performance.now();
    const total = end - start;
    console.log(`[Optimized] No-Pass Route Duration: ${total.toFixed(2)}ms (Avg: ${(total/iterations).toFixed(2)}ms)`);
  });

  it('POST to password route with large body (Must Parse)', async () => {
    const params = new URLSearchParams();
    // Add password early to verify it finds it? No order doesn't matter for URLSearchParams parsing usually
    params.append('password', 'secret');
    params.append('junk', 'x'.repeat(1024 * 1024));
    const bodyStr = params.toString();

    const start = performance.now();
    const iterations = 50;
    for(let i=0; i<iterations; i++) {
        const res = await app.request('http://localhost/pass', {
            method: 'POST',
            body: bodyStr,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'x-forwarded-for': '127.0.0.1'
            }
        });
        if (res.status !== 301) throw new Error(`Failed: ${res.status}`);
    }
    const end = performance.now();
    const total = end - start;
    console.log(`[Reference] Password Route Duration: ${total.toFixed(2)}ms (Avg: ${(total/iterations).toFixed(2)}ms)`);
  });

});
