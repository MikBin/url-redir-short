# Change Proposal: Hexagonal Architecture for Redirect Engine

## Problem
The `redir-engine` currently attempts to use the same Server-Sent Events (SSE) synchronization mechanism across all runtimes. However, Cloudflare Workers are ephemeral and cannot maintain a persistent SSE connection. Furthermore, Workers lose in-memory state on eviction, making the current `RadixTree` + `CuckooFilter` state management incompatible with the edge serverless execution model.

## Opportunity
By applying Hexagonal Architecture (Ports and Adapters), we can abstract the engine's Storage and Synchronization mechanisms. This allows us to share 90% of the core logic while injecting runtime-specific adapters (e.g., Cloudflare KV for Workers, and Memory+SSE for Node VPS) ensuring the engine scales correctly on both architectures without creating two disparate codebases.

## Success Metrics
- Cloudflare Worker runtime uses Cloudflare KV for state and no longer attempts SSE connections.
- Node.js runtime continues to use in-memory RadixTree and SSE for sync.
- Core engine logic (HTTP request handling, metrics, analytics) remains unified and shared.
- Admin Service is updated to push changes to Cloudflare KV when applicable.

## Scope
- Define `IRedirectStore` and `ISyncManager` port interfaces in `redir-engine`.
- Implement `InMemoryStore` and `CloudflareKVStore` storage adapters.
- Implement `SSESyncAdapter` and an empty/no-op sync adapter for CF workers.
- Update Admin Service to push updates directly to CF KV.
- Refactor `runtimes/node` and `runtimes/cf-worker` to wire up the appropriate adapters.
