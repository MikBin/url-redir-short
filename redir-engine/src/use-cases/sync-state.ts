import { metrics } from '../adapters/metrics/prometheus';
import { IRedirectStore } from '../ports/IRedirectStore';
import { RedirectRule, RedirectRuleUpdate } from '../core/config/types';
import { CacheEvictionManager, EvictionConfig } from '../adapters/cache/cache-eviction';

export class SyncStateUseCase {
  private store: IRedirectStore;
  private evictionManager: CacheEvictionManager;

  constructor(
    store: IRedirectStore,
    evictionConfig?: Partial<EvictionConfig>
  ) {
    this.store = store;
    this.evictionManager = new CacheEvictionManager(evictionConfig);
    
    // Start memory monitoring
    this.evictionManager.startMonitoring();
  }

  public async handleCreate(rule: RedirectRule) {
    this.normalizeRule(rule);
    console.log(`[Sync] Create: ${rule.path} -> ${rule.destination} (Active: ${rule.isActive})`);

    if (rule.isActive === false) {
      // If created as inactive, don't add to radix tree
      await this.store.removeRedirect(rule.path);
    } else {
      await this.store.addRedirect(rule);
    }

    this.evictionManager.recordAccess(rule.path, rule);
    this.updateMetrics();
  }

  public async handleUpdate(rule: RedirectRule) {
    this.normalizeRule(rule);
    console.log(`[Sync] Update: ${rule.path} -> ${rule.destination} (Active: ${rule.isActive})`);
    
    if (rule.isActive === false) {
      // If updated to inactive, remove from radix tree
      await this.store.removeRedirect(rule.path);
    } else {
      await this.store.addRedirect(rule);
    }

    this.evictionManager.recordAccess(rule.path, rule);
    this.updateMetrics();
  }

  public async handleDelete(rule: RedirectRule) {
    console.log(`[Sync] Delete: ${rule.path}`);
    await this.store.removeRedirect(rule.path);
    this.evictionManager.recordRemoval(rule.path);
    this.updateMetrics();
  }

  private updateMetrics() {
    // Note: RadixTree size metric is skipped if store doesn't expose it
    // We could add size() to IRedirectStore if needed.
    const cacheInfo = this.evictionManager.getCacheInfo();
    metrics.cacheEntries.set(cacheInfo.size);
    
    const evictionMetrics = this.evictionManager.getMetrics();
    const total = evictionMetrics.hits + evictionMetrics.misses;
    if (total > 0) {
      metrics.cacheHitRatio.set(evictionMetrics.hits / total);
    }
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
