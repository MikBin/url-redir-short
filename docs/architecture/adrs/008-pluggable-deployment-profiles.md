# ADR-008: Pluggable Deployment Profiles for a Variant-Invariant Security Model

**Status:** Accepted
**Date:** 2026-09-30
**Deciders:** Project Team
**Relates to:** ADR-007 (public-share-shortener pivot), ADR-005 (dual admin service), `docs/analysis/cloudflare-vs-vps.md`

---

## Context

ADR-007 makes PocketBase-on-a-VPS-behind-Cloudflare the active stack for `public-share-shortener`. But the platform is explicitly multi-variant by design: the postponed SaaS direction resumes on Supabase+CF, dev/staging hosts may run PocketBase on a tailnet with no public ingress, future usage cases may add more users and different ingress combinations. The security posture for the active stack (trust tiers for operator / app backends / edge Worker / anonymous clients, lock-by-default data plane, admin-surface isolation, abuse-controlled public create) was agreed on 2026-09-30 but existed only as conversation — it would fork per variant and rot.

We need the security architecture to be **flexible and pluggable** without being ad hoc: one trust model, many implementations.

## Decision

1. **The trust model is defined once and is variant-invariant.** `docs/deployment/security-model.md` is the authoritative model: actor tiers (T0 operator, T1 first-party services, T2 edge runtime, T3 anonymous), a trust matrix, five enforcement layers (host, edge, identity/authorization, application, operations), and seven non-negotiable invariants (origin never publicly reachable; lock-by-default data plane; T2's read path is structurally read-only; only T0 changes authorization; the sole public write sits behind the abuse stack; trustworthy client IP end-to-end; rate limits + fail-closed CORS + strict TLS everywhere).

2. **Concrete stacks implement the model as named deployment profiles** documented as `docs/deployment/security-profile-*.md`, registered in the model's profile registry. Each profile follows the profile contract: ingress topology, per-actor enforcement map, secrets inventory, verification drills, degradation behavior.

3. **`pocketbase-vps-cf` is the first profile** and is binding for `public-share-shortener` (tasks 1.1, 1.2, 2.1, 2.8, 4.3, 4.4 implement against it). `supabase-cf` and `pocketbase-tailnet` are reserved registry entries with sketches in the model document.

4. **Profiles may strengthen the invariants, never weaken them.** A stack that cannot satisfy a layer's responsibilities (e.g. an ingress without WAF-equivalent controls) is restricted to non-public usage.

5. **New usage cases extend the model, they do not fork it.** More users (SaaS) insert a tenant tier between T3 and T1 and change only the authorization layer (owner-scoped rules/RLS — the postponed C1 model); new stacks enter as new profiles; L0/L1 responsibilities are shared across all of them.

## Consequences

**Positive:**
- Security guidance for every current and future variant lives in exactly two places: the model (invariants) and one profile per stack (enforcement) — reviewable, drillable, no per-variant folklore.
- The postponed Supabase path reuses the edge/host layers unchanged and swaps only identity/authorization technology; resuming it cannot silently weaken the posture.
- Onboarding app #4 (ADR-007 goal) stays configuration-only; the profile's T1 tier grows a `services` row, not new architecture.
- Verification drills become part of the change's §6 gate, so "secure by deployment" is tested, not assumed.

**Negative:**
- Every new stack pays the profile-documentation cost before production exposure.
- The model document becomes a governance-critical artifact: changes to it require the same review discipline as ADRs.
- Some profile content (Cloudflare Access specifics, PocketBase version capabilities) can drift with upstream releases and is dated — the monthly ops cadence in the profile owns keeping it current.
