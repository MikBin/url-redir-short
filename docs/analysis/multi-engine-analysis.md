# Multi-Engine Architecture Analysis

**Date:** 2026-04-28 | **Updated:** 2026-04-29 (reflects CHANGE-015 Hexagonal Architecture refactor)

## Scenario

A single admin-service on a single machine, with many engines connecting to it — some deployed on VPS (Node.js), some on Cloudflare Workers.

---

## Q1: Can it work right now?

**Partially.** Of the original 4 blocking issues, 3 have been resolved by the Hexagonal Architecture refactor (CHANGE-015). One remains open.

### ✅ RESOLVED — Issue 1: No Initial Full Sync

Still not implemented. The SSE stream only sends a `{ type: 'connected' }` handshake on connect — no state dump.

> **Status:** Still open. A snapshot/full-sync endpoint is planned as a follow-up to CHANGE-015. Engines start empty and only receive events that happen after connecting.

### ⚠️ OPEN — Issue 2: No Domain Awareness

The transformer (`transformer.ts`) maps `slug → /path` but ignores `domain_id`. The `RedirectRule` type has no domain field. The HTTP server routes by `url.pathname` only — the `Host` header is never inspected.

**Impact:** If `domain-a.com` and `domain-b.com` both define `/promo`, they collide in the RadixTree (one overwrites the other). Links from different domains cannot coexist in the same engine.

> **Status:** Still open. Domain-aware routing is a planned future change.

### ✅ RESOLVED — Issue 3: CF Workers Can't Maintain SSE Connections

**Resolved by CHANGE-015:** The CF Worker runtime now uses `CloudflareKVStore` + `NoOpSyncAdapter`. State is persisted in Cloudflare KV and pushed from the Admin Service on every link mutation via the REST API (fire-and-forget). Workers no longer need persistent SSE connections.

> **Resolution:** `runtimes/cf-worker/index.ts` — CloudflareKVStore + NoOpSyncAdapter wired at startup. Admin pushes to KV via `server/utils/cloudflare-kv.ts`.

### ✅ RESOLVED — Issue 4: No Engine Identity or Filtering

**Partially resolved by CHANGE-015:** The CF Worker runtime reads only its own KV namespace — there is implicit domain isolation at the KV level (each Worker deployment has its own KV binding). The Node.js engine still receives all SSE events, but this is acceptable for single-domain VPS deployments.

> **Remaining gap:** True per-domain SSE filtering (send each engine only events for its domains) is not yet implemented. Full resolution depends on Issue 2 (domain awareness).

---

## Q2: Can the same domain be handled by both a VPS engine and CF Workers?

**No, for two independent reasons:**

1. **DNS constraint:** A domain resolves to one set of IPs. You can't route `example.com` traffic to both a VPS and CF Workers simultaneously without a load balancer/CDN in front.

2. **No domain isolation in the engine (Issue 2):** Even if traffic were split at the DNS level, the engine treats `/abc` identically regardless of `Host` header — there is no domain-scoped routing. Both engines would have the full dataset and respond identically.

---

## Q3: Does the admin need to orchestrate which domain goes where?

**Yes, and this remains the correct direction — but it doesn't fully exist yet.** CHANGE-015 added KV-based sync for CF Workers, but true domain orchestration is still missing.

| What's Needed | Current State |
|---|---|
| Engine registration (ID + runtime type) | ❌ Engines are anonymous |
| Domain → engine group mapping in DB | ❌ `domains` table exists but has no engine assignment |
| Filtered SSE per engine (only its domains) | ❌ Bare EventEmitter broadcasts everything |
| Full sync endpoint (snapshot on connect) | ❌ Only handshake sent |
| Domain-aware path keys (e.g., `example.com/abc`) | ❌ Path is just `/abc`, `domain_id` is discarded by transformer |
| Host header inspection for routing | ❌ Never read |
| CF Worker-compatible sync (KV) | ✅ **Implemented by CHANGE-015** |

---

## Summary

CHANGE-015 resolved the CF Workers state management problem. The remaining blocker for production multi-engine, multi-domain use is **Issue 2 (domain awareness)**. Until domain-aware routing is implemented, the system supports:
- ✅ Single admin + multiple Node.js engines on **one domain each**
- ✅ Single admin + CF Workers on **one domain** (KV-backed)
- ❌ Multiple domains on the same engine instance
- ❌ Domain-to-engine orchestration
