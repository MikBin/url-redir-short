## Why

The redirect engine currently runs on two platforms (VPS/Node.js and Cloudflare Workers), but has no documented or standardized path for deployment to other cloud environments. As the project moves toward client-facing distribution, the lack of multi-platform deployment guidance is a marketability gap — potential clients on AWS, Fly.io, Deno Deploy, or Supabase infrastructure have no clear path to adoption. This change addresses that gap with zero-code deploy templates and a runtime porting guide, deferring the implementation of new runtime adapters to a later phase when client demand validates the investment.

## What Changes

- Add a `deployments/` directory at the repo root with ready-made, opinionated deployment templates for each target platform.
- Add a `redir-engine/runtimes/PORTING.md` guide explaining the architecture contract (`IRedirectStore` + `ISyncManager`) for developers who want to add new runtimes.
- Add a new `redir-engine/runtimes/bun/` entry point (mirrors Node.js, near-zero code delta) as the first new runtime.
- Add a new `redir-engine/runtimes/deno/` entry point for Deno Deploy compatibility.
- Add a new `redir-engine/src/adapters/storage/SupabaseEdgeKVStore.ts` adapter to enable a Supabase Edge Function runtime.
- Update the root `README.md` with a runtime compatibility matrix showing support status across all platforms.
- No breaking changes to existing Node.js or Cloudflare Workers runtimes.

## Capabilities

### New Capabilities

- `runtime-portability`: The documented architecture contract and porting guide that allows any developer to implement a new runtime adapter by satisfying `IRedirectStore` and `ISyncManager` interfaces.
- `deploy-templates`: Ready-to-use deployment configuration files (Dockerfiles, `fly.toml`, `deno.json`, SAM templates, etc.) for each supported target platform, paired with a quick-start README per target.
- `bun-runtime`: A Bun-native entry point for the redirect engine, enabling higher throughput on Fly.io and bare-metal VPS deployments without Node.js.
- `deno-runtime`: A Deno-compatible entry point for the redirect engine targeting Deno Deploy.
- `supabase-edge-runtime`: A Supabase Edge Function entry point backed by a new `SupabaseEdgeKVStore` adapter that reads redirect rules directly from the Supabase database, enabling an all-in-one Supabase deployment.

### Modified Capabilities

- `01-core-architecture`: The runtime layer is now explicitly multi-platform. The `runtimes/` directory structure and the `IRedirectStore`/`ISyncManager` port contracts are formally documented as the extension points for new platforms.

## Impact

- **New code**: `redir-engine/runtimes/bun/index.ts`, `redir-engine/runtimes/deno/index.ts`, `redir-engine/src/adapters/storage/SupabaseEdgeKVStore.ts`
- **New docs**: `redir-engine/runtimes/PORTING.md`, `deployments/*/README.md`
- **New config files**: `deployments/fly/fly.toml`, `deployments/fly/Dockerfile.fly`, `deployments/deno/deno.json`, `deployments/supabase-edge/config.toml`, `deployments/aws-lambda/template.yaml` (informational only — no Lambda adapter code in this phase)
- **No changes** to existing `runtimes/node/` or `runtimes/cf-worker/` runtimes
- **No changes** to Admin Service, sync protocol, or analytics pipeline
- **Deferred**: AWS Lambda `RedisStore` adapter — tracked as a future phase, only to be built when a concrete client requirement exists
