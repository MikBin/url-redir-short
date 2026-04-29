import { IRedirectStore } from '../../ports/IRedirectStore';
import { RedirectRule } from '../../core/config/types';
import { RadixTree } from '../../core/routing/radix-tree';
import { CuckooFilter } from '../../core/filtering/cuckoo-filter';

export class InMemoryStore implements IRedirectStore {
  private radixTree: RadixTree;
  private cuckooFilter: CuckooFilter;

  constructor(size: number = 10000) {
    this.radixTree = new RadixTree();
    this.cuckooFilter = new CuckooFilter(size);
  }

  async getRedirect(slug: string, domainId?: string): Promise<RedirectRule | null> {
    // Basic implementation ignores domainId for now, just matching the RadixTree logic
    return this.radixTree.find(slug);
  }

  async mightExist(slug: string, domainId?: string): Promise<boolean> {
    return this.cuckooFilter.has(slug);
  }

  // Utility methods to manage the store internally
  insert(rule: RedirectRule): void {
    this.radixTree.insert(rule.path, rule);
    this.cuckooFilter.add(rule.path);
  }

  remove(slug: string): void {
    this.radixTree.delete(slug);
    this.cuckooFilter.remove(slug);
  }
}
