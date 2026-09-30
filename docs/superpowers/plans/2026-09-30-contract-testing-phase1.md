# Contract Testing & Architecture Enforcement — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce contract test harnesses for every hexagonal port, architecture boundary tests, and a deployment-matrix manifest — so that new adapters and combinations cannot ship without tests.

**Architecture:** Reusable Vitest test factories per port interface (`IRedirectStore`, `ISyncManager`, `AnalyticsCollector`). Each adapter implementation registers itself against the shared contract. A filesystem-scanning architecture test enforces dependency rules. A `deployment-matrix.json` manifest + validation script ensures CI coverage of every declared combination.

**Tech Stack:** Vitest, TypeScript, Node.js `fs` API for architecture scanning.

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `redir-engine/tests/contracts/redirect-store.contract.ts` | Reusable test factory for `IRedirectStore` |
| Create | `redir-engine/tests/contracts/redirect-store.in-memory.test.ts` | Runs contract against `InMemoryStore` |
| Create | `redir-engine/tests/contracts/redirect-store.cf-kv.test.ts` | Runs contract against `CloudflareKVStore` |
| Create | `redir-engine/tests/contracts/sync-manager.contract.ts` | Reusable test factory for `ISyncManager` |
| Create | `redir-engine/tests/contracts/sync-manager.noop.test.ts` | Runs contract against `NoOpSyncAdapter` |
| Create | `redir-engine/tests/contracts/sync-manager.sse.test.ts` | Runs contract against `SSESyncAdapter` |
| Create | `redir-engine/tests/contracts/analytics-collector.contract.ts` | Reusable test factory for `AnalyticsCollector` |
| Create | `redir-engine/tests/contracts/analytics-collector.fire-and-forget.test.ts` | Runs contract against `FireAndForgetCollector` |
| Create | `redir-engine/tests/architecture/dependency-rules.test.ts` | Enforces hexagonal import boundaries |
| Create | `deployment-matrix.json` | Machine-readable manifest of supported combos |
| Create | `scripts/validate-deployment-matrix.ts` | CI script that validates matrix completeness |
| Modify | `redir-engine/package.json` | Add `test:contracts` and `test:architecture` scripts |

---

### Task 1: IRedirectStore Contract Harness

**Files:**
- Create: `redir-engine/tests/contracts/redirect-store.contract.ts`

This is the core reusable test factory. It defines the behavioral invariants that *every* `IRedirectStore` implementation must satisfy.

- [ ] **Step 1: Create the contract test factory**

```typescript
// redir-engine/tests/contracts/redirect-store.contract.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IRedirectStore } from '../../src/ports/IRedirectStore';
import { RedirectRule } from '../../src/core/config/types';

interface ContractContext {
  store: IRedirectStore;
  teardown?: () => Promise<void>;
}

const sampleRule: RedirectRule = {
  id: 'rule-1',
  path: '/hello',
  destination: 'https://example.com',
  code: 301,
};

const sampleRule2: RedirectRule = {
  id: 'rule-2',
  path: '/world',
  destination: 'https://other.com',
  code: 302,
};

const ruleWithFeatures: RedirectRule = {
  id: 'rule-3',
  path: '/advanced',
  destination: 'https://advanced.com',
  code: 301,
  ab_testing: {
    enabled: true,
    variations: [
      { id: 'v1', destination: 'https://var1.com', weight: 50 },
      { id: 'v2', destination: 'https://var2.com', weight: 50 },
    ],
  },
  targeting: {
    enabled: true,
    rules: [
      { id: 't1', target: 'country', value: 'us', destination: 'https://us.com' },
    ],
  },
  hsts: { enabled: true, maxAge: 31536000 },
  password_protection: { enabled: false, password: '' },
  expiresAt: Date.now() + 86400000,
  maxClicks: 100,
  isActive: true,
};

export function redirectStoreContract(
  name: string,
  factory: () => Promise<ContractContext>
) {
  describe(`IRedirectStore contract: ${name}`, () => {
    let ctx: ContractContext;

    beforeEach(async () => {
      ctx = await factory();
    });

    afterEach(async () => {
      await ctx.teardown?.();
    });

    // --- CRUD roundtrip ---

    it('stores and retrieves a rule by path', async () => {
      await ctx.store.addRedirect(sampleRule);
      const result = await ctx.store.getRedirect('/hello');
      expect(result).toEqual(sampleRule);
    });

    it('returns null for a non-existent path', async () => {
      const result = await ctx.store.getRedirect('/nonexistent');
      expect(result).toBeNull();
    });

    it('overwrites an existing rule on re-add', async () => {
      await ctx.store.addRedirect(sampleRule);
      const updated: RedirectRule = { ...sampleRule, destination: 'https://updated.com' };
      await ctx.store.addRedirect(updated);
      const result = await ctx.store.getRedirect('/hello');
      expect(result?.destination).toBe('https://updated.com');
    });

    it('removes a rule by path', async () => {
      await ctx.store.addRedirect(sampleRule);
      await ctx.store.removeRedirect('/hello');
      const result = await ctx.store.getRedirect('/hello');
      expect(result).toBeNull();
    });

    it('removeRedirect is a no-op for non-existent paths', async () => {
      await expect(ctx.store.removeRedirect('/ghost')).resolves.not.toThrow();
    });

    // --- Multiple rules ---

    it('stores and retrieves multiple independent rules', async () => {
      await ctx.store.addRedirect(sampleRule);
      await ctx.store.addRedirect(sampleRule2);

      expect(await ctx.store.getRedirect('/hello')).toEqual(sampleRule);
      expect(await ctx.store.getRedirect('/world')).toEqual(sampleRule2);
    });

    it('removing one rule does not affect another', async () => {
      await ctx.store.addRedirect(sampleRule);
      await ctx.store.addRedirect(sampleRule2);
      await ctx.store.removeRedirect('/hello');

      expect(await ctx.store.getRedirect('/hello')).toBeNull();
      expect(await ctx.store.getRedirect('/world')).toEqual(sampleRule2);
    });

    // --- mightExist ---

    it('mightExist returns true for a stored slug', async () => {
      await ctx.store.addRedirect(sampleRule);
      expect(await ctx.store.mightExist('/hello')).toBe(true);
    });

    it('mightExist returns false or true for non-existent slug (probabilistic OK)', async () => {
      const result = await ctx.store.mightExist('/does-not-exist');
      // Probabilistic structures (Cuckoo, Bloom) may return true (false positive).
      // The contract only requires: if the slug IS stored, mightExist MUST return true.
      // A false positive for a non-stored slug is acceptable.
      expect(typeof result).toBe('boolean');
    });

    // --- Complex rules ---

    it('preserves all fields of a complex rule through roundtrip', async () => {
      await ctx.store.addRedirect(ruleWithFeatures);
      const result = await ctx.store.getRedirect('/advanced');
      expect(result).toEqual(ruleWithFeatures);
    });
  });
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd redir-engine && npx tsc --noEmit tests/contracts/redirect-store.contract.ts --esModuleInterop --module nodenext --moduleResolution nodenext --target es2022 --strict`

Expected: No errors (this file has no runnable tests of its own, only exports a factory).

- [ ] **Step 3: Commit**

```bash
git add redir-engine/tests/contracts/redirect-store.contract.ts
git commit -m "test: add IRedirectStore contract test harness"
```

---

### Task 2: Register InMemoryStore Against Contract

**Files:**
- Create: `redir-engine/tests/contracts/redirect-store.in-memory.test.ts`

- [ ] **Step 1: Write the contract registration test**

```typescript
// redir-engine/tests/contracts/redirect-store.in-memory.test.ts
import { redirectStoreContract } from './redirect-store.contract';
import { InMemoryStore } from '../../src/adapters/store/in-memory-store';
import { RadixTree } from '../../src/core/routing/radix-tree';
import { CuckooFilter } from '../../src/core/filtering/cuckoo-filter';

redirectStoreContract('InMemoryStore', async () => ({
  store: new InMemoryStore(new RadixTree(), new CuckooFilter(10000)),
}));
```

- [ ] **Step 2: Run the tests**

Run: `cd redir-engine && npx vitest run tests/contracts/redirect-store.in-memory.test.ts`

Expected: All tests PASS. InMemoryStore fully satisfies the contract.

- [ ] **Step 3: Commit**

```bash
git add redir-engine/tests/contracts/redirect-store.in-memory.test.ts
git commit -m "test: register InMemoryStore against IRedirectStore contract"
```

---

### Task 3: Register CloudflareKVStore Against Contract

**Files:**
- Create: `redir-engine/tests/contracts/redirect-store.cf-kv.test.ts`

This test uses a `Map`-backed mock of `KVNamespace` — the same pattern as the existing `storage.test.ts` but through the contract harness.

- [ ] **Step 1: Write the contract registration test**

```typescript
// redir-engine/tests/contracts/redirect-store.cf-kv.test.ts
import { redirectStoreContract } from './redirect-store.contract';
import { CloudflareKVStore } from '../../src/adapters/storage/CloudflareKVStore';

function createMockKV(): KVNamespace {
  const data = new Map<string, string>();
  return {
    get: async (key: string) => data.get(key) ?? null,
    put: async (key: string, value: string) => { data.set(key, value); },
    delete: async (key: string) => { data.delete(key); },
    list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
    getWithMetadata: async () => ({ value: null, metadata: null, cacheStatus: null }),
  } as unknown as KVNamespace;
}

redirectStoreContract('CloudflareKVStore', async () => ({
  store: new CloudflareKVStore({ REDIRECTS_KV: createMockKV() }),
}));
```

- [ ] **Step 2: Run the tests**

Run: `cd redir-engine && npx vitest run tests/contracts/redirect-store.cf-kv.test.ts`

Expected: All tests PASS. If the "overwrites an existing rule on re-add" test fails, it's because `CloudflareKVStore.addRedirect` uses `rule.path` as the key — this should work because the updated rule still has the same `path`.

- [ ] **Step 3: Commit**

```bash
git add redir-engine/tests/contracts/redirect-store.cf-kv.test.ts
git commit -m "test: register CloudflareKVStore against IRedirectStore contract"
```

---

### Task 4: ISyncManager Contract Harness

**Files:**
- Create: `redir-engine/tests/contracts/sync-manager.contract.ts`

The `ISyncManager` contract is behavioral: `start()`/`stop()` must be idempotent, `onUpdate` must register a callback.

- [ ] **Step 1: Create the contract test factory**

```typescript
// redir-engine/tests/contracts/sync-manager.contract.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ISyncManager } from '../../src/ports/ISyncManager';
import { RedirectRuleUpdate } from '../../src/core/config/types';

interface ContractContext {
  adapter: ISyncManager;
  /** Optional: trigger an update event on the adapter (for adapters that support it in test mode) */
  triggerUpdate?: (update: RedirectRuleUpdate) => void;
  teardown?: () => Promise<void>;
}

export function syncManagerContract(
  name: string,
  factory: () => Promise<ContractContext>
) {
  describe(`ISyncManager contract: ${name}`, () => {
    let ctx: ContractContext;

    beforeEach(async () => {
      ctx = await factory();
    });

    afterEach(async () => {
      ctx.adapter.stop();
      await ctx.teardown?.();
    });

    // --- Lifecycle ---

    it('start() resolves without throwing', async () => {
      await expect(ctx.adapter.start()).resolves.not.toThrow();
    });

    it('stop() does not throw', () => {
      expect(() => ctx.adapter.stop()).not.toThrow();
    });

    it('start() is idempotent (calling twice does not throw)', async () => {
      await ctx.adapter.start();
      await expect(ctx.adapter.start()).resolves.not.toThrow();
    });

    it('stop() is idempotent (calling twice does not throw)', async () => {
      await ctx.adapter.start();
      ctx.adapter.stop();
      expect(() => ctx.adapter.stop()).not.toThrow();
    });

    it('stop() before start() does not throw', () => {
      expect(() => ctx.adapter.stop()).not.toThrow();
    });

    // --- Callback registration ---

    it('onUpdate() accepts a callback without error', () => {
      const callback = vi.fn();
      expect(() => ctx.adapter.onUpdate(callback)).not.toThrow();
    });

    it('onUpdate() can be called before start()', () => {
      const callback = vi.fn();
      ctx.adapter.onUpdate(callback);
      // Callback should not have been called yet
      expect(callback).not.toHaveBeenCalled();
    });

    // --- Update delivery (only if triggerUpdate is provided) ---

    it('delivers updates to registered callback', async () => {
      if (!ctx.triggerUpdate) return; // Skip for adapters that can't be triggered in unit tests

      const callback = vi.fn();
      ctx.adapter.onUpdate(callback);
      await ctx.adapter.start();

      const update: RedirectRuleUpdate = {
        type: 'create',
        data: { id: '1', path: '/test', destination: 'https://example.com', code: 301 },
      };

      ctx.triggerUpdate(update);

      expect(callback).toHaveBeenCalledWith(update);
    });
  });
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd redir-engine && npx tsc --noEmit tests/contracts/sync-manager.contract.ts --esModuleInterop --module nodenext --moduleResolution nodenext --target es2022 --strict`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add redir-engine/tests/contracts/sync-manager.contract.ts
git commit -m "test: add ISyncManager contract test harness"
```

---

### Task 5: Register Sync Adapters Against Contract

**Files:**
- Create: `redir-engine/tests/contracts/sync-manager.noop.test.ts`
- Create: `redir-engine/tests/contracts/sync-manager.sse.test.ts`

- [ ] **Step 1: Write the NoOpSyncAdapter contract registration**

```typescript
// redir-engine/tests/contracts/sync-manager.noop.test.ts
import { syncManagerContract } from './sync-manager.contract';
import { NoOpSyncAdapter } from '../../src/adapters/sync/NoOpSyncAdapter';

syncManagerContract('NoOpSyncAdapter', async () => ({
  adapter: new NoOpSyncAdapter(),
  // NoOp never triggers updates — triggerUpdate intentionally omitted
}));
```

- [ ] **Step 2: Write the SSESyncAdapter contract registration**

```typescript
// redir-engine/tests/contracts/sync-manager.sse.test.ts
import { vi } from 'vitest';
import { syncManagerContract } from './sync-manager.contract';
import { SSESyncAdapter } from '../../src/adapters/sync/SSESyncAdapter';
import { EventSourceConstructor } from '../../src/adapters/sse/sse-client';

class MockEventSource {
  url: string;
  constructor(url: string) {
    this.url = url;
  }
  close = vi.fn();
  addEventListener = vi.fn();
  onopen: null = null;
  onerror: null = null;
  onmessage: null = null;
  dispatchEvent = vi.fn();
  removeEventListener = vi.fn();
  readyState = 0;
  CONNECTING = 0 as const;
  OPEN = 1 as const;
  CLOSED = 2 as const;
  withCredentials = false;
}

syncManagerContract('SSESyncAdapter', async () => ({
  adapter: new SSESyncAdapter(
    'http://mock-admin.test/api/sync/stream',
    MockEventSource as unknown as EventSourceConstructor
  ),
  // SSE updates come from the network; we can't easily trigger them in unit tests
  // without reaching into the SSEClient internals. The contract covers lifecycle only.
}));
```

- [ ] **Step 3: Run both tests**

Run: `cd redir-engine && npx vitest run tests/contracts/sync-manager.noop.test.ts tests/contracts/sync-manager.sse.test.ts`

Expected: All tests PASS for both adapters.

- [ ] **Step 4: Commit**

```bash
git add redir-engine/tests/contracts/sync-manager.noop.test.ts redir-engine/tests/contracts/sync-manager.sse.test.ts
git commit -m "test: register NoOpSyncAdapter and SSESyncAdapter against ISyncManager contract"
```

---

### Task 6: Architecture Dependency-Rule Tests

**Files:**
- Create: `redir-engine/tests/architecture/dependency-rules.test.ts`

These tests enforce the hexagonal dependency rules:
1. `core/` never imports from `adapters/`
2. `use-cases/` never imports from `adapters/` (catches the existing violations in `sync-state.ts` and `handle-request.ts` — the test documents these as known exceptions until they are refactored)
3. `core/` never imports from `use-cases/`
4. Adapters only import from `ports/` and `core/`, not from other adapter directories

- [ ] **Step 1: Write the architecture tests**

```typescript
// redir-engine/tests/architecture/dependency-rules.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, relative, resolve } from 'path';

const SRC_ROOT = resolve(__dirname, '../../src');

function collectTsFiles(dir: string): string[] {
  const files: string[] = [];
  if (!existsSync(dir)) return files;

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTsFiles(fullPath));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

function extractImports(filePath: string): string[] {
  const content = readFileSync(filePath, 'utf-8');
  const importRegex = /from\s+['"]([^'"]+)['"]/g;
  const imports: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

// Known violations to track. Remove entries from here as they get refactored.
const KNOWN_USE_CASE_ADAPTER_IMPORTS: Record<string, string[]> = {
  'use-cases/sync-state.ts': [
    '../adapters/metrics/prometheus',
    '../adapters/cache/cache-eviction',
  ],
  'use-cases/handle-request.ts': [
    '../adapters/metrics/prometheus',
  ],
};

// Known cross-adapter imports. These should be refactored over time.
const KNOWN_CROSS_ADAPTER_IMPORTS: Record<string, string[]> = {
  'sync/SSESyncAdapter.ts': ['../sse/sse-client'],
};

describe('Architecture dependency rules', () => {
  describe('core/ never imports from adapters/', () => {
    const coreFiles = collectTsFiles(join(SRC_ROOT, 'core'));

    it.each(coreFiles.map(f => [relative(SRC_ROOT, f), f]))(
      '%s has no adapter imports',
      (_relPath, filePath) => {
        const imports = extractImports(filePath);
        const adapterImports = imports.filter(i => i.includes('adapters/'));
        expect(adapterImports).toEqual([]);
      }
    );
  });

  describe('core/ never imports from use-cases/', () => {
    const coreFiles = collectTsFiles(join(SRC_ROOT, 'core'));

    it.each(coreFiles.map(f => [relative(SRC_ROOT, f), f]))(
      '%s has no use-case imports',
      (_relPath, filePath) => {
        const imports = extractImports(filePath);
        const useCaseImports = imports.filter(i => i.includes('use-cases/'));
        expect(useCaseImports).toEqual([]);
      }
    );
  });

  describe('use-cases/ does not import from adapters/ (tracked violations)', () => {
    const useCaseFiles = collectTsFiles(join(SRC_ROOT, 'use-cases'));

    it.each(useCaseFiles.map(f => [relative(SRC_ROOT, f), f]))(
      '%s has no unexpected adapter imports',
      (relPath, filePath) => {
        const imports = extractImports(filePath);
        const adapterImports = imports.filter(i => i.includes('adapters/'));

        const knownViolations = KNOWN_USE_CASE_ADAPTER_IMPORTS[relPath] ?? [];
        const unexpectedImports = adapterImports.filter(
          i => !knownViolations.includes(i)
        );

        expect(
          unexpectedImports,
          `${relPath} has unexpected adapter imports: ${unexpectedImports.join(', ')}. ` +
          `If these are intentional, add them to KNOWN_USE_CASE_ADAPTER_IMPORTS in dependency-rules.test.ts. ` +
          `Better: refactor to inject via ports.`
        ).toEqual([]);
      }
    );
  });

  describe('adapters/ do not import from other adapter directories', () => {
    const adaptersRoot = join(SRC_ROOT, 'adapters');
    const adapterDirs = readdirSync(adaptersRoot, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const dir of adapterDirs) {
      const adapterFiles = collectTsFiles(join(adaptersRoot, dir));

      if (adapterFiles.length === 0) continue;

      it.each(adapterFiles.map(f => [relative(join(adaptersRoot, dir), f), f]))(
        `adapters/${dir}/%s has no cross-adapter imports`,
        (relPath, filePath) => {
          const imports = extractImports(filePath);
          const knownCross = KNOWN_CROSS_ADAPTER_IMPORTS[`${dir}/${relPath}`] ?? [];

          for (const otherDir of adapterDirs) {
            if (otherDir === dir) continue;
            const crossImports = imports.filter(i =>
              (i.includes(`adapters/${otherDir}/`) || i.includes(`../${otherDir}/`)) &&
              !knownCross.includes(i)
            );
            expect(
              crossImports,
              `adapters/${dir}/${relPath} has unexpected imports from adapters/${otherDir}: ${crossImports.join(', ')}`
            ).toEqual([]);
          }
        }
      );
    }
  });

  describe('ports/ only imports from core/', () => {
    const portFiles = collectTsFiles(join(SRC_ROOT, 'ports'));

    it.each(portFiles.map(f => [relative(SRC_ROOT, f), f]))(
      '%s only imports from core/',
      (_relPath, filePath) => {
        const imports = extractImports(filePath);
        const nonCoreImports = imports.filter(
          i => i.startsWith('.') && !i.includes('core/')
        );
        expect(nonCoreImports).toEqual([]);
      }
    );
  });
});
```

- [ ] **Step 2: Run the architecture tests**

Run: `cd redir-engine && npx vitest run tests/architecture/dependency-rules.test.ts`

Expected: All tests PASS. The known violations in `sync-state.ts` and `handle-request.ts` are documented as exceptions. Any *new* adapter imports in use-cases or cross-adapter imports will fail.

- [ ] **Step 3: Commit**

```bash
git add redir-engine/tests/architecture/dependency-rules.test.ts
git commit -m "test: add architecture dependency-rule tests for hexagonal boundaries"
```

---

### Task 7: Deployment Matrix & Validation Script

**Files:**
- Create: `deployment-matrix.json` (project root)
- Create: `scripts/validate-deployment-matrix.ts`
- Modify: `redir-engine/package.json` — add `test:contracts` and `test:architecture` scripts

- [ ] **Step 1: Create the deployment matrix manifest**

```json
{
  "combinations": [
    {
      "id": "supabase-node",
      "admin": "supabase",
      "engineRuntime": "node",
      "store": "InMemoryStore",
      "sync": "SSESyncAdapter",
      "systemE2E": true
    },
    {
      "id": "pocketbase-node",
      "admin": "pocketbase",
      "engineRuntime": "node",
      "store": "InMemoryStore",
      "sync": "SSESyncAdapter",
      "systemE2E": false
    },
    {
      "id": "supabase-cf",
      "admin": "supabase",
      "engineRuntime": "cf-worker",
      "store": "CloudflareKVStore",
      "sync": "NoOpSyncAdapter",
      "systemE2E": false
    },
    {
      "id": "pocketbase-cf",
      "admin": "pocketbase",
      "engineRuntime": "cf-worker",
      "store": "CloudflareKVStore",
      "sync": "NoOpSyncAdapter",
      "systemE2E": false
    }
  ]
}
```

- [ ] **Step 2: Create the validation script**

```typescript
// scripts/validate-deployment-matrix.ts
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

interface Combination {
  id: string;
  admin: string;
  engineRuntime: string;
  store: string;
  sync: string;
  systemE2E: boolean;
}

interface DeploymentMatrix {
  combinations: Combination[];
}

const ROOT = resolve(__dirname, '..');
const CONTRACTS_DIR = resolve(ROOT, 'redir-engine/tests/contracts');

function loadMatrix(): DeploymentMatrix {
  const raw = readFileSync(resolve(ROOT, 'deployment-matrix.json'), 'utf-8');
  return JSON.parse(raw);
}

function toKebab(s: string): string {
  return s.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

function validateContractTestExists(adapterName: string, portPrefix: string): string[] {
  const errors: string[] = [];
  const possibleFiles = [
    `${portPrefix}.${adapterName.toLowerCase()}.test.ts`,
    `${portPrefix}.${toKebab(adapterName)}.test.ts`,
  ];

  const exists = possibleFiles.some(f => existsSync(resolve(CONTRACTS_DIR, f)));
  if (!exists) {
    errors.push(
      `Missing contract test for "${adapterName}". ` +
      `Expected one of: ${possibleFiles.join(', ')} in redir-engine/tests/contracts/`
    );
  }
  return errors;
}

function validateAdminTestsExist(admin: string): string[] {
  const errors: string[] = [];
  const adminTestDir = resolve(ROOT, `admin-service/${admin}/tests`);
  if (!existsSync(adminTestDir)) {
    errors.push(`Missing test directory for admin backend "${admin}": admin-service/${admin}/tests`);
  }
  return errors;
}

function validateEngineRuntime(runtime: string): string[] {
  const errors: string[] = [];
  const runtimeDir = resolve(ROOT, `redir-engine/runtimes/${runtime}`);
  if (!existsSync(runtimeDir)) {
    errors.push(`Missing runtime directory for "${runtime}": redir-engine/runtimes/${runtime}`);
  }
  return errors;
}

function main() {
  const matrix = loadMatrix();
  const allErrors: string[] = [];

  const uniqueStores = new Set(matrix.combinations.map(c => c.store));
  const uniqueSyncs = new Set(matrix.combinations.map(c => c.sync));
  const uniqueAdmins = new Set(matrix.combinations.map(c => c.admin));
  const uniqueRuntimes = new Set(matrix.combinations.map(c => c.engineRuntime));

  for (const store of uniqueStores) {
    allErrors.push(...validateContractTestExists(store, 'redirect-store'));
  }

  for (const sync of uniqueSyncs) {
    allErrors.push(...validateContractTestExists(sync, 'sync-manager'));
  }

  for (const admin of uniqueAdmins) {
    allErrors.push(...validateAdminTestsExist(admin));
  }

  for (const runtime of uniqueRuntimes) {
    allErrors.push(...validateEngineRuntime(runtime));
  }

  const ids = matrix.combinations.map(c => c.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length > 0) {
    allErrors.push(`Duplicate combination IDs: ${dupes.join(', ')}`);
  }

  if (allErrors.length > 0) {
    console.error('❌ Deployment matrix validation failed:\n');
    for (const err of allErrors) {
      console.error(`  • ${err}`);
    }
    process.exit(1);
  }

  console.log(`✅ Deployment matrix valid: ${matrix.combinations.length} combinations verified.`);
  console.log(`   Stores: ${[...uniqueStores].join(', ')}`);
  console.log(`   Syncs: ${[...uniqueSyncs].join(', ')}`);
  console.log(`   Admins: ${[...uniqueAdmins].join(', ')}`);
  console.log(`   Runtimes: ${[...uniqueRuntimes].join(', ')}`);
}

main();
```

- [ ] **Step 3: Add convenience scripts to redir-engine/package.json**

In `redir-engine/package.json`, add to `"scripts"`:

```json
"test:contracts": "vitest run tests/contracts/",
"test:architecture": "vitest run tests/architecture/"
```

- [ ] **Step 4: Run the validation script**

Run: `cd d:\projects\url-redir-short && npx tsx scripts/validate-deployment-matrix.ts`

Expected:
```
✅ Deployment matrix valid: 4 combinations verified.
   Stores: InMemoryStore, CloudflareKVStore
   Syncs: SSESyncAdapter, NoOpSyncAdapter
   Admins: supabase, pocketbase
   Runtimes: node, cf-worker
```

- [ ] **Step 5: Run the full test suite to ensure nothing broke**

Run: `cd redir-engine && npm run test`

Expected: All 175+ existing tests PASS, plus the new contract and architecture tests.

- [ ] **Step 6: Commit**

```bash
git add deployment-matrix.json scripts/validate-deployment-matrix.ts redir-engine/package.json
git commit -m "feat: add deployment matrix manifest and validation script"
```

---

## Verification Checklist

After all tasks are complete:

- [ ] `cd redir-engine && npm run test` — all tests pass (175+ existing + new contracts + architecture)
- [ ] `cd redir-engine && npx vitest run tests/contracts/` — all contract tests pass
- [ ] `cd redir-engine && npx vitest run tests/architecture/` — all arch rules pass
- [ ] `npx tsx scripts/validate-deployment-matrix.ts` — matrix validates
- [ ] No new `any` usage introduced
- [ ] No lint errors
