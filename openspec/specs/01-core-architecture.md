# Spec: Core Architecture & Distributed System

## Overview
The Universal Redirector System uses a distributed architecture with a centralized Admin Service (Source of Truth) and multiple distributed Redirector Engines (Edge Nodes). State synchronization occurs via Server-Sent Events (SSE). Engines use a Cuckoo Filter + Radix Tree pipeline for ultra-fast request processing.

## Requirements

### FR-01: Distributed Architecture
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** The system MUST consist of a centralized Admin Service (Source of Truth) and multiple distributed Redirector Engines (Edge Nodes).
- **Implementation:**
  - Admin Service: `admin-service/supabase/` (Nuxt 4 + Supabase)
  - Redirector Engine: `redir-engine/src/` (Hono + TypeScript)
  - Multi-runtime: `redir-engine/runtimes/node/`, `redir-engine/runtimes/cf-worker/`

### FR-02: Database-Agnostic Admin
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** The Admin Service MUST be database-agnostic, supporting adapters for PostgreSQL and PocketBase.
- **Implementation:**
  - Supabase adapter: `admin-service/supabase/`
  - PocketBase adapter: `admin-service/pocketbase/` (scaffolded)

### FR-03: In-Memory Edge State
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** Redirector Engines MUST maintain a local, in-memory state of active rules to minimize latency.
- **Implementation:**
  - Radix Tree: `redir-engine/src/core/routing/radix-tree.ts`
  - Cuckoo Filter: `redir-engine/src/core/filtering/cuckoo-filter.ts`
  - State sync: `redir-engine/src/use-cases/sync-state.ts`

### FR-04: SSE State Synchronization
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** State changes (Create, Update, Delete) MUST be broadcast from the Admin Service to Redirector Engines via Server-Sent Events (SSE).
- **Implementation:**
  - SSE stream endpoint: `admin-service/supabase/server/api/sync/stream.get.ts`
  - SSE client with backoff: `redir-engine/src/adapters/sse/sse-client.ts`
  - Realtime plugin: `admin-service/supabase/server/plugins/realtime.ts`
  - Data transformer: `admin-service/supabase/server/utils/transformer.ts`

### FR-05: Low-Latency Edge Processing
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** Redirector Engines MUST prioritize low latency and high throughput.
- **Implementation:** Cuckoo Filter → Radix Tree pipeline in `redir-engine/src/use-cases/handle-request.ts`

### FR-06: Cuckoo Filter for 404 Rejection
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** Redirector Engines MUST use a Cuckoo Filter as a mutable "Allow List" to instantly reject 404 traffic without database or router lookups.
- **Implementation:** `redir-engine/src/core/filtering/cuckoo-filter.ts`
- **Tests:** `redir-engine/tests/core/filtering/`, `redir-engine/e2e-suite/specs/T03-fast-404.test.ts`

### FR-07: Radix Tree Route Lookup
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** Redirector Engines MUST use a Radix Tree for efficient route lookup.
- **Implementation:** `redir-engine/src/core/routing/radix-tree.ts`
- **Tests:** `redir-engine/tests/core/routing/`

### FR-08: Dynamic Cuckoo Filter Updates
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** The Cuckoo Filter MUST support dynamic insertions and deletions to reflect state changes without requiring a full reload.
- **Implementation:** Insert/delete methods on `cuckoo-filter.ts`

### FR-12: Async Analytics Logging
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** Analytics data (Source, User-Agent, Path, Timestamp) MUST be logged asynchronously to prevent blocking the redirect response.
- **Implementation:** `redir-engine/src/adapters/analytics/fire-and-forget.ts`
- **Tests:** `redir-engine/e2e-suite/specs/T04-analytics-emission.test.ts`

## Implementation Status Summary

| Requirement | Status | Notes |
|---|---|---|
| FR-01 | ✅ | Admin + distributed engines |
| FR-02 | ✅ | Supabase primary, PocketBase scaffolded |
| FR-03 | ✅ | In-memory Radix Tree + Cuckoo Filter |
| FR-04 | ✅ | SSE with exponential backoff |
| FR-05 | ✅ | Sub-50ms processing pipeline |
| FR-06 | ✅ | Cuckoo Filter for fast 404 |
| FR-07 | ✅ | Radix Tree routing |
| FR-08 | ✅ | Dynamic insert/delete supported |
| FR-12 | ✅ | Fire-and-forget analytics adapter |

## E2E Test Coverage
- `T01-boot-and-sync.test.ts` — SSE connection and state sync
- `T02-basic-redirect.test.ts` — Basic redirect flow
- `T03-fast-404.test.ts` — Cuckoo Filter 404 rejection
- `T12-performance.test.ts` — Performance benchmarks
- `T13-cache-performance.test.ts` — Cache performance

## Production Gaps
- No deployment/infrastructure-as-code manifests (Kubernetes, Terraform, etc.) for production environments (→ CHANGE-010)
- No reverse proxy/TLS configuration for HTTPS termination at the edge (→ CHANGE-006)