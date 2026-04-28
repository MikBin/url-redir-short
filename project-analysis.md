# Project Analysis: Single Admin + Multiple VPS/Cloudflare Engines

**Date:** 2026-04-28

## Scenario

A single admin-service on a single machine, with many engines connecting to it — some deployed on VPS, some on Cloudflare Workers.

---

## Q1: Can it work right now?

**No.** There are 4 blocking issues:

### 1. No Initial Full Sync

The SSE stream (`stream.get.ts`) only sends a `{ type: 'connected' }` handshake on connect — it never dumps existing link state. Engines boot with empty data structures and can only receive events that happen _after_ connecting. No snapshot/full-sync endpoint exists.

**Impact:** Every engine starts empty. If an engine disconnects and reconnects, it misses all changes that happened while offline.

### 2. No Domain Awareness

The transformer (`transformer.ts`) maps `slug → /path` but ignores `domain_id` entirely. The `RedirectRule` type has no domain field. The HTTP server (`server.ts`) routes by `url.pathname` only — the `Host` header is never inspected.

**Impact:** If `domain-a.com` and `domain-b.com` both define `/promo`, they collide in the RadixTree (one overwrites the other). Links from different domains cannot coexist in the same engine.

### 3. CF Workers Can't Maintain SSE Connections

The `FetchEventSource` (`cf-worker/fetch-event-source.ts`) uses a `while(true) { reader.read() }` loop that requires a persistent HTTP connection. Cloudflare Workers have a 30-second CPU limit (free) or 30s–15min wall-clock (paid). When a Worker is evicted, all in-memory state (RadixTree + CuckooFilter) is lost. On cold start, it reinitializes empty. The `ctx.waitUntil()` hack is only for Miniflare E2E tests.

**Impact:** CF Workers lose their state on every eviction and cannot maintain a persistent SSE connection to receive updates.

### 4. No Engine Identity or Filtering

The admin uses a bare `EventEmitter` (`broadcaster.ts`) to broadcast events — every engine receives every event. There is no engine registration, no engine-to-domain mapping, and no way to filter which events an engine receives.

**Impact:** All engines receive all data regardless of which domains they actually serve. There is no way to assign domains to specific engines.

### What Does Work Today

A single admin + single Node.js engine on one domain, for links created after the engine connects. This is a dev/prototype setup.

---

## Q2: Can the same domain be handled by both a VPS engine and CF Workers?

**No, for two independent reasons:**

1. **DNS constraint:** A domain resolves to one set of IPs. You can't route `example.com` traffic to both a VPS and CF Workers simultaneously (unless you put a load balancer/CDN in front, which defeats the purpose of having two different runtimes).

2. **No domain isolation in the engine:** Even if you could split traffic at the DNS level, the engine treats `/abc` identically regardless of which domain the request arrived on — there's no `Host` header inspection, no domain-scoped routing. Both engines would have the full dataset (since admin broadcasts everything) and would respond identically, meaning they can't serve different domain configurations.

---

## Q3: Does the admin need to orchestrate which domain goes where?

**Yes, and this is the correct architectural direction — but it doesn't exist yet.** Currently there is zero orchestration capability. To support the mixed VPS/CF deployment model, the system needs:

| What's Needed | Current State |
|---|---|
| Engine registration (ID + runtime type) | ❌ Engines are anonymous |
| Domain → engine group mapping in DB | ❌ `domains` table exists but has no engine assignment |
| Filtered SSE per engine (only its domains) | ❌ Bare EventEmitter broadcasts everything |
| Full sync endpoint (snapshot on connect) | ❌ Only handshake sent |
| Domain-aware path keys (e.g., `example.com/abc`) | ❌ Path is just `/abc`, `domain_id` is discarded by transformer |
| Host header inspection for routing | ❌ Never read |
| CF Worker-compatible sync (polling or KV) | ❌ Only SSE supported |

---

## Summary

The admin _should_ orchestrate domain-to-engine assignment, but this capability needs to be built. The current architecture is a single-engine, single-domain prototype with no multi-engine or multi-domain support.