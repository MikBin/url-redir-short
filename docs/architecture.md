# System Architecture

This document describes the high-level architecture of the Universal Redirector System.

## System Overview

The platform is a distributed URL redirection system composed of two main operational units:
- **Admin Service**: A control plane built with Nuxt 4, Vue 3, and Supabase for link management, analytics, and configuration.
- **Redir Engine**: A high-performance, edge-optimized redirect engine built with Hono and TypeScript that supports multiple runtimes (Node.js, Cloudflare Workers).

A **Sync Protocol** leverages Server-Sent Events (SSE) to push real-time state updates from the Admin Service to the Redirect Engine.

## Component Architecture

### 1. Admin Service

The Admin Service serves as the system of record and the user interface.

- **Frontend**: Vue 3 pages managed by Nuxt (`app/pages/`), providing dashboards for link management, analytics visualization (via `vue-chartjs`), and system status.
- **Backend API**: Nuxt server routes (`server/api/`) providing CRUD operations for links, analytics data aggregation (via DB RPCs), bulk imports, and QR code generation.
- **Realtime Sync**: Utilizes Supabase realtime subscriptions (`server/plugins/realtime.ts`) and a Broadcaster utility to push database changes down to the Engine instances.
- **Data Transformation**: A `transformer.ts` utility converts database snake_case conventions to the engine's expected camelCase format.

### 2. Redirect Engine

The Redirect Engine is built following Clean Architecture principles, ensuring that business logic is isolated from delivery mechanisms (HTTP/SSE) and infrastructure.

```text
redir-engine/
├── src/
│   ├── core/           # Domain layer (pure functions, no external deps)
│   │                   # - Cuckoo filter (fast 404 rejection)
│   │                   # - Radix tree (efficient routing)
│   ├── use-cases/      # Application logic (handle-request, sync-state)
│   └── adapters/       # I/O, Cache, SSE Client, HTTP Handlers
├── runtimes/           # Entry points for specific platforms (node, cf-worker)
```

**Key Features of the Engine:**
- **Routing**: Uses a Radix Tree for fast path matching.
- **Filtering**: Implements a Cuckoo Filter for O(1) existence checks, allowing instant 404 rejection for non-existent routes without querying the cache.
- **Caching**: Employs an LRU cache with a doubly-linked list for O(1) memory management and eviction based on configurable memory pressure.
- **Analytics**: Uses a fire-and-forget mechanism to ship analytics payloads back to the Admin Service asynchronously, preventing logging from blocking redirect latency.

## Sync Protocol & Data Flow

The architecture relies on a unidirectional data flow for state synchronization to keep the Redirect Engine fast and decentralized.

1. **Mutation**: A user creates or updates a link via the Admin Service UI.
2. **Persistence**: The Admin Service saves the record in Supabase.
3. **Event Generation**: Supabase realtime webhooks or internal event emitters capture the mutation.
4. **Broadcast**: The Admin Service broadcasts the updated `RedirectRule` over an SSE stream (`/api/sync/stream`).
5. **Consumption**: The Redirect Engine maintains a persistent SSE connection with exponential backoff (`adapters/sse/sse-client.ts`). It receives the event and updates its in-memory radix tree and cuckoo filter immediately.

### Data Flow Diagram (Conceptual)

```text
[ Admin UI ] ---> [ Admin API (Nuxt) ] ---> [ Supabase DB ]
                        |                          |
                        v                          v
                [ Broadcaster ] <------- [ Realtime Events ]
                        |
                        | (SSE Stream)
                        v
[ Redirect Engine ] <---+
  - Radix Tree
  - Cuckoo Filter
  - LRU Cache
                        | (Fire-and-forget Analytics)
                        v
                [ Admin API /collect ] ---> [ Supabase DB ]
```

## Technology Stack Decisions

- **TypeScript Strict Mode**: Enforced across both services for end-to-end type safety.
- **Hono**: Chosen for the Redirect Engine due to its ultra-fast routing and cross-platform compatibility (Node, Cloudflare Workers, Bun).
- **Nuxt + Vue 3**: Selected for the Admin Service to provide a robust, modern SSR framework capable of building both a reactive dashboard and a solid API layer.
- **Supabase (PostgreSQL)**: Provides a scalable relational database with built-in Row-Level Security (RLS) and real-time event streaming capabilities.
- **Cuckoo Filter over Bloom Filter**: Used in the engine for fast 404s because Cuckoo Filters allow for item deletion (necessary when an admin deletes a link), whereas standard Bloom Filters do not.
- **In-Memory Caching**: Over relying solely on external Redis, to ensure microsecond latency for hot paths.
