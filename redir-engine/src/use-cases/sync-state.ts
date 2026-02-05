import { RadixTree } from '../core/routing/radix-tree';
import { CuckooFilter } from '../core/filtering/cuckoo-filter';
import { RedirectRule, RedirectRuleUpdate } from '../core/config/types';
import { CacheEvictionManager, EvictionConfig } from '../adapters/cache/cache-eviction';

export class SyncStateUseCase {
  private radixTree: RadixTree;
  private cuckooFilter: CuckooFilter;
  private evictionManager: CacheEvictionManager;

  constructor(
    radixTree: RadixTree,
    cuckooFilter: CuckooFilter,
    evictionConfig?: Partial<EvictionConfig>
  ) {
    this.radixTree = radixTree;
    this.cuckooFilter = cuckooFilter;
    this.evictionManager = new CacheEvictionManager(evictionConfig);
    
    // Start memory monitoring
    this.evictionManager.startMonitoring();
  }

  public handleCreate(rule: RedirectRule) {
    this.normalizeRule(rule);
    console.log(`[Sync] Create: ${rule.path} -> ${rule.destination}`);
    this.radixTree.insert(rule.path, rule);
    this.cuckooFilter.add(rule.path);
    this.evictionManager.recordAccess(rule.path, rule);
  }

  public handleUpdate(rule: RedirectRule) {
    this.normalizeRule(rule);
    console.log(`[Sync] Update: ${rule.path} -> ${rule.destination}`);
    // Update is same as insert for Radix
    this.radixTree.insert(rule.path, rule);
    // Cuckoo: Add if not present. If present, it's fine.
    // Note: Cuckoo filter generally doesn't support "update" in the sense of changing value associated with key (it only stores keys).
    // So ensuring it is in the filter is enough.
    this.cuckooFilter.add(rule.path);
    this.evictionManager.recordAccess(rule.path, rule);
  }

  public handleDelete(rule: RedirectRule) {
    console.log(`[Sync] Delete: ${rule.path}`);
    this.radixTree.delete(rule.path);
    this.cuckooFilter.remove(rule.path);
    this.evictionManager.recordRemoval(rule.path);
  }

  private normalizeRule(rule: RedirectRule) {
    if (rule.targeting?.enabled && rule.targeting.rules) {
      for (const targetRule of rule.targeting.rules) {
        if (
          targetRule.value &&
          ['country', 'device', 'language'].includes(targetRule.target)
        ) {
          targetRule.value = targetRule.value.toLowerCase();
        }
      }
    }
  }

  /**
   * Record cache access (called from request handler)
   */
  public recordCacheAccess(path: string, rule: RedirectRule): void {
    this.evictionManager.recordAccess(path, rule);
  }

  /**
   * Get eviction metrics
   */
  public getEvictionMetrics() {
    return this.evictionManager.getMetrics();
  }

  /**
   * Get cache info
   */
  public getCacheInfo() {
    return this.evictionManager.getCacheInfo();
  }

  /**
   * Print cache report
   */
  public printCacheReport(): string {
    return this.evictionManager.printReport();
  }

  /**
   * Stop monitoring (for shutdown)
   */
  public shutdown(): void {
    this.evictionManager.stopMonitoring();
    this.evictionManager.clear();
  }
}
