import { RadixTree } from '../core/routing/radix-tree';
import { CuckooFilter } from '../core/filtering/cuckoo-filter';
import { RedirectRule, RedirectRuleUpdate } from '../core/config/types';

export class SyncStateUseCase {
  private radixTree: RadixTree;
  private cuckooFilter: CuckooFilter;

  constructor(radixTree: RadixTree, cuckooFilter: CuckooFilter) {
    this.radixTree = radixTree;
    this.cuckooFilter = cuckooFilter;
  }

  public handleCreate(rule: RedirectRule) {
    console.log(`[Sync] Create: ${rule.path} -> ${rule.destination}`);
    this.radixTree.insert(rule.path, rule);
    this.cuckooFilter.add(rule.path);
  }

  public handleUpdate(rule: RedirectRule) {
    console.log(`[Sync] Update: ${rule.path} -> ${rule.destination}`);
    // Update is same as insert for Radix
    this.radixTree.insert(rule.path, rule);
    // Cuckoo: Add if not present. If present, it's fine.
    // Note: Cuckoo filter generally doesn't support "update" in the sense of changing value associated with key (it only stores keys).
    // So ensuring it is in the filter is enough.
    this.cuckooFilter.add(rule.path);
  }

  public handleDelete(rule: RedirectRule) {
    console.log(`[Sync] Delete: ${rule.path}`);
    this.radixTree.delete(rule.path);
    this.cuckooFilter.remove(rule.path);
  }
}
