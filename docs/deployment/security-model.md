# Backend Security Model (Variant-Invariant)

> **Status:** Authoritative — every deployment profile MUST implement this model.
> **Decision record:** ADR-008. **Product context:** ADR-007 (public-share-shortener).
> Concrete implementations live in profile documents: `security-profile-*.md` in this directory.

This document defines the trust model **once**, independent of any particular backend stack. PocketBase-on-VPS, Supabase-behind-Cloudflare, or any future stack all implement the *same trust boundaries* with *different enforcement technology*. The model never forks per variant; only profiles do.

---

## 1. Actors and Trust Tiers

| Tier | Actor | May do | Must never be able to |
|------|-------|--------|----------------------|
| **T0** | Operator (admin human) | Everything: administer data, change authorization rules, operate kill switches | — (smallest possible group; MFA mandatory) |
| **T1** | First-party services (app backends) | Scoped programmatic writes on the data plane via their own identity | Hold T0 credentials; alter authorization rules; bypass validation/abuse layers |
| **T2** | Edge runtime (redirect Worker) | Read-only resolution lookups via a purpose-built endpoint | Write anything, anywhere, through any path |
| **T3** | Anonymous clients | Create links through the single public create endpoint, passing the full abuse-control stack | Touch the data plane (collections/tables) directly; enumerate slugs |
| — | Everyone / everything else | Nothing | Everything |

Adding actors later (e.g. tenant users for the postponed SaaS direction) means **inserting a new tier and mapping it in the matrix** — not redesigning the model (see §6).

## 2. Trust Matrix

| Actor | Admin surface | Data-plane writes | Data-plane reads | Public endpoints |
|-------|---------------|-------------------|------------------|------------------|
| T0 Operator | Full (UI + API) | Full | Full | — |
| T1 App backend | None | Scoped by rule (named collections/tables only) | Scoped by rule | — |
| T2 Edge Worker | None | **None — structurally impossible** | Resolve-only via read-only endpoint | — |
| T3 Anonymous | None | Create endpoint only (Turnstile + quota + breaker + destination allowlist) | None | Create, and resolve-by-click through the edge |
| Unclassified | None | None | None | None |

## 3. Enforcement Layers

Every profile must satisfy each layer's responsibilities. The *technology* varies by stack; the *responsibility* does not.

| Layer | Responsibility | Invariant rules |
|-------|----------------|-----------------|
| **L0 — Host** | The data-plane origin is never directly reachable from the public internet | Only the designated ingress (proxy/tunnel) may reach the origin process; origin binds to localhost/private interface; host firewall denies all other inbound |
| **L1 — Edge / Ingress** | TLS termination, path-level access control, outer rate limiting, trustworthy client IP | TLS end-to-end (no "flexible" modes); admin paths restricted to T0 by identity or IP; rate rules in front of every public endpoint; real client IP (`CF-Connecting-IP` or equivalent) propagated for quota keys |
| **L2 — Identity & Authorization** | Per-actor identities, least-privilege data access | **Lock-by-default**: every collection/table denies everything unless a rule explicitly grants it, and every grant names its actor tier; no shared credentials across tiers; only T0 can change authorization; T2's read path is a purpose-built read-only route, never the general data API |
| **L3 — Application** | Self-defending public endpoints | The only public write is the create endpoint, behind the full abuse stack (CAPTCHA/Turnstile, per-IP daily quota, circuit breaker, first-party destination allowlist, random unguessable slugs); CORS fails closed; everything rate-limited |
| **L4 — Operations** | Survive incidents | Daily backups with off-box copies and a tested restore; documented update cadence; audit/admin logs retained; documented takedown and kill-switch procedures |

## 4. Model Invariants (the non-negotiables)

1. The origin has **no public inbound port** — reachable only through the edge ingress (L0).
2. **Lock-by-default** data plane; every grant names its tier (L2).
3. T2 (edge runtime) gets **read-only semantics structurally** — its only route has no write operations — not merely "no write permission" (L2).
4. **Only T0 changes authorization.** A leaked T1 credential must not be able to widen anyone's access (L2).
5. The only public write path is the **abuse-controlled create endpoint** (L3).
6. Client IPs used for quotas are **trustworthy end-to-end** (L1).
7. Rate limits and fail-closed CORS on every public surface; TLS with verified origin certificates throughout (L1/L3).

Profiles **may strengthen** these (e.g. zero-inbound tunnels, hardware-backed operator auth) but **never weaken** them.

## 5. The Profile Contract

A **deployment profile** is a named, documented implementation of this model on a concrete stack. Each profile document MUST provide:

1. **Ingress topology** — diagram + description of how L0/L1 are satisfied.
2. **Per-actor enforcement map** — every row of the trust matrix (§2) mapped to the concrete mechanism that enforces it (firewall rule, WAF expression, collection rule, RLS policy, custom route, …).
3. **Secrets inventory** — every secret the profile introduces, who holds it, and its rotation expectation.
4. **Verification drills** — negative tests proving each "Must never" cell actually fails closed, plus the positive paths.
5. **Degradation behavior** — what works and what fails when each component (edge, origin, tunnel) is down.

### Profile Registry

| Profile | Stack | Status | Document |
|---------|-------|--------|----------|
| `pocketbase-vps-cf` | PocketBase on VPS behind Cloudflare proxy | **Active** — required by `public-share-shortener` (ADR-007) | [`security-profile-pocketbase-cf.md`](security-profile-pocketbase-cf.md) |
| `supabase-cf` | Supabase behind Cloudflare | **Reserved** — postponed SaaS direction (ADR-007 §8) | — (sketch in §6) |
| `pocketbase-tailnet` | PocketBase on a tailnet, no public ingress | **Reserved** — admin-only/dev/staging host | — |

New stacks (including combinations not yet imagined) enter the registry as new profiles; they do not edit this model except through the ADR/review process.

## 6. Extending the Model to Future Cases

### More users (postponed SaaS direction)

Insert a **T-tenant tier** between T3 and T1: authenticated end users who own their links. Only L2 changes — authorization becomes owner-scoped (Supabase RLS or PocketBase owner rules, the postponed C1 `user = @request.auth.id` model) — while L0/L1/L3/L4 and every other tier boundary stay as-is. The trust matrix grows a row; no row is rewritten.

### `supabase-cf` sketch (reserved)

- **L0/L1: identical** to `pocketbase-vps-cf` (CF proxy, Access on the admin host, WAF rate rules) — the edge does not care what sits behind it.
- **L2:** identities = Supabase auth; authorization = RLS policies per table (lock-by-default translates to "no permissive policies; service-role key used only server-side"); the edge runtime's read path = a Postgres REST/Edge-Function view restricted to resolve semantics.
- **T0 surface:** Supabase dashboard host placed behind CF Access instead of PocketBase `/_/`.
- **L3:** an Edge Function replicating the create-endpoint abuse stack (Turnstile verify, per-IP quota, breaker, allowlist).

### Non-Cloudflare ingress

A profile without Cloudflare must supply equivalents for TLS, WAF/rate limiting, and a trustworthy client IP before it may host public endpoints. If an ingress cannot provide them, that profile is restricted to non-public usage (like `pocketbase-tailnet`).

## References

- ADR-007 — product pivot and abuse model (`docs/architecture/adrs/007-public-share-shortener.md`)
- ADR-008 — pluggable deployment profiles decision (`docs/architecture/adrs/008-pluggable-deployment-profiles.md`)
- ADR-005 — dual admin-service history (`docs/architecture/adrs/005-dual-admin-service.md`)
- Active profile: [`security-profile-pocketbase-cf.md`](security-profile-pocketbase-cf.md)
