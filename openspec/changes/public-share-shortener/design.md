## Context

The 2026-09-30 product pivot (ADR-007) re-targets the platform as invisible share infrastructure for the owner's own applications (macrolattice.com, supatrainer.com, azurechip.com — local-first, web + mobile, no app backend), instead of the postponed multi-tenant shortener SaaS. Creation is anonymous and open to anyone, which is only acceptable because destinations are restricted to first-party hosts. The existing assets this design builds on: the hexagonal engine core with `IRedirectStore`/`ISyncManager`/analytics ports (ADR-002), the CF Worker runtime prototype and `CloudflareKVStore` (ADR-004), the Supabase KV publisher (`cloudflare-kv.ts`), and the PocketBase admin variant (whose critical defects C1/C5/H16 must be fixed or deleted, not carried forward).

Constraint set from the decision series (`docs/analysis/cloudflare-vs-vps.md` and follow-ups): no Supabase dependency, no login anywhere in the user-visible flow, apps must not hold API secrets, a 4th app must onboard without code changes, and the abuse model must survive anonymous creation.

## Goals / Non-Goals

**Goals:**
- Anonymous "share meal/workout/screen" → short URL on the app's `sh.<app-domain>`, in one round trip, with no login UI
- First-party destinations only, enforced server-side on every create
- Bot/flood resistance via layered controls (Turnstile, per-IP quota, circuit breaker) and junk self-destruction (auto-expiry)
- One backend (PocketBase), one Worker, one analytics dataset across all apps
- Onboarding app #4 = one registry row + one CF route, zero code

**Non-Goals:**
- Shortening arbitrary external URLs ("Mode C") — rejected for reputation risk; revisit never implies reopening without a new ADR
- Login-gated creation ("Mode B") — postponed, not abandoned; the create API shape must not preclude adding it
- Click-based expiration and per-link 301/302 (FR-36/37, FR-50/51) — out of scope; specs corrected to ⚠️/❌
- Any work on the postponed Supabase SaaS path (Phase 0 hardening, CSV, QR, RBAC/SSO)
- Real-time analytics dashboards in-app; Analytics Engine SQL queries suffice initially

## Decisions

### Decision 1: Anonymous creation restricted to first-party allowlist ("Mode A")
**Chosen:** Anyone may create, but only destinations on the app's own `allowed_host` (rendered from templates) are accepted. Worst case is junk links to our own pages.
**Alternatives:** Login-gated creation (Mode B) — safer quotas but adds friction and an identity provider to no-backend apps; postponed. Open arbitrary shortening (Mode C) — rejected: abused shorteners land on Safe Browsing/messenger blacklists within days, which would break sharing for all three apps at once; short links also carry ~no backlink/SEO value, so the upside does not price the risk.

### Decision 2: Clients send content references, not URLs
**Chosen:** Create API accepts `{appId, type, contentId, params}`; the server renders the destination from a per-app `url_template` stored in the registry. Client-side Zod pre-validation is documented contract and UX only — the server never trusts it.
**Alternatives:** Client-submitted URL + strict validator — simpler clients, but trust rests entirely on the validator and template changes require app updates. App-backend-mediated creation — rejected: the apps are local-first with no backend by design.

### Decision 3: Host-keyed KV routing on a single Worker
**Chosen:** One Worker serves all `sh.<app-domain>` zones via route patterns; KV keys are `${host}:${path}` and lookups key off `new URL(request.url).hostname`. Multi-domain routing is realized by the key namespace itself.
**Alternatives:** Implement engine-level multi-domain routing (M19, `domainId` through the engine) — unnecessary scope; the host prefix achieves per-domain isolation with zero engine changes. One Worker + one KV namespace per app — stronger blast isolation at the cost of N deployments and N bindings; acceptable fallback if a single namespace ever becomes a contention or cleanup problem.

### Decision 4: PocketBase as the single backend, behind the CF proxy
**Chosen:** PocketBase (single binary, SQLite) holds the `apps` registry, `links`, and abuse-control state; its built-in admin UI is the ops pane; Cloudflare proxy (orange cloud) in front provides TLS, WAF, rate rules, and a trustworthy `CF-Connecting-IP` for quota keys.
**Alternatives:** Supabase (cloud or self-hosted Postgres) — rejected for this goal per owner preference and to avoid a second platform dependency; the Supabase code path stays available for the postponed SaaS direction. A Worker+D1 zero-server create path — fewest moving parts but diverges furthest from the repo and loses the free admin UI; noted as a possible future migration since the create API is thin.

### Decision 5: Layered abuse controls, each placed at its cheapest enforcement point
**Chosen:** Turnstile verified in the PocketBase before-create hook (bots pay before touching quota or KV); CF WAF rate rule per `CF-Connecting-IP` (blunt outer layer); per-IP daily quota of 100/app in the hook (a normal user shares far fewer than 100 meals or workouts); `public_creation_paused` circuit breaker tripped by a baseline-deviation job (clicks unaffected while tripped); 30-day no-click auto-expiry via daily cron (destroyed stockpiles and bounded junk); random ≥7-char slugs (no enumeration, no brandjacking).
**Alternatives:** Durable-Object counters or per-request edge rate limiting — rejected as over-engineering for a create path driven by humans tapping Share. Relying on CF controls alone — rejected: the hook is the only place with app-aware limits and the kill switch.

### Decision 6: Read-through fallback instead of durable KV publish
**Chosen:** On KV miss the Worker queries a rate-limited PocketBase resolve endpoint, populates KV, and redirects. Local dev exploits this by default (publisher off → every click exercises the fallback).
**Alternatives:** Making the KV publisher durable (queue + retry, H2's hardening) — worthwhile but doesn't close the ~60 s cross-PoP propagation window, which only a read path can close. Durable Objects as source of truth — new runtime dependency, unnecessary at this scale.

## Risks / Trade-offs

- **KV eventual consistency** → mitigated by read-through, never eliminated; one extra subrequest per cold miss per PoP.
- **Anonymous quota keys are IP-based** → soft limits (IP rotation, shared NATs penalize innocents); acceptable because the allowlist bounds all damage to first-party pages.
- **PocketBase single-node** → create-path ceiling and an ops box to run (ZIP backup cron, patching); acceptable because creates are rare human actions and clicks never touch PocketBase.
- **Turnstile needs a web context** → trivial for web/Capacitor, requires an embedded WebView in React Native; documented in the client contract.
- **Registry templates become runtime-critical config** → a bad `url_template` breaks sharing for that app at create time; mitigate with template validation tests on registry save.
- **Create-IP handling is contract-pinned (A2)** → `links.created_from_ip` stores a salted SHA-256 hash (lowercase hex, ≤64 chars) of the client IP keyed by the stored `IP_HASH_SALT`, never the raw IP. PocketBase migrations cannot hash, so the create-path hook (§2.1/§2.4) owns the write and the §6.1 gate asserts that no unhashed value lands; `fnv1a64` (cache-key hashing) is explicitly not acceptable for this field.
- **Postponed-path defects remain open** → C2/C4/C9/H12 etc. stay unfixed while the SaaS direction is frozen; re-scope on resume.

## Migration Plan

1. PocketBase foundation (Tasks §1): C1 rules fix, H16, delete broken analytics, `apps` registry + `links` extension — additive migrations, no existing data to carry
2. Create path (§2) against PocketBase locally (Turnstile test keys, publisher off)
3. Worker productionization (§3) in `wrangler dev`, then a free `*.workers.dev` preview with a `cloudflared` tunnel to local PocketBase
4. Abuse lifecycle + ops (§4): cron jobs, WAF rule, backups, runbook
5. Per-app client wiring (§5 contract docs) and the §6 verification drills (flood, fresh-link, 4th-app onboarding)

Rollback: each phase is additive; disabling the create endpoint's route stops new links while existing ones keep redirecting from KV.

## Open Questions

- Expiry: fixed 30 days from creation vs 30 clickless days (current choice)? Confirm with first real usage data.
- Should the resolve endpoint be served by PocketBase directly or replicated to a second tiny Worker for availability during PocketBase restarts?
- Per-app `daily_create_limit` tuning: start uniform at 100 or differentiate (meals vs workouts vs screens) from day one?
- When (if ever) does `usage-quotas` (postponed) subsume this quota mechanism, and should the hook interface be shaped now to make that merge trivial?
