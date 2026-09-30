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

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

const KNOWN_USE_CASE_ADAPTER_IMPORTS: Record<string, string[]> = {
  'use-cases/sync-state.ts': [
    '../adapters/metrics/prometheus',
    '../adapters/cache/cache-eviction',
  ],
  'use-cases/handle-request.ts': [
    '../adapters/metrics/prometheus',
  ],
};

const KNOWN_CROSS_ADAPTER_IMPORTS: Record<string, string[]> = {
  'sync/SSESyncAdapter.ts': ['../sse/sse-client'],
  'http/server.ts': ['../metrics/prometheus'],
  'sse/sse-client.ts': ['../metrics/prometheus'],
};

describe('Architecture dependency rules', () => {
  describe('core/ never imports from adapters/', () => {
    const coreFiles = collectTsFiles(join(SRC_ROOT, 'core'));

    it.each(coreFiles.map(f => [normalizePath(relative(SRC_ROOT, f)), f]))(
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

    it.each(coreFiles.map(f => [normalizePath(relative(SRC_ROOT, f)), f]))(
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

    it.each(useCaseFiles.map(f => [normalizePath(relative(SRC_ROOT, f)), f]))(
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

      it.each(adapterFiles.map(f => [normalizePath(relative(join(adaptersRoot, dir), f)), f]))(
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

    it.each(portFiles.map(f => [normalizePath(relative(SRC_ROOT, f)), f]))(
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
