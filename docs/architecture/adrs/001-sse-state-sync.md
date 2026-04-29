# ADR-001: SSE for State Synchronization

## Status
Accepted

## Context
The Redirect Engine needs to be aware of link updates, creations, and deletions in real-time to ensure redirection accuracy. We considered several synchronization mechanisms:
1. **Direct DB Connection**: Engine connects to Supabase/PostgreSQL. (Slow, high overhead for edge runtimes).
2. **Polling**: Engine polls an API every few seconds. (High latency for updates, high load on Admin).
3. **Webhooks**: Admin pushes to a known Engine URL. (Requires Engine to have a stable URL, difficult for auto-scaling or ephemeral workers).
4. **SSE (Server-Sent Events)**: Engine maintains a persistent connection to Admin.

## Decision
We chose **Server-Sent Events (SSE)** for state synchronization from the Admin Service to the Redirect Engine.

## Consequences
- **Pros**:
    - Unidirectional and low overhead compared to WebSockets.
    - Standard HTTP protocol, works well with most firewalls and proxies.
    - Low latency (push-based).
- **Cons**:
    - Requires persistent connections, which is challenging for Cloudflare Workers (requires specialized adapters or fallback to KV).
    - Requires a reconnection logic with exponential backoff.
    - Currently lacks a "catch-up" mechanism for offline engines (to be addressed in a future ADR/Update).
