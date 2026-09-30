# public-share-shortener — Tasks

> **Priority:** sole active goal per `openspec/roadmap.md` (2026-09-30 pivot). All other active changes are postponed until this ships. Governing decision: ADR-007.

## 1. PocketBase Foundation (gating fixes)

- [ ] 1.1 Fix C1: rewrite all `links` collection rules to owner scope (`user = @request.auth.id` for read/update/delete; create requires authenticated owner or the anonymous-create route) in `pb_migrations` — never `@request.auth.id != ""`
- [ ] 1.2 Fix H16: set `httpOnly: true` on the login cookie in `admin-service/pocketbase/server/api/auth/login.post.ts`
- [ ] 1.3 Remove the broken analytics endpoints and collections (C5): delete `server/api/analytics/**` writes to the absent `analytics_aggregates`; click analytics move to Analytics Engine (Task 3.4)
- [ ] 1.4 Create `apps` registry collection: `app_id`, `share_host`, `allowed_host`, `url_template` (map of type → template), `daily_create_limit` (default 100), `active`; seed rows for macrolattice, supatrainer, azurechip
- [ ] 1.5 Extend `links` collection: `app` (relation), `slug` (unique per app), `content_ref` (JSON), `destination_url`, `expires_at`/`last_click_at` (nullable), `created_from_ip` (hashed)
- [ ] 1.6 Make `pb_init.js`/migrations idempotent (no destructive recreation); fix watch-mode test script (`package.json`)
- [ ] 1.7 Unit tests: rules enforce owner scope (cross-user CRUD rejected); registry seed validates

## 2. Anonymous Create Path (PocketBase)

- [ ] 2.1 Create `POST /api/share/create` route: accepts `{ appId, type, contentId, params }`; anonymous-safe; CORS restricted to the three app origins (fail closed — C8 lesson)
- [ ] 2.2 Implement template renderer + **authoritative allowlist validator** (pure function): canonicalize URL, exact-match `allowed_host`, reject non-HTTPS, IP literals, userinfo, punycode homographs, known-shortener destinations, length > 2048 — with unit tests for every rejection case (spec scenarios)
- [ ] 2.3 Implement Turnstile verification in the before-create hook via `$http.send` → `turnstile/v0/siteverify`; reject 403 on missing/invalid/replayed token; unit-test the siteverify response handling (mock `$http.send`)
- [ ] 2.4 Implement per-IP daily quota keyed by `CF-Connecting-IP` + `app_id` against `daily_create_limit`; return 429 with reset time; unit tests at/below limit and per-app isolation
- [ ] 2.5 Implement circuit breaker: `system_config` flag `public_creation_paused` checked before all create work (503 when set); daily job trips it when creates exceed N× trailing baseline; admin can reset via PB UI
- [ ] 2.6 Implement slug generator: random ≥7 chars, 62-alphabet, collision retry against existing keys; ignore any client-supplied slug; entropy/collision unit tests
- [ ] 2.7 Port the KV publisher to a PocketBase hook (`$http.send`, from `admin-service/supabase/server/utils/cloudflare-kv.ts`): writes/deletes `${share_host}:${path}` keys on create/delete; failures logged with counter (not silent)
- [ ] 2.8 Create public `GET /api/share/resolve?host=&path=` (read-through fallback source): returns destination or 404; rate-limited; only exposes existing slugs
- [ ] 2.9 Idempotency: same `(app, canonical destination)` returns the existing short URL instead of creating a duplicate
- [ ] 2.10 E2E tests: create → PB record → KV key present → resolve returns destination; Turnstile/quota/breaker rejections return correct status codes

## 3. Edge Runtime (Cloudflare Worker)

- [ ] 3.1 Fix C3: real `wrangler.toml` — KV namespace id, `[vars]`, route patterns for `sh.macrolattice.com/*`, `sh.supatrainer.com/*`, `sh.azurechip.com/*`; replace CI deploy with a documented `wrangler deploy` (or fix the workflow's `workingDirectory`)
- [ ] 3.2 Fix H8: hoist app/use-case/store construction to module scope per isolate; remove `/_test/inject` and `/_test/clear` from production builds
- [ ] 3.3 Host-keyed lookup: resolve `Host` header → KV key `${host}:${path}` (uses existing `CloudflareKVStore` key format); unit tests for host routing and same-slug independence
- [ ] 3.4 Analytics Engine adapter implementing `IAnalyticsCollector`: `writeDataPoint` per click (blobs: share_host, slug, country, UA class) wired via `ctx.waitUntil`
- [ ] 3.5 Read-through fallback: on KV miss call `/api/share/resolve`, on hit `kv.put` and redirect; on confirmed miss 404; never blocks redirects on PB beyond the fallback path
- [ ] 3.6 Write create-side data points (share_host, hashed IP) from the PocketBase create route to the same dataset
- [ ] 3.7 Worker tests: routing, fallback, 404, waitUntil wiring (miniflare/vitest-pool-worker)

## 4. Lifecycle, Abuse & Ops

- [ ] 4.1 Daily PocketBase cron (`cronAdd`): purge links with zero clicks in 30 days (`last_click_at`/`created`) and delete their KV entries; idempotent
- [ ] 4.2 Circuit-breaker baseline job: compute trailing 7-day create baseline, trip at N× (env-configurable), notify via PB admin log
- [ ] 4.3 Cloudflare config: WAF rate rule on the create endpoint per `CF-Connecting-IP` (e.g. 10/min burst, aligns with daily quota), Turnstile widget, KV namespace, PB host proxied (orange cloud) for real client IP
- [ ] 4.4 PocketBase ops: built-in ZIP backup on daily cron with off-box copy; admin 2FA enabled; document restore steps
- [ ] 4.5 Anomaly dashboard: Analytics Engine queries for creates/day per app, unique-IP ratio, destination-host cardinality; weekly export documented
- [ ] 4.6 Runbook: takedown a link (PB delete → KV delete → optional WAF block during propagation), trip/reset breaker, onboard app #4 (route + registry row checklist), PB-down behavior (creates fail, clicks live)

## 5. Client Contract (documentation, apps live outside this repo)

- [ ] 5.1 Document the create API contract (request/response, status codes 400/403/429/503) and the Zod pre-validation expectation per app
- [ ] 5.2 Document Turnstile integration per platform: web/Capacitor render the widget directly; React Native embeds it via WebView
- [ ] 5.3 Document share-flow latency budget (one create round trip on share tap) and PB-down degradation behavior

## 6. Verification Gate

- [ ] 6.1 All new unit/E2E tests green in CI; PocketBase suite extended to cover rules, hooks, and quotas
- [ ] 6.2 Load-shape sanity check: scripted create flood (Turnstile-invalid, quota-exceeding, breaker-tripping) against staging confirms 403/429/503 paths and that clicks remain unaffected while tripped
- [ ] 6.3 Fresh-link UX check: create → immediate click from a different network resolves via read-through (no 404)
- [ ] 6.4 Onboarding drill: add a throwaway 4th host end-to-end (route + row) with zero code changes, then remove it
