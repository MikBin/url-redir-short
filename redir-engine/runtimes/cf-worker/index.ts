import { Buffer } from 'node:buffer';
globalThis.Buffer = Buffer;

import type { createApp } from '../../src/adapters/http/server';
import type { HandleRequestUseCase } from '../../src/use-cases/handle-request';
import type { FireAndForgetCollector } from '../../src/adapters/analytics/fire-and-forget';
import type { CloudflareKVStore } from '../../src/adapters/storage/CloudflareKVStore';
import type { NoOpSyncAdapter } from '../../src/adapters/sync/NoOpSyncAdapter';

// Cloudflare Workers - Env Interface
interface Env {
  ADMIN_SERVICE_URL: string;
  ANALYTICS_SERVICE_URL: string;
  E2E_TEST_MODE?: string;
  REDIRECTS_KV: KVNamespace;
}

// Global State
let initialized = false;

// Dynamic imports to ensure Buffer is polyfilled before modules load
let createAppFunction: typeof createApp;
let HandleRequestUseCaseClass: typeof HandleRequestUseCase;
let FireAndForgetCollectorClass: typeof FireAndForgetCollector;
let CloudflareKVStoreClass: typeof CloudflareKVStore;
let NoOpSyncAdapterClass: typeof NoOpSyncAdapter;

let memStoreRef: unknown = null;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const ANALYTICS_SERVICE_URL = env.ANALYTICS_SERVICE_URL || 'http://localhost:3002';

    if (!initialized) {
        // Dynamic imports
        const httpModule = await import('../../src/adapters/http/server');
        const handleModule = await import('../../src/use-cases/handle-request');
        const analyticsModule = await import('../../src/adapters/analytics/fire-and-forget');
        const kvStoreModule = await import('../../src/adapters/storage/CloudflareKVStore');
        const syncAdapterModule = await import('../../src/adapters/sync/NoOpSyncAdapter');

        createAppFunction = httpModule.createApp;
        HandleRequestUseCaseClass = handleModule.HandleRequestUseCase;
        FireAndForgetCollectorClass = analyticsModule.FireAndForgetCollector;
        CloudflareKVStoreClass = kvStoreModule.CloudflareKVStore;
        NoOpSyncAdapterClass = syncAdapterModule.NoOpSyncAdapter;

      // In CF Workers, we normally use NoOpSyncAdapter.
      if (env.E2E_TEST_MODE === 'true') {
          // For E2E tests, CF worker needs an in-memory store so it works identically to Node
          // and responds to Admin mock's KV updates
          const inMemoryStoreModule = await import('../../src/adapters/store/in-memory-store');
          const radixTreeModule = await import('../../src/core/routing/radix-tree');
          const cuckooFilterModule = await import('../../src/core/filtering/cuckoo-filter');

          const radixTree = new radixTreeModule.RadixTree();
          const cuckooFilter = new cuckooFilterModule.CuckooFilter();
          const memStore = new inMemoryStoreModule.InMemoryStore(radixTree, cuckooFilter);
          memStoreRef = memStore;

      } else {
          // 1. Initialize Sync Adapter (No-op for Workers as state is in KV)
          const syncAdapter = new NoOpSyncAdapterClass();
          await syncAdapter.start();
      }

      initialized = true;
    }

    // E2E test hack for CF Worker:
    // Expose an endpoint to inject KV data for tests since Admin service mock doesn't write to CF's KV
    if (env.E2E_TEST_MODE === 'true' && request.method === 'POST') {
        const url = new URL(request.url);
        if (url.pathname === '/_test/inject') {
            const body = await request.json() as { type: string; data: { path: string; [key: string]: unknown } };
            if (body.type === 'create' || body.type === 'update') {
                await env.REDIRECTS_KV.put(body.data.path, JSON.stringify(body.data));
                if (memStoreRef) await (memStoreRef as { addRedirect: (d: unknown) => Promise<void> }).addRedirect(body.data);
            } else if (body.type === 'delete') {
                await env.REDIRECTS_KV.delete(body.data.path);
                if (memStoreRef) await (memStoreRef as { removeRedirect: (p: string) => Promise<void> }).removeRedirect(body.data.path);
            }
            return new Response('OK');
        } else if (url.pathname === '/_test/clear') {
            memStoreRef = null;
            if (globalThis.gc) {
               globalThis.gc();
            }
            return new Response('OK');
        }
    }

    // Initialize Analytics
    const analyticsCollector = new FireAndForgetCollectorClass(ANALYTICS_SERVICE_URL);

    // Initialize Storage with KV
    let store: import('../../src/ports/IRedirectStore').IRedirectStore = new CloudflareKVStoreClass(env);

    if (env.E2E_TEST_MODE === 'true' && memStoreRef) {
        // Use in-memory store instead of KV for tests to guarantee local cache behavior in tests like T13
        store = memStoreRef as import('../../src/ports/IRedirectStore').IRedirectStore;
    }

    // Initialize Use Case
    const handleRequest = new HandleRequestUseCaseClass(store, analyticsCollector);

    // Create Hono app
    const app = createAppFunction(handleRequest);

    return app.fetch(request, env, ctx);
  }
};
