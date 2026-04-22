# Architectural Analysis: Universal Redirector System

## System Overview

A distributed URL redirection platform with two main components:

- **Admin Service**: Nuxt 4 + Vue 3 + Supabase control plane for link management, analytics, and configuration
- **Redir Engine**: Hono + TypeScript edge-optimized redirect engine with multi-runtime support (Node.js, Cloudflare Workers)
- **Sync Protocol**: Real-time SSE state synchronization from Admin → Engine with `transformer.ts` handling snake_case DB → camelCase Engine conversion

## Architecture

### Redir Engine (Clean Architecture)

```
redir-engine/
├── src/
│   ├── core/                          # Domain layer (pure, no dependencies)
│   │   ├── config/types.ts            # RedirectRule, RedirectRuleUpdate
│   │   ├── config/index.ts            # Config loading
│   │   ├── routing/radix-tree.ts      # Radix tree for path routing
│   │   ├── filtering/cuckoo-filter.ts # Cuckoo filter for fast 404 rejection
│   │   ├── analytics/collector.ts     # Analytics collector interface
│   │   ├── analytics/payload-builder.ts
│   │   ├── context/lazy-device-context.ts
│   │   ├── context/lazy-language-context.ts
│   │   └── utils/lru-cache.ts
│   ├── use-cases/
│   │   ├── handle-request.ts          # Request handling + targeting/A-B/password
│   │   └── sync-state.ts             # SSE sync + eviction integration
│   └── adapters/
│       ├── http/server.ts             # Hono HTTP adapter
│       ├── sse/sse-client.ts          # SSE client with exponential backoff
│       ├── cache/cache-eviction.ts    # LRU eviction with memory monitoring
│       ├── cache/cache-metrics.ts     # Hit ratio, latency, percentile tracking
│       ├── cache/doubly-linked-list.ts # O(1) LRU data structure
│       └── analytics/fire-and-forget.ts
├── runtimes/
│   ├── node/                          # Node.js runtime entry
│   └── cf-worker/                     # Cloudflare Workers runtime entry
├── tests/
│   ├── core/                          # Unit tests (cuckoo-filter, radix-tree, property tests)
│   ├── use-cases/                     # handle-request tests, caching tests
│   ├── adapters/                      # doubly-linked-list tests
│   └── perf/                          # 8 benchmark suites (cuckoo, radix, ua-parsing, etc.)
└── e2e-suite/specs/                   # 14 E2E test suites (T01–T13)
```

### Admin Service

```
admin-service/supabase/
├── app/pages/                         # Vue 3 pages
│   ├── index.vue                      # Link management dashboard
│   ├── analytics.vue                  # Analytics visualization (vue-chartjs)
│   ├── login.vue                      # Authentication
│   └── status.vue                     # System status
├── server/
│   ├── api/
│   │   ├── links/                     # CRUD: create.post, [id].patch, [id].delete
│   │   ├── analytics/                 # v1/collect.post, dashboard.get, stats.get,
│   │   │                              # links/[linkId]/detailed.get, links/overview.get,
│   │   │                              # export/[format].get
│   │   ├── sync/stream.get.ts         # SSE stream endpoint for engine sync
│   │   ├── bulk.post.ts               # Bulk operations
│   │   ├── health.get.ts              # Health check
│   │   ├── metrics.get.ts             # System metrics
│   │   └── qr.get.ts                  # QR code generation
│   ├── plugins/realtime.ts            # Supabase realtime subscription
│   └── utils/                         # 13 utility modules
│       ├── transformer.ts             # snake_case ↔ camelCase
│       ├── broadcaster.ts             # SSE broadcast to engines
│       ├── error-handler.ts           # Centralized error handling
│       ├── logger.ts                  # Structured logging
│       ├── rate-limit.ts              # In-memory rate limiting
│       ├── sanitizer.ts               # Input sanitization
│       ├── hash.ts                    # IP anonymization (SHA-256)
│       ├── audit.ts                   # Audit logging
│       ├── bulk.ts                    # Bulk import logic
│       ├── config.ts                  # Configuration
│       ├── monitoring.ts              # Monitoring utilities
│       ├── qr.ts                      # QR generation
│       └── storage.ts                 # Storage utilities
└── tests/                             # 14 test files (unit, integration, component, perf)
```

## Implemented Features

### Core Redirect Engine
- **Cuckoo Filter**: O(1) existence check for fast 404 rejection
- **Radix Tree**: Efficient path routing with prefix matching
- **LRU Cache Eviction**: Memory-pressure-based eviction with doubly-linked-list (O(1) operations), configurable via `CACHE_MAX_HEAP_MB`, `CACHE_EVICTION_BATCH`, `CACHE_CHECK_INTERVAL_MS`
- **Cache Metrics**: Hit ratio, latency percentiles (P95/P99), memory tracking

### Traffic Routing
- **Targeting**: Language, device, and geo-based routing (via `cf-ipcountry` header)
- **A/B Testing**: Probabilistic split testing with weight distribution
- **Expiration**: Time-based (`expiresAt`) and click-based (`maxClicks`) expiration

### Security
- **Password Protection**: Per-link password with form flow
- **HSTS**: Per-link HSTS enforcement
- **Rate Limiting**: In-memory rate limiting on analytics ingestion
- **IP Anonymization**: SHA-256 hashing for privacy
- **Input Sanitization**: Zod-validated inputs
- **Supabase RLS**: Row-level security on database tables

### Analytics
- **Ingestion**: `collect.post.ts` endpoint with validation and IP hashing
- **Aggregation**: Database RPCs for low-latency statistics
- **Visualization**: `analytics.vue` dashboard with vue-chartjs (trends, geo, device, browser)
- **Export**: CSV/JSON export via `/api/analytics/export/[format]`

### Resilience
- **SSE Client**: Exponential backoff and reconnection logic
- **Fire-and-forget Analytics**: Non-blocking analytics collection
- **Health Checks**: `/api/health` endpoint

### Admin Operations
- **Bulk Import**: CSV bulk link creation via `/api/bulk`
- **QR Code Generation**: `/api/qr` endpoint
- **Audit Logging**: Admin action tracking

## Test Coverage

| Layer | Files | Scope |
|-------|-------|-------|
| **Unit Tests** | `tests/core/` (4 files) | Cuckoo filter, radix tree, property-based tests |
| **Use Case Tests** | `tests/use-cases/` (2 files) | handle-request, caching behavior |
| **Adapter Tests** | `tests/adapters/` (1 file) | Doubly-linked list |
| **Performance Benchmarks** | `tests/perf/` (8 files) | Cuckoo, radix, UA parsing, language parsing, handle-request, cache eviction, payload builder, server body parsing |
| **E2E Tests** | `e2e-suite/specs/` (14 files) | T01 boot/sync through T13 cache performance |
| **Admin Unit Tests** | `tests/` (14 files) | Transformer, sanitizer, rate-limit, hash, QR, bulk, broadcaster, targeting, components, integration |

## Specification-Driven Development

Active OpenSpec workflow in `openspec/`:
- **Constitution**: `openspec/specs/constitution.md` — project guardrails
- **Domain Specs**: 6 specification files (`01-core-architecture` through `06-nonfunctional-requirements`)
- **Active Changes**: CHANGE-001 through CHANGE-005 (csv-bulk-import, auto-alias-generation, advanced-qr-branding, utm-management-ui, history-audit-log-ui)

## Quality Metrics

| Aspect | Score (1-10) | Justification |
|--------|-------------|---------------|
| **Scalability** | 9 | Distributed architecture, edge optimization, multi-runtime |
| **Performance** | 9 | Cuckoo filter + radix tree + LRU eviction + O(1) cache ops |
| **Reliability** | 8 | SSE backoff, fire-and-forget analytics, health checks |
| **Security** | 7 | RLS, hashing, rate limiting, sanitization; needs distributed rate limiting |
| **Maintainability** | 9 | Clean architecture, pure functions, SOLID, OpenSpec workflow |
| **Testability** | 9 | Comprehensive unit/E2E/perf/property tests across both services |

## Areas for Improvement

### Medium Priority
- **Distributed Rate Limiting**: Move from in-memory to Redis/KV-backed rate limiting
- **Centralized Observability**: Structured log aggregation, Prometheus/Grafana metrics
- **Admin Audit Completeness**: Full audit trail for all mutations

### Low Priority
- **Shared Types Package**: Extract shared types between Engine and Admin into a common package
- **SSO/RBAC**: Enterprise authentication and role-based access control
- **Advanced QR Branding**: Logo embedding in QR codes (planned in CHANGE-003)
