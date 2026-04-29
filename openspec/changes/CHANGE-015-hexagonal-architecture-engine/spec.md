# Specification: Hexagonal Architecture Engine

## Ports (Interfaces)

### `IRedirectStore`
Defines how the engine reads redirect data.
```typescript
export interface IRedirectStore {
  getRedirect(slug: string, domainId?: string): Promise<RedirectRule | null>;
  // For the Cuckoo filter / 404 fast-path
  mightExist(slug: string, domainId?: string): Promise<boolean>; 
}
```

### `ISyncManager`
Defines how the engine receives updates from the Admin service.
```typescript
export interface ISyncManager {
  start(): Promise<void>;
  stop(): void;
  onUpdate(callback: (event: SyncEvent) => void): void;
}
```

## Adapters

### Storage Adapters
1. **`InMemoryStore`**: Uses `RadixTree` and `CuckooFilter`. Used by the Node.js runtime. Needs methods to populate/update state.
2. **`CloudflareKVStore`**: Uses Cloudflare Workers KV API (`env.REDIRECTS_KV`). Used by CF Worker runtime. `mightExist` always returns true, deferring to KV `get` for the exact match, or utilizes a cached filter if implemented.

### Sync Adapters
1. **`SSESyncAdapter`**: Connects to the Admin Service SSE endpoint (`/api/sync/stream`). Implements reconnection logic.
2. **`NoOpSyncAdapter`**: For Cloudflare Workers. Syncing is handled externally by the Admin pushing to KV, so the Worker itself doesn't actively sync.

## Admin Service Changes (Orchestrator)
The Admin Service must become aware of deployment types.
When a redirect rule is created/updated/deleted:
1. **VPS Domains**: Broadcast via existing SSE mechanism.
2. **CF Worker Domains**: Call Cloudflare API to update the KV store directly.

## Runtime Wiring

### `runtimes/node/index.ts`
Wires `InMemoryStore` and `SSESyncAdapter`. On an update from the sync adapter, updates the in-memory store.

### `runtimes/cf-worker/index.ts`
Wires `CloudflareKVStore` and `NoOpSyncAdapter`. State is inherently synced because KV is updated by the Admin Service.
