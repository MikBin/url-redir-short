import { serve } from '@hono/node-server';
import { RadixTree } from '../../src/core/routing/radix-tree';
import { CuckooFilter } from '../../src/core/filtering/cuckoo-filter';
import { SSEClient } from '../../src/adapters/sse/sse-client';
import { createApp } from '../../src/adapters/http/server';
import { SyncStateUseCase } from '../../src/use-cases/sync-state';
import { HandleRequestUseCase } from '../../src/use-cases/handle-request';
import { FireAndForgetCollector } from '../../src/adapters/analytics/fire-and-forget';

// Configuration
const PORT = parseInt(process.env.PORT || '3000', 10);
const ADMIN_SERVICE_URL = process.env.ADMIN_SERVICE_URL || 'http://localhost:3001/sync/stream';
const ANALYTICS_SERVICE_URL = process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3002';

// 1. Initialize Core Data Structures
const radixTree = new RadixTree();
const cuckooFilter = new CuckooFilter();

// 2. Initialize Analytics
const analyticsCollector = new FireAndForgetCollector(ANALYTICS_SERVICE_URL);

// 3. Initialize Use Cases
const syncState = new SyncStateUseCase(radixTree, cuckooFilter);
const handleRequest = new HandleRequestUseCase(radixTree, cuckooFilter, analyticsCollector);

// 4. Initialize SSE Client and connect
const sseClient = new SSEClient(ADMIN_SERVICE_URL);
sseClient.connect(
  (data) => syncState.handleCreate(data),
  (data) => syncState.handleUpdate(data),
  (data) => syncState.handleDelete(data)
);

// 5. Initialize HTTP Server
const app = createApp(handleRequest);

console.log(`[Engine] Starting on port ${PORT}`);
serve({
  fetch: app.fetch,
  port: PORT
});
