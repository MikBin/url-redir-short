import { RadixTree } from '../core/routing/radix-tree';
import { CuckooFilter } from '../core/filtering/cuckoo-filter';
import { RedirectRule } from '../core/config/types';
import { AnalyticsCollector } from '../core/analytics/collector';
import { buildAnalyticsPayload } from '../core/analytics/payload-builder';

export class HandleRequestUseCase {
  private radixTree: RadixTree;
  private cuckooFilter: CuckooFilter;
  private analyticsCollector?: AnalyticsCollector;

  constructor(
    radixTree: RadixTree,
    cuckooFilter: CuckooFilter,
    analyticsCollector?: AnalyticsCollector
  ) {
    this.radixTree = radixTree;
    this.cuckooFilter = cuckooFilter;
    this.analyticsCollector = analyticsCollector;
  }

  public async execute(
    path: string,
    headers: Headers,
    ip: string,
    originalUrl: string
  ): Promise<RedirectRule | null> {
    // 1. Check Cuckoo Filter
    if (!this.cuckooFilter.has(path)) {
      return null; // Definitely 404
    }

    // 2. Check Radix Tree (verify Cuckoo positive)
    const rule = this.radixTree.find(path);

    if (rule && this.analyticsCollector) {
      // Async fire-and-forget analytics
      const payload = await buildAnalyticsPayload(
        path,
        rule.destination,
        ip,
        headers,
        rule.code,
        originalUrl
      );
      // We don't await the collector, but the collector implementation
      // is responsible for handling the async nature (e.g. waitUntil)
      this.analyticsCollector.collect(payload);
    }

    return rule;
  }
}
