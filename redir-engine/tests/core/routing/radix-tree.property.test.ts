import { describe, it } from 'vitest';
import fc from 'fast-check';
import { RadixTree } from '../../../src/core/routing/radix-tree';
import { RedirectRule } from '../../../src/core/config/types';

describe('RadixTree Properties', () => {
  it('should always find an inserted rule', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).map(s => '/' + s), // Paths starting with /
        fc.record({
          id: fc.uuid(),
          destination: fc.webUrl(),
          code: fc.constantFrom(301, 302),
        }),
        (path, ruleData) => {
          const tree = new RadixTree();
          const rule: RedirectRule = { ...ruleData, path, code: ruleData.code as 301 | 302 };

          tree.insert(path, rule);

          const found = tree.find(path);
          return found !== null && found.id === rule.id;
        }
      )
    );
  });

  it('should not find a deleted rule', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).map(s => '/' + s),
        fc.record({
          id: fc.uuid(),
          destination: fc.webUrl(),
          code: fc.constantFrom(301, 302),
        }),
        (path, ruleData) => {
          const tree = new RadixTree();
          const rule: RedirectRule = { ...ruleData, path, code: ruleData.code as 301 | 302 };

          tree.insert(path, rule);
          tree.delete(path);

          return tree.find(path) === null;
        }
      )
    );
  });

  it('should update existing rule when re-inserted', () => {
      fc.assert(
          fc.property(
              fc.string({ minLength: 1 }).map(s => '/' + s),
              fc.record({
                  id: fc.uuid(),
                  destination: fc.webUrl(),
                  code: fc.constantFrom(301, 302),
              }),
              fc.webUrl(),
              (path, ruleData, newDest) => {
                  const tree = new RadixTree();
                  const rule1: RedirectRule = { ...ruleData, path, code: ruleData.code as 301 | 302 };
                  const rule2: RedirectRule = { ...ruleData, path, destination: newDest, code: ruleData.code as 301 | 302 };

                  tree.insert(path, rule1);
                  tree.insert(path, rule2);

                  const found = tree.find(path);
                  return found !== null && found.destination === newDest;
              }
          )
      );
  });
});
