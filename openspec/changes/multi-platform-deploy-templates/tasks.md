## 1. Documentation & Architecture Contract

- [ ] 1.1 Write `redir-engine/runtimes/PORTING.md` explaining `IRedirectStore` and `ISyncManager` interfaces, the Store/Sync pairing matrix, and a minimal annotated entry-point template
- [ ] 1.2 Update root `README.md` with the runtime compatibility matrix (Node.js, CF Workers, Fly.io/Bun, Deno Deploy, Supabase Edge, AWS Lambda@Edge with statuses)

## 2. Bun Runtime

- [ ] 2.1 Create `redir-engine/runtimes/bun/index.ts` mirroring `runtimes/node/index.ts` but using Bun's native `Bun.serve()` HTTP listener instead of `@hono/node-server`
- [ ] 2.2 Verify the Bun entry point starts, connects to SSE, and serves a test redirect correctly
- [ ] 2.3 Add a `bun:start` script to `redir-engine/package.json` (or `runtimes/bun/package.json`)

## 3. Deno Runtime

- [ ] 3.1 Create `redir-engine/runtimes/deno/index.ts` using `Deno.serve()` and `InMemoryStore + SSESyncAdapter`
- [ ] 3.2 Create `deployments/deno/deno.json` with import map configuration for the engine's TypeScript source
- [ ] 3.3 Verify the Deno entry point starts and serves a test redirect (local `deno run` first)

## 4. SupabaseEdgeKVStore Adapter

- [ ] 4.1 Create `redir-engine/src/adapters/storage/SupabaseEdgeKVStore.ts` implementing `IRedirectStore` by querying the Supabase `links` table via the Supabase JS client
- [ ] 4.2 Implement `getRedirect`, `mightExist` (returns `true`), `addRedirect`, and `removeRedirect` on `SupabaseEdgeKVStore`
- [ ] 4.3 Write unit tests for `SupabaseEdgeKVStore` with a mocked Supabase client
- [ ] 4.4 Create `redir-engine/runtimes/supabase-edge/index.ts` as a Supabase Edge Function entry point wiring `SupabaseEdgeKVStore + NoOpSyncAdapter`

## 5. Deployment Templates

- [ ] 5.1 Create `deployments/fly/fly.toml` with service name, region, port, and env variable placeholders
- [ ] 5.2 Create `deployments/fly/Dockerfile.fly` using `oven/bun` base image running `runtimes/bun/index.ts`
- [ ] 5.3 Create `deployments/fly/README.md` with last-verified date, env var list, and `fly deploy` steps
- [ ] 5.4 Create `deployments/deno/README.md` with cold-start trade-off note and GitHub/Deno Deploy integration steps
- [ ] 5.5 Create `deployments/supabase-edge/config.toml` with Edge Function configuration
- [ ] 5.6 Create `deployments/supabase-edge/README.md` with DB-per-request latency note, pgBouncer note, and deployment steps
- [ ] 5.7 Create `deployments/aws-lambda/README.md` marked as "Planned — Adapter not yet implemented" with a description of what is required and a link to the open question in `design.md`

## 6. Verification

- [ ] 6.1 Run the existing E2E suite against the Node.js runtime to confirm no regressions from any shared code changes
- [ ] 6.2 Manually verify the Bun runtime passes at least one E2E redirect scenario
- [ ] 6.3 Confirm `SupabaseEdgeKVStore` unit tests pass in CI
- [ ] 6.4 Review all template READMEs for accuracy and that the "Last verified" date is present

## Review Log

**Date:** 2026-09-29 · **Reviewer:** nw-platform-architect-reviewer (Kilo)
**Verdict:** APPROVED as a plan — 0% started, status accurate, well-structured verification section.

**Findings (priority order):**

- `issue (blocking):` Do not start this change until the production deploy path it templatizes works: Caddy proxies to wrong ports (`infra/caddy/Caddyfile:6,15,23` vs containers on 3000), deploy scripts reference nonexistent `image:` fields (`scripts/deploy-production.sh:17-21`), and the CF Worker deploy is double-broken (`.github/workflows/deploy-staging.yml:37` wrong workingDirectory + `wrangler.toml` has no `[env.*]` sections). Porting guides built on a broken reference deployment will codify the breakage.
- `thought (non-blocking):` The proposal's "zero-code deploy templates" narrative (`proposal.md:3`) contradicts its own task list, which implements three new runtimes/adapters (Bun, Deno, SupabaseEdgeKVStore). Either rescope to docs-only or rename the change before starting.
- `suggestion (non-blocking):` Section 6 verification is good; add a CI job placeholder check so 6.3 ("unit tests pass in CI") has an actual CI lane to pass in — current CI never runs the engine test matrix for non-Node runtimes.
- `praise:` The task breakdown with per-template README "last-verified" discipline (5.3, 5.4, 5.7 marking Lambda@Edge as planned-not-implemented) is exactly the right honesty pattern for portability work.
