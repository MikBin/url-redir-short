# Implementation Tasks: Hexagonal Architecture Engine

## Task 1: Engine Ports
**Files:** `redir-engine/src/ports/IRedirectStore.ts`, `ISyncManager.ts`
- [x] Create `IRedirectStore` interface with `getRedirect` and `mightExist` methods.
- [x] Create `ISyncManager` interface with `start`, `stop`, and `onUpdate` methods.

## Task 2: Core Refactor
**File:** `redir-engine/src/core/router.ts` (or equivalent)
- [x] Modify constructor/init to accept `IRedirectStore`.
- [x] Update request handling to `await store.getRedirect(...)` instead of directly accessing the RadixTree.

## Task 3: Storage Adapters
**Files:** `redir-engine/src/adapters/storage/InMemoryStore.ts`, `CloudflareKVStore.ts`
- [x] Implement `InMemoryStore` wrapping `RadixTree` and `CuckooFilter`. Add methods for the sync client to update it.
- [x] Implement `CloudflareKVStore` utilizing the CF KV API.

## Task 4: Sync Adapters
**Files:** `redir-engine/src/adapters/sync/SSESyncAdapter.ts`, `NoOpSyncAdapter.ts`
- [x] Extract `SSEClient` logic into `SSESyncAdapter` implementing `ISyncManager`.
- [x] Implement a dummy `NoOpSyncAdapter` that does nothing for CF workers.

## Task 5: Runtime Wiring
**Files:** `redir-engine/runtimes/node/index.ts`, `redir-engine/runtimes/cf-worker/index.ts`
- [ ] Node: Wire `InMemoryStore` + `SSESyncAdapter`. Bind sync updates to store updates.
- [ ] CF Worker: Wire `CloudflareKVStore` + `NoOpSyncAdapter`.

## Task 6: Admin Service KV Publisher
**Files:** `admin-service/supabase/server/utils/cloudflare-kv.ts`, event hooks
- [ ] Implement CF KV API client for Admin Service.
- [ ] Update link creation/mutation handlers to push to KV if the associated domain is configured for CF Workers.
