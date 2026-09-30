# Fermyon (Spin / Fermyon Cloud) vs Cloudflare Workers — Platform Analysis

**Date:** 2026-09-30
**Scope:** `redir-engine` edge runtime selection, evaluated from this project's point of view.
**Sources:** `fermyon.com/about`, `fermyon.com/cloud`, `fermyon.com/pricing`, `developer.fermyon.com/cloud/faq`, `spinframework.dev` docs, `developers.cloudflare.com/workers/platform/pricing`, `developers.cloudflare.com/workers/platform/limits`, repo source (`redir-engine/runtimes/*`, ADR-001, ADR-004, `review.md`).
**Caveat:** Pricing and limits are point-in-time (2026-09-30). Fermyon is mid-transition after the Akamai acquisition; re-verify before acting on this document.

---

## 1. Executive Summary

**Fermyon does not beat Cloudflare Workers for this project as it is wired today, and on three points it is disqualified outright.**

1. **30s request-handler cap on Fermyon Cloud** kills the ADR-001 SSE state-sync design (`SSEClient` in `redir-engine/src/adapters/sse/sse-client.ts`).
2. **500 outbound requests/hour/app** on Fermyon Cloud kills the per-request analytics path (`FireAndForgetCollector` POSTs to the admin collect endpoint once per redirect).
3. **No Node/Hono ecosystem in Wasm** (Javy/QuickJS): Hono has no Spin adapter, `eventsource` and `prom-client` cannot run (no sockets in WASI), making Spin a third runtime with a porting cost rather than an adapter swap.

Cloudflare Workers wins the three axes that dominate for a redirect engine: per-request cost (10–40× cheaper), unlimited invocation duration for HTTP-triggered Workers (SSE-compatible), and no outbound-request caps.

**Where Fermyon genuinely does better for this project** (see §5): cold-start latency under scale-to-zero, deterministic Wasm footprint, stricter sandbox with declarative outbound allowlisting, a native-Rust hot-path option, bundled ACID SQLite as an edge rule store, CNAME-based custom domains with automated TLS (relevant to M19 multi-domain), and stable inbound URLs that make webhook-based sync viable — the option ADR-001 rejected for CF Workers.

**Recommendation:** keep CF Workers as the edge target (fix C3/H8 instead of switching runtimes); if Fermyon is explored, do it as a Rust-rewritten hot-path experiment on Spin/SpinKube (self-hosted, sidestepping the Cloud caps), not as a replacement for the TS engine.

---

## 2. Fermyon Landscape (2026)

The `fermyon.com/about` page describes a company mid-transition: **Fermyon has joined Akamai** (site-wide banner; pricing page is branded "Fermyon Cloud Pricing – Akamai Functions").

| Product | What it is | Relevance to this project |
|---|---|---|
| **Spin** (CNCF) | Open-source dev framework/CLI for Wasm apps; TS/JS via Javy (QuickJS), plus Rust, Go, Python, .NET | The only way to deploy to Fermyon Cloud |
| **Fermyon Cloud** | Serverless Wasm hosting; Starter $0, Growth $19.38/mo | Direct CF Workers competitor |
| **Wasm Functions** | "Functions" product on **Akamai Cloud's** edge network | The actual global-edge answer to CF; newer, limits/pricing not publicly comparable (page 403s automated fetches) |
| **SpinKube / Platform for K8s** | Run Spin on your own Kubernetes | Relevant only if the engine moves to K8s |

### 2.1 Fermyon Cloud quotas that matter (official FAQ)

| Quota | Starter ($0) | Growth ($19.38/mo) |
|---|---|---|
| Apps | 5 | 100 |
| Request executions | 100,000 | 1,000,000 |
| Request executions/sec | 1,000 | 1,000 |
| **Request handler duration** | **30s** | **30s** |
| HTTP body size | 10MB | 10MB |
| **Outbound requests** | **500/hour/app** | **500/hour/app** |
| KV stores | 1/app (1GB) | 1/app (2GB) |
| SQLite stores | 1/app (1GB) | 1/app (2GB) |
| Egress (bandwidth) | 5GB | 50GB |
| Region deployments | 1 | 1 |
| Custom domains | 5 | 100 |
| Overage pricing | — | "Contact sales" (not published) |

Also: service chaining not supported on Cloud; Redis trigger not supported; outbound Postgres/MySQL supported; Spin 2.x supports streaming responses (SSE as server OK), outbound streaming still experimental.

---

## 3. This Project's Engine Workload Profile

From `redir-engine` source, ADR-001, ADR-004, `review.md`:

| Property | Current implementation | Runtime implication |
|---|---|---|
| Hot path | Radix trie + cuckoo filter, in-memory, O(k) | Sub-ms CPU, tiny memory |
| Sync | `SSEClient` (`eventsource`) connects to admin `/api/sync/stream` (Node runtime, ADR-001) | Long-lived outbound connection + reconnect/backoff |
| CF runtime sync | `NoOpSyncAdapter` + `CloudflareKVStore` per-request KV reads (ADR-004); eventual consistency, ~50ms miss | No SSE on CF |
| Analytics | `FireAndForgetCollector` — one HTTP POST per redirect | One outbound request per invocation |
| HTTP stack | Hono (`createApp`) shared by both runtimes | Web-standard Request/Response |
| Metrics | `prom-client` Prometheus endpoint (Node only) | TCP listener — impossible in Wasm/WASI |
| Multi-domain | Planned (M19); `domainId` in port, unused | Per-tenant custom-domain binding |
| CF deploy | Broken (C3: no `[env.*]` in wrangler.toml, CI workingDirectory wrong; H8: per-request reconstruction) | CF path is prototype-grade |

---

## 4. Feature Comparison (project-specific)

| Dimension | Cloudflare Workers (2026) | Fermyon Cloud (2026) | Winner for this project |
|---|---|---|---|
| Invocation wall-time | Unlimited for HTTP-triggered Workers ("no hard limit while client is connected"; SSE long-lived OK) | **30s request handler cap** | CF — decisive |
| Outbound requests | Subrequests: 10,000/invocation paid (up to 10M configurable), no hourly cap | **500/hour/app** (~8/min) | CF — ~2,500× headroom; analytics POST alone caps Fermyon at trivial traffic |
| Requests pricing | Free 100k/day (3M/mo); Paid $5/mo incl. 10M + $0.30/M | Free 100k total; Growth $19.38 incl. 1M; overage = sales call | CF — 10–40× cheaper, linear metered overage |
| Egress | Free, unlimited | 5GB / 50GB included, overage custom | CF |
| Cold start | Isolate freeze/thaw; ms-class on eviction | μs-class Wasm instantiation, scale-to-zero default | Fermyon (§5.1) |
| State store | KV (eventual, ~50ms miss, per-read metering) + D1 SQLite (25B rows-read/mo incl.) | KV (1 store/app) + ACID SQLite bundled | Fermyon for consistency/SQL; CF for scale and global reach |
| Global reach | 300+ cities, anycast, no region concept | **1 region per app** on Cloud (Akamai edge via Wasm Functions is the global option) | CF for Cloud tier |
| Sandbox | V8 isolate; blocks eval/new Function; fetch unrestricted | WASI sandbox + explicit `allowed_outbound_hosts` allowlist; no eval; no syscalls | Fermyon (stricter, declarative) |
| Languages | JS/TS (+ Wasm modules; workers-rs with JS glue) | TS/JS (Javy) + native Rust/Go/Python/.NET | Fermyon for non-JS hot paths |
| Custom domains | Requires hostname on a Cloudflare zone | CNAME-based binding + automated TLS on any domain (100 on Growth) | Fermyon — matters for M19 |
| Sync protocol fit | SSE client works via fetch streaming; KV fallback exists in-repo | SSE client impossible >30s; stable inbound URLs make webhook push viable | CF for current protocol; Fermyon forces redesign |
| Observability | Workers Logs/metrics built-in; OTel/Prometheus integrations | Dashboard logs only; OTel plugin yields minimal metrics (no CPU/mem) | CF |
| Framework compat | Hono official adapter; `eventsource-parser` works; KV/D1 bindings | No Hono adapter (Spin SDK ships its own Router); no `eventsource`, no `prom-client`, no sockets in WASI | CF |
| Burst ceiling | No published per-Worker RPS cap | 1,000 req/sec per app, then sales | CF |
| Vendor/maturity | Mature platform (DOs, Queues, R2, D1, Workflows) | Smaller, CNCF Spin, post-Akamai transition risk | CF (asterisk on Akamai's network) |

---

## 5. Where Fermyon Genuinely Beats CF Workers (for this project)

### 5.1 Cold-start latency for a scale-to-zero redirector

Fermyon's core claim (μs-class Wasm instantiation; ~3MB `app.wasm` vs a 200MB+ container) is independently corroborated (BetterStack 2025 comparison: no >200ms spikes vs AWS Lambda; CF Workers faster warm but pays isolate spawn on eviction). For a redirector serving bursty traffic (campaign links, print QR codes), first-hit TTFB is the product metric; Fermyon's scale-to-zero is deterministic Wasm instantiation, not a V8 snapshot.

### 5.2 The hot path's ideal form factor

Radix trie + cuckoo filter + LRU cache is the canonical "tiny, deterministic, memory-bound" Wasm workload. Spin's first-class languages (Rust/Go) allow compiling the same data structures to native Wasm with sub-ms latency and a footprint far under CF's 128MB isolate — the deployed artifact is ~3MB, versioned and auditable. CF cannot do this without V8 glue (`workers-rs`). If the trie/cuckoo filter ever move out of TypeScript, Fermyon is the only one of the two making that natural.

### 5.3 Security posture is stricter by default

- `spin.toml` `allowed_outbound_hosts`: the engine provably cannot reach hosts not declared — the analytics POST is confined to the admin collect endpoint; SSRF-by-misconfiguration is impossible.
- WASI sandbox: no arbitrary syscalls, no dynamic code generation (CF also blocks eval, but Spin's capability model is declarative and auditable).
- For a public redirector serving arbitrary user traffic, this is a genuinely stronger default than CF's fetch-anything model.

### 5.4 Bundled ACID SQLite as the edge rule store

Directly addresses ADR-004's acknowledged weaknesses: CF KV is eventually consistent with ~50ms cache-miss latency and per-read billing (the current `CloudflareKVStore` reads KV per request, so at scale the KV bill — $0.50/M reads — becomes the dominant CF cost). A Spin engine could mirror rules into local ACID SQLite (relational queries, per-domain rows for M19, atomic upserts) with no per-read metering. CF's equivalent is D1 (25B rows-read/mo included) — parity-plus for Fermyon, not a CF gap.

### 5.5 CNAME custom domains + automated TLS — relevant to M19

Fermyon custom domains are CNAME-based with automatic cert issuance on any domain the operator controls. CF Worker custom domains require the hostname on a Cloudflare zone. For a multi-tenant shortener where tenants bring their own domains (planned M19 multi-domain routing), Fermyon's binding model is materially easier — 100 domains on Growth.

### 5.6 Stable inbound URLs enable the sync redesign ADR-001 wanted

ADR-001 rejected webhooks because ephemeral workers lack stable URLs. Fermyon apps have stable custom subdomains/domains, so the admin could push rule changes over inbound HTTP (no outbound budget consumed, no 30s connection problem), and snapshot/replay (H1) becomes a simple bulk-load endpoint. This is a legitimate architectural improvement Fermyon enables that plain CF Workers (without Durable Objects) does not.

---

## 6. Hard Blockers on Fermyon for This Codebase

### 6.1 The 30s handler cap kills ADR-001 (SSE state sync)

The Node runtime's sync story is `SSEClient` → admin `/api/sync/stream` (persistent connection + reconnect/backoff). On Fermyon Cloud every invocation is capped at 30s, so the engine's SSE connection is severed every 30s on every instance. `eventsource` also requires Node `net`/`tls`, which do not exist in WASI. Sync would need to be rewritten as a fetch-streaming SSE client with forced reconnects, or redesigned entirely (§5.6).

### 6.2 The 500 outbound-requests/hour cap kills per-request analytics

`FireAndForgetCollector` POSTs to `ANALYTICS_SERVICE_URL` once per redirect. Fermyon Cloud allows 500 outbound requests/hour/app — a sustained ~8 redirects/minute. A high-throughput redirector exhausts the cap within minutes of real traffic. CF's equivalent is 10,000 subrequests/invocation with no hourly cap. (Fermyon's outbound Postgres support is interesting but counts against the same budget.)

### 6.3 It is a third runtime, not a port

- **Hono**: no official Spin adapter; the Spin JS SDK ships its own router; Javy runs a limited JS environment (no full Node API, no WebSocket, minimal fetch).
- **Metrics**: no TCP listener in WASI ⇒ `prom-client` cannot exist; the repo's Prometheus/Grafana story (M11, H23) would need an OTel-push rewrite, and Fermyon Cloud's metrics surface is thin (dashboard only; OTel plugin exposes ~2 metrics, no CPU/memory).
- The hexagonal ports (`IRedirectStore`, `ISyncManager`) make an adapter *feasible*, but the result is three maintained runtimes (Node, CF Worker, Spin), with the Spin one unable to use the sync and analytics paths that define the system.

---

## 7. Pricing — Quantified for This Project's Workloads

Cost driver is **request count** (sub-ms CPU, small responses, tiny memory).

| Profile | CF Workers Paid | Fermyon Cloud Growth | Verdict |
|---|---|---|---|
| Side project (<100k req/mo) | $0 — Free tier = 100k/day (3M/mo) | $0 — Starter = 100k total | CF capacity 30× higher at $0 |
| Launched (1M req/mo) | $5 — 10M included (~$0.50/1M effective) | $19.38 — exactly 1M included; overage unpriced | CF 4× cheaper with 10× headroom |
| Scale (100M req/mo) | ≈ $32–36/mo ($5 + 90M×$0.30/M + small CPU overage); KV raises this to ~$45–75/mo unless caching/D1 is used | Custom/sales; 1,000 RPS ceiling; 1 region | Only CF has linear, published metering |

Additional facts:

- **Egress**: CF free; Fermyon 5/50GB then custom. Redirect responses are small, so egress is minor — but CF is strictly better.
- **KV at scale**: CF KV per-read billing at 1 read/redirect is a real cost driver; fix on the CF side by caching in the isolate (also fixes H8) or moving to D1.
- **Outbound cap is a pricing wall too**: beyond 500 outbound/hr, Fermyon's analytics path fails — per-request analytics cannot even be bought on published tiers.
- **Akamai Functions**: the true CF competitor on Akamai's network (4,100+ edge locations), but limits/pricing are not publicly documented in comparable detail (page 403s automated fetches); Fermyon Cloud proper still ships 1 region per app.

---

## 8. Migration Cost

| Path | Effort | Notes |
|---|---|---|
| Fix CF Worker runtime (current plan) | Days | C3: add `[env.staging]`/`[env.production]` + real vars, fix CI workingDirectory; H8: hoist reconstruction to module scope; add KV caching. All components already exist (`CloudflareKVStore`, `NoOpSyncAdapter`, miniflare tests). |
| Spin runtime for the engine | Weeks + protocol change | New SDK (no Hono); SSE sync impossible ⇒ webhook redesign; analytics ⇒ batching or dropped; prom-client ⇒ OTel. Third runtime alongside Node and CF. |
| Rust hot-path PoC on Spin | 1–2 sprints, experimental | The only Fermyon play with clear upside: native Wasm radix+cuckoo, μs cold starts; can run on SpinKube on the existing VPS with zero Fermyon Cloud dependency (sidesteps the 500/hr and 30s caps entirely). |

---

## 9. Recommendation

1. **Keep Cloudflare Workers as the edge target.** For a redirect engine, CF wins on the three dominant axes: per-request cost (10–40×), unlimited invocation duration (SSE), and no outbound caps. The existing broken runtime (C3/H8) is days away from working.
2. **Do not move the sync or analytics paths to Fermyon Cloud** — the 30s handler cap and 500 outbound/hr cap are architectural disqualifiers for ADR-001 and the per-request analytics design.
3. **If Fermyon is explored, do it as a Rust-rewritten hot-path experiment** (Spin + SpinKube on the existing VPS, or Wasm Functions on Akamai's edge once pricing is public) — targeting μs cold starts and the ~3MB footprint, not as a replacement for the current TS engine.
4. **Adopt the two ideas Fermyon gets right regardless of runtime:** (a) a webhook/bulk-load sync path (fixes H1), and (b) CNAME-based tenant domains with automated TLS for M19 — both are achievable on CF with more setup.

**Bottom line:** Fermyon's story — Wasm density, μs cold starts, sandbox-first security, multi-language — is compelling, and three of its properties (cold start, bundled SQLite, CNAME domains) are genuinely better for this project than CF Workers. But on features and pricing measured against this codebase, Cloudflare Workers remains the correct runtime: 10–40× cheaper per redirect, no duration or outbound-request caps, and a port to Fermyon would require redesigning the two subsystems (sync and analytics) that the project has already built and tested.

---

## Appendix A. Verification Notes

| Claim | Source |
|---|---|
| CF HTTP-triggered Workers: no wall-time limit; SSE long-lived; streaming OK | developers.cloudflare.com/workers/platform/limits (2026-09-05): "There is no hard limit on duration for HTTP-triggered Workers… no effective limit on SSE response duration" |
| CF subrequests: 10,000/invocation paid, up to 10M configurable; free 50 | developers.cloudflare.com/workers/platform/limits; changelog 2026-02-11 |
| CF pricing: Free 100k/day; Paid $5 incl. 10M requests + $0.30/M; no egress charge; KV 10M reads/mo + $0.50/M | developers.cloudflare.com/workers/platform/pricing (2026-08-28) |
| Fermyon quotas: 30s handler, 10MB body, 500 outbound/hr/app, 1,000 req/sec, 1 region, KV/SQLite 1GB/2GB, egress 5GB/50GB | developer.fermyon.com/cloud/faq |
| Fermyon pricing: Starter $0, Growth $19.38/mo; overage = contact sales | fermyon.com/pricing (fetched 2026-09-30) |
| Fermyon Cloud SDK support: HTTP trigger only; Redis trigger unsupported; service chaining unsupported; outbound HTTP/Postgres/MySQL supported | developer.fermyon.com/cloud/faq |
| Spin outbound streaming experimental; SSE as server feasible in Spin 2.x | spinframework.dev/v4/http-outbound; github.com/spinframework/spin discussion #1867 |
| Akamai acquisition + Wasm Functions on Akamai Cloud | fermyon.com/about, fermyon.com/cloud (2026-09-30) |