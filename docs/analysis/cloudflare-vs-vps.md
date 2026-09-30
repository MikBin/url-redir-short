# Cloudflare (Edge) vs Dedicated VPS — Deployment Analysis

**Date:** 2026-09-30
**Scope:** Whether the `redir-engine` redirect hot path should run on the Cloudflare edge (Workers + KV, per ADR-004), on a dedicated VPS (Node runtime, per ADR-001), or a hybrid of both.
**Sources:** `review.md` (2026-09-29 delta re-review), `redir-engine/runtimes/*`, ADR-001 (SSE state sync), ADR-004 (CF KV edge state), `docs/analysis/fermyon-vs-cloudflare-workers.md`, Cloudflare Workers/KV public docs.
**Caveat:** Pricing and platform limits are point-in-time (2026-09-30); re-verify before acting. This document is a companion to `fermyon-vs-cloudflare-workers.md`: that doc compares *two edge platforms* (and concludes CF beats Fermyon if edge is chosen); this doc answers the prior question — *whether to choose the edge at all versus a dedicated VPS*.

---

## 1. Executive Summary

**Ship on the VPS path, put Cloudflare's free proxy in front of it, and park the Workers runtime until real global traffic justifies the redesign it needs.**

The reasoning in one sentence: the Cloudflare Workers path's limitations are not mostly about Workers itself — they are about **KV's eventual consistency** and the **loss of a warm process**, which happen to be the two things this engine's entire design is built on (ADR-001 SSE sync into a warm in-memory radix trie + cuckoo filter).

Concretely:

1. **The Node runtime is where 80% of the production work is done** (`review.md` §1). Phase 0 (C2, C4, C9, H12) is days-to-weeks of wiring fixes; the CF path needs C3 + H8 plus an architectural rework (§4).
2. **The engine's performance engineering contributes nothing on the edge path.** Every lookup becomes a KV read instead of a sub-ms in-memory trie hit; the radix tree, cuckoo filter, and shared UA LRU cache are unused on that runtime.
3. **Consistent-state features cannot be ported, only redesigned.** Click counting, `maxClicks` expiry (FR-36/37), and password-attempt throttling require atomic counters; KV has none, forcing Durable Objects (extra cost and complexity). These features are already broken on Node (C11, H6) — on edge they are architecturally hard, not merely unbuilt.
4. **CF's free proxy in front of the VPS captures most of the edge benefit** (TLS termination, DDoS mitigation, anycast DNS) with zero code changes.

**Relationship to existing decisions:** this does not contradict ADR-004 (KV as the edge state store — *how* state is stored if the edge runs) nor `fermyon-vs-cloudflare-workers.md` (CF is the right edge *platform* if the edge is chosen). It sequences the decision: **edge is an option to keep, not a premium to pay now.**

---

## 2. What "Cloudflare" Means Here — Three Deployment Shapes

| Shape | What runs where | Code impact |
|---|---|---|
| **A. Pure CF edge** | `runtimes/cf-worker/` Workers + KV; Admin on Supabase cloud + Pages | Requires C3/H8 fixes + rework (§4) |
| **B. Dedicated VPS** | `runtimes/node/` engine + Admin in Docker Compose behind Caddy (current documented prod path) | Phase 0 wiring fixes only |
| **C. Hybrid** | CF proxy (orange cloud, free tier) in front of the VPS-hosted Node engine | Zero code changes |

Shape C is frequently overlooked and changes the calculus: most of Cloudflare's benefit for a redirect service (TLS, DDoS, DNS) is available without moving the engine off the VPS.

---

## 3. Inherent Platform Limits of the Workers + KV Path

| Platform limit | Consequence for this redirect engine |
|---|---|
| No persistent process — isolates are ephemeral; module globals are per-isolate/per-PoP | The Node design (warm singleton trie + filter, `runtimes/node/index.ts`) does not port. State must be re-derived from KV per request or per cold isolate |
| KV is eventually consistent (propagation up to ~60 s globally) | "Create link → immediately test it" can 404; deletes can resurrect. For a URL shortener this is a core UX defect, not a corner case |
| No atomic counters in KV | `maxClicks` decrement, click-based expiry, password-attempt limits need Durable Objects — a redesign, not a port |
| No long-lived outbound connections | `SSESyncAdapter` / `eventsource` cannot run — hence `NoOpSyncAdapter` (ADR-004). The entire Admin→Engine sync protocol (ADR-001) does not exist on this path |
| Fire-and-forget `fetch` may be dropped without `waitUntil` | `FireAndForgetCollector` loses analytics events on Workers (confirmed by H8) |
| CPU-time caps, 128 MB isolate memory, no background timers | Kills `CacheEvictionManager` periodic work, in-memory analytics batching, any background job |
| `workerd` is not Node (`nodejs_compat` helps; the `Buffer` polyfill at the top of `runtimes/cf-worker/index.ts` is a symptom) | Porting friction for each Node-specific dependency |
| Observability must move to CF-native tooling (Logpush, Analytics Engine) | The Prometheus/Grafana/Loki stack and `prom-client` metrics adapters do not apply |
| Platform/account dependency | An account issue or ToS misfire takes the edge path down with no local fallback. Rare, but existential for a redirect SaaS |

---

## 4. Project-Specific State of the CF Path (from `review.md`)

Beyond inherent limits, the edge path as implemented today is prototype-grade:

- **C3** — deploy is provably broken: no `[env.staging]`/`[env.production]` in `wrangler.toml`, placeholder vars, and CI sets `workingDirectory` to a folder with no `wrangler.toml` at all.
- **H8** — per-request reconstruction of app/use-case/collector; `/_test/inject` and `/_test/clear` backdoors ship in prod; no `waitUntil` on analytics.
- **H2** — the Admin→KV publisher feeding the Worker is fire-and-forget with swallowed errors (`.catch(() => {})`); edge-state durability is unsolved even upstream of the runtime.
- **H1** — the SSE replay/snapshot work planned for the Node path has no edge equivalent; two sync paths must be maintained forever (drift risk already visible in H14/M1-style duplication).

Net: choosing pure edge first means funding (a) C3/H8 fixes, (b) a durable KV publish path, (c) Durable Objects for consistent state, and (d) a parallel observability stack — before the first production redirect.

---

## 5. Pros and Cons — Pure Cloudflare (Workers + KV)

**Pros**

- Global anycast edge: low redirect TTFB from anywhere; no "choose a region" decision.
- Free automatic TLS and strong DDoS mitigation included.
- Scale-to-zero: no servers to patch, no `backup.sh` (H21) / `restore.sh` (H22) burden, no observability stack to operate.
- Cheap at MVP volume (~$5/mo covers ~10M requests/mo; even ~100M/mo is roughly $30/mo — pricing point-in-time).
- Multi-region "for free" — no SSE fan-out to N engine instances later.
- The hexagonal core means the CF adapter work is not wasted.

**Cons**

- Not deployable today (C3) and prototype-grade (H8).
- KV eventual consistency breaks shortener UX (create-then-click, deletes).
- Click counters / max-click expiry / password throttling force Durable Objects — a redesign.
- Real-time SSE sync impossible; permanent dual sync paths (H1/H2).
- Analytics pipeline drops events (no `waitUntil`); no batching.
- Engine's performance engineering (trie, cuckoo filter, LRU UA cache) contributes nothing.
- Existing Prometheus metrics dead; CF-specific observability required.
- Admin service still needs re-platforming (Supabase cloud + Pages) to eliminate the server entirely.

## 6. Pros and Cons — Dedicated VPS (Node Runtime)

**Pros**

- The engine is purpose-built for it: warm in-memory trie = sub-ms lookups, real-time SSE updates, zero storage calls per redirect.
- Everything in the repo already targets it — Docker, Compose, Caddy, Prometheus/Grafana/Loki, Redis rate limiting, backup/restore tooling.
- Strong consistency for free: clicks, `maxClicks`, password state live in one process.
- Flat cost; no per-request billing; no surprise bill from a viral link.
- No platform dependency; the hexagonal core keeps future portability anyway.

**Cons**

- The TLS/deploy edge is currently broken (C2 wrong Caddy upstream ports; C4 missing `image:` fields; H12 fake health checks) — must fix before any cutover.
- Single region: global users pay +100–300 ms per redirect; multi-region later means SSE fan-out + load balancing + shared state.
- DDoS/TLS hardening is our job, and current hardening is weak (C9 `trust` auth, exposed DB/Redis ports, H17).
- Full ops burden: patching, backups (H21/H22 both broken today), capacity planning, on-call.
- Paying 24/7 even at zero traffic; one viral spike can saturate one box.

## 7. Pros and Cons — Hybrid (CF Proxy in Front of VPS)

**Pros**

- Free edge TLS + DDoS + anycast DNS immediately; zero code changes; keeps every strength of the Node runtime; de-risks launch while C2 is fixed internally.

**Cons**

- Redirect still hits origin (latency = origin region + 1 RTT).
- CF proxy quirks: websockets/SSE for the *admin UI* need attention; full-path caching of redirects is not automatic.
- The VPS ops list (§6 cons) still applies.

---

## 8. Decision Matrix

| Dimension | Pure CF edge | Dedicated VPS | Hybrid (CF proxy + VPS) |
|---|---|---|---|
| Time to production | Weeks (C3, H8, sync redesign) | ~Sprint (Phase 0) | ~Sprint (Phase 0) + DNS change |
| Redirect latency (global) | Best (edge PoP) | Worst (single region) | Same as VPS (+~0–1 RTT at edge) |
| Consistency (clicks, maxClicks, password) | Needs Durable Objects | Native | Native |
| Create-then-click UX | Degraded (KV ~60 s) | Immediate | Immediate |
| Analytics delivery | Broken until `waitUntil` | Works (fire-and-forget) | Works |
| TLS + DDoS | Included | DIY (C2 to fix) | Included |
| Ops burden | Lowest | Highest | Highest (same as VPS) |
| Observability | Rebuild on CF tooling | Existing stack | Existing stack |
| Cost at MVP volume | ~$5/mo + Supabase cloud | VPS ($5–20/mo flat) | Same as VPS |
| Cost at high volume | Competitive until extreme scale | Flat; add boxes for scale | Same as VPS |
| Risk concentration | CF account dependency | Our ops discipline | Our ops discipline |

---

## 9. Recommendation

1. **Ship on the VPS path.** It is where 80% of the work is done and where the engine's architecture pays off. Execute Phase 0 (C2, C4, C9, H12) first.
2. **Put Cloudflare's free proxy in front now** (Shape C). The TLS/DDoS benefit without touching code; this also de-risks the broken TLS edge while it is being fixed internally.
3. **Park the Workers runtime.** Remove the broken CI deploy step (roadmap Phase 0 item 3) until both conditions hold: (a) real global traffic justifying edge latency, and (b) willingness to fund the redesign it actually needs — Durable Objects for click/password state, `waitUntil` analytics, durable KV publish (H2), CF-native observability.
4. **Keep the option, don't pay the premium.** The ports/adapters boundary (ADR-002) is what makes parking the edge path nearly free to maintain. When traffic justifies it, ADR-004 and `fermyon-vs-cloudflare-workers.md` already define *how* and *on which platform*.

### Triggers to revisit (edge becomes right when any of these hold)

| Trigger | Threshold |
|---|---|
| Geo latency | Measurable CTR impact from regions >150 ms RTT from the VPS |
| Spike tolerance | Recurrent spikes exceeding single-box capacity faster than multi-VPS/SSE-fan-out scaling can respond |
| Multi-domain (M19) | Per-tenant custom-domain issuance outgrows Caddy on-demand TLS automation (CF for SaaS / Workers custom domains) |
