# ADR-007: Anonymous First-Party Share Shortener on Cloudflare Edge with PocketBase Backend

**Status:** Accepted
**Date:** 2026-09-30
**Deciders:** Project Team
**Supersedes (for this product direction):** the "park the Workers runtime" stance in `docs/analysis/cloudflare-vs-vps.md` §9, and the PocketBase-dev-only ambiguity flagged in ADR-005 discussions.

---

## Context

The platform's next goal is no longer a multi-tenant shortener SaaS. It is **invisible share infrastructure for the owner's own applications** (macrolattice.com, supatrainer.com, azurechip.com — web plus React Native/Capacitor where applicable, local-first, no app backend). Users tap "share recipe/workout/screen" and receive a short URL on the app's `sh.<app-domain>` host; the shortener is never user-visible as a product.

Requirements settled through the 2026-09-30 analysis series (`docs/analysis/cloudflare-vs-vps.md` and the follow-up decisions):

- Creation is **anonymous** (no login anywhere in the flow) but restricted to **first-party destinations only** ("Mode A"). This is the decision that makes an anonymous public endpoint acceptable: the worst case is junk links pointing at our own app pages.
- One shortener service backs all apps; onboarding a 4th app must be configuration (one registry row + one Cloudflare route), not code.
- Apps are local-first with no backend, so the shortener's create API is called directly from web/mobile clients and must be self-defending.
- Owner prefers not to use Supabase for this goal; PocketBase becomes the single backend (auth-free for end users, built-in admin UI for ops).

Related findings this decision must respect: C1 (PocketBase cross-tenant bypass), C3/H8 (CF Worker deploy/runtime prototype state), C5 (broken PocketBase analytics), H16 (`httpOnly: false`), M19 (multi-domain routing unimplemented in the engine).

## Decision

1. **Abuse model: "Mode A" — anonymous creation + strict first-party allowlist.** Only destinations on an app's own host (`macrolattice.com`, `supatrainer.com`, `azurechip.com`, …) may be shortened, enforced server-side on every create. Arbitrary external URLs are rejected (Mode C) and remain out of scope. Login-gated creation (Mode B) is postponed, not abandoned.
2. **Clients send content references, not URLs.** The create API receives `{ appId, type, contentId, params }`; the server renders the destination from a per-app URL template stored in the registry. Apps additionally pre-validate their URL structures client-side with Zod (contract documented; server never trusts it). This preserves "no user-supplied URL" without needing an app backend.
3. **Edge runtime is the primary redirect path:** one Cloudflare Worker, multi-zone routes `sh.<app-domain>/*`, one KV namespace. **Routing is host-keyed**: KV keys are `sh.<host>:/<slug>` and the Worker resolves by `Host` header. This deliberately sidesteps M19 (engine-level multi-domain routing) entirely.
4. **PocketBase is the single backend** (source of truth for links + app registry + abuse controls), fronted by Cloudflare proxy (orange cloud) for TLS/WAF/per-IP rate rules. Fixing C1 (owner-scoped collection rules) and H16 is a gating task of this path. The broken PocketBase analytics pipeline (C5) is deleted, not fixed — click analytics move to Workers Analytics Engine.
5. **Layered abuse controls** (all mandatory before public exposure):
   - *Layer 1 — make bots expensive:* Cloudflare Turnstile verified inside the PocketBase before-create hook; CF WAF rate rule per `CF-Connecting-IP` on the create endpoint; per-IP daily quota of **100 creates/day/app** (a normal user shares far fewer than 100 recipes or workouts; configurable per app); global circuit-breaker flag (`public_creation_paused`) auto-set when daily volume exceeds a multiple of baseline.
   - *Layer 2 — make junk self-destruct:* anonymous links auto-expire after 30 days without clicks (daily PocketBase cron purges); random unguessable slugs only (no custom slugs); strict destination validation (HTTPS only, no IP literals, no IDN homographs, no userinfo, reject chains through other shorteners); client-side Zod pre-validation as UX, server validation as authority.
   - *Layer 3 — see it and stop it:* create events written to Workers Analytics Engine (host, hashed IP) for anomaly detection (creates/minute spike, unique-IP ratio collapse, destination-host entropy); circuit breaker + PocketBase admin UI as the kill switch / takedown path.
6. **Fresh-link consistency:** the Worker falls back to a PocketBase resolve endpoint on KV miss (read-through) so a recipient clicking a link seconds after creation does not get a 404 during KV propagation.
7. **Analytics:** one Workers Analytics Engine dataset for clicks and creates across all apps, with share host and slug as dimensions. Supabase-stack click ingestion (H15 surface) is not used for this goal.
8. **Everything else is postponed.** The Supabase multi-tenant SaaS path, its Phase 0 hardening, CSV import, QR branding, RBAC/SSO, quotas-for-SaaS, and multi-platform runtime templates remain on the roadmap as postponed. The CF Worker CI deploy fixes (C3) land as part of this path.

## Consequences

**Positive:**
- Anonymous share UX with zero login friction, achieved without opening the phishing/malware floodgates that destroyed the reputation model of Mode C.
- Adding app #4 is one registry row + one CF route — no code, no engine changes (host-keyed KV is the routing).
- One backend (PocketBase), one edge Worker, one analytics dataset, one admin UI (PocketBase's built-in) — minimal operational surface.
- Clicks keep working even if PocketBase is down; only new creates fail (graceful degradation).
- The hexagonal engine core (ADR-002) is reused via existing ports (`IRedirectStore` KV adapter, new `IAnalyticsCollector` adapter for Analytics Engine).

**Negative:**
- KV is eventually consistent (~seconds, officially up to 60 s) — mitigated but not eliminated by the read-through fallback; one subrequest per cold miss.
- PocketBase is single-node SQLite; create-side scale ceiling accepted (creates are rare human actions; clicks scale at the edge and never touch PocketBase).
- Owner operates the PocketBase host (patching, backups via built-in ZIP cron, uptime of the *create* path only).
- Turnstile requires a web context: trivial for web/Capacitor, needs an embedded WebView for React Native.
- Anonymous quota keys are soft (IP-based; `CF-Connecting-IP` is reliable only because everything sits behind the CF proxy); acceptable because the allowlist bounds all damage to first-party pages.
- Postponed SaaS-path defects (C2, C4, C9, H12, …) remain open and must be re-prioritized if/when that direction resumes.
