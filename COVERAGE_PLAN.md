# Test Coverage Analysis & Plan

This document outlines the current state of automated test coverage across the `url-redir-short` repository and provides a comprehensive, actionable plan to reach greater than 95% test coverage across all subsystems.

## 1. Current Coverage Report

### 1.1 Redir-Engine (Hono-based Redirector)
- **Framework:** Vitest with `@vitest/coverage-v8`
- **Current Coverage Overview:**
  - **Overall:** ~86.34% Statements, ~73.45% Branches, ~84.61% Functions, ~86.54% Lines.
  - **Core/Filtering (`CuckooFilter`):** Excellent (100% Statements)
  - **Adapters/Cache (`DoublyLinkedList`):** Excellent (~97.7%)
  - **Core/Routing (`RadixTree`):** Excellent (~95.3%)
  - **Adapters/Metrics (`prometheus.ts`):** Moderate (~73.3%)
  - **Core/Utils (`LRUCache`):** Moderate (~62.5%)
  - **Use-Cases (`HandleRequestUseCase`):** Moderate (~77.9%). A few specific paths (e.g., handling complex Edge Cases or fallback logic) are missing coverage.
- **Summary:** The core routing and filtering algorithms are well-tested. The primary gaps are in caching utilities (LRUCache), Prometheus metric collection endpoints, and edge cases inside the main request handler (`use-cases/handle-request.ts`).

### 1.2 Admin Service - PocketBase (Nuxt 4 / Vue 3)
- **Framework:** Vitest with `@vitest/coverage-v8`
- **Current Coverage Overview:**
  - **Overall:** ~71.93% Statements, ~67% Branches, ~77.33% Functions, ~71.39% Lines.
  - **Utilities (`app/utils`, `server/utils/qr.ts`, `server/utils/hash.ts`, `server/utils/bulk.ts`, etc.):** Excellent (100%)
  - **Composables (`useUtmTemplates.ts`):** Strong (~90.6%)
  - **Transformers & Sanitizers:** Moderate to Strong (~53-95%)
  - **API Handlers:** Highly variable. E.g., `api/analytics/stats.get.ts` has 100%, but `api/links/[linkId]/detailed.get.ts` has ~57.8%.
  - **Middleware (`server/middleware/1.security.ts`):** Low (~44%). The request handling and security check conditions are lacking.
  - **Monitoring/Logging Utilities (`server/utils/monitoring.ts`):** Low (~38%).
- **Summary:** Basic utility functions are thoroughly tested. API handlers, Nuxt server middleware (specifically security), and complex monitoring integrations are dragging down the coverage percentage. No coverage exists for Vue UI components.

### 1.3 Admin Service - Supabase (Nuxt 4 / Vue 3)
- **Framework:** Vitest, `@nuxt/test-utils`, `@vue/test-utils`
- **Current Coverage Overview:**
  - **Overall:** ~28.21% Statements, ~66.9% Branches, ~38.29% Functions, ~28.21% Lines.
  - **Components (`app/components`):** Excellent (100%) on the tested subsets, but testing overall component behavior needs expansion.
  - **API Endpoints:** Very Low (0%). Nuxt Nitro endpoints heavily rely on Supabase and Valkey/Redis, causing crashes in CI/CD or local test runs when mocked environments aren't properly bootstrapped.
  - **Utilities:** Mixed. Some pure logic files (`hash.ts`, `transformer.ts`, `bulk.ts`) have 100%. Integration-heavy files (`error-handler.ts`, `logger.ts`, `cloudflare-kv.ts`) have 0%.
- **Summary:** The current Vitest configuration struggles with `Nuxt + Supabase + Redis` integration. Due to startup crashes and circular dependencies during SSR, coverage is severely hampered.

### 1.4 E2E Suites
- **Framework:** Playwright (`system-e2e`) / Custom Vitest Node Mocks (`redir-engine/e2e-suite`)
- **Current Status:**
  - `redir-engine/e2e-suite` runs effectively but is testing the Engine against mock Admin/Analytics services. It provides functional confidence but shouldn't strictly be counted towards the "unit/integration" statement coverage metric.
  - `system-e2e` lacks broad coverage generation currently.

---

## 2. Comprehensive Plan to Reach > 95% Coverage

Achieving > 95% test coverage requires a systematic approach, tackling each subsystem with specific testing strategies.

### Phase 1: Redir-Engine (Hono)

**Goal:** Push from ~86% to > 95%.

1.  **Mocking the Cache (`core/utils/lru-cache.ts`):**
    -   Write explicit unit tests simulating cache eviction policies (e.g., ensuring old elements drop out when max capacity is reached).
    -   Test corner cases: evicting the last item, fetching a non-existent item, updating an existing item.
2.  **Metrics Coverage (`adapters/metrics/prometheus.ts`):**
    -   Since it interacts with `prom-client`, mock the `prom-client` registers.
    -   Simulate requests and assert that `incrementCounter` or `observeHistogram` are invoked.
3.  **Use Cases (`use-cases/handle-request.ts`):**
    -   Isolate the untested branches: e.g., what happens when `store.get()` throws an unexpected error, or when `req.raw` lacks expected headers.
    -   Test edge-case redirect configurations: malformed URLs in the store, missing tracking flags.

### Phase 2: Admin Service - PocketBase (Nuxt)

**Goal:** Push from ~72% to > 95%.

1.  **API Handler Integration Tests:**
    -   Use `vi.mock('h3', ...)` aggressively to mock H3 event contexts (`createEvent()`).
    -   Mock the PocketBase client helper (`server/utils/pocketbase.ts`) completely. Prevent actual network requests.
    -   Write tests for `detailed.get.ts` and `[format].get.ts` focusing on the data transformation loops and error handling blocks (e.g., what if PocketBase returns a 500?).
2.  **Middleware & Monitoring:**
    -   For `security.ts`, create synthetic `H3Event` objects simulating missing API keys, incorrect IP hashes, and bypass routes (like `/health`).
    -   For `monitoring.ts`, mock `performance.now()` and test the aggregation logic over time windows.
3.  **UI Component Testing (Vue):**
    -   *Note: While memory guidelines say "do not write automated tests for Vue pages", if we intend to hit >95% overall repository coverage, we must either exclude Vue pages from the coverage report or use `@vue/test-utils` for components.*
    -   Strategy: Rely heavily on E2E testing for the UI, and exclude `.vue` files from the Vitest coverage threshold strictly if they are intended purely for E2E. If required for unit coverage: Mock `$fetch` using `vi.stubGlobal('fetch')`.

### Phase 3: Admin Service - Supabase (Nuxt)

**Goal:** Push from ~28% to > 95%. This is the most critical area.

1.  **Resolve Nuxt Nitro Bootstrapping Issues:**
    -   The immediate failure point is Redis/Supabase connectivity during test startup.
    -   **Action:** Ensure `vitest.config.ts` or the `setupFiles` inject mock environment variables (`SUPABASE_URL`, `SUPABASE_KEY`, `REDIS_URL`) *before* the Nuxt context boots.
2.  **Mocking External Clients:**
    -   Use `ioredis-mock` instead of actual Redis. Ensure the global `ioredis` import is replaced with the mock.
    -   Mock the `@nuxtjs/supabase` auto-imports (`serverSupabaseClient`, `serverSupabaseServiceRole`).
3.  **Targeting 0% Coverage Files:**
    -   Write isolated unit tests for `error-handler.ts`, `cloudflare-kv.ts`, and `logger.ts` by bypassing Nuxt and testing the pure TypeScript logic.
    -   For API endpoints (e.g., `create.post.ts`), use `@nuxt/test-utils` `setup()` function, pass mocked payloads, and assert the mocked Supabase client receives the correct `.insert()` call.

### Phase 4: E2E and System Testing

**Goal:** Verify integration points and UI flows.

1.  **Playwright System Tests:**
    -   Implement standard User Journeys: Login -> Create Link -> Visit Link (hits engine) -> Check Analytics.
    -   Verify the UI renders correctly (leveraging visual snapshots or element assertions).
2.  **Performance Constraints:**
    -   Ensure `redir-engine/e2e-suite` performance tests remain isolated and do not skew coverage metrics.

## 3. Immediate Action Items (Next Steps for Execution)

1.  **Supabase Test Environment:** Fix the `ECONNREFUSED` Redis errors and Supabase missing credential errors in `admin-service/supabase/tests/integration/*.ts`.
2.  **Redir-Engine LRU/Metrics:** Add tests for `lru-cache.ts` and `prometheus.ts`.
3.  **PocketBase API handlers:** Mock the PocketBase client in `detailed.get.ts` to cover the missing 50% of lines.
4.  **Enforce Coverage Thresholds:** Update the respective `vitest.config.ts` files to set `coverage: { thresholds: { lines: 95, branches: 95, functions: 95, statements: 95 } }`.
