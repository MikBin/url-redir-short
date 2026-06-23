# Test Coverage Analysis & Plan

> **Snapshot date:** 2026-06-23 · **Data source:** live `@vitest/coverage-v8` runs against the current `main`.
> This document is regenerated from real coverage runs (not estimates). Re-run the commands in
> [§6 Reproducing this report](#6-reproducing-this-report) to refresh the figures after significant change.

This document captures the current state of automated test coverage across every subsystem of the
`url-redir-short` repository, identifies the specific files/modules that are under-tested, and lays out a
prioritized plan to reach and sustain **≥ 95% line/branch coverage**.

## 1. At-a-Glance Summary

| Subsystem | Path | Tests | % Stmts | % Branch | % Funcs | % Lines | Coverage scope (configured `include`) |
|---|---|---:|---:|---:|---:|---:|---|
| **Redir-Engine** | `redir-engine/` | 123 ✅ | **55.5%** | **45.6%** | **45.4%** | **56.9%** | `src/**` + `runtimes/**` (build artifacts excluded) |
| **Admin · PocketBase** | `admin-service/pocketbase/` | 143 ✅ | **49.7%** | **46.2%** | **56.9%** | **49.9%** | `server/middleware/**` + `server/utils/**` + `server/api/**` |
| **Admin · Supabase** | `admin-service/supabase/` | 286 ✅ | **95.9%** | **86.9%** | **100%** | **95.9%** | `server/api/**` *only* |
| E2E (engine) | `redir-engine/e2e-suite/` | 14 specs | — | — | — | — | Functional/Vitest (not counted in unit %) |
| E2E (system) | `system-e2e/` | 1 spec | — | — | — | — | Playwright (requires live services) |

**All 552 unit/integration tests currently pass** (engine 123 + pocketbase 143 + supabase 286).

### Headline takeaways
1. **Supabase is at target for its configured scope** (95.9% lines on `server/api/**`), but that scope is
   **narrow** — it deliberately excludes `server/utils`, `server/middleware`, and Vue components. The true
   repo-wide figure is lower.
2. **Redir-Engine and PocketBase are the real gaps** (~56% and ~50% lines). In both cases the **core/pure
   logic is excellent**; the gaps are concentrated in **adapters, Nitro/h3 handler entrypoints, and runtime
   bootstrap code**.
3. **No coverage thresholds are enforced anywhere**, and the engine has **no coverage configuration at all**
   (no `coverage:` block, no `@vitest/coverage-v8` dependency). Coverage can therefore silently regress.

---

## 2. Current Coverage by Subsystem

### 2.1 Redir-Engine (Hono + TypeScript) — `redir-engine/`

- **Framework:** Vitest + `@vitest/coverage-v8` (provider installed transiently for measurement; **not yet declared in `package.json`** — see §5).
- **Overall:** 55.5% Stmts / 45.6% Branch / 45.4% Funcs / 56.9% Lines · **123 tests / 19 files · all passing.**

| Area | File | Coverage | Notes |
|---|---|---:|---|
| ✅ Excellent | `core/filtering/cuckoo-filter.ts` | 100% | + property-based test |
| ✅ Excellent | `core/routing/radix-tree.ts` | 95.3% | + property-based test |
| ✅ Excellent | `core/utils/lru-cache.ts` | 100% | |
| ✅ Excellent | `adapters/cache/doubly-linked-list.ts` | 100% | |
| ✅ Excellent | `adapters/metrics/prometheus.ts` | 100% | branch gaps only (24-94) |
| ✅ Excellent | `core/analytics/payload-builder.ts` | 94.7% | |
| ✅ Excellent | `core/context/lazy-*-context.ts` | 100% | |
| ✅ Strong | `use-cases/handle-request.ts` | 98.5% | |
| ⚠ Partial | `adapters/http/server.ts` | 62% | routing/error paths (6-115) |
| ⚠ Partial | `adapters/storage/CloudflareKVStore.ts` | 57.9% | |
| ⚠ Partial | `adapters/sse/sse-client.ts` | 73.6% | reconnect/error paths |
| ⚠ Partial | `adapters/cache/cache-eviction.ts` | 48% | eviction branches (37-217) |
| ❌ Untested | `use-cases/sync-state.ts` | 0% | 14-117 |
| ❌ Untested | `adapters/analytics/fire-and-forget.ts` | 0% | 5-21 |
| ❌ Untested | `adapters/cache/cache-metrics.ts` | 0% | 30-122 |
| ❌ Untested | `adapters/sync/NoOpSyncAdapter.ts` | 0% | |
| ❌ Untested | `adapters/sync/SSESyncAdapter.ts` | 0% | 10-26 |
| ❌ Untested | `core/config/index.ts` | 0% | 8-18 |
| ❌ Untested | `core/utils/case-transformer.ts` | 0% | 15-29 |
| ❌ Untested | `adapters/store/in-memory-store.ts` | 0% | exercised only via E2E |
| ❌ Untested | `runtimes/node/index.ts` | 0% | bootstrap entrypoint |
| ❌ Untested | `runtimes/cf-worker/{index,fetch-event-source}.ts` | 0% | CF Worker bootstrap |

> **Caveat:** several "0%" adapters (`in-memory-store`, `sync-state`, `fire-and-forget`, `server.ts`) are
> exercised indirectly by `redir-engine/e2e-suite/`, whose coverage is **not** collected here. This is real
> functional confidence that does not show up in the unit figure.

### 2.2 Admin Service · PocketBase (Nuxt 4) — `admin-service/pocketbase/`

- **Framework:** Vitest + `@vitest/coverage-v8`.
- **Overall:** 49.7% Stmts / 46.2% Branch / 56.9% Funcs / 49.9% Lines · **143 tests / 24 files · all passing.**

| Area | File | Coverage | Notes |
|---|---|---:|---|
| ✅ Excellent | `server/utils/analytics.ts` | 100% | |
| ✅ Strong | `server/utils/transformer.ts` | 95.2% | |
| ✅ Strong | `api/auth/{login,logout,register}.post.ts` | ~97% | |
| ✅ Strong | `api/analytics/links/[linkId]/detailed.get.ts` | 100% | |
| ⚠ Partial | `server/utils/{logger,rate-limit,targeting,error-handler,config}.ts` | 54-83% | |
| ❌ Untested | `api/analytics/{dashboard,overview}.get.ts` | 0 / 0% | see note below |
| ❌ Untested | `api/analytics/v1/collect.post.ts` | 0% | 5-185 |
| ❌ Untested | `api/links/{create,index,[id].delete,[id].patch}.ts` | 0% | full CRUD handlers |
| ❌ Untested | `api/sync/stream.get.ts` | 0% | SSE sync to engines |
| ❌ Untested | `api/{bulk,health,metrics,qr}.ts` | 0% | |
| ❌ Untested | `server/middleware/{0.error,2.auth,3.rate-limit}.ts` | 0% | middleware dir avg 35.7% |
| ❌ Untested | `server/utils/{alias-generator,audit,metrics,pocketbase}.ts` | 0% | client/IO helpers |
| ⚠ Partial | `server/utils/sanitizer.ts` | 54% | |

> **Critical finding — tests exist but don't cover handlers.** Many PocketBase test files
> (e.g. `tests/analytics-dashboard.test.ts`) assert against the **extracted pure function**
> (`processAnalyticsEvents` in `server/utils/analytics`) rather than the Nitro **handler** itself
> (`server/api/analytics/dashboard.get.ts`). That is why the utility reads 100% while its handler reads 0%.
> The handlers are thin (data fetch → call util → error handling), but their **fetch/error/IO paths are
> untested**. This is the single biggest, highest-leverage PocketBase gap.

### 2.3 Admin Service · Supabase (Nuxt 4) — `admin-service/supabase/`

- **Framework:** Vitest + `@nuxt/test-utils` + `@vitest/coverage-v8`; Supabase/ioredis fully mocked
  (`tests/setup/env.ts` injects dummy credentials + `ioredis-mock`).
- **Overall (scoped to `server/api/**`):** 95.9% Stmts / 86.9% Branch / **100%** Funcs / 95.9% Lines ·
  **286 tests / 58 files · all passing.** ✅ *The historic Nuxt+Supabase+Redis bootstrapping crashes that
  previously held this subsystem at ~28% are fully resolved.*

| Weakest handlers | Coverage | Gap |
|---|---:|---|
| `api/analytics/v1/collect.post.ts` | 87.6% | branches 63.9% — lines 167-207, 224, 242-254 |
| `api/links/create.post.ts` | 94.2% | lines 58-62 |
| `api/links/[id]/history.get.ts` | 96.6% | lines 52-53 |
| everything else | 95-100% | branch gaps only |

> **Scope caveat (important):** the configured `coverage.include` is **`server/api/**/*.ts` only**.
> `server/utils/**`, `server/middleware/**`, and all Vue components are **excluded from measurement**, so
> 95.9% describes the API surface, not the whole service. (Many utils *are* tested — e.g.
> `transformer`, `hash`, `bulk`, `sanitizer` — but their coverage is not currently reported.)

### 2.4 E2E Suites

- **`redir-engine/e2e-suite/`** — 14 Vitest specs (`T01`–`T13`) running the real engine against **mocked**
  admin/analytics services. Provides strong functional confidence (boot/sync, redirect, 404 fast-path, A/B,
  geo/language fallback, analytics emission, HSTS, password protection, expiration, privacy, performance).
  *Not counted toward unit-coverage %, but materially de-risks the engine adapters.*
- **`system-e2e/`** — Playwright, **1 spec** (`system-flow.spec.ts`) gated behind `scripts/start-services.ts`
  (requires live admin + engine). Minimal breadth; no coverage generation.

---

## 3. Cross-Cutting Tooling Gaps

These affect the reliability of *every* number above and should be fixed first:

1. **No coverage thresholds anywhere.** None of the four `vitest.config.ts` files define
   `coverage.thresholds`, so coverage can drop without any signal.
2. **Engine has no coverage config / provider.** `redir-engine/vitest.config.ts` has no `coverage:` block and
   `@vitest/coverage-v8` is not in its `package.json`. (Figures above were produced with a transient
   `--no-save` install + CLI flags — see §6.)
3. **Inconsistent `include` scopes** make the three subsystem numbers **not directly comparable**:
   Supabase measures only `server/api`, PocketBase measures `server/{api,utils,middleware}`, Engine measures
   `src` + `runtimes`. Normalize these so "repo coverage" is well-defined.
4. **Engine build artifacts pollute measurement.** Without explicit excludes, Cloudflare Worker bundles
   (`bundle-*/loader.entry.ts`) inflate the denominator and crater the headline (the raw run reports
   **11.3%** until artifacts are excluded). The excludes must be baked into config.

---

## 4. Plan to Reach ≥ 95% (Prioritized)

### Phase 0 — Tooling & guardrails (do first, unblocks everything)
1. Add `@vitest/coverage-v8` to `redir-engine` devDependencies and a `coverage:` block to its
   `vitest.config.ts` (`include: ['src/**/*.ts','runtimes/**/*.ts']`, `exclude` test files + `.wrangler/`,
   `bundle-*`, `dist/`).
2. Normalize `coverage.include` across all three workspaces (e.g. measure `server/**` consistently in both
   admin services) so figures are comparable.
3. Set ascending `coverage.thresholds` in every config (start just above current levels, ratchet toward 95):
   - Engine: `lines: 57, branches: 46, functions: 46, statements: 55`
   - PocketBase: `lines: 50, branches: 47, functions: 57, statements: 50`
   - Supabase: `lines: 96, branches: 87, functions: 100, statements: 96`
   - Wire `npm run test:coverage` scripts in each `package.json`.

### Phase 1 — Redir-Engine adapters & runtime (target: ~56% → ≥ 90%)
Highest-leverage because several large files are at **0%**:
1. **`use-cases/sync-state.ts`** (0%, ~104 lines) — unit-test the SSE sync state machine: connect, replay,
   apply-chunk, gap/reset, and error paths. *(Much is covered by E2E; extract & cover the pure logic.)*
2. **`adapters/cache/cache-metrics.ts` + `cache-eviction.ts`** (0% / 48%) — test metric recording and the
   eviction-policy branches (LRU victim selection, manual eviction, capacity edge cases).
3. **`adapters/analytics/fire-and-forget.ts`** (0%) — test non-blocking dispatch + failure isolation.
4. **`adapters/sync/{NoOp,SSE}SyncAdapter.ts`** (0%) — contract tests against `ISyncManager`.
5. **`core/config/index.ts`** (0%) — test config loading/defaults/validation.
6. **`core/utils/case-transformer.ts`** (0%) — trivial snake↔camel; quick property-based test.
7. **Runtime entrypoints** (`runtimes/node/index.ts`, `runtimes/cf-worker/*`) — cover via the e2e-suite boot
   path or thin integration tests; exclude from strict unit thresholds if intended to be E2E-only.
8. Close branch gaps in already-high files: `prometheus.ts` (24-94), `server.ts` (6-115),
   `CloudflareKVStore.ts` (36-47), `sse-client.ts` (reconnect paths).

### Phase 2 — PocketBase handlers & middleware (target: ~50% → ≥ 90%)
The single biggest opportunity: **the API handlers are mostly 0% despite companion test files.**
1. **Drive the actual handlers**, not just extracted utils. Use `vi.mock('../../utils/pocketbase')` and
   `createEvent()`-style H3 fixtures to exercise each handler's fetch → transform → respond → error path:
   - `api/links/{create.post,[id].patch,[id].delete,index.get}.ts` (0%)
   - `api/sync/stream.get.ts` (0%) — SSE generation/backpressure
   - `api/analytics/{dashboard,overview}.get.ts` and `api/analytics/v1/collect.post.ts` (0%)
   - `api/{bulk,qr,metrics}.get/post.ts` (0%)
2. **Middleware** (0%): `0.error.ts`, `2.auth.ts`, `3.rate-limit.ts` — synthetic H3 events: missing/invalid
   auth, rate-limit exceeded, error capture.
3. **Untested utils** (0%): `alias-generator.ts`, `audit.ts`, `metrics.ts`, `pocketbase.ts` (client wrapper).

### Phase 3 — Supabase: widen scope, then close branch gaps
1. **Expand `coverage.include`** to `server/**` (utils, middleware) so the reported number reflects reality.
   Most utils are already tested; expect the widened figure to remain high.
2. Close remaining branch gaps: `collect.post.ts` (63.9% → target ≥ 90%), `create.post.ts`, `history.get.ts`,
   `[format].get.ts` export branches, `bulk.post.ts` (55-60).
3. Decide & document the policy for **Vue components/pages**: either unit-test key components with
   `@vue/test-utils` (component tests already exist for `Status`/`Analytics`) or formally exclude `.vue`
   from the threshold and rely on `system-e2e`.

### Phase 4 — E2E & system testing
1. Grow `system-e2e` Playwright journeys (currently 1 spec): login → create link → hit engine → view
   analytics; QR download; bulk import.
2. Keep `redir-engine/e2e-suite` performance tests isolated so they never skew unit metrics.

---

## 5. Immediate Action Items (Next Steps)

- [ ] **P0** Add coverage config + `@vitest/coverage-v8` to `redir-engine`; add `coverage` excludes for build artifacts.
- [ ] **P0** Set initial `coverage.thresholds` (just above current levels) in all three workspaces + `test:coverage` scripts.
- [ ] **P0** Normalize `coverage.include` scopes (esp. widen Supabase to `server/**`).
- [ ] **P1** PocketBase: write handler-level tests driving `api/links/*`, `api/sync/stream`, `api/analytics/*` with a mocked PocketBase client (biggest single coverage win).
- [ ] **P1** Engine: unit-test `sync-state.ts`, `cache-metrics.ts`, `cache-eviction.ts`, `fire-and-forget.ts`.
- [ ] **P2** PocketBase middleware (`2.auth`, `3.rate-limit`, `0.error`) and 0% utils.
- [ ] **P2** Supabase: close `collect.post.ts` branch gaps; ratify `.vue` coverage policy.
- [ ] **P3** Expand `system-e2e` Playwright journeys.

## 6. Reproducing this report

```bash
# Admin · Supabase (provider already declared)
cd admin-service/supabase && npx vitest run --coverage

# Admin · PocketBase (provider already declared)
cd admin-service/pocketbase && npx vitest run --coverage

# Engine — until Phase 0 lands a permanent config, measure with a transient provider + CLI flags:
cd redir-engine
npm install --no-save @vitest/coverage-v8
npx vitest run \
  --coverage.enabled \
  --coverage.include='src/**/*.ts' \
  --coverage.include='runtimes/**/*.ts' \
  --coverage.exclude='**/*.test.ts' \
  --coverage.exclude='tests/**' \
  --coverage.exclude='**/.wrangler/**' \
  --coverage.exclude='**/bundle-*/**' \
  --coverage.exclude='**/loader.entry.ts' \
  --coverage.exclude='**/dist/**' \
  --coverage.reporter=text
```

> The engine `--no-save` install does **not** modify `package.json`/`package-lock.json`; it only populates
> `node_modules` (gitignored). Phase 0 makes this permanent and scriptable.
