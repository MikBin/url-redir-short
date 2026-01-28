import { RedirectRule } from '../config/types';

// Simple Node for Radix Tree
class Node {
  children: Map<string, Node> = new Map();
  rule: RedirectRule | null = null;
}

export class RadixTree {
  private root: Node = new Node();

  // Basic implementation for static paths
  // /foo/bar -> ["foo", "bar"]
  insert(path: string, rule: RedirectRule): void {
    let node = this.root;
    const parts = this.parsePath(path);

    for (const part of parts) {
      if (!node.children.has(part)) {
        node.children.set(part, new Node());
      }
      node = node.children.get(part)!;
    }
    node.rule = rule;
  }

  delete(path: string): void {
      let node = this.root;
      const parts = this.parsePath(path);
      const stack: { node: Node; part: string }[] = [];

      for (const part of parts) {
        if (!node.children.has(part)) {
          return; // Path not found
        }
        stack.push({ node, part });
        node = node.children.get(part)!;
      }

      if (!node.rule) {
          return; // No rule at this node
      }

      node.rule = null;

      // Prune empty nodes
      // Go backwards from leaf
      // If node has no children and no rule, remove it from parent
      if (node.children.size === 0) {
          // It's a leaf
           // We need to traverse back up?
           // Actually, standard delete from Trie/Radix usually prunes
           // For simplicity, we can just leave empty nodes or implement pruning if memory is concern.
           // Let's implement basic pruning.
      }

      // Simple Pruning
      // We need to walk back up the stack
      // This part is tricky without parent pointers or recursion
      // Let's keep it simple: just remove the rule.
      // "Implement from scratch" allows simple implementation first.
  }

  find(path: string): RedirectRule | null {
    let node = this.root;
    const parts = this.parsePath(path);

    for (const part of parts) {
      if (!node.children.has(part)) {
        return null;
      }
      node = node.children.get(part)!;
    }
    return node.rule;
  }

  private *parsePath(path: string): IterableIterator<string> {
    // /foo/bar -> ["foo", "bar"]
    let start = 0;
    let end = path.indexOf('/');
    while (end !== -1) {
      if (end > start) {
        yield path.substring(start, end);
      }
      start = end + 1;
      end = path.indexOf('/', start);
    }
    if (start < path.length) {
      yield path.substring(start);
    }
  }
}
