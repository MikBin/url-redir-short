## ADDED Requirements

### Requirement: SupabaseEdgeKVStore Adapter
The system SHALL provide a `SupabaseEdgeKVStore` class in `redir-engine/src/adapters/storage/SupabaseEdgeKVStore.ts` that implements `IRedirectStore`. It MUST read redirect rules directly from the Supabase database using the Supabase JS client, using the same table schema as the Admin Service. It SHALL use `NoOpSyncAdapter` as its sync partner (no SSE connection needed).

#### Scenario: Redirect lookup via Supabase
- **WHEN** `getRedirect(slug)` is called
- **THEN** the store SHALL query the Supabase `links` table (or equivalent) for a row matching the slug and return a `RedirectRule` or `null`

#### Scenario: mightExist always returns true
- **WHEN** `mightExist(slug)` is called on `SupabaseEdgeKVStore`
- **THEN** it SHALL return `true` (no local filter exists; the DB query in `getRedirect` is the authoritative check)

#### Scenario: Store satisfies IRedirectStore contract
- **WHEN** `SupabaseEdgeKVStore` is used in place of `InMemoryStore` or `CloudflareKVStore`
- **THEN** all four interface methods (`getRedirect`, `mightExist`, `addRedirect`, `removeRedirect`) SHALL be implemented without runtime errors

### Requirement: Supabase Edge Function Entry Point
The system SHALL provide a `redir-engine/runtimes/supabase-edge/index.ts` entry point structured as a Supabase Edge Function (Deno-based). It MUST instantiate `SupabaseEdgeKVStore` with the Supabase client initialised from Edge Function environment variables and use `NoOpSyncAdapter`.

#### Scenario: Edge Function handles a redirect request
- **WHEN** a redirect request hits the Supabase Edge Function
- **THEN** the engine SHALL use `SupabaseEdgeKVStore` to resolve the slug, return the correct `Location` header, and fire an analytics event

#### Scenario: DB-per-request latency is documented
- **WHEN** a developer reads `deployments/supabase-edge/README.md`
- **THEN** they SHALL find a note explaining the ~5-20ms per-request DB read latency trade-off versus the in-memory model, and that Supabase's built-in pgBouncer connection pooling mitigates connection overhead
