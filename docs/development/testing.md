# Testing Guide

This guide details the testing strategy, commands, and configurations for the `url-redir-short` system.

## Test Strategy Overview

The testing strategy follows a standard pyramid approach:
1. **Unit Tests (Vitest):** Fast, isolated tests for pure domain functions, utilities, and isolated components. High coverage is expected here.
2. **Integration/Adapter Tests:** Tests verifying the boundaries, such as the Doubly Linked List, SSE Client backoff logic, and Hono routing.
3. **End-to-End (E2E) Tests:** Full system tests verifying the Admin Service and Redirect Engine work together seamlessly (e.g., creating a link in Admin and ensuring the Engine redirects correctly).
4. **Performance Tests:** Benchmarks ensuring the core algorithms (Cuckoo Filter, Radix Tree) meet strict latency requirements.

## 1. Unit Tests

Both the Admin Service and the Redirect Engine utilize Vitest as the core test runner.

### Admin Service Tests

Located in `admin-service/supabase/tests/`.

```bash
cd admin-service/supabase
npm run test
```
*Note: These tests cover utilities like the transformer, rate-limit, hashing, QR generation, broadcaster, and Vue components.*

### Redirect Engine Tests

Located in `redir-engine/tests/`.

```bash
cd redir-engine
npm run test
```
*Note: These cover the Clean Architecture core domain (Radix Tree, Cuckoo Filter), use cases (handle-request), and adapters.*

## 2. End-to-End (E2E) Tests

The E2E tests are crucial as they verify the SSE synchronization protocol. They are located in the `redir-engine/e2e-suite/` directory.

The E2E suite usually orchestrates a mock or real Admin Service instance alongside the Engine to simulate full user flows.

```bash
cd redir-engine/e2e-suite
npm install
npm test
```

To run a specific test suite during debugging:
```bash
npm test -- specs/T01-basic.test.ts
```

## 3. Performance Testing

Because the Redirect Engine is designed for high throughput at the edge, performance tests are strictly maintained to catch performance regressions.

### Unit Benchmarks

Located in `redir-engine/tests/perf/`.

```bash
cd redir-engine
npm run test:perf        # run benchmarks
npm run test:perf:watch  # watch mode
```

Benchmarks cover:
- **Cuckoo Filter** (`tests/perf/cuckoo-filter.bench.ts`): insert, lookup (hit/miss), delete, mixed workload, memory fill factor
- **Radix Tree** (`tests/perf/radix-tree.bench.ts`): shallow/deep insert, lookup, delete, mixed workload, real-world URL patterns

### E2E Load Tests

Located in `redir-engine/e2e-suite/specs/T12-performance.test.ts`.

```bash
cd redir-engine/e2e-suite
npm run test:performance
```

Covers: routing table scaling (1K/10K), concurrent requests (10/50/100), 404 rejection efficiency, hot-path 80/20 traffic, sustained 50 RPS.

### Established Performance Baselines

These baselines were established on hardware as of January 2026 and serve as the regression benchmark:

| Metric | Result | Target |
|--------|--------|--------|
| Cuckoo Filter inserts (1K–100K) | 9,750–29,447 ops/sec | — |
| Cuckoo Filter lookups | 64,254–90,318 ops/sec | — |
| Cuckoo Filter memory (10K items) | ~3 MB | — |
| Radix Tree inserts (deep→shallow) | 112K–733K ops/sec | — |
| Radix Tree lookups | 1.5M–7.3M ops/sec | — |
| HTTP redirect avg (1K routes) | < 100ms | < 10ms p99 |
| HTTP redirect avg (10K routes) | < 150ms | < 10ms p99 |
| Concurrent (50 req) avg | < 300ms | — |
| Concurrent (100 req) avg | < 500ms | — |
| Sustained 50 RPS avg | < 200ms | — |

## Continuous Integration (CI)

All test suites (Unit, E2E, and Perf) are automatically run via GitHub Actions on every Pull Request and push to the `main` branch. A PR cannot be merged if any test fails. See the [CI/CD Pipeline](cd-pipeline.md) for more details.

## Adding Tests

**Rule of thumb:** If you add a feature or fix a bug, you must add a corresponding test.
- For business logic changes, add a Unit Test.
- For state/sync changes, update or add an E2E test suite in `e2e-suite/specs/`.
- For hot-path changes in the engine, ensure existing performance tests still pass, or add a new benchmark.
