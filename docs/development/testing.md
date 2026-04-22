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

These tests are located in `redir-engine/tests/perf/`.

```bash
cd redir-engine
npm run test:perf
```

Benchmarks cover:
- Radix tree routing speed.
- Cuckoo filter insertion and existence checks.
- LRU Cache eviction latency.
- Payload builder allocation speed.

## Continuous Integration (CI)

All test suites (Unit, E2E, and Perf) are automatically run via GitHub Actions on every Pull Request and push to the `main` branch. A PR cannot be merged if any test fails. See the [CI/CD Pipeline](cd-pipeline.md) for more details.

## Adding Tests

**Rule of thumb:** If you add a feature or fix a bug, you must add a corresponding test.
- For business logic changes, add a Unit Test.
- For state/sync changes, update or add an E2E test suite in `e2e-suite/specs/`.
- For hot-path changes in the engine, ensure existing performance tests still pass, or add a new benchmark.
