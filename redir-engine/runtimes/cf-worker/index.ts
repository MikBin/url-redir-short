import { Buffer } from 'node:buffer';
globalThis.Buffer = Buffer;

// Cloudflare Workers - Env Interface
interface Env {
  ADMIN_SERVICE_URL: string;
  ANALYTICS_SERVICE_URL: string;
  E2E_TEST_MODE?: string;
}

// Global State
let radixTree: any;
let cuckooFilter: any;
let sseClient: any;
let initialized = false;

// Dynamic imports to ensure Buffer is polyfilled before modules load
let CuckooFilterClass: any;
let RadixTreeClass: any;
let SSEClientClass: any;
let createAppFunction: any;
let SyncStateUseCaseClass: any;
let HandleRequestUseCaseClass: any;
let FireAndForgetCollectorClass: any;
let InMemoryStoreClass: any;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const ADMIN_SERVICE_URL = env.ADMIN_SERVICE_URL || 'http://localhost:3001/sync/stream';
    const ANALYTICS_SERVICE_URL = env.ANALYTICS_SERVICE_URL || 'http://localhost:3002';

    if (!initialized) {
        // Dynamic imports
        const cuckooModule = await import('../../src/core/filtering/cuckoo-filter');
        const radixModule = await import('../../src/core/routing/radix-tree');
        const sseModule = await import('../../src/adapters/sse/sse-client');
        const httpModule = await import('../../src/adapters/http/server');
        const syncModule = await import('../../src/use-cases/sync-state');
        const handleModule = await import('../../src/use-cases/handle-request');
        const analyticsModule = await import('../../src/adapters/analytics/fire-and-forget');
        const fetchEventSourceModule = await import('./fetch-event-source');
        const inMemoryStoreModule = await import('../../src/adapters/store/in-memory-store');

        CuckooFilterClass = cuckooModule.CuckooFilter;
        RadixTreeClass = radixModule.RadixTree;
        SSEClientClass = sseModule.SSEClient;
        createAppFunction = httpModule.createApp;
        SyncStateUseCaseClass = syncModule.SyncStateUseCase;
        HandleRequestUseCaseClass = handleModule.HandleRequestUseCase;
        FireAndForgetCollectorClass = analyticsModule.FireAndForgetCollector;
        const FetchEventSourceClass = fetchEventSourceModule.FetchEventSource;
        InMemoryStoreClass = inMemoryStoreModule.InMemoryStore;

      radixTree = new RadixTreeClass();
      cuckooFilter = new CuckooFilterClass();

      // 1. Initialize Analytics
      const analyticsCollector = new FireAndForgetCollectorClass(ANALYTICS_SERVICE_URL);

      // 2. Initialize Use Cases
      const syncState = new SyncStateUseCaseClass(radixTree, cuckooFilter);
      const store = new InMemoryStoreClass(radixTree, cuckooFilter);
      const handleRequest = new HandleRequestUseCaseClass(store, analyticsCollector);

      // 3. Initialize SSE Client and connect
      // Use FetchEventSource instead of global EventSource
      sseClient = new SSEClientClass(ADMIN_SERVICE_URL, FetchEventSourceClass);
      sseClient.connect(
        (data: any) => syncState.handleCreate(data),
        (data: any) => syncState.handleUpdate(data),
        (data: any) => syncState.handleDelete(data)
      );

      // Hack to keep Miniflare alive for the SSE stream to process background events in E2E tests
      // By attaching the SSE stream's underlying Promise to waitUntil ONLY during initialization, we avoid
      // exhausting Miniflare's resources with unresolving dummy promises or orphaned background tasks.
      if (env.E2E_TEST_MODE === 'true' && sseClient.eventSource?.promise) {
        ctx.waitUntil(sseClient.eventSource.promise);
      }

      initialized = true;
    }

    // Re-create use cases to ensure env vars are fresh if needed
    const analyticsCollector = new FireAndForgetCollectorClass(ANALYTICS_SERVICE_URL);
    const store = new InMemoryStoreClass(radixTree, cuckooFilter);
    const handleRequest = new HandleRequestUseCaseClass(store, analyticsCollector);
    const app = createAppFunction(handleRequest);

    return app.fetch(request, env, ctx);
  }
};
