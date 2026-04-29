import { Buffer } from 'node:buffer';
globalThis.Buffer = Buffer;

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
let createAppFunction: any;
let HandleRequestUseCaseClass: any;
let FireAndForgetCollectorClass: any;
let CloudflareKVStoreClass: any;
let NoOpSyncAdapterClass: any;

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

      // 1. Initialize Sync Adapter (No-op for Workers as state is in KV)
      const syncAdapter = new NoOpSyncAdapterClass();
      await syncAdapter.start();

      initialized = true;
    }

    // Initialize Analytics
    const analyticsCollector = new FireAndForgetCollectorClass(ANALYTICS_SERVICE_URL);
    
    // Initialize Storage with KV
    const store = new CloudflareKVStoreClass(env);
    
    // Initialize Use Case
    const handleRequest = new HandleRequestUseCaseClass(store, analyticsCollector);
    
    // Create Hono app
    const app = createAppFunction(handleRequest);

    return app.fetch(request, env, ctx);
  }
};
