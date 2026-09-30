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
  return JSON.parse(raw) as DeploymentMatrix;
}

function toKebab(s: string): string {
  return s.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

const ADAPTER_FILE_ALIASES: Record<string, string[]> = {
  'CloudflareKVStore': ['cf-kv', 'cloudflare-kv-store', 'cloudflarekvstore'],
  'InMemoryStore': ['in-memory', 'in-memory-store', 'inmemorystore'],
  'SSESyncAdapter': ['sse', 'sse-sync-adapter', 'ssesyncadapter'],
  'NoOpSyncAdapter': ['noop', 'no-op-sync-adapter', 'noopsyncadapter'],
  'FireAndForgetCollector': ['fire-and-forget', 'fireandforgetcollector'],
};

function validateContractTestExists(adapterName: string, portPrefix: string): string[] {
  const errors: string[] = [];
  const contractsDir = resolve(CONTRACTS_DIR);

  if (!existsSync(contractsDir)) {
    errors.push(`Contracts directory not found: redir-engine/tests/contracts/`);
    return errors;
  }

  const { readdirSync } = require('fs') as typeof import('fs');
  const files = readdirSync(contractsDir) as string[];

  const matchingFiles = files.filter(f =>
    f.startsWith(`${portPrefix}.`) && f.endsWith('.test.ts')
  );

  const adapterLower = adapterName.toLowerCase();
  const adapterKebab = toKebab(adapterName);
  const adapterNorm = adapterLower.replace(/-/g, '');
  const aliases = ADAPTER_FILE_ALIASES[adapterName] ?? [];

  const hasMatch = matchingFiles.some(f => {
    const middle = f.replace(`${portPrefix}.`, '').replace('.test.ts', '');
    const middleNorm = middle.replace(/-/g, '');
    return middle === adapterLower
      || middle === adapterKebab
      || adapterNorm.includes(middleNorm)
      || middleNorm.includes(adapterNorm)
      || aliases.includes(middle);
  });

  if (!hasMatch) {
    errors.push(
      `Missing contract test for "${adapterName}" (port: ${portPrefix}). ` +
      `Found contract files: [${matchingFiles.join(', ')}] — none match "${adapterName}".`
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
