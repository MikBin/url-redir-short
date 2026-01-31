import { serve } from '@hono/node-server';
import { RadixTree } from '../../src/core/routing/radix-tree';
import { CuckooFilter } from '../../src/core/filtering/cuckoo-filter';
import { SSEClient } from '../../src/adapters/sse/sse-client';
import { createApp } from '../../src/adapters/http/server';
import { SyncStateUseCase } from '../../src/use-cases/sync-state';
import { HandleRequestUseCase } from '../../src/use-cases/handle-request';
import { FireAndForgetCollector } from '../../src/adapters/analytics/fire-and-forget';
import { EventSource } from 'eventsource';
import { loadConfig } from '../../src/core/config';

// Configuration
const config = loadConfig(process.env);

// 1. Initialize Core Data Structures
const radixTree = new RadixTree();
const cuckooFilter = new CuckooFilter();

// 2. Initialize Analytics
const analyticsCollector = new FireAndForgetCollector(config.analyticsServiceUrl);

// 3. Initialize Use Cases with Cache Eviction
// Configure eviction based on environment variables
const evictionConfig = {
  maxHeapMB: parseInt(process.env.CACHE_MAX_HEAP_MB || '500'),
  evictionBatchSize: parseInt(process.env.CACHE_EVICTION_BATCH || '1000'),
  checkIntervalMs: parseInt(process.env.CACHE_CHECK_INTERVAL_MS || '10000'),
  enableMetrics: process.env.CACHE_METRICS !== 'false',
};
const syncState = new SyncStateUseCase(radixTree, cuckooFilter, evictionConfig);
const handleRequest = new HandleRequestUseCase(radixTree, cuckooFilter, analyticsCollector);

// 4. Initialize SSE Client and connect
// @ts-ignore - mismatch between eventsource types and our interface
const sseClient = new SSEClient(config.adminServiceUrl, EventSource);
sseClient.connect(
  (data) => syncState.handleCreate(data),
  (data) => syncState.handleUpdate(data),
  (data) => syncState.handleDelete(data)
);

// 5. Initialize HTTP Server
const app = createApp(handleRequest);

console.log(`[Engine] Starting on port ${config.port}`);
serve({
  fetch: app.fetch,
  port: config.port
});
