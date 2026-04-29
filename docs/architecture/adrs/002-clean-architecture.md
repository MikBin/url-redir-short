# ADR-002: Clean Architecture for Multi-Runtime Support

## Status
Accepted

## Context
The Redirect Engine needs to run in diverse environments:
- **Node.js**: Long-running VPS/Docker environments.
- **Cloudflare Workers**: Ephemeral edge runtimes.
- **Local Dev**: Native TypeScript execution.

The core logic (routing, filtering) must remain identical across these platforms, while delivery (Hono, HTTP) and infrastructure (Cache, SSE client) might vary.

## Decision
We adopted **Clean Architecture** (Hexagonal Architecture) for the `redir-engine`.

The structure is:
1. **Core**: Pure domain logic (RadixTree, CuckooFilter). Zero dependencies.
2. **Use Cases**: Application logic orchestrating the core and interfaces (HandleRequest, SyncState).
3. **Adapters**: Implementation details for specific runtimes or services (SSEClient, HonoHandler, LocalCache).
4. **Runtimes**: Entry points for specific platforms (Node, CF Worker) that inject the necessary adapters.

## Consequences
- **Pros**:
    - High testability (core logic can be unit tested without I/O).
    - Ease of porting to new runtimes (e.g., Bun, Deno) by only swapping adapters.
    - Strict separation of concerns.
- **Cons**:
    - Slight increase in boilerplate code due to interfaces and dependency injection.
    - Requires developers to understand the layering.
