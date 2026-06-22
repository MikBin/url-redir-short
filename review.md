# Architectural Code Review — `url-redir-short`

> **Supersedes:** `z-review.md`, `k-review.md`, and `review-crosscheck.md` (removed 2026-06-22). This document is the single living review.

**Reviewer:** Senior Solution Architect · **Date:** 2026-06-22
**Scope:** Entire monorepo — `redir-engine`, `admin-service` (Supabase + PocketBase), infrastructure, CI/CD, observability, tests, specs, docs, and the LikeC4 architecture model.
**Method:** Deep code and configuration review across ~4,000 lines of core source + 300+ files; independent spot-checking of the highest-severity claims; reconciliation of two prior internal reviews.

---

## 1. Executive Summary

`url-redir-short` is a **technically ambitious, well-conceived URL-redirect platform** with a genuinely strong core: a hexagonal redirect engine built on a radix trie, cuckoo filter, lazy targeting contexts, and SHA-256 IP anonymization. The architecture diagrams, ADRs, and OpenSpec proposals show that the team thinks in systems.

However, **the platform is not production-ready as a whole**. It is best described as an **advanced pilot / late-MVP**. The Supabase + Node engine path is roughly **80% of the way to a hardened production launch**, but the **TLS edge, the deploy pipeline, the Cloudflare Worker runtime, and the PocketBase backend do not work end-to-end today** — and the PocketBase backend ships with a **cross-tenant authorization bypass**.

**Headline verdict:**
- `redir-engine` hot path: production-ready with minor caveats.
- `admin-service` Supabase variant: shippable after ~6–8 fixes.
- `admin-service` PocketBase variant: **not safe for production**.
- Cloudflare Worker runtime: **not deployable** as configured.
- Infrastructure / CI / observability: good intent, but several wiring defects block any production cutover.

---

## 2. Scope & Methodology

### 2.1 Scope

| Area | What was reviewed |
|---|---|
| `redir-engine` | Core routing, storage adapters, SSE sync, cache eviction, analytics, CF Worker runtime, Node runtime, tests, benchmarks. |
| `admin-service/supabase` | Nuxt/Nitro API, RLS/schema, security middleware, rate limiting, analytics, SSE sync, CF KV publisher, tests, Docker. |
| `admin-service/pocketbase` | PocketBase migrations, API routes, plugins, analytics, auth, realtime, tests, dependencies. |
| `admin-service/shared` | Reuse/duplication between the two admin variants. |
| Infrastructure | Docker Compose, Caddyfile, deploy scripts, secrets management. |
| CI/CD | GitHub Actions workflows, deploy scripts. |
| Observability | Prometheus, Grafana, Loki configuration, dashboards, alerting. |
| Documentation | ADRs, arc42, OpenSpec specs/roadmap, LikeC4 model. |

### 2.2 Methodology

1. Read the two prior internal reviews (`z-review.md` and `k-review.md`) and their cross-check (`review-crosscheck.md`).
2. Independently re-verified the most severe claims against source (C1, C2, C3, C8, C9, H13, etc.).
3. Reconciled diverging severity ratings and integrated `k-review.md` product/parity gaps.
4. Produced a single severity-ordered findings list and a unified roadmap.

### 2.3 Reconciliation of Prior Reviews

- **`z-review.md`** was the stronger security/ops review. It found critical issues `k-review.md` missed: the PocketBase auth bypass, broken Caddy/TLS edge, broken deploy scripts, and the `trust` Postgres auth.
- **`k-review.md`** was the stronger feature/parity tracker. It found product gaps `z-review.md` missed: the hanging E2E suite, weak CSP, multi-domain routing not implemented, missing CSV/QR features, and the location of analytics enrichment.
- **Both reviews now agree** after correction: the system is not production-ready as a whole; the Supabase+Node path is ~80% to a hardened launch.
- **One inaccuracy inside `z-review.md` was corrected by the cross-check:** the original claim "no `npm run lint` script exists" was false. The root `package.json` does define a lint script; the real defect is that CI does not run it and the workspace resolution may be incomplete.

---

## 3. Production Readiness Scorecard

| Subsystem | Rating | One-line verdict |
|---|---|---|
| **redir-engine — core redirect hot path** | 🟢 Production Ready | Clean, fast, well-tested hexagonal core. |
| **redir-engine — cache eviction / radix tree** | 🔴 Critical gap | Inert cache eviction; unpruning trie = memory leak. |
| **redir-engine — SSE sync (Node)** | 🟡 Nearly Ready | No resume/replay/snapshot; cold-start race. |
| **redir-engine — CF Worker runtime** | 🟠 In Progress | Per-request reconstruction, placeholder config, test backdoors. |
| **admin-service — Supabase** | 🟡 7/10 — shippable with caveats | CORS fail-open + KV-sync durability + test gaps to fix. |
| **admin-service — PocketBase** | 🔴 3.5/10 — NOT production-ready | Auth bypass + broken analytics + bad dependency. |
| **SSE sync protocol** | 🟠 In Progress | No sequencing, snapshot, replay, or backpressure. |
| **Infrastructure / Docker / TLS edge** | 🔴 2.5/5 — broken in prod | Caddy points at wrong ports; `trust` auth; no hardening. |
| **Observability stack** | 🟡 3/5 | Stack present; no alerting, deprecated Loki, `:latest` images. |
| **CI/CD pipeline** | 🟡 2.5/5 | Good shape; CF deploy path broken; no lint/coverage gate. |
| **Secrets management** | 🟡 3/5 | Excellent git hygiene; hardcoded Grafana pw; no scanning. |
| **Tests & coverage discipline** | 🟡 6/10 | Engine + PocketBase strong; Supabase weak; unenforced. |
| **OpenSpec & documentation** | 🟡 Moderate | High-quality content; status tracking unreliable. |

---

## 4. Architecture & Design Assessment

### 4.1 LikeC4 Model

The LikeC4 model (`docs/architecture/likec4/architecture.c4`) is **accurate and well-modeled** for what it captures:

- Two engine runtimes (Node persistent + Cloudflare Worker ephemeral) sharing the same hexagonal core via injected adapters.
- Dual store port (`IRedirectStore`) with `InMemoryStore` and `CloudflareKVStore`.
- Dual sync port (`ISyncManager`) with `SSESyncAdapter` and `NoOpSyncAdapter`.
- Dual DB backends (Supabase reference + PocketBase lightweight).
- Two parallel sync paths in Supabase (SSE broadcaster + CF KV publisher).

**Gaps vs. reality:**
- `CacheEvictionManager` is drawn as a real component but is functionally inert.
- `Targeting Pipeline` is implicit in `handle-request.ts`, not a separate component.
- The KV publisher relationship is real but unreliable (`.catch(() => {})`).
- The model does not represent the **cold-start race** (engine serving before SSE bootstrap completes).
- The deployment view does not show that staging/prod share the same path or that Wrangler envs are unconfigured.
- Valkey is shown as used for distributed rate limiting, but the implementation is still in-memory.
- Analytics enrichment is shown as rich demographic data, but the engine only sends `user_agent`; enrichment happens in the Admin collector.

### 4.2 Code Structure

**Redirect Engine (`redir-engine/src/`)**

The Clean/Hexagonal architecture is genuinely followed:

- `src/core/`: pure domain (Cuckoo Filter, Radix Tree, analytics payload, targeting context).
- `src/use-cases/`: `HandleRequestUseCase`, `SyncStateUseCase`.
- `src/ports/`: `IRedirectStore`, `ISyncManager`.
- `src/adapters/`: HTTP, SSE, storage, analytics, metrics.

This makes the engine testable and portable between Node.js and Cloudflare Workers.

**Admin Service — Supabase (`admin-service/supabase/`)**

Nuxt 4 + Nitro + Vue 3 + Tailwind. Structure is organized:

- `server/api/`: REST endpoints.
- `server/middleware/`: security, rate limiting, error handling.
- `server/plugins/`: realtime, config validation, metrics.
- `server/utils/`: logger, transformer, sanitizer, audit, etc.

**Admin Service — PocketBase (`admin-service/pocketbase/`)**

Claims parity with Supabase but has significant drift:

- Missing `validate-env` plugin and secrets validation.
- Missing metrics plugin.
- Missing Cloudflare KV publisher.
- Domains UI is PocketBase-only (reverse drift).
- Cross-tenant authorization bypass in `links` rules.
- Broken analytics pipeline.
- Non-existent `vue-router@^5.0.4` dependency.

### 4.3 Strengths

- **Genuine Clean/Hexagonal Architecture** in the engine. Ports are narrow and inverted; dependency direction is inward.
- **Multi-runtime strategy is real.** The same `HandleRequestUseCase` runs on Node and CF Workers via different adapters.
- **Performance engineering with measured intent.** Radix trie (O(k) lookup), cuckoo filter (O(1) 404 gate), shared UA LRU cache, deferred body parsing, lazy contexts.
- **Privacy-by-design.** Salted SHA-256 IP anonymization; verified by E2E `T08-privacy.test.ts`.
- **TypeScript `strict: true`** in the engine.
- **Only one explicit `any`** in production source: `admin-service/pocketbase/server/plugins/realtime.ts:9`.
- **Excellent git/secret hygiene.** `.env` and `secrets/*.txt` gitignored; file-based Docker secrets.
- **Multi-stage, non-root Docker images** with health checks.
- **Scenario-driven OpenSpec proposals** and a respectable ADR/arc42 documentation set.
- **Strong engine test quality.** `handle-request.test.ts` covers cuckoo false-positives, store-throws, expiration, password, targeting, malformed A/B config.
- **Honest self-assessment.** `COVERAGE_PLAN.md` admits Supabase is at ~28%.

### 4.4 Weaknesses

- `RedirectRule` is defined in multiple places (`redir-engine/src/core/config/types.ts`, `admin-service/supabase/server/utils/transformer.ts`, `admin-service/shared/types.ts`), creating drift risk.
- `InMemoryStore` accepts `domainId` in its port methods but ignores it; multi-domain routing is not implemented.
- `loadConfig()` does not validate required URLs or API keys.
- ~60–70% code duplication between Supabase and PocketBase `server/utils/`; `admin-service/shared/utils/` is underused.
- `admin-service/shared/utils/sanitizer.ts` is imported by neither variant; `admin-service/shared/utils/hash.ts` is dead code.

---

## 5. Findings by Severity

Every item below includes a location citation and, for critical/high items, an independent verification note.

### 5.1 Critical — Must-fix before any production launch

| # | Issue | Location | Impact | Verified |
|---|---|---|---|---|
| C1 | **PocketBase authorization bypass** — `links` API rules are `@request.auth.id != ""` (any authenticated user can CRUD any tenant's links). | `admin-service/pocketbase/pb_migrations/1777556624_updated_links.js:7-11` | Cross-tenant data breach / privilege escalation. | ✅ Verified against source. |
| C2 | **Caddy TLS edge points at wrong ports.** `reverse_proxy admin:3001` / `engine:3002`, but containers listen internally on `3000` (`docker-compose.yml` maps `3001:3000` / `3002:3000`). The `docker-compose.prod.yml` overlay only `!reset []`s host-side ports, so the bug persists. | `infra/caddy/Caddyfile:6,15,23` vs `docker-compose.yml:59,73,99,108` | HTTPS unreachable in production. | ✅ Verified against source. |
| C3 | **Cloudflare Worker deploy will fail.** CI runs `wrangler deploy --env staging/prod`, but `wrangler.toml` has no `[env.staging]`/`[env.production]` sections and vars are placeholders. | `.github/workflows/deploy-*.yml:37-38`; `redir-engine/runtimes/cf-worker/wrangler.toml` | Edge runtime cannot be deployed via the documented path. | ✅ Verified against source. |
| C4 | **Deploy scripts cannot deploy registry images.** `deploy-production.sh` exports `ADMIN_IMAGE_TAG` and runs `docker compose pull admin`, but `docker-compose.yml` defines `admin`/`engine` with `build:` and no `image:` field. | `scripts/deploy-production.sh:17-21`; `docker-compose.yml:46-48` | `pull` is a no-op; deploys silently rebuild or fail. | ✅ Verified against source. |
| C5 | **PocketBase analytics pipeline is broken.** `analytics_aggregates` collection is referenced but absent from `pb_schema.json`; `analytics_events` has only 4 fields but ingestion writes 14. Non-atomic read-modify-write. | `admin-service/pocketbase/server/api/analytics/v1/collect.post.ts:118,148,167` | Click counts zero/stale; lost updates. | ✅ Verified against source. |
| C6 | **Non-existent `vue-router@^5.0.4` dependency.** Current major is 4. | `admin-service/pocketbase/package.json:24` | `npm install` broken for PocketBase variant. | ✅ Verified against source. |
| C7 | **Expected API key printed to stdout.** `stream.get.ts:15` logs the expected secret. The 401 body only echoes the caller's own header and masks the expected value. | `admin-service/pocketbase/server/api/sync/stream.get.ts:15,18` | Secret disclosure to process logs. | ✅ Verified against source. |
| C8 | **CORS fail-open (Supabase).** `security.ts` allows all origins when `CORS_ALLOWED_ORIGINS` is unset, combined with `Access-Control-Allow-Credentials: 'true'`. The shipped compose sets `CORS_ALLOWED_ORIGINS: "*"`. | `admin-service/supabase/server/middleware/security.ts:56-62` | Credential theft / CSRF surface. | ✅ Verified against source. |
| C9 | **`POSTGRES_HOST_AUTH_METHOD: trust` disables Postgres password auth.** | `docker-compose.yml:17` | DB accessible without credentials. | ✅ Verified against source. |
| C10 | **Radix trie never prunes deleted nodes.** The pruning block is commented-out pseudo-code. | `redir-engine/src/core/routing/radix-tree.ts:49-68` | Monotonic memory leak under create/delete churn. | ✅ Verified against source. |

### 5.2 High — Correctness, reliability, or significant security gaps

| # | Issue | Location |
|---|---|---|
| H1 | **SSE protocol has no sequencing, snapshot, replay, or backpressure.** Reconnecting engines miss the gap; fresh engines cannot bootstrap. | `admin-service/*/server/plugins/realtime.ts`, `admin-service/*/server/api/sync/stream.get.ts` |
| H2 | **Cloudflare KV sync is fire-and-forget.** Every `publishRuleToKV(...).catch(() => {})` swallows failures. | `admin-service/supabase/server/api/links/{create,patch,delete}.ts` |
| H3 | **Cache eviction is inert.** `CacheEvictionManager` never calls `store.removeRedirect()`; `recordCacheAccess()` is never invoked. | `redir-engine/src/adapters/cache/cache-eviction.ts`; `redir-engine/src/use-cases/sync-state.ts:87` |
| H4 | **No input validation at the SSE trust boundary.** `JSON.parse(e.data)` with no try/catch or Zod. | `redir-engine/src/adapters/sse/sse-client.ts:90,95,100` |
| H5 | **Plaintext password storage + non-constant-time compare** in password-protected links. | `redir-engine/src/use-cases/handle-request.ts:71`; `redir-engine/src/core/config/types.ts:37` |
| H6 | **`maxClicks` is never decremented by the engine.** A link at `clicks=4, maxClicks=5` redirects forever. | `redir-engine/src/use-cases/handle-request.ts:55-57` |
| H7 | **No graceful shutdown in Node runtime.** No `SIGTERM`/`SIGINT` handler; timers and SSE sockets leak. | `redir-engine/runtimes/node/index.ts` |
| H8 | **CF Worker reconstructs use-case + app per request.** Dynamic imports are cached, but instances are rebuilt. Test-injection endpoints (`/_test/inject`, `/_test/clear`) ship in prod; `FireAndForgetCollector` lacks `waitUntil`. | `redir-engine/runtimes/cf-worker/index.ts:72-108` |
| H9 | **API key in SSE URL query string** (`?apiKey=...`). Leaks into proxy/access logs. | `redir-engine/src/adapters/sse/sse-client.ts:53,56` |
| H10 | **Supabase tests pass vacuously.** `try/catch` blocks without `expect.assertions(n)`; `health.test.ts` accepts 200 or 503. | `admin-service/supabase/tests/unit/api/*.ts` |
| H11 | **Audit duplication + plaintext password in UI.** `audit.ts` and DB trigger duplicate logging; `AuditLog.vue` renders `password_protection.password`; `actor_id` mis-attributed. | `admin-service/supabase/server/utils/audit.ts`; `admin-service/supabase/app/components/AuditLog.vue:60-71`; `admin-service/supabase/schema.sql:400-410` |
| H12 | **Deploy health checks only warn.** A broken deploy is reported as success. | `scripts/deploy-production.sh:30-33`; `scripts/deploy-staging.sh:21-25` |
| H13 | **Lint tooling is not enforced.** Root `package.json:30` defines `"lint": "eslint ."`, but CI never invokes it and workspace resolution may be incomplete. | root `package.json:30`; `.github/workflows/ci.yml` |
| H14 | **Three divergent copies of the link schema** + inline copies. PocketBase accepts non-URL destinations; slug length inconsistent. | `admin-service/shared/utils/sanitizer.ts`, `admin-service/supabase/server/utils/sanitizer.ts`, `admin-service/pocketbase/server/utils/sanitizer.ts` |
| H15 | **Public analytics endpoint unauthenticated.** `/api/analytics/v1/collect` has no shared secret; rate-limited by spoofable `x-forwarded-for`. | `admin-service/supabase/server/api/analytics/v1/collect.post.ts:242-250` |
| H16 | **`login.post.ts` sets `httpOnly: false`** (XSS can steal token); register/logout use `httpOnly: true`. | `admin-service/pocketbase/server/api/auth/login.post.ts:19` |
| H17 | **Observability stack exposed/hardcoded.** Postgres `trust`, DB/Redis published to host, Grafana pw `admin`, no TLS/auth on Prometheus/Loki/Grafana. | `docker-compose.yml`; `docker-compose.observability.yml` |
| H18 | **`backfill-aggregates.js` is non-idempotent** and `require()`s into a sibling package's `node_modules`. | `scripts/backfill-aggregates.js:1` |

### 5.3 Medium — Quality, hardening, drift, and parity gaps

| # | Issue | Location / Notes |
|---|---|---|
| M1 | **Massive code duplication between Supabase and PocketBase.** ~60–70% of `server/utils/` duplicated; `shared/` underused. | `admin-service/**` |
| M2 | **`as unknown as` casts** are the spiritual equivalent of `any`. | `redir-engine/runtimes/cf-worker/index.ts:78,81,101`; `storage.ts:17`; `logger.ts:65` |
| M3 | **Zod version split.** Supabase `zod@^3.24`, PocketBase `zod@^4.3.6`. | `admin-service/*/package.json` |
| M4 | **No monorepo workspace definition.** Root declares runtime deps with versions different from the engine. | root `package.json` vs `redir-engine/package.json` |
| M5 | **Cuckoo filter fixed capacity (10,000).** No auto-resize or fill-ratio monitoring. | `redir-engine/src/core/routing/cuckoo-filter.ts` |
| M6 | **`cache-metrics.ts` unbounded `requests[]` array** + O(n) `getMetrics()`. | `redir-engine/src/adapters/metrics/cache-metrics.ts` |
| M7 | **Supabase `broadcaster.ts` is a stub.** 90% comments; only an `EventEmitter` is used. | `admin-service/supabase/server/utils/broadcaster.ts` |
| M8 | **`case-transformer.ts` is dead code.** AGENTS.md claims snake→camel transformation; not wired. | `admin-service/supabase/server/utils/case-transformer.ts` |
| M9 | **PocketBase `test` script runs in watch mode.** | `admin-service/pocketbase/package.json` |
| M10 | **`{{PORT}}` socket file committed at repo root.** | repo root |
| M11 | **Observability gaps.** No Alertmanager/rules; Grafana datasource no `uid`; Loki uses deprecated `boltdb-shipper`/`v11`; `:latest` images; no Prometheus retention. | `infra/grafana/`, `infra/loki/`, `docker-compose.observability.yml` |
| M12 | **No resource limits, `restart`, `read_only`, `cap_drop`** in compose. | `docker-compose.yml`; `docker-compose.prod.yml` |
| M13 | **`engine_radix_tree_size` metric defined but never populated.** | `redir-engine/src/adapters/metrics/...` |
| M14 | **`analytics_events` unbounded growth.** No retention/partitioning. | `admin-service/supabase/schema.sql` |
| M15 | **Schema drift.** `schema.sql` and `20250125000000_baseline.sql` are two sources of truth; RLS permissive on analytics; `unique(slug, domain_id)` allows NULL duplicates. | `admin-service/supabase/schema.sql`; `admin-service/supabase/supabase/migrations/20250125000000_baseline.sql` |
| M16 | **OpenSpec task status unreliable.** CHANGE-007/011 show 0% but are ~75–80% done; analysis doc stale. | `openspec/tasks.md`; `docs/analysis/openspec-implementation-analysis.md` |
| M17 | **E2E suite hangs.** `redir-engine/e2e-suite` did not complete; possible deadlock or timeout issue. | `redir-engine/e2e-suite` |
| M18 | **Weak CSP.** Allows `'unsafe-inline'` and `'unsafe-eval'` for scripts. | `admin-service/supabase/server/middleware/security.ts:33` |
| M19 | **Multi-domain routing not implemented.** `domainId` accepted in port methods but ignored. | `redir-engine/src/adapters/store/in-memory-store.ts` |
| M20 | **Analytics enrichment lives in Admin, not engine.** Engine sends only `user_agent`; device/geo parsing is server-side. | `redir-engine/src/adapters/analytics/...`; `admin-service/*/server/api/analytics/...` |
| M21 | **CSV bulk import missing.** Only JSON bulk import implemented. | `admin-service/supabase/server/api/links/bulk.post.ts` |
| M22 | **Advanced QR incomplete.** Basic QR works; logos/error-correction/storage missing. | `admin-service/supabase/app/pages/qr/...` |
| M23 | **Auto-alias generation partial.** Utility exists but OpenSpec flags it incomplete. | `@shared/utils/alias-generator` |

### 5.4 Low — Polish

| # | Issue | Notes |
|---|---|---|
| L1 | **Console logging** in engine/SSE client instead of structured logger. | Prefer the injected logger. |
| L2 | **`NODE_ENV` branching** in error handler leaks internal errors in dev mode only. | Acceptable but not ideal. |

---

## 6. Subsystem Deep Dives

### 6.1 redir-engine — Core / Cache / CF Worker / SSE

**Hot path:** The highlight of the codebase. `handle-request.ts` orchestrates cuckoo-fast-404 → store lookup → targeting/A-B/password/HSTS → fire-and-forget analytics with disciplined purity.

**Undermining issues:**
1. **Radix trie delete is a memory leak** (C10). The "radix tree" is actually an uncompressed trie with dead pruning code.
2. **Cache-eviction subsystem is inert** (H3). `CacheEvictionManager` evicts from its own bookkeeping map; `recordCacheAccess` is never called; metrics are misleading.
3. **SSE trust boundary has no validation** (H4). No Zod; uncaught `JSON.parse`.
4. **CF Worker runtime is a prototype** (H8). Per-request reconstruction, shipped test backdoors, dropped analytics.

**Coverage gaps:** `server.ts`, `sync-state.ts`, `cache-eviction.ts`, `SSESyncAdapter.ts`, `cache-metrics.ts`, `payload-builder.ts`, `fire-and-forget.ts`, `loadConfig` lack dedicated unit tests.

### 6.2 admin-service — Supabase

The mature variant. RLS on all tables, atomic `increment_analytics_aggregate()` RPC, Redis-backed rate limiting, Prometheus metrics, comprehensive indexes, `REPLICA IDENTITY FULL`, audit triggers.

**Shippable after fixing:** CORS fail-open (C8), strict-TS errors in `collect.post.ts`, client-settable `updated_at` in `patch.ts`, unbounded `perPage`, vacuous `try/catch` test pattern (H10), and adding retry/observability to KV sync (H2).

**Why not higher:** no SSE replay/snapshot (H1); analytics RLS intentionally permissive; in-memory monitoring metrics; no analytics retention; dashboard reads bypass the API layer.

### 6.3 admin-service — PocketBase

**Not production-ready.** Beyond the auth bypass (C1) and broken analytics (C5): non-existent `vue-router@5` (C6); in-memory rate limiter; no indexes/unique constraints; `httpOnly: false` login cookie (H16); no Zod on `register.post.ts`; explicit `any` in `realtime.ts:9`; out-of-order realtime; three env-var names for `PB_URL`; `pb_init.js` destructively recreates collections.

The non-analytics/non-links code is a reasonable copy of Supabase logic — it works as a **single-user local-dev deployment** today.

### 6.4 Infrastructure / CI / Observability

Strong intent (multi-stage non-root images, file secrets, retention policies, rollback templates, declarative observability) undermined by wiring defects that mean the deploy and TLS paths do not work (C2, C3, C4, H12) and absent hardening (no limits, no alerting, hardcoded Grafana pw, `:latest` tags, `trust` auth, no secret scanning, no SHA-pinned actions, no lint/coverage gate).

---

## 7. Consolidated Roadmap

### Phase 0 — Unblock Production (must-fix before any cutover)

1. **Fix Caddy upstream ports** → `admin:3000` / `engine:3000` (C2).
2. **Add `image:` fields** to `docker-compose.prod.yml` parameterized by `ADMIN_IMAGE_TAG`/`ENGINE_IMAGE_TAG` (C4, H12).
3. **Fix or disable CF Worker deploy** — add `[env.staging]`/`[env.production]` to `wrangler.toml` or remove the CI deploy step (C3).
4. **Remove `POSTGRES_HOST_AUTH_METHOD: trust`**; move Grafana pw to a file secret (C9, H17).
5. **Fix PocketBase `links` API rules** to `@request.auth.id = owner_id` (C1) — or explicitly deprecate the PocketBase variant for production.
6. **Make deploy health checks fail the job** on error (H12).
7. **Fix CORS fail-open** in Supabase `security.ts` — fail closed (C8).

### Phase 1 — Correctness & Durability

8. **Implement radix trie pruning** on delete (C10).
9. **Wire real validation at the SSE trust boundary** — introduce Zod in the engine and validate every inbound `RedirectRule` (H4).
10. **Make KV sync durable** — queue + retry + metric + alert (H2).
11. **Add SSE snapshot/replay** — `Last-Event-ID` + bulk-load endpoint (H1).
12. **Add graceful shutdown** to Node runtime — `SIGTERM`/`SIGINT` → drain → `shutdown()`/`stop()`/`stopMonitoring()` (H7).
13. **Fix or delete the cache eviction subsystem** (H3).
14. **Hash password-protection passwords** + use `crypto.timingSafeEqual` (H5).
15. **Fix Supabase test pattern** with `expect.assertions(n)` / `rejects.toThrow` (H10).

### Phase 2 — Hardening & CI Discipline

16. **Make `npm run lint` pass** and add it to CI; add `coverage.thresholds` to vitest configs (H13).
17. **Expand CI** to run PocketBase tests, system-e2e, perf benches; switch to `npm ci`; bump actions; SHA-pin third-party actions; add `concurrency` and `gitleaks`.
18. **Consolidate duplicated schemas** — make `admin-service/shared/utils/sanitizer.ts` the single source of truth.
19. **Adopt npm/pnpm workspaces** to kill dep-drift.
20. **Add compose hardening** — resource limits, `restart`, `read_only`, `cap_drop`; pin observability images; add Alertmanager; fix Grafana datasource `uid`; migrate Loki to `tsdb`.
21. **Add analytics retention/partitioning** + a shared secret on the ingestion endpoint (H15).

### Phase 3 — Feature Completion

- Re-sync OpenSpec `tasks.md` checkboxes (CHANGE-007, CHANGE-011); regenerate the stale analysis doc.
- Decide the fate of the PocketBase variant (invest to fix or formally mark dev-only).
- Resume suspended changes (CHANGE-012 distributed rate limiting, usage-quotas, CHANGE-013 RBAC/SSO) per `roadmap.md`.
- Fix the hanging E2E suite (M17).
- Implement multi-domain routing (M19) or remove the unused `domainId` parameter from the port.

---

## 8. Recommendations

### Immediate Actions (this week)

- Execute Phase 0 items C1, C2, C8, C9 first. These are one-line fixes that remove the largest security and availability blockers.
- Run `npm run lint` locally, fix the first batch of trivial violations, and add a CI job that runs it.
- Reproduce the E2E hang (M17) and decide whether it is a test bug or a product bug before the next sprint.

### Strategic Decisions

- **PocketBase variant:** Decide now whether to invest in fixing it or formally mark it as dev-only/single-user. It is not a near-term production option.
- **Cloudflare Worker:** Decide whether the CF edge is a current priority. If not, remove the broken CI deploy step until the runtime is hardened.
- **Monorepo structure:** Move to npm/pnpm workspaces and consolidate duplicated schemas before the codebase grows further.

### Observability & CI Guardrails

- Add a CI gate that fails on `npm run lint` failures.
- Add coverage thresholds to vitest configs and enforce them in CI.
- Add a secret-scanning step (`gitleaks` or `trufflehog`) to CI.
- Add Prometheus alerts for error rate, sync lag, and KV publish failures.

### Documentation Maintenance

- Keep `review.md` as the single living review. Update it after each major phase completion.
- Reconcile OpenSpec task status with reality so the roadmap is trustworthy.

---

## 9. Conclusion

| Dimension | Grade | Notes |
|---|---|---|
| Architectural vision & design | **A** | Hexagonal engine, dual-runtime, dual-backend, real performance data structures. |
| Core implementation (engine hot path) | **A−** | Clean, tested, fast; marred by inert cache and unpruning trie. |
| Admin (Supabase) | **B** | Solid; ~6–8 fixes to ship. |
| Admin (PocketBase) | **D** | Auth bypass + broken analytics + bad deps. |
| Infrastructure / CI / Ops | **C−** | Good bones, broken wiring, no hardening. |
| Test & spec maturity | **C+** | Strong in places, weak in others, unenforced. |

**Overall:** `url-redir-short` is a well-architected late-MVP / advanced pilot. The redirect hot path is genuinely excellent and could ship today behind a fixed TLS edge. The remaining work is operational and security hardening: the broken TLS edge, the PocketBase and Cloudflare Worker paths, the SSE durability story, and the CI/ops guardrails.

The highest-leverage action is **Phase 0** — it converts "broken in prod" into "shippable with caveats" in roughly a sprint, after which the Supabase+Node path is a credible production redirector.

---

## Appendices

### A. Independent Verification Notes

The following critical/high claims were spot-checked against the current source:

| Item | Claim | Verification | Result |
|---|---|---|---|
| C1 | PocketBase auth bypass | Read `admin-service/pocketbase/pb_migrations/1777556624_updated_links.js:7-11`. | ✅ Confirmed: all rules are `@request.auth.id != ""`. |
| C2 | Caddy wrong ports | Read `infra/caddy/Caddyfile:6,15,23` and `docker-compose.yml:59,73,99,108` and `docker-compose.prod.yml:24-28`. | ✅ Confirmed: Caddy targets `3001`/`3002` internally; containers listen on `3000`; prod overlay only resets host ports. |
| C3 | CF Worker missing envs | Read `redir-engine/runtimes/cf-worker/wrangler.toml`. | ✅ Confirmed: no `[env.*]` sections; vars are placeholders. |
| C8 | CORS fail-open | Read `admin-service/supabase/server/middleware/security.ts:56-62` and `docker-compose.yml:64`. | ✅ Confirmed: reflects origin and sets credentials-true; compose sets `CORS_ALLOWED_ORIGINS: "*"`. |
| C9 | Postgres trust | Read `docker-compose.yml:17`. | ✅ Confirmed: `POSTGRES_HOST_AUTH_METHOD: trust`. |
| H13 | Lint exists but not enforced | Read root `package.json:30` and `eslint.config.mjs`; checked CI workflow for `npm run lint`. | ✅ Confirmed: script exists; eslint installed at root; not invoked in CI. |
| M19 | Multi-domain ignored | Read `redir-engine/src/adapters/store/in-memory-store.ts`. | ✅ Confirmed: `domainId` accepted but not used. |

### B. Reconciliation of `z-review.md` vs `k-review.md`

| Dimension | More Credible Source | Reason |
|---|---|---|
| Security findings (auth, secrets, injection) | `z-review.md` | Found C1, C7, C9, H5, H16; `k-review.md` missed them. |
| Infrastructure / deploy / TLS | `z-review.md` | Found C2/C3/C4; `k-review.md` wrongly marked Caddy production-ready. |
| Engine correctness (radix prune, maxClicks, cache eviction) | `z-review.md` | C10, H3, H6; more precise and higher-severity. |
| Feature parity / product gaps | `k-review.md` | QR, CSV, multi-domain, alias, analytics-enrichment location. |
| Test/CI hygiene (E2E hang, lint) | `k-review.md` | E2E hang is k-only; both flagged lint, but `z-review.md` originally said no lint script existed. |
| Overall readiness verdict | `z-review.md` (corrected) | Both agree: not production-ready; Supabase+Node ~80% to launch. |

### C. Disposition of Partial Review Files

The partial review files (`z-review.md`, `k-review.md`, and `review-crosscheck.md`) have been removed. `review.md` is the single living document and should be updated as the project progresses.
