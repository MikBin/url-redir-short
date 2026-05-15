## Context

The redirect engine is built on Hono with a Clean Architecture that separates runtime concerns from domain logic via two port interfaces: `IRedirectStore` (how redirect rules are read) and `ISyncManager` (how rules are kept in sync). Currently two runtimes exist: Node.js (VPS) and Cloudflare Workers. The engine's portability is a structural advantage that is not yet communicated or exploited.

The admin service (centralized) pushes state changes to engine instances via SSE. Engines hold an in-memory Radix Tree + Cuckoo Filter for sub-millisecond routing. On platforms with globally distributed storage (e.g., CF KV), the engine instead reads directly from that storage and uses a `NoOpSyncAdapter`.

## Goals / Non-Goals

**Goals:**
- Add Bun and Deno as first-class runtime entry points (near-zero code delta from Node.js).
- Add a `SupabaseEdgeKVStore` adapter enabling a Supabase Edge Function runtime that reads from the Supabase DB directly.
- Provide opinionated, working deployment templates per target platform in a `deployments/` directory.
- Document the porting contract in `redir-engine/runtimes/PORTING.md` so external developers can add their own runtimes.
- Update the root `README.md` with a runtime compatibility matrix.

**Non-Goals:**
- A CLI or automation tooling for deployment target selection (deferred, revisit post-alpha).
- An AWS Lambda runtime adapter (requires a `RedisStore` or `DynamoDBStore` implementation — deferred until a concrete client requirement exists).
- A Fastly Compute runtime (Wasm build pipeline complexity, niche addressable market).
- Any changes to the Admin Service, sync protocol, or analytics pipeline.
- Horizontal scaling of the Admin SSE fanout (tracked as a separate future concern).

## Decisions

### Decision 1: Deploy Templates over a CLI

**Choice:** A `deployments/` directory with static config files + per-platform README, not a code-generating CLI.

**Rationale:** At pre-alpha, no client is actively using a second platform. A CLI introduces ongoing maintenance against each platform's evolving config format (e.g., Wrangler v1→v2→v3 breakage). Static templates are auditable, require no tooling, and give 80% of the CLI's marketing value. The CLI is a natural next step once real client usage validates target platforms.

**Alternatives considered:** `create-hono` scaffold integration — rejected, too prescriptive for a project with custom adapters.

### Decision 2: Bun and Deno Reuse `InMemoryStore + SSESyncAdapter`

**Choice:** Both new runtimes use the same store/sync combination as Node.js, not a new "distributed" store.

**Rationale:** Bun runs persistent processes (like Node.js), so in-memory state + SSE sync is correct and performant. Deno Deploy isolates are ephemeral, meaning each cold start re-populates the Radix Tree via SSE — acceptable for pre-alpha, and documented as a known trade-off in the Deno README.

**Alternatives considered:** Backing Deno with Deno KV (Deno's native distributed store) — valid but adds a dependency and requires a new store adapter. Deferred as a future enhancement.

### Decision 3: `SupabaseEdgeKVStore` Reads Directly from Supabase DB

**Choice:** The Supabase Edge runtime uses a new `SupabaseEdgeKVStore` that queries the redirects table via the Supabase client, bypassing SSE entirely (`NoOpSyncAdapter`).

**Rationale:** Supabase Edge Functions are co-located with the Supabase database. Reading from the DB directly is low-latency and avoids the complexity of maintaining an SSE connection from a serverless function. This mirrors the CF KV pattern: the store IS the source of truth.

**Alternatives considered:** Supabase Realtime (subscriptions) as a sync mechanism — more complex, unclear benefit over a direct DB read per request at this stage.

### Decision 4: `PORTING.md` as the Formal Extension Contract

**Choice:** A single markdown document in `redir-engine/runtimes/` that explains the two interfaces, the Store/Sync pairing matrix, and provides a minimal entry-point template.

**Rationale:** This is the cheapest way to communicate portability to developer-evaluators. It costs one hour to write and has no maintenance burden unless the interfaces change.

## Risks / Trade-offs

- **Deno cold-start latency**: Each new Deno Deploy isolate re-fetches all redirect rules via SSE before serving traffic. For large rule sets (thousands of redirects), this cold-start time could be significant. → Mitigation: document the trade-off clearly in the Deno README; consider Deno KV backing as a future enhancement.
- **Stale deploy templates**: Platform config formats evolve. A `fly.toml` written today may not work in 12 months without updates. → Mitigation: add a "last verified" date to each template README; treat templates as living docs, not a one-time artifact.
- **`SupabaseEdgeKVStore` latency per request**: Unlike the in-memory store (sub-millisecond), a DB read per redirect request adds ~5-20ms depending on region co-location. → Mitigation: this is acceptable for a "Supabase-native" deployment story; document the latency trade-off and note that connection pooling via `pgBouncer` (already in Supabase) mitigates it significantly.
- **SSE fanout at scale**: As more engine instances connect to the Admin's SSE endpoint, open connection count grows linearly. This is not a concern for single-client deployments but becomes a bottleneck at ~500+ instances. → Mitigation: tracked as a separate architectural concern; not in scope for this change.

## Migration Plan

No breaking changes. All existing runtimes are untouched. New additions are purely additive:
1. Add `runtimes/bun/` and `runtimes/deno/` entry points.
2. Add `src/adapters/storage/SupabaseEdgeKVStore.ts`.
3. Add `deployments/` directory with templates.
4. Add `runtimes/PORTING.md`.
5. Update root `README.md` runtime matrix.

Rollback: trivially delete any of the above — no existing functionality is affected.

## Open Questions

- Should the Deno runtime entry point be structured for `deno serve` (HTTP server) or `Deno.serve()` directly? Both are valid; `deno serve` is closer to a drop-in for Deno Deploy.
- For the `SupabaseEdgeKVStore`, should it cache results in a module-level Map to reduce DB calls within a single isolate lifecycle? Probably yes, but the cache invalidation story needs thought.
- Should the AWS Lambda template in `deployments/aws-lambda/` be an informational "coming soon" stub, or omitted entirely until the adapter exists? A stub with clear "ADAPTER NOT YET IMPLEMENTED" messaging may be better for marketability.
