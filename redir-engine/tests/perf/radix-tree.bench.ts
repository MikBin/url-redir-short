import { describe, it, beforeEach } from 'vitest';
import { RadixTree } from '../../src/core/routing/radix-tree';
import { RedirectRule } from '../../src/core/config/types';

describe('RadixTree - Performance Benchmarks', () => {
  const createRule = (id: string, path: string): RedirectRule => ({
    id,
    path,
    destination: `https://example.com/${id}`,
    code: 301,
  });

  describe('Insert Operations', () => {
    it('insert 1K shallow paths (/p1, /p2, ...)', () => {
      const tree = new RadixTree();
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        tree.insert(`/p${i}`, createRule(`id-${i}`, `/p${i}`));
      }
      const elapsed = performance.now() - start;
      const opsPerSec = (1000 / (elapsed / 1000)).toFixed(0);
      console.log(`  insert 1K shallow: ${elapsed.toFixed(2)}ms (${opsPerSec} ops/sec)`);
    });

    it('insert 1K medium-depth paths (/a/b/c1, /a/b/c2, ...)', () => {
      const tree = new RadixTree();
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        tree.insert(`/a/b/c${i}`, createRule(`id-${i}`, `/a/b/c${i}`));
      }
      const elapsed = performance.now() - start;
      const opsPerSec = (1000 / (elapsed / 1000)).toFixed(0);
      console.log(`  insert 1K medium-depth: ${elapsed.toFixed(2)}ms (${opsPerSec} ops/sec)`);
    });

    it('insert 1K deep paths (/a/b/c/d/e/f/p1, ...)', () => {
      const tree = new RadixTree();
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        tree.insert(`/a/b/c/d/e/f/p${i}`, createRule(`id-${i}`, `/a/b/c/d/e/f/p${i}`));
      }
      const elapsed = performance.now() - start;
      const opsPerSec = (1000 / (elapsed / 1000)).toFixed(0);
      console.log(`  insert 1K deep: ${elapsed.toFixed(2)}ms (${opsPerSec} ops/sec)`);
    });

    it('insert 10K mixed-depth paths', () => {
      const tree = new RadixTree();
      const start = performance.now();
      for (let i = 0; i < 10000; i++) {
        const depth = Math.floor(Math.random() * 5) + 1; // 1-5 segments
        let path = '';
        for (let d = 0; d < depth; d++) {
          path += `/seg${d}`;
        }
        path += `/item${i}`;
        tree.insert(path, createRule(`id-${i}`, path));
      }
      const elapsed = performance.now() - start;
      const opsPerSec = (10000 / (elapsed / 1000)).toFixed(0);
      console.log(`  insert 10K mixed-depth: ${elapsed.toFixed(2)}ms (${opsPerSec} ops/sec)`);
    });

    it('insert 100K shallow paths (distributed)', () => {
      const tree = new RadixTree();
      const start = performance.now();
      for (let i = 0; i < 100000; i++) {
        tree.insert(`/p${i}`, createRule(`id-${i}`, `/p${i}`));
      }
      const elapsed = performance.now() - start;
      const opsPerSec = (100000 / (elapsed / 1000)).toFixed(0);
      console.log(`  insert 100K shallow: ${elapsed.toFixed(2)}ms (${opsPerSec} ops/sec)`);
    });
  });

  describe('Lookup Operations', () => {
    let tree1K: RadixTree;
    let tree10K: RadixTree;
    let tree100K: RadixTree;

    beforeEach(() => {
      tree1K = new RadixTree();
      for (let i = 0; i < 1000; i++) {
        tree1K.insert(`/path${i}`, createRule(`id-${i}`, `/path${i}`));
      }

      tree10K = new RadixTree();
      for (let i = 0; i < 10000; i++) {
        tree10K.insert(`/path${i}`, createRule(`id-${i}`, `/path${i}`));
      }

      tree100K = new RadixTree();
      for (let i = 0; i < 100000; i++) {
        tree100K.insert(`/path${i}`, createRule(`id-${i}`, `/path${i}`));
      }
    });

    it('lookup in 1K items (hit - first)', () => {
      const start = performance.now();
      for (let i = 0; i < 10000; i++) {
        tree1K.find('/path0');
      }
      const elapsed = performance.now() - start;
      const opsPerSec = (10000 / (elapsed / 1000)).toFixed(0);
      console.log(`  lookup 1K (hit-first): ${(elapsed / 10000).toFixed(4)}ms/op (${opsPerSec} ops/sec)`);
    });

    it('lookup in 1K items (hit - middle)', () => {
      const start = performance.now();
      for (let i = 0; i < 10000; i++) {
        tree1K.find('/path500');
      }
      const elapsed = performance.now() - start;
      const opsPerSec = (10000 / (elapsed / 1000)).toFixed(0);
      console.log(`  lookup 1K (hit-middle): ${(elapsed / 10000).toFixed(4)}ms/op (${opsPerSec} ops/sec)`);
    });

    it('lookup in 1K items (miss)', () => {
      const start = performance.now();
      for (let i = 0; i < 10000; i++) {
        tree1K.find('/notfound');
      }
      const elapsed = performance.now() - start;
      const opsPerSec = (10000 / (elapsed / 1000)).toFixed(0);
      console.log(`  lookup 1K (miss): ${(elapsed / 10000).toFixed(4)}ms/op (${opsPerSec} ops/sec)`);
    });

    it('lookup in 10K items (hit - middle)', () => {
      const start = performance.now();
      for (let i = 0; i < 10000; i++) {
        tree10K.find('/path5000');
      }
      const elapsed = performance.now() - start;
      const opsPerSec = (10000 / (elapsed / 1000)).toFixed(0);
      console.log(`  lookup 10K (hit-middle): ${(elapsed / 10000).toFixed(4)}ms/op (${opsPerSec} ops/sec)`);
    });

    it('lookup in 10K items (miss)', () => {
      const start = performance.now();
      for (let i = 0; i < 10000; i++) {
        tree10K.find('/notfound');
      }
      const elapsed = performance.now() - start;
      const opsPerSec = (10000 / (elapsed / 1000)).toFixed(0);
      console.log(`  lookup 10K (miss): ${(elapsed / 10000).toFixed(4)}ms/op (${opsPerSec} ops/sec)`);
    });

    it('lookup in 100K items (hit - middle)', () => {
      const start = performance.now();
      for (let i = 0; i < 10000; i++) {
        tree100K.find('/path50000');
      }
      const elapsed = performance.now() - start;
      const opsPerSec = (10000 / (elapsed / 1000)).toFixed(0);
      console.log(`  lookup 100K (hit-middle): ${(elapsed / 10000).toFixed(4)}ms/op (${opsPerSec} ops/sec)`);
    });

    it('lookup in 100K items (miss)', () => {
      const start = performance.now();
      for (let i = 0; i < 10000; i++) {
        tree100K.find('/notfound');
      }
      const elapsed = performance.now() - start;
      const opsPerSec = (10000 / (elapsed / 1000)).toFixed(0);
      console.log(`  lookup 100K (miss): ${(elapsed / 10000).toFixed(4)}ms/op (${opsPerSec} ops/sec)`);
    });

    it('batch lookup 100 in 10K items', () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        tree10K.find(`/path${i * 100}`);
      }
      const elapsed = performance.now() - start;
      const opsPerSec = (100 / (elapsed / 1000)).toFixed(0);
      console.log(`  batch lookup 100 in 10K: ${elapsed.toFixed(2)}ms total (${opsPerSec} ops/sec)`);
    });

    it('batch lookup 100 in 100K items', () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        tree100K.find(`/path${i * 1000}`);
      }
      const elapsed = performance.now() - start;
      const opsPerSec = (100 / (elapsed / 1000)).toFixed(0);
      console.log(`  batch lookup 100 in 100K: ${elapsed.toFixed(2)}ms total (${opsPerSec} ops/sec)`);
    });
  });

  describe('Deep Path Lookup', () => {
    let deepTree: RadixTree;

    beforeEach(() => {
      deepTree = new RadixTree();
      // Insert paths with varying depths
      for (let depth = 1; depth <= 10; depth++) {
        let path = '';
        for (let d = 0; d < depth; d++) {
          path += `/seg${d}`;
        }
        deepTree.insert(path, createRule(`depth-${depth}`, path));
      }
    });

    it('lookup depth 1', () => {
      const start = performance.now();
      for (let i = 0; i < 10000; i++) {
        deepTree.find('/seg0');
      }
      const elapsed = performance.now() - start;
      const opsPerSec = (10000 / (elapsed / 1000)).toFixed(0);
      console.log(`  lookup depth 1: ${(elapsed / 10000).toFixed(4)}ms/op (${opsPerSec} ops/sec)`);
    });

    it('lookup depth 5', () => {
      const start = performance.now();
      for (let i = 0; i < 10000; i++) {
        deepTree.find('/seg0/seg1/seg2/seg3/seg4');
      }
      const elapsed = performance.now() - start;
      const opsPerSec = (10000 / (elapsed / 1000)).toFixed(0);
      console.log(`  lookup depth 5: ${(elapsed / 10000).toFixed(4)}ms/op (${opsPerSec} ops/sec)`);
    });

    it('lookup depth 10', () => {
      const start = performance.now();
      for (let i = 0; i < 10000; i++) {
        deepTree.find('/seg0/seg1/seg2/seg3/seg4/seg5/seg6/seg7/seg8/seg9');
      }
      const elapsed = performance.now() - start;
      const opsPerSec = (10000 / (elapsed / 1000)).toFixed(0);
      console.log(`  lookup depth 10: ${(elapsed / 10000).toFixed(4)}ms/op (${opsPerSec} ops/sec)`);
    });

    it('lookup deep path miss', () => {
      const start = performance.now();
      for (let i = 0; i < 10000; i++) {
        deepTree.find('/seg0/seg1/seg2/seg3/seg4/seg5/seg6/seg7/seg8/notfound');
      }
      const elapsed = performance.now() - start;
      const opsPerSec = (10000 / (elapsed / 1000)).toFixed(0);
      console.log(`  lookup deep path miss: ${(elapsed / 10000).toFixed(4)}ms/op (${opsPerSec} ops/sec)`);
    });
  });

  describe('Delete Operations', () => {
    it('delete 100 from 1K', () => {
      const tree = new RadixTree();
      for (let i = 0; i < 1000; i++) {
        tree.insert(`/path${i}`, createRule(`id-${i}`, `/path${i}`));
      }
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        tree.delete(`/path${i}`);
      }
      const elapsed = performance.now() - start;
      const opsPerSec = (100 / (elapsed / 1000)).toFixed(0);
      console.log(`  delete 100 from 1K: ${elapsed.toFixed(2)}ms (${opsPerSec} ops/sec)`);
    });

    it('delete 1K from 10K', () => {
      const tree = new RadixTree();
      for (let i = 0; i < 10000; i++) {
        tree.insert(`/path${i}`, createRule(`id-${i}`, `/path${i}`));
      }
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        tree.delete(`/path${i}`);
      }
      const elapsed = performance.now() - start;
      const opsPerSec = (1000 / (elapsed / 1000)).toFixed(0);
      console.log(`  delete 1K from 10K: ${elapsed.toFixed(2)}ms (${opsPerSec} ops/sec)`);
    });

    it('delete non-existent paths (1K from 1K)', () => {
      const tree = new RadixTree();
      for (let i = 0; i < 1000; i++) {
        tree.insert(`/path${i}`, createRule(`id-${i}`, `/path${i}`));
      }
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        tree.delete(`/notfound${i}`);
      }
      const elapsed = performance.now() - start;
      const opsPerSec = (1000 / (elapsed / 1000)).toFixed(0);
      console.log(`  delete non-existent 1K: ${elapsed.toFixed(2)}ms (${opsPerSec} ops/sec)`);
    });
  });

  describe('Update Operations', () => {
    it('update 100 existing paths in 1K', () => {
      const tree = new RadixTree();
      for (let i = 0; i < 1000; i++) {
        tree.insert(`/path${i}`, createRule(`id-${i}`, `/path${i}`));
      }
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        tree.insert(`/path${i}`, createRule(`id-${i}-updated`, `/path${i}`));
      }
      const elapsed = performance.now() - start;
      const opsPerSec = (100 / (elapsed / 1000)).toFixed(0);
      console.log(`  update 100 in 1K: ${elapsed.toFixed(2)}ms (${opsPerSec} ops/sec)`);
    });

    it('update 1K existing paths in 10K', () => {
      const tree = new RadixTree();
      for (let i = 0; i < 10000; i++) {
        tree.insert(`/path${i}`, createRule(`id-${i}`, `/path${i}`));
      }
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        tree.insert(`/path${i}`, createRule(`id-${i}-updated`, `/path${i}`));
      }
      const elapsed = performance.now() - start;
      const opsPerSec = (1000 / (elapsed / 1000)).toFixed(0);
      console.log(`  update 1K in 10K: ${elapsed.toFixed(2)}ms (${opsPerSec} ops/sec)`);
    });
  });

  describe('Mixed Workload', () => {
    it('mixed operations (50% insert, 40% lookup, 10% delete) - 1K total', () => {
      const tree = new RadixTree();
      const total = 1000;
      const insertCount = Math.floor(total * 0.5); // 500
      const lookupCount = Math.floor(total * 0.4); // 400
      const deleteCount = total - insertCount - lookupCount; // 100

      const start = performance.now();
      // Inserts
      for (let i = 0; i < insertCount; i++) {
        tree.insert(`/p${i}`, createRule(`id-${i}`, `/p${i}`));
      }

      // Lookups
      for (let i = 0; i < lookupCount; i++) {
        tree.find(`/p${Math.floor((i * insertCount) / lookupCount)}`);
      }

      // Deletes
      for (let i = 0; i < deleteCount; i++) {
        tree.delete(`/p${i}`);
      }
      const elapsed = performance.now() - start;
      const opsPerSec = (total / (elapsed / 1000)).toFixed(0);
      console.log(`  mixed ops 1K (50% ins, 40% look, 10% del): ${elapsed.toFixed(2)}ms (${opsPerSec} ops/sec)`);
    });

    it('mixed operations (50% insert, 40% lookup, 10% delete) - 10K total', () => {
      const tree = new RadixTree();
      const total = 10000;
      const insertCount = Math.floor(total * 0.5); // 5000
      const lookupCount = Math.floor(total * 0.4); // 4000
      const deleteCount = total - insertCount - lookupCount; // 1000

      const start = performance.now();
      for (let i = 0; i < insertCount; i++) {
        tree.insert(`/p${i}`, createRule(`id-${i}`, `/p${i}`));
      }

      for (let i = 0; i < lookupCount; i++) {
        tree.find(`/p${Math.floor((i * insertCount) / lookupCount)}`);
      }

      for (let i = 0; i < deleteCount; i++) {
        tree.delete(`/p${i}`);
      }
      const elapsed = performance.now() - start;
      const opsPerSec = (total / (elapsed / 1000)).toFixed(0);
      console.log(`  mixed ops 10K (50% ins, 40% look, 10% del): ${elapsed.toFixed(2)}ms (${opsPerSec} ops/sec)`);
    });
  });

  describe('Real-world Patterns', () => {
    it('realistic redirect patterns (user shortcuts) - 1K', () => {
      const tree = new RadixTree();
      const users = 100;
      const shortcutsPerUser = 10;

      const insertStart = performance.now();
      for (let u = 0; u < users; u++) {
        for (let s = 0; s < shortcutsPerUser; s++) {
          const path = `/u${u}/s${s}`;
          tree.insert(path, createRule(`${u}-${s}`, path));
        }
      }
      const insertElapsed = performance.now() - insertStart;

      // Simulate access pattern
      const lookupStart = performance.now();
      for (let access = 0; access < 1000; access++) {
        const u = Math.floor(Math.random() * users);
        const s = Math.floor(Math.random() * shortcutsPerUser);
        tree.find(`/u${u}/s${s}`);
      }
      const lookupElapsed = performance.now() - lookupStart;
      console.log(`  user shortcuts (1K) - insert: ${insertElapsed.toFixed(2)}ms, lookup: ${(lookupElapsed / 1000).toFixed(4)}ms/op`);
    });

    it('campaign URLs with tracking - 1K', () => {
      const tree = new RadixTree();
      const campaigns = 20;
      const linksPerCampaign = 50;

      const insertStart = performance.now();
      for (let c = 0; c < campaigns; c++) {
        for (let l = 0; l < linksPerCampaign; l++) {
          const path = `/camp${c}/link${l}`;
          tree.insert(path, createRule(`${c}-${l}`, path));
        }
      }
      const insertElapsed = performance.now() - insertStart;

      // Simulate hot paths
      const lookupStart = performance.now();
      for (let access = 0; access < 1000; access++) {
        const c = Math.floor(Math.random() * campaigns);
        const l = Math.floor(Math.random() * linksPerCampaign);
        tree.find(`/camp${c}/link${l}`);
      }
      const lookupElapsed = performance.now() - lookupStart;
      console.log(`  campaign URLs (1K) - insert: ${insertElapsed.toFixed(2)}ms, lookup: ${(lookupElapsed / 1000).toFixed(4)}ms/op`);
    });
  });
});
