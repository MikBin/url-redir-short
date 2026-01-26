import { describe, it, expect, beforeEach } from 'vitest';
import { RadixTree } from '../../../src/core/routing/radix-tree';
import { RedirectRule } from '../../../src/core/config/types';

describe('RadixTree', () => {
  let tree: RadixTree;

  const mockRule: RedirectRule = {
    id: '1',
    path: '/foo',
    destination: 'https://example.com',
    code: 301,
  };

  beforeEach(() => {
    tree = new RadixTree();
  });

  it('should insert and find a rule', () => {
    tree.insert(mockRule.path, mockRule);
    const result = tree.find(mockRule.path);
    expect(result).toEqual(mockRule);
  });

  it('should return null for non-existent path', () => {
    const result = tree.find('/non/existent');
    expect(result).toBeNull();
  });

  it('should handle nested paths', () => {
    const nestedRule = { ...mockRule, path: '/foo/bar', id: '2' };
    tree.insert('/foo', mockRule);
    tree.insert('/foo/bar', nestedRule);

    expect(tree.find('/foo')).toEqual(mockRule);
    expect(tree.find('/foo/bar')).toEqual(nestedRule);
  });

  it('should overwrite existing rule', () => {
    tree.insert('/foo', mockRule);
    const newRule = { ...mockRule, destination: 'https://new.com' };
    tree.insert('/foo', newRule);

    expect(tree.find('/foo')).toEqual(newRule);
  });

  it('should delete a rule', () => {
    tree.insert('/foo', mockRule);
    expect(tree.find('/foo')).not.toBeNull();

    tree.delete('/foo');
    expect(tree.find('/foo')).toBeNull();
  });

  it('should handle deletion of non-existent path', () => {
    // Should not throw
    tree.delete('/non/existent');
  });

  it('should handle deleting a rule that shares path prefix', () => {
    const nestedRule = { ...mockRule, path: '/foo/bar', id: '2' };
    tree.insert('/foo', mockRule);
    tree.insert('/foo/bar', nestedRule);

    tree.delete('/foo');

    expect(tree.find('/foo')).toBeNull();
    expect(tree.find('/foo/bar')).toEqual(nestedRule);
  });
});
