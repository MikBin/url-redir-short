import { serve } from '@hono/node-server';
import { RadixTree } from '../../src/core/routing/radix-tree';
import { CuckooFilter } from '../../src/core/filtering/cuckoo-filter';
import { SSESyncAdapter } from '../../src/adapters/sync/SSESyncAdapter';
import { createApp } from '../../src/adapters/http/server';
import { SyncStateUseCase } from '../../src/use-cases/sync-state';
import { HandleRequestUseCase } from '../../src/use-cases/handle-request';
import { FireAndForgetCollector } from '../../src/adapters/analytics/fire-and-forget';
import { EventSource } from 'eventsource';
import { loadConfig } from '../../src/core/config';
import { InMemoryStore } from '../../src/adapters/store/in-memory-store';

// Configuration
const config = loadConfig(process.env);

// 1. Initialize Core Data Structures
const radixTree = new RadixTree();
const cuckooFilter = new CuckooFilter();
const store = new InMemoryStore(radixTree, cuckooFilter);

// 2. Initialize Analytics
const analyticsCollector = new FireAndForgetCollector(config.analyticsServiceUrl);

// 3. Initialize Use Cases with Cache Eviction
const evictionConfig = {
  maxHeapMB: parseInt(process.env.CACHE_MAX_HEAP_MB || '500'),
  evictionBatchSize: parseInt(process.env.CACHE_EVICTION_BATCH || '1000'),
  checkIntervalMs: parseInt(process.env.CACHE_CHECK_INTERVAL_MS || '10000'),
  enableMetrics: process.env.CACHE_METRICS !== 'false',
};
const syncState = new SyncStateUseCase(store, evictionConfig);
const handleRequest = new HandleRequestUseCase(store, analyticsCollector);

// 4. Initialize Sync Adapter and connect
const syncAdapter = new SSESyncAdapter(config.adminServiceUrl, EventSource, config.syncApiKey);
syncAdapter.onUpdate(async (update) => {
  if (update.type === 'create') await syncState.handleCreate(update.data);
  if (update.type === 'update') await syncState.handleUpdate(update.data);
  if (update.type === 'delete') await syncState.handleDelete(update.data);
});
syncAdapter.start();

// 5. Initialize HTTP Server
const app = createApp(handleRequest);

console.log(`[Engine] Starting on port ${config.port}`);
serve({
  fetch: app.fetch,
  port: config.port
});
