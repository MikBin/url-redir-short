# Spec: Non-Functional Requirements

## Overview
Non-functional requirements define the performance, scalability, and efficiency targets for the system.

## Requirements

### NFR-01: Processing Latency (<50ms)
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** The Redirector Engine MUST achieve a processing latency of under 50 milliseconds per request.
- **Implementation:** Cuckoo Filter (O(1) rejection) + Radix Tree (O(k) lookup) pipeline
- **Benchmarks:** `redir-engine/tests/perf/`
  - `cuckoo-filter.bench.ts`
  - `radix-tree.bench.ts`
  - `handle-request.bench.ts`
  - `payload-builder.bench.ts`
  - `cache-eviction.bench.ts`
- **Tests:** `redir-engine/e2e-suite/specs/T12-performance.test.ts`

### NFR-02: Horizontal Scaling
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** The system MUST be designed for Horizontal Scaling, allowing multiple Redirector Engine instances to operate independently without shared state.
- **Implementation:** Stateless engines receive state via SSE fan-out from Admin Service
- **Config:** Multiple engine URLs in `docker-compose.yml`

### NFR-03: Memory Efficiency
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** In-memory data structures MUST be designed for Memory Efficiency, accommodating large datasets.
- **Implementation:**
  - Cuckoo Filter: Space-efficient probabilistic data structure (~10 bits/entry)
  - LRU Cache with eviction: `redir-engine/src/adapters/cache/`
  - Radix Tree: Prefix-compressed string matching
- **Benchmarks:** `cache-eviction.bench.ts`
- **Tests:** `T13-cache-performance.test.ts`

### NFR-04: TLS/HTTPS Termination
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** All production traffic MUST be served over HTTPS with TLS termination at the edge (reverse proxy or load balancer).
- **Implementation:** Caddy reverse proxy with automatic Let's Encrypt TLS in `infra/caddy/Caddyfile`. HTTP/2 and OCSP stapling enabled. See CHANGE-006.

### NFR-05: Structured Observability Stack
- **Priority:** MUST
- **Status:** ❌ Not Implemented
- **Description:** The system MUST provide centralized log aggregation, metrics collection (Prometheus), and alerting for production monitoring.
- **Implementation:** Structured logging exists but no aggregation, metrics export, or alerting.

### NFR-06: Secrets Management
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** Production deployments MUST NOT contain hardcoded secrets. All sensitive configuration MUST be injected via environment variables from a secrets manager or vault.
- **Implementation:** `loadSecret()` utility reads from Docker secrets (`/run/secrets/<name>`) with env-var fallback. Startup validation plugin fails fast on missing secrets. See CHANGE-008.

### NFR-07: Database Migration Tooling
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** Schema changes MUST be managed via versioned, reversible migrations rather than raw SQL files.
- **Implementation:** Supabase CLI migration framework initialized in `admin-service/supabase/supabase/`. Baseline migration `20250125000000_baseline.sql` created from `schema.sql`. CI validates migrations on every push. See CHANGE-009.

### NFR-08: Continuous Deployment Pipeline
- **Priority:** MUST
- **Status:** ✅ Implemented
- **Description:** The system MUST have automated deployment pipelines (CI/CD) that build, test, and deploy to staging/production environments.
- **Implementation:** GitHub Actions workflows: `build-push.yml` (Docker images → GHCR), `deploy-staging.yml`, `deploy-production.yml` (SSH deploy + health check). See CHANGE-010.

### NFR-09: Backup and Disaster Recovery
- **Priority:** MUST
- **Status:** ❌ Not Implemented
- **Description:** Production databases MUST have automated backup schedules and a documented disaster recovery procedure.
- **Implementation:** No backup strategy or DR plan exists.

### NFR-10: Distributed Rate Limiting
- **Priority:** MUST
- **Status:** ❌ Not Implemented
- **Description:** Rate limiting MUST work across multiple engine instances using a shared store (Redis/KV) rather than in-memory counters.
- **Implementation:** Current rate limiting is in-memory only.

## Implementation Status Summary

| Requirement | Status | Notes |
|---|---|---|
| NFR-01 | ✅ | Sub-50ms processing pipeline |
| NFR-02 | ✅ | Stateless engines with SSE fan-out |
| NFR-03 | ✅ | Cuckoo Filter + LRU cache + Radix Tree |
| NFR-04 | ✅ | Caddy reverse proxy + auto-TLS (CHANGE-006) |
| NFR-05 | ❌ | Observability stack → CHANGE-007 |
| NFR-06 | ✅ | Docker secrets + startup validation (CHANGE-008) |
| NFR-07 | ✅ | Supabase CLI migrations (CHANGE-009) |
| NFR-08 | ✅ | GitHub Actions CI/CD pipelines (CHANGE-010) |
| NFR-09 | ❌ | Backup and disaster recovery → CHANGE-011 |
| NFR-10 | ❌ | Distributed rate limiting → CHANGE-012 |

## Load Testing Infrastructure
- `redir-engine/load-tests/` — k6 load testing scripts
- `redir-engine/load-tests/run.ts` — Test runner
- `redir-engine/load-tests/mock-admin.ts` — Mock SSE server for load tests
- `redir-engine/load-tests/setup.sh` — Environment setup