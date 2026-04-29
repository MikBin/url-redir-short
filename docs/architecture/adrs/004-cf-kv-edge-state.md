# ADR-004: Cloudflare KV as Edge State Store for CF Worker Deployments

**Status:** Accepted
**Date:** 2026-04-29
**Deciders:** Project Team

---

## Context

Cloudflare Workers are ephemeral — they do not hold long-lived connections and their in-memory state is lost on eviction. This makes SSE-based state synchronization (ADR-001) inapplicable for CF Worker deployments.

The system needed a persistent, globally-distributed state store that Worker instances can read on every request without depending on a long-lived connection to the Admin Service.

## Decision

Use **Cloudflare Workers KV** as the state store for CF Worker deployments:

1. The **Admin Service** pushes redirect rules to KV via the Cloudflare REST API on every link create/update/delete mutation (fire-and-forget, non-blocking).
2. The **CF Worker runtime** uses `CloudflareKVStore` (implementing `IRedirectStore`) to perform per-request KV lookups.
3. The **NoOpSyncAdapter** (implementing `ISyncManager`) is used in CF Workers — no SSE connection is established.

## Consequences

**Positive:**
- CF Workers can serve redirects without any SSE infrastructure.
- State survives Worker eviction — KV is globally persistent.
- No code duplication: the same `IRedirectStore` port is used by both runtimes, only the adapter changes.

**Negative:**
- KV reads have ~50ms latency on cache miss (eventual consistency). For most redirects this is acceptable.
- KV publish is fire-and-forget — a publish failure leaves KV out of sync with the DB until the next mutation on the same key. A reconciliation job is planned to address this.
- Requires CF account credentials (`CF_ACCOUNT_ID`, `CF_KV_NAMESPACE_ID`, `CF_API_TOKEN`) in Admin Service env.
