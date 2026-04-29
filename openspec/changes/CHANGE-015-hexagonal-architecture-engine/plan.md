# Implementation Plan: Hexagonal Architecture for Engine

## Phase 1: Define Ports and Update Core (Day 1)
- [ ] Create `redir-engine/src/ports/` directory.
- [ ] Define `IRedirectStore.ts` and `ISyncManager.ts`.
- [ ] Refactor `core/engine.ts` (or equivalent core router) to accept these interfaces via dependency injection rather than tightly coupling to `RadixTree`.

## Phase 2: Implement Storage Adapters (Day 2)
- [ ] Create `redir-engine/src/adapters/storage/`.
- [ ] Extract existing RadixTree/CuckooFilter logic into `InMemoryStore.ts`.
- [ ] Create `CloudflareKVStore.ts` that interacts with CF KV bindings.
- [ ] Write unit tests for both storage adapters.

## Phase 3: Implement Sync Adapters (Day 3)
- [ ] Create `redir-engine/src/adapters/sync/`.
- [ ] Move existing SSE client logic into `SSESyncAdapter.ts`.
- [ ] Create `NoOpSyncAdapter.ts` for environments where state is managed externally.

## Phase 4: Refactor Runtimes (Day 4)
- [ ] Update `redir-engine/runtimes/node/index.ts` to instantiate and inject the Node adapters.
- [ ] Update `redir-engine/runtimes/cf-worker/index.ts` to instantiate and inject the CF Worker adapters.

## Phase 5: Admin Service KV Orchestration (Day 5)
- [ ] Update Admin Service domain models to track deployment type (VPS vs Edge).
- [ ] Implement Cloudflare KV API client in the Admin Service.
- [ ] Hook into the redirect creation/update/deletion lifecycle to push to KV for edge domains.
