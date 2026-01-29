import { Buffer } from 'node:buffer';
globalThis.Buffer = Buffer;

// Cloudflare Workers - Env Interface
interface Env {
  ADMIN_SERVICE_URL: string;
  ANALYTICS_SERVICE_URL: string;
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

        CuckooFilterClass = cuckooModule.CuckooFilter;
        RadixTreeClass = radixModule.RadixTree;
        SSEClientClass = sseModule.SSEClient;
        createAppFunction = httpModule.createApp;
        SyncStateUseCaseClass = syncModule.SyncStateUseCase;
        HandleRequestUseCaseClass = handleModule.HandleRequestUseCase;
        FireAndForgetCollectorClass = analyticsModule.FireAndForgetCollector;
        const FetchEventSourceClass = fetchEventSourceModule.FetchEventSource;

      radixTree = new RadixTreeClass();
      cuckooFilter = new CuckooFilterClass();

      // 1. Initialize Analytics
      const analyticsCollector = new FireAndForgetCollectorClass(ANALYTICS_SERVICE_URL);

      // 2. Initialize Use Cases
      const syncState = new SyncStateUseCaseClass(radixTree, cuckooFilter);
      const handleRequest = new HandleRequestUseCaseClass(radixTree, cuckooFilter, analyticsCollector);

      // 3. Initialize SSE Client and connect
      // Use FetchEventSource instead of global EventSource
      sseClient = new SSEClientClass(ADMIN_SERVICE_URL, FetchEventSourceClass);
      sseClient.connect(
        (data: any) => syncState.handleCreate(data),
        (data: any) => syncState.handleUpdate(data),
        (data: any) => syncState.handleDelete(data)
      );

      initialized = true;
    }

    // Re-create use cases to ensure env vars are fresh if needed
    const analyticsCollector = new FireAndForgetCollectorClass(ANALYTICS_SERVICE_URL);
    const handleRequest = new HandleRequestUseCaseClass(radixTree, cuckooFilter, analyticsCollector);
    const app = createAppFunction(handleRequest);

    return app.fetch(request, env, ctx);
  }
};
