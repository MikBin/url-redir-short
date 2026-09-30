# Contract Testing & Architecture Enforcement — Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Phase-1 foundation enforceable. Run every existing suite in CI, make `deployment-matrix.json` the executable source of truth that fans out CI legs, complete the analytics-port contract, share one sync-protocol contract across both admin flavors and the engine, and add mechanical ratchets so test coverage, architectural boundaries, and combination support cannot erode as new adapters, runtimes, and deployment combinations are added.

**Architecture:** CI becomes a set of parallel jobs; a `matrix-setup` job reads `deployment-matrix.json` and fans E2E legs out via `fromJSON`. A contract registry plus an adapter-registration test asserts every port implementation is contract-tested and present in the matrix. The sync protocol is single-sourced as Zod schemas under `admin-service/shared/sync-contract/` with a vendored, hash-checked copy for the engine (no workspace surgery). Architecture known-violation lists become exact-match and can only shrink. Coverage thresholds are enforced in CI and ratcheted by a config test. Deploy workflows gate on CI success.

**Tech Stack:** GitHub Actions, Vitest, Playwright, Zod (aligned to a single major across admins), tsx, Supabase CLI (local Docker stack), wrangler/workerd, PocketBase.

---

## Baseline audit (verified 2026-09-30)

| Suite | Location | Local | CI today | Phase-2 action |
|---|---|---|---|---|
| Engine L0 unit + L1 contracts + architecture (246 tests) | `redir-engine/tests/` | OK | Runs via `npm test` (`vitest run` includes `tests/**/*.test.ts`), but coverage thresholds (53/43/43/54) never enforced — CI runs `test`, not `test:coverage` | Task 1 |
| E2E node (quick mode) | `redir-engine/e2e-suite` (`test:node`) | OK | Runs, `E2E_QUICK_MODE=true` | Task 2 |
| E2E cf-worker | `redir-engine/e2e-suite` (`test:cf`) | OK | Runs (full) | Task 2 |
| Admin Supabase suite | `admin-service/supabase/tests/` | OK | Runs (`npm install`; lockfile exists -> switch to `npm ci`) | Task 1 |
| Admin PocketBase suite (34 test files incl. perf) | `admin-service/pocketbase/tests/` | OK | NEVER RUN in CI | Task 1 |
| System E2E (Playwright chromium) | `system-e2e/` (boots admin:3001 + engine:3002 via `scripts/start-services.ts`; needs local Supabase) | Manual only | NEVER RUN in CI | Task 1 (main/nightly) |
| Deployment-matrix validator | `scripts/validate-deployment-matrix.ts` | OK | Unreferenced by any workflow | Task 1 |
| `deployment-matrix.json` consumers | — | — | Only the validator reads it; nothing else consumes it | Task 2 |
| Lint | root `npm run lint` (`eslint.config.mjs`) | Unverified (root deps absent locally) | Not run | Task 1 |
| Deploy gates | `build-push.yml`, `deploy-staging.yml`, `deploy-production.yml` | — | Deploys do not require CI success | Task 5 |

Note: the Phase-1 File Structure table listed `analytics-collector.contract.ts`, but it was never created (only `redirect-store` and `sync-manager` contracts exist). Task 3 delivers it.

## Layer model: do not multiply the pyramid by combinations

| Layer | Scope | Runs per... | Cost |
|---|---|---|---|
| L0 unit | `src/core/`, `src/use-cases/` (pure) | once — combo-independent by definition | seconds |
| L1 port contracts | each adapter x its port harness (`tests/contracts/`) | once per adapter, not per combo | seconds (miniflare for KV) |
| L2 admin integration | each admin flavor vs its DB, transformer, broadcaster | once per admin | minutes |
| L3 runtime E2E | `e2e-suite` with real runtime | per combination — smoke on PR, full on main | minutes |
| L4 system E2E | `system-e2e` Playwright with real admin + engine + DB | per `systemE2E: true` combination, main/nightly only | minutes |

CI cost stays O(adapters + combinations x smoke), not O(combinations x everything). Combinations only matter at L3/L4 and for runtime-specific adapter behavior at L1.

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `.github/workflows/ci.yml` | Parallel jobs; matrix fan-out; smoke/full tiers; coverage + lint gates; `workflow_call` |
| Modify | `.github/workflows/build-push.yml`, `.github/workflows/deploy-staging.yml`, `.github/workflows/deploy-production.yml` | Gate deploys on CI success for the same SHA |
| Modify | `deployment-matrix.json` | Add `analytics` + `capabilities` fields per combination |
| Modify | `scripts/validate-deployment-matrix.ts` | Analytics contract checks; bidirectional adapter <-> matrix checks; capabilities required; vendor hash check |
| Create | `scripts/sync-contract-vendor.ts` | Vendor `schemas.ts` into engine with SHA-256 header; `--check` mode for CI |
| Create | `admin-service/shared/sync-contract/schemas.ts` | Single-source Zod schemas for the SSE sync protocol |
| Create | `admin-service/shared/contracts/sync-stream.contract.ts` | Behavior contract factory both admins register against |
| Create | `admin-service/supabase/tests/sync-stream.contract.test.ts` | Registers Supabase admin against the shared behavior contract |
| Create | `admin-service/pocketbase/tests/sync-stream.contract.test.ts` | Registers PocketBase admin against the shared behavior contract |
| Create | `redir-engine/src/ports/IAnalyticsCollector.ts` | Extract the collector port currently implicit in `adapters/analytics/fire-and-forget.ts` |
| Create | `redir-engine/tests/contracts/analytics-collector.contract.ts` | Reusable test factory for `IAnalyticsCollector` |
| Create | `redir-engine/tests/contracts/analytics-collector.fire-and-forget.test.ts` | Runs contract against `FireAndForgetCollector` |
| Create | `redir-engine/tests/contracts/registry.ts` | Explicit adapter -> port -> contract-test -> matrix-key registry |
| Create | `redir-engine/tests/architecture/adapter-registration.test.ts` | Fails when any port implementation is unregistered or untested |
| Create | `redir-engine/tests/architecture/coverage-config.test.ts` | Fails when vitest coverage thresholds drop below committed baseline |
| Create | `redir-engine/src/generated/sync-schemas.ts` | GENERATED vendored copy (do not edit by hand) |
| Modify | `redir-engine/tests/architecture/dependency-rules.test.ts` | Known-violation lists become exact-match (stale entries fail) |
| Modify | `redir-engine/src/adapters/sse/sse-client.ts` | Validate inbound sync events with shared schema; log + skip invalid |
| Modify | `redir-engine/e2e-suite/utils/engine-controller.ts` | Combination-aware launcher (`runtime`, `store`, `sync`) |
| Modify | `redir-engine/e2e-suite/package.json` | Add `test:runtime` script for matrix-driven runs |
| Modify | `admin-service/supabase/package.json` | Align zod to the same major as PocketBase before sharing schemas |
| Modify | `AGENTS.md` | Definition-of-Done checklist for new adapters/runtimes/combinations |

---

### Task 1: Run everything that already exists in CI

**Files:**
- Modify: `.github/workflows/ci.yml`

Nothing new is built in this task; it closes the Phase-1 wiring gaps so every suite that already passes locally also passes (or fails) in CI.

- [ ] **Step 1: Restructure `ci.yml` into parallel jobs**

Split today's single serial job into: `engine`, `e2e-node`, `e2e-cf` (interim until Task 2), `admin-supabase`, `admin-pocketbase`, `validate`, `lint`. Add run cancellation and keep the existing npm cache settings:

```yaml
name: CI

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]
  schedule:
    - cron: '0 3 * * *'
  workflow_dispatch:

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
```

The two missing jobs (lockfiles exist for every service, so use `npm ci`):

```yaml
  admin-pocketbase:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
          cache-dependency-path: '**/package-lock.json'
      - run: npm ci
        working-directory: admin-service/pocketbase
      - run: npm test
        working-directory: admin-service/pocketbase

  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
          cache-dependency-path: '**/package-lock.json'
      - run: npm ci
      - run: npx tsx scripts/validate-deployment-matrix.ts
```

- [ ] **Step 2: Enforce coverage thresholds**

Engine job runs `npm run test:coverage` (thresholds 53/43/43/54 are already configured in `redir-engine/vitest.config.ts` but were never enforced because CI ran `npm test`).

- [ ] **Step 3: Add the system-e2e job (not on PRs)**

```yaml
  system-e2e:
    if: github.event_name != 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
          cache-dependency-path: '**/package-lock.json'
      - run: npx supabase start
      - run: npm ci
        working-directory: system-e2e
      - run: npx playwright install --with-deps chromium
        working-directory: system-e2e
      - name: Export Supabase env
        run: |
          npx supabase status -o env >> "$GITHUB_ENV"
      - run: npm test
        working-directory: system-e2e
        env:
          SUPABASE_URL: ${{ env.API_URL }}
          SUPABASE_KEY: ${{ env.ANON_KEY }}
          SUPABASE_SERVICE_KEY: ${{ env.SERVICE_ROLE_KEY }}
```

Adjust variable names to match `npx supabase status -o env` output on the pinned CLI version; `system-e2e/scripts/start-services.ts` boots the admin (port 3001) and engine (port 3002) itself.

- [ ] **Step 4: Add the lint job**

```yaml
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
          cache-dependency-path: '**/package-lock.json'
      - run: npm ci
      - run: npm run lint
```

If eslint is not green on first landing, use `continue-on-error: true` plus a tracked follow-up, and remove the escape hatch before this phase is declared complete. (Local status is unverified because root `node_modules` is not installed on this machine.)

- [ ] **Step 5: Verify and commit**

Expected: all jobs green, total billed minutes comparable to today's single job (billed minutes = sum of jobs; parallelization reduces wall time, not billing). Commit:

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run pocketbase, validate, coverage, lint, and system-e2e suites"
```

---

### Task 2: Matrix-driven CI fan-out (make the matrix executable)

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `redir-engine/e2e-suite/package.json`
- Modify: `redir-engine/e2e-suite/utils/engine-controller.ts`
- Modify: `deployment-matrix.json`

- [ ] **Step 1: Add the `matrix-setup` job**

```yaml
  matrix-setup:
    runs-on: ubuntu-latest
    outputs:
      combos: ${{ steps.combos.outputs.value }}
    steps:
      - uses: actions/checkout@v4
      - id: combos
        run: |
          node -e "process.stdout.write(JSON.stringify(require('./deployment-matrix.json').combinations))" > /tmp/combos.json
          echo "value=$(cat /tmp/combos.json)" >> "$GITHUB_OUTPUT"
```

- [ ] **Step 2: Fan E2E out from the matrix**

Replace the interim `e2e-node`/`e2e-cf` jobs:

```yaml
  e2e:
    needs: [matrix-setup]
    strategy:
      fail-fast: false
      matrix:
        combo: ${{ fromJSON(needs.matrix-setup.outputs.combos) }}
    name: E2E ${{ matrix.combo.id }}
    runs-on: ubuntu-latest
    env:
      TEST_RUNTIME: ${{ matrix.combo.engineRuntime }}
      E2E_QUICK_MODE: ${{ github.event_name == 'pull_request' && 'true' || 'false' }}
    steps:
      # checkout, setup-node, install redir-engine + e2e-suite deps...
      - run: npm run test:runtime
        working-directory: redir-engine/e2e-suite
```

Add `"test:runtime": "vitest --no-file-parallelism"` to `redir-engine/e2e-suite/package.json` so any `TEST_RUNTIME` value works without a matching script.

- [ ] **Step 3: Make the launcher combination-aware**

Extend `EngineController` to take a combination instead of a bare runtime:

```typescript
export interface EngineCombination {
  id: string;
  runtime: 'node' | 'cf-worker';
  store: string;
  sync: string;
}
```

For the initial implementation, map `store`/`sync` from the runtime bootstrap and assert consistency against the matrix entry (a mismatch fails loudly). Interim until runtimes accept `store`/`sync` parameters: gate SSE-sync-dependent specs with `describe.skipIf(process.env.TEST_RUNTIME === 'cf-worker')`.

- [ ] **Step 4: Add `capabilities` to the matrix and gate specs**

Give each combination a `capabilities` array (e.g. `["sse-sync", "kv-store", "cookies"]`) and replace ad-hoc runtime checks in specs with capability checks from the matrix entry. This is what lets a future `bun`/`deno`/`supabase-edge` runtime slot in without editing spec files.

- [ ] **Step 5: Gate the L4 job on the matrix flag**

The `system-e2e` job from Task 1 should only run for combinations with `"systemE2E": true` (today: `supabase-node`), driven by the same fan-out rather than a hand-written job.

- [ ] **Step 6: Verify and commit**

Verification: add a temporary 5th combination to `deployment-matrix.json` on a scratch branch, push, confirm a new CI leg appears with zero workflow edits; then remove it.

```bash
git add .github/workflows/ci.yml redir-engine/e2e-suite deployment-matrix.json
git commit -m "ci: fan out E2E legs from deployment-matrix.json"
```

---

### Task 3: Complete the analytics-port contract

**Files:**
- Create: `redir-engine/src/ports/IAnalyticsCollector.ts`
- Create: `redir-engine/tests/contracts/analytics-collector.contract.ts`
- Create: `redir-engine/tests/contracts/analytics-collector.fire-and-forget.test.ts`
- Modify: `deployment-matrix.json`
- Modify: `scripts/validate-deployment-matrix.ts`

The Phase-1 plan listed this file but it was never created; the validator already carries a `FireAndForgetCollector` alias, so wire the contract it expects.

- [ ] **Step 1: Extract the port**

Create `IAnalyticsCollector` with the public shape currently implemented by `adapters/analytics/fire-and-forget.ts` (`collect(event)`, `shutdown()`), keeping behavioral parity. `ports/ only imports from core/` in `dependency-rules.test.ts` automatically covers the new file.

- [ ] **Step 2: Write the contract factory**

Invariants every collector must satisfy:
- `collect()` never throws and never produces an unhandled rejection
- `collect()` resolves before/independently of transport completion (fire-and-forget)
- exactly one forward per `collect()` for accepted events
- transport failure is swallowed, logged, and does not poison later events
- `shutdown()` drains the queue

Use an injected mock transport so the contract is deterministic.

- [ ] **Step 3: Register `FireAndForgetCollector`**

`analytics-collector.fire-and-forget.test.ts` calls the factory with the adapter and an injected transport. When `public-share-shortener` lands its Cloudflare Analytics Engine adapter, register a second file (mock the `env.ANALYTICS` binding); the matrix field added below makes that a tracked obligation.

- [ ] **Step 4: Add the `analytics` field to the matrix and validator**

Add `"analytics": "FireAndForgetCollector"` to every combination (future CF combinations switch to the Analytics Engine collector when it exists). Extend `validate-deployment-matrix.ts` to run the existing contract-file check for the `analytics` value and include it in the summary output.

- [ ] **Step 5: Run and commit**

Run: `cd redir-engine && npm run test:contracts` and `npx tsx scripts/validate-deployment-matrix.ts`.

```bash
git add redir-engine/src/ports/IAnalyticsCollector.ts redir-engine/tests/contracts deployment-matrix.json scripts/validate-deployment-matrix.ts
git commit -m "feat(contracts): add IAnalyticsCollector port contract and matrix field"
```

---

### Task 4: Shared sync-protocol contract (kill dual-admin drift)

**Files:**
- Create: `admin-service/shared/sync-contract/schemas.ts`
- Create: `admin-service/shared/contracts/sync-stream.contract.ts`
- Create: `scripts/sync-contract-vendor.ts`
- Create: `redir-engine/src/generated/sync-schemas.ts` (generated)
- Create: `admin-service/supabase/tests/sync-stream.contract.test.ts`
- Create: `admin-service/pocketbase/tests/sync-stream.contract.test.ts`
- Modify: `redir-engine/src/adapters/sse/sse-client.ts`
- Modify: `admin-service/supabase/package.json` (zod alignment)

- [ ] **Step 1: Align zod versions**

Supabase admin uses zod `^3.24.0`, PocketBase admin uses `^4.3.6`. Raise Supabase to the same major as PocketBase, run its suite, and fix fallout before sharing schemas.

- [ ] **Step 2: Author the single-source schemas**

`admin-service/shared/sync-contract/schemas.ts`: `RedirectRuleSchema` (camelCase, matching the engine's `RedirectRule`), `SyncEventSchema` as a discriminated union (`snapshot`/`upsert`/`delete`), and a `parseSyncEvent` helper returning a result object (never throws). This file is the contract; both admins and the engine must validate against it.

- [ ] **Step 3: Vendor the schemas into the engine with a drift check**

No npm workspaces exist; do not introduce them in this phase. Instead create `scripts/sync-contract-vendor.ts`:
- default mode: copy `admin-service/shared/sync-contract/schemas.ts` to `redir-engine/src/generated/sync-schemas.ts` with a header `// GENERATED - sha256: <hash> - run scripts/sync-contract-vendor.ts`
- `--check` mode: recompute the hash and exit non-zero on drift

Wire `--check` into `scripts/validate-deployment-matrix.ts` (or a dedicated CI step). Drift becomes mechanically impossible: edit the schema without re-vendoring and CI fails.

- [ ] **Step 4: Validate inbound events in the engine**

`redir-engine/src/adapters/sse/sse-client.ts` currently `JSON.parse`s with no validation (tracked review finding). Replace with `parseSyncEvent`; invalid events are logged and skipped. Add contract/unit cases: malformed payloads are ignored, valid payloads pass, unknown event types are skipped without throwing.

- [ ] **Step 5: Register both admins against the behavior contract**

`admin-service/shared/contracts/sync-stream.contract.ts` exports a factory parameterized by `{ name, seedLink, openStream, readEvents }`. Both admins add a thin `sync-stream.contract.test.ts` that supplies their own transport and DB seed. Acceptance marker: both admin test directories import the shared factory; no duplicated expectation logic. Also parse each admin's transformer output with `RedirectRuleSchema` inside its existing transformer tests.

- [ ] **Step 6: Run and commit**

```bash
git add admin-service/shared admin-service/supabase/tests admin-service/pocketbase/tests scripts/sync-contract-vendor.ts redir-engine/src/generated redir-engine/src/adapters/sse/sse-client.ts
git commit -m "feat(sync): single-source sync protocol schemas with vendored drift check"
```

---

### Task 5: Ratchets that prevent erosion

**Files:**
- Create: `redir-engine/tests/contracts/registry.ts`
- Create: `redir-engine/tests/architecture/adapter-registration.test.ts`
- Create: `redir-engine/tests/architecture/coverage-config.test.ts`
- Modify: `redir-engine/tests/architecture/dependency-rules.test.ts`
- Modify: `scripts/validate-deployment-matrix.ts`
- Modify: `.github/workflows/*.yml` (deploy gating)
- Modify: `AGENTS.md`

- [ ] **Step 1: Adapter registry + registration test**

`tests/contracts/registry.ts` declares every adapter explicitly:

```typescript
export const CONTRACT_REGISTRY = [
  { adapter: 'InMemoryStore', port: 'IRedirectStore', contractTest: 'redirect-store.in-memory.test.ts', matrixKey: 'store' },
  { adapter: 'CloudflareKVStore', port: 'IRedirectStore', contractTest: 'redirect-store.cf-kv.test.ts', matrixKey: 'store' },
  { adapter: 'SSESyncAdapter', port: 'ISyncManager', contractTest: 'sync-manager.sse.test.ts', matrixKey: 'sync' },
  { adapter: 'NoOpSyncAdapter', port: 'ISyncManager', contractTest: 'sync-manager.noop.test.ts', matrixKey: 'sync' },
  { adapter: 'FireAndForgetCollector', port: 'IAnalyticsCollector', contractTest: 'analytics-collector.fire-and-forget.test.ts', matrixKey: 'analytics' },
] as const;
```

`adapter-registration.test.ts` (source-scanning, same style as `dependency-rules.test.ts`):
- scan `src/adapters/**/*.ts` for `export class X implements <ports>`; every class implementing `IRedirectStore`/`ISyncManager`/`IAnalyticsCollector` must appear in the registry (or in an `INTERNAL_ONLY` list with a mandatory reason string)
- every registry entry's `contractTest` file must exist in `tests/contracts/`
- every registry entry's name must appear in `deployment-matrix.json` under its `matrixKey`

A new adapter now fails CI until it is contract-tested and matrix-registered.

- [ ] **Step 2: Make the validator bidirectional**

Extend `scripts/validate-deployment-matrix.ts`:
- every store/sync/analytics named in the matrix must be an exported class in `redir-engine/src/adapters/`
- every combination must declare `capabilities` and `systemE2E`
- every `systemE2E: true` combination must map to a launcher-supported runtime (keep an explicit allowlist in the validator; update it when `system-e2e` gains a new flavor)

- [ ] **Step 3: Make architecture violation lists exact-match**

In `dependency-rules.test.ts`, `KNOWN_USE_CASE_ADAPTER_IMPORTS` and `KNOWN_CROSS_ADAPTER_IMPORTS` currently fail on growth only; stale entries silently linger. Add a stale-entry assertion: a known violation that no longer occurs must fail with "remove the stale entry". The lists then can only shrink — refactors must pay down the debt to stay green.

- [ ] **Step 4: Coverage ratchet test**

`tests/architecture/coverage-config.test.ts` imports `vitest.config.ts`, reads `test.coverage.thresholds`, and asserts each value is >= a committed `BASELINE` constant in the test. Lowering the config below baseline fails; raising coverage requires deliberately raising the baseline. Combined with Task 1 Step 2 (CI runs `test:coverage`), thresholds cannot silently rot. Follow-up (not this phase): per-directory floor for `src/core/`.

- [ ] **Step 5: Gate deploys on CI success**

Make `ci.yml` reusable (`on: workflow_call`) and add it as the first job of `deploy-production.yml` (`uses: ./.github/workflows/ci.yml`), so a tag cannot deploy a red SHA. For `deploy-staging.yml`, replace the `workflow_run` trigger on "Build and Push Docker Images" with CI success (or chain CI -> build-push -> deploy via `needs`).

- [ ] **Step 6: Record the Definition of Done**

Append to `AGENTS.md` an "Adding adapters, runtimes, or combinations" checklist: (1) register the adapter in `tests/contracts/registry.ts` with a contract test, (2) add it to `deployment-matrix.json`, (3) run `npx tsx scripts/validate-deployment-matrix.ts`, (4) add capabilities to any new combination. Steps 1-2 are enforced mechanically by Step 1 and Step 2.

- [ ] **Step 7: Verify and commit**

Verification on a scratch branch: add a dummy adapter class -> CI fails (registration test + validator); add `{ statements: 10 }` to vitest config -> coverage ratchet test fails; add a stale known-violation entry -> architecture test fails.

```bash
git add redir-engine/tests scripts .github/workflows AGENTS.md
git commit -m "chore(test-ratchet): enforce adapter registration, stale pruning, coverage baseline, deploy gating"
```

---

### Task 6: Sequencing and budget

Tasks are ordered by dependency; this is how they map onto the ADR-007 pivot (`public-share-shortener` ships first):

| Task | When | Why |
|---|---|---|
| 1 (CI wiring) | Now | Cheap, immediate safety net; no new code |
| 3 (analytics contract) | With the shortener | Its CF Analytics Engine adapter needs a contract to register against |
| 2 (matrix fan-out) | Before the shortener ships | The shipping combination is `pocketbase-cf`; fan-out must exist to give it an L3/L4 leg |
| 5 Step 6 (DoD text) | Now | Costs nothing; every later task benefits |
| 4 (sync contract) | After the shortener ships | Dual-admin drift work belongs to the postponed SaaS direction but the schema alignment is a prerequisite for any later engine work |
| 5 (ratchets), 6 | Post-ship | Consolidation phase before `multi-platform-deploy-templates` adds runtimes |

Budget reality (GitHub Actions, verified 2026-09-30): Free plan includes 2,000 GitHub-hosted minutes/month on private repos; Pro ($4/mo) includes 3,000; Linux 2-core overage is $0.006/min; public repos are unlimited. A disciplined tiered setup (smoke on PR, full + system-e2e on main/nightly) is estimated at ~25-35 billed minutes per PR and fits Free. The heavy L4/nightly legs should run on a self-hosted runner if one exists (currently free; note GitHub postponed the March-2026 self-hosted billing change — recheck before relying on it). Worst case remains under ~$15/mo, so tiering decisions should be driven by wall-clock and signal quality, not cost.

---

## Verification Checklist

After all tasks are complete:

- [ ] CI runs and gates: engine (incl. contracts, architecture, coverage), e2e node, e2e cf, admin supabase, admin pocketbase, validate, lint, system-e2e (main/nightly)
- [ ] Adding a combination to `deployment-matrix.json` produces a CI leg with zero workflow edits
- [ ] Adding a port-implementing adapter without registry entry or contract test fails CI
- [ ] A store/sync/analytics name in the matrix with no matching source adapter fails the validator
- [ ] A stale entry in a known-violations list fails the architecture tests
- [ ] Lowering coverage thresholds below the committed baseline fails CI
- [ ] `scripts/sync-contract-vendor.ts --check` fails when the schema is edited without re-vendoring
- [ ] Malformed SSE events are skipped (not thrown) by the engine, covered by tests
- [ ] Both admin test suites run the shared `sync-stream.contract.ts` factory
- [ ] Deploy workflows refuse a SHA whose CI is red
- [ ] No new `any` usage; `npm run lint` green
