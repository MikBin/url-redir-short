# Test Coverage Analysis & Plan

> **Snapshot date:** 2026-06-23 (post-completion re-run) · **Data source:** live `@vitest/coverage-v8`
> runs against `main` @ `1593295`. This document is regenerated from real coverage runs (not estimates).
> Re-run the commands in [§6 Reproducing this report](#6-reproducing-this-report) to refresh the figures.

This document captures the state of automated test coverage across every subsystem of the
`url-redir-short` repository, tracks the work done to raise it, and lists the remaining gaps on the road to
a sustained **≥ 95% line/branch coverage**.

> **Status (2026-06-23):** Phases 0–4 of the original plan are **complete**. Coverage thresholds are now
> enforced in all three workspaces (CI fails on regression), the Supabase measurement scope was widened to
> the whole `server/**` tree, and system-E2E grew from 1 to 5 Playwright journeys. Coverage rose sharply in
> every package. Remaining work is concentrated in **runtime bootstrap code (engine) and Nuxt middleware /
> plugin IO (admin services)** — see [§4 Remaining gaps](#4-remaining-gaps--forward-plan).

## 1. At-a-Glance Summary

| Subsystem | Path | Tests | % Stmts | % Branch | % Funcs | % Lines | Coverage scope (`include`) | Enforced thresholds (stmt/br/func/line) |
|---|---|---:|---:|---:|---:|---:|---|---|
| **Redir-Engine** | `redir-engine/` | 175 ✅ | **77.7%** | **69.1%** | **85.4%** | **78.7%** | `src/**` + `runtimes/**` | 53 / 43 / 43 / 54 |
| **Admin · PocketBase** | `admin-service/pocketbase/` | 191 ✅ | **80.8%** | **66.8%** | **80.7%** | **81.5%** | `server/**` | 80 / 65 / 80 / 80 |
| **Admin · Supabase** | `admin-service/supabase/` | 360 ✅ | **78.9%** | **93.1%** | **86.8%** | **78.9%** | `server/**` | 72 / 86 / 78 / 72 |
| E2E (engine) | `redir-engine/e2e-suite/` | 14 specs | — | — | — | — | Functional/Vitest (not counted in unit %) | — |
| E2E (system) | `system-e2e/` | 5 specs | — | — | — | — | Playwright (requires live services) | — |

**All 726 unit/integration tests currently pass** (engine 175 + pocketbase 191 + supabase 360), up from 552.

### Headline takeaways (before → after)
1. **Engine** lines **56.9% → 78.7%** (123 → 175 tests). Every previously-0% *pure* module is now fully
   covered (`sync-state`, `fire-and-forget`, `cache-metrics`, `core/config`, `case-transformer`,
   `NoOpSyncAdapter`); only the runtime bootstrap entrypoints remain at 0% by design.
2. **PocketBase** lines **49.9% → 81.5%** (143 → 191 tests). The historic gap — handlers reading 0% while
   their extracted utils read 100% — is closed: handler-level tests now drive the actual Nitro handlers.
3. **Supabase** headline **dropped 95.9% → 78.9%** *by design*: the measurement scope was widened from
   `server/api/**` only to the full `server/**` tree (utils, middleware, plugins). The API surface itself
   remains ~95–100%; the new denominator now reflects the previously-hidden middleware/plugin IO code.
4. **system-e2e** grew **1 → 5** Playwright journeys (login→create→redirect→analytics, advanced routing,
   QR, bulk import, analytics dashboard).
5. **Thresholds are enforced** in all three workspaces; PocketBase/Supabase thresholds are ratcheted just
   below current levels. Engine thresholds still sit at the old baseline (54 lines) and have headroom to
   ratchet toward the new ~79% — see [§3](#3-tooling--guardrails).

---

## 2. Current Coverage by Subsystem

### 2.1 Redir-Engine (Hono + TypeScript) — `redir-engine/`

- **Framework:** Vitest + `@vitest/coverage-v8` (now a declared devDependency).
- **Overall:** 77.7% Stmts / 69.1% Branch / 85.4% Funcs / 78.7% Lines · **175 tests / 30 files · all passing.**

| Area | File | Coverage | Notes |
|---|---|---:|---|
| ✅ Full | `core/config/index.ts` | 100% | was 0% — config loading/defaults/validation |
| ✅ Full | `core/utils/case-transformer.ts` | 100% | was 0% — snake↔camel |
| ✅ Full | `adapters/analytics/fire-and-forget.ts` | 100% | was 0% |
| ✅ Full | `adapters/sync/NoOpSyncAdapter.ts` | 100% | was 0% |
| ✅ Full | `adapters/cache/cache-metrics.ts` | 100% | was 0% |
| ✅ Full | `use-cases/sync-state.ts` | 100% | was 0% — SSE state machine |
| ✅ Strong | `adapters/cache/cache-eviction.ts` | 98.2% | was 48% (gap: L156) |
| ✅ Strong | `use-cases/handle-request.ts` | 98.5% | gap: L124 |
| ✅ Strong | `core/routing/radix-tree.ts` | 95.3% | gaps: L46, L84 |
| ✅ Strong | `core/analytics/payload-builder.ts` | 94.4% | gap: L20 |
| ⚠ Partial | `adapters/http/server.ts` | 82% | gaps: L25-26, L76-83, L112 |
| ⚠ Partial | `adapters/sse/sse-client.ts` | 84.6% | reconnect/error paths |
| ⚠ Partial | `adapters/metrics/prometheus.ts` | 100%* | branch gap: L94 |
| ⚠ Partial | `adapters/storage/CloudflareKVStore.ts` | 57.9% | gaps: L11, L36-47 |
| ⚠ Partial | `adapters/sync/SSESyncAdapter.ts` | 57.1% | gaps: L15-17 |
| ❌ E2E-only | `runtimes/node/index.ts` | 0% | bootstrap entrypoint (L14-47) |
| ❌ E2E-only | `runtimes/cf-worker/{index,fetch-event-source}.ts` | 0% | CF Worker bootstrap |

> Fully-covered files (`cuckoo-filter.ts`, `lru-cache.ts`, `doubly-linked-list.ts`, `core/context/*`,
> `core/config`, `case-transformer`, `fire-and-forget`, `NoOpSyncAdapter`) are omitted from the v8 text
> report when they have zero uncovered lines. The two 0% **runtime** files are exercised end-to-end by
> `redir-engine/e2e-suite/`; the plan is to keep them out of strict unit thresholds and rely on E2E.

### 2.2 Admin Service · PocketBase (Nuxt 4) — `admin-service/pocketbase/`

- **Framework:** Vitest + `@vitest/coverage-v8`.
- **Overall:** 80.8% Stmts / 66.8% Branch / 80.7% Funcs / 81.5% Lines · **191 tests / 34 files · all passing.**

| Area | File | Coverage | Notes |
|---|---|---:|---|
| ✅ Strong | `api/links/{index,[id].delete}.ts` | 100% / 84.6% | was 0% — CRUD handlers now driven |
| ✅ Strong | `api/sync/stream.get.ts` | 94.7% | was 0% — SSE generation |
| ✅ Strong | `api/auth/{login,logout,register}.post.ts` | 93–100% | |
| ✅ Strong | `middleware/{0.error,3.rate-limit}.ts` | 100% / 89.7% | was 0% |
| ✅ Strong | `server/utils/{analytics,pocketbase,transformer}.ts` | 91–93% | |
| ⚠ Partial | `api/bulk.post.ts` | 94.5% | branch gaps: L77, L141-148 |
| ⚠ Partial | `api/links/{create,[id].patch}.ts` | 84.6% / 76% | create funcs 50%; patch gaps L46-83 |
| ⚠ Partial | `api/analytics/v1/collect.post.ts` | 62.1% | **branches 33.8%** — biggest PocketBase gap |
| ❌ Untested | `api/links/[id]/history.get.ts` | 0% | L4-69 — handler exists, no test |
| ⚠ Partial | `server/utils/sanitizer.ts` | 53.8% | funcs 42.9% |
| ⚠ Partial | `server/utils/config.ts` | 66.7% | |

> The "tests exist but cover the extracted util, not the handler" problem from the prior snapshot is
> resolved: `*-handler.test.ts` files now exercise the real Nitro handlers via mocked PocketBase client +
> H3 event fixtures.

### 2.3 Admin Service · Supabase (Nuxt 4) — `admin-service/supabase/`

- **Framework:** Vitest + `@nuxt/test-utils` + `@vitest/coverage-v8`; Supabase/ioredis fully mocked
  (`tests/setup/env.ts` injects dummy credentials + `ioredis-mock`).
- **Overall (now scoped to full `server/**`):** 78.9% Stmts / **93.1%** Branch / 86.8% Funcs / 78.9% Lines ·
  **360 tests / 70 files · all passing.**

| Area | File | Coverage | Notes |
|---|---|---:|---|
| ✅ Full | `api/links/**`, `api/{bulk,qr}`, `api/sync/stream` | 100% | |
| ✅ Strong | `api/analytics/**` (dashboard, stats, export, overview, detailed) | 95–100% | |
| ✅ Strong | `api/analytics/v1/collect.post.ts` | 94.8% | was 87.6% (Phase 3) |
| ✅ Strong | `server/utils/{transformer,bulk,hash,metrics,qr,audit,cloudflare-kv,...}.ts` | 100% | widened scope now reported |
| ⚠ Partial | `server/utils/rate-limit.ts` | 79.7% | gaps: L37-44, L56-69 |
| ⚠ Partial | `server/utils/broadcaster.ts` | 77.8% | funcs 0% |
| ⚠ Partial | `server/utils/sanitizer.ts` | 90.6% | funcs 71% |
| ❌ Untested | `server/middleware/{error,security}.ts` | 0% stmts | stmts not exercised (branch-stubbed) |
| ❌ Untested | `server/middleware/rate-limit.ts` | 0% | L1-97 |
| ❌ Untested | `server/plugins/{metrics,realtime}.ts` | 0% stmts | Nitro plugin lifecycle |
| ❌ Untested | `server/utils/monitoring.ts`, `server/utils/storage.ts` | 0% stmts | |

> **Scope note:** `coverage.include` was widened from `server/api/**` to `server/**` in Phase 3, so the
> reported figure finally reflects middleware, plugins, and utils. The API surface alone remains ~95–100%;
> the new gaps are Nitro **plugin/middleware lifecycle** code that is hard to exercise without a booted
> Nitro server (these run only via `system-e2e`). `health.get.ts` / `metrics.get.ts` are explicitly
> excluded from measurement.

### 2.4 E2E Suites

- **`redir-engine/e2e-suite/`** — 14 Vitest specs (`T01`–`T13`) running the real engine against **mocked**
  admin/analytics services. Covers boot/sync, redirect, 404 fast-path, A/B, geo/language fallback, analytics
  emission, HSTS, password protection, expiration, privacy, and performance. *Not counted toward unit-coverage %,
  but materially de-risks the engine adapters and the runtime bootstrap code that is 0% in unit runs.*
- **`system-e2e/`** — Playwright, **5 specs** (`system-flow`, `advanced-routing`, `qr-code`, `bulk-import`,
  `analytics-dashboard`), each gated behind `scripts/start-services.ts` (requires live admin + engine).

---

## 3. Tooling & Guardrails

The cross-cutting tooling gaps from the prior snapshot are resolved; what remains is **threshold ratcheting**:

1. ✅ **Coverage config + `@vitest/coverage-v8`** declared in `redir-engine` (Phase 0). Build artifacts
   (`bundle-*`, `.wrangler/`, `dist/`, `loader.entry.ts`) and test/bench files are excluded.
2. ✅ **`coverage.thresholds`** set in all three workspaces; `npm run test:coverage` wired in every
   `package.json`. CI fails when coverage drops below threshold.
3. ✅ **Scopes normalized** — both admin services now measure `server/**`; the engine measures
   `src` + `runtimes`. Figures are now directly comparable across admin services.
4. ⚠ **Ratchet thresholds upward.** Current thresholds vs. actual coverage:

   | Workspace | Threshold (stmt/br/func/line) | Actual (stmt/br/func/line) | Headroom |
   |---|---|---|---|
   | Engine | 53 / 43 / 43 / 54 | 77.7 / 69.1 / 85.4 / 78.7 | large (set at old baseline) |
   | PocketBase | 80 / 65 / 80 / 80 | 80.8 / 66.8 / 80.7 / 81.5 | tight |
   | Supabase | 72 / 86 / 78 / 72 | 78.9 / 93.1 / 86.8 / 78.9 | moderate |

   Engine thresholds in particular can move from the legacy baseline toward ~70/60/75/70 without blocking
   CI. Ratchet incrementally so each bump is a deliberate floor, not a moving target.

---

## 4. Remaining Gaps & Forward Plan

Phases 0–4 (tooling, engine adapters, PocketBase handlers, Supabase scope-widening, E2E) are **complete**.
The work below closes the distance to ≥ 95%.

### Phase 5 — Close the last gaps (target: → ≥ 90–95%)

**Engine:**
1. `adapters/storage/CloudflareKVStore.ts` (57.9%) and `adapters/sync/SSESyncAdapter.ts` (57.1%) —
   the last sub-60% adapters. Add contract tests (mocked KV / EventSource).
2. Close branch gaps in already-high files: `server.ts` (82%), `sse-client.ts` (84.6%),
   `payload-builder.ts` (94.4%), `prometheus.ts` (branch L94).
3. **Decide the runtime-entrypoint policy.** `runtimes/node/index.ts` and `runtimes/cf-worker/*` are 0%
   in unit runs (E2E-only). Either add thin integration boot-tests or formally exclude them from the
   threshold and document that E2E owns them.

**PocketBase:**
1. `api/analytics/v1/collect.post.ts` — **branches 33.8%** (the worst branch figure in the repo). Cover the
   collect/validation/batching branches.
2. `api/links/[id]/history.get.ts` (0%) — add a handler test (parallel to the Supabase one).
3. `server/utils/sanitizer.ts` (53.8%), `server/utils/config.ts` (66.7%).

**Supabase:**
1. `server/middleware/{rate-limit,error,security}.ts` (0%) and `server/plugins/{metrics,realtime}.ts` (0%) —
   Nitro lifecycle code. Either boot a Nitro test server (`nitro` dev engine in tests) or accept that
   `system-e2e` owns these and document the carve-out.
2. `server/utils/monitoring.ts` (0%), `server/utils/storage.ts` (0%), `server/utils/broadcaster.ts` (77.8%).

### Phase 6 — Maintain & sustain
1. Ratchet thresholds upward each release (see §3) so coverage cannot silently regress.
2. Grow `system-e2e` only where a user journey adds confidence beyond unit/adapter tests (avoid redundant
   breadth). Keep `redir-engine/e2e-suite` perf tests isolated from unit metrics.

---

## 5. Action Items (Next Steps)

- [x] **P0** Coverage config + `@vitest/coverage-v8` added to `redir-engine`; build artifacts excluded.
- [x] **P0** `coverage.thresholds` set in all three workspaces; `test:coverage` scripts wired.
- [x] **P0** `coverage.include` normalized (Supabase widened to `server/**`).
- [x] **P1** PocketBase: handler-level tests driving `api/links/*`, `api/sync/stream`, `api/analytics/*`
      with a mocked PocketBase client.
- [x] **P1** Engine: unit tests for `sync-state`, `cache-metrics`, `cache-eviction`, `fire-and-forget`,
      sync adapters, `core/config`, `case-transformer`.
- [x] **P2** PocketBase middleware + 0% utils.
- [x] **P2** Supabase: `collect.post.ts` branch gaps raised (87.6% → 94.8%).
- [x] **P3** `system-e2e` expanded to 5 Playwright journeys.
- [ ] **P4** Ratchet engine thresholds from legacy baseline (54 → ~70 lines).
- [ ] **P5** Close remaining < 90% files listed in [§4](#4-remaining-gaps--forward-plan).
- [ ] **P5** Ratify the `.vue` / runtime-entrypoint / Nitro-plugin coverage policy (unit vs. E2E ownership).

## 6. Reproducing this report

Every workspace now has a permanent coverage config, so a single script reproduces all figures:

```bash
# Redir-Engine
cd redir-engine && npm run test:coverage

# Admin · PocketBase
cd admin-service/pocketbase && npm run test:coverage

# Admin · Supabase
cd admin-service/supabase && npm run test:coverage
```

Each writes `text`, `text-summary`, and `html` reports (the HTML report lands in `<pkg>/coverage/index.html`).
Thresholds are enforced, so a coverage regression fails the run.
