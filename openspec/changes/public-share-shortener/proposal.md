## Why

The platform's next goal is invisible share infrastructure for the owner's own applications (macrolattice.com, supatrainer.com, azurechip.com — local-first, web + mobile, no app backend). Users tap "share recipe/workout/screen" and get a short URL on the app's `sh.<app-domain>` host. Creation is anonymous (no login anywhere) but safe: destinations are restricted to first-party hosts ("Mode A", ADR-007), so the worst-case abuse is junk links to our own pages. This change supersedes all other active changes in priority — everything else is postponed until it ships.

## What Changes

- New deployment goal: **one Cloudflare Worker** (multi-zone routes `sh.<app-domain>/*`) + **one KV namespace** (host-keyed `sh.<host>:/<slug>`) + **Workers Analytics Engine** (clicks and creates) as the redirect hot path — the Node/VPS path and Supabase admin stack are not used for this goal
- **PocketBase becomes the single backend**: app registry, link records, abuse controls, built-in admin UI for ops/takedowns; fronted by Cloudflare proxy (orange cloud) for TLS/WAF/real client IP
- New `apps` registry collection: per-app `app_id`, `share_host`, `allowed_host`, `url_template`, `daily_create_limit` (default 100) — adding a 4th app is one row + one CF route, zero code
- New anonymous **content-reference create endpoint**: clients POST `{ appId, type, contentId, params }`; the server renders the destination URL from the app template and enforces the first-party allowlist (clients also pre-validate URL structure with Zod; the server never trusts it)
- Layered abuse controls: Cloudflare Turnstile (verified in the PocketBase before-create hook), CF WAF rate rule per `CF-Connecting-IP`, per-IP daily quota (100/day/app default), global circuit breaker (`public_creation_paused`), 30-day no-click auto-expiry via daily cron, random unguessable slugs only
- Worker hardening per ADR-007: real `wrangler.toml` envs/routes (fixes C3), module-scope initialization, `ctx.waitUntil` on analytics, removal of `/_test/*` backdoors, KV read-through fallback to a PocketBase resolve endpoint for fresh links (fixes the KV propagation gap)
- PocketBase variant fixes gating this change: C1 owner-scoped `links` rules, H16 `httpOnly` fix, port of the KV publisher (`cloudflare-kv.ts`) to a PocketBase hook using `$http.send`, deletion of the broken analytics endpoints (C5 — click analytics move to Analytics Engine)

## Capabilities

### New Capabilities

- `public-share-shortener`: Anonymous first-party share shortening — content-reference create API with template rendering, first-party allowlist, Turnstile + per-IP quota + circuit breaker, host-keyed edge routing, read-through fallback, auto-expiry, and create/click analytics via Workers Analytics Engine.

### Modified Capabilities

- None (all existing specs belong to the postponed multi-tenant SaaS direction; this change deliberately adds a separate capability rather than modifying those specs).

## Impact

- **PocketBase schema**: new `apps` registry collection; `links` rules rewritten to owner-scope (C1 fix); new fields (`app`, `slug`, `content_ref`, `expires_at`, `last_click_at`); broken analytics collections/endpoints removed (C5)
- **New endpoints (PocketBase)**: anonymous create (content-reference, Turnstile-gated), public resolve (read-through fallback, rate-limited), KV publisher hook on create/update/delete
- **Worker runtime**: `runtimes/cf-worker/` productionized — config, hoisted init, Analytics Engine adapter at the `IAnalyticsCollector` port, read-through on KV miss, test backdoors removed; CI deploy path fixed or replaced by documented `wrangler deploy`
- **New env/secrets**: Turnstile site key/secret, CF KV credentials for PocketBase, per-app `daily_create_limit`, circuit-breaker threshold
- **Client contract (documented, not code in this repo)**: each app pre-validates its share URL structure with Zod before calling create; web/Capacitor render the Turnstile widget directly, React Native embeds it in a WebView
- **Cloudflare config**: KV namespace, multi-zone routes per `sh.<app-domain>`, WAF rate rule, Turnstile widget; PocketBase host proxied (orange cloud) for `CF-Connecting-IP`
- **Postponed**: all other active changes (see `openspec/roadmap.md` priority pivot) — the Supabase SaaS path, its Phase 0 hardening, CSV, QR, RBAC/SSO, quotas-for-SaaS, multi-platform templates
- **Estimated effort**: ~7–10 focused days (backend 3–4, edge 2–3, per-app client wiring ~1 day each)
