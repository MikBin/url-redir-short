import { RadixTree } from '../core/routing/radix-tree';
import { CuckooFilter } from '../core/filtering/cuckoo-filter';
import { RedirectRule } from '../core/config/types';

export class HandleRequestUseCase {
  private radixTree: RadixTree;
  private cuckooFilter: CuckooFilter;

  constructor(radixTree: RadixTree, cuckooFilter: CuckooFilter) {
    this.radixTree = radixTree;
    this.cuckooFilter = cuckooFilter;
  }

  public execute(path: string): RedirectRule | null {
    // 1. Check Cuckoo Filter
    if (!this.cuckooFilter.has(path)) {
      return null; // Definitely 404
    }

    // 2. Check Radix Tree (verify Cuckoo positive)
    const rule = this.radixTree.find(path);
    return rule;
  }
}
