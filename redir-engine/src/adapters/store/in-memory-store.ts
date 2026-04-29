import { IRedirectStore } from '../../ports/IRedirectStore';
import { RedirectRule } from '../../core/config/types';
import { RadixTree } from '../../core/routing/radix-tree';
import { CuckooFilter } from '../../core/filtering/cuckoo-filter';

export class InMemoryStore implements IRedirectStore {
  constructor(
    private radixTree: RadixTree,
    private cuckooFilter: CuckooFilter
  ) {}

  async getRedirect(slug: string, domainId?: string): Promise<RedirectRule | null> {
    return this.radixTree.find(slug);
  }

  async mightExist(slug: string, domainId?: string): Promise<boolean> {
    return this.cuckooFilter.has(slug);
  }

  async addRedirect(rule: RedirectRule): Promise<void> {
    this.radixTree.insert(rule.path, rule);
    this.cuckooFilter.add(rule.path);
  }

  async removeRedirect(path: string): Promise<void> {
    this.radixTree.delete(path);
    this.cuckooFilter.remove(path);
  }
}
