import { RadixTree } from '../core/routing/radix-tree';
import { CuckooFilter } from '../core/filtering/cuckoo-filter';
import { RedirectRule } from '../core/config/types';
import { AnalyticsCollector } from '../core/analytics/collector';
import { buildAnalyticsPayload } from '../core/analytics/payload-builder';
import { UAParser } from 'ua-parser-js';

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

    if (!rule) {
      return null;
    }

    // Clone rule to avoid mutating shared state if we modify destination
    let finalRule = { ...rule };

    // 3. Apply Targeting Logic (Phase 3.2)
    // Priority: Targeting Rules > A/B Testing (if enabled on the targeted rule? Or globally?)
    // Usually targeting rules override the default destination.
    // If a targeting rule matches, we use its destination.
    // Question: Can a targeted rule have A/B testing? The current config structure puts them at same level.
    // For now, let's assume Targeting overrides Default, and we don't apply A/B on top of targeting unless we recursively structure it (which we didn't).
    // So if targeting matches, we use that destination and skip A/B (unless we want to support A/B within targeting, which is complex).

    let targetingMatched = false;

    if (finalRule.targeting?.enabled && finalRule.targeting.rules) {
      for (const targetRule of finalRule.targeting.rules) {
        if (this.checkTarget(targetRule, headers)) {
          finalRule.destination = targetRule.destination;
          targetingMatched = true;
          break; // First match wins
        }
      }
    }

    // 4. Apply A/B Testing Logic
    // Only apply if no targeting rule matched (or if we want A/B to apply to the default).
    // If targeting matched, we have a specific destination.
    // If we want to support A/B for specific targets, we'd need nested config.
    // Assuming A/B is for the "default" audience or if we want to split traffic for everyone.
    // Let's assume if targeting matched, we are done. If not, we check A/B.
    if (!targetingMatched && finalRule.ab_testing?.enabled && finalRule.ab_testing.variations.length > 0) {
      const random = Math.random() * 100;
      let cumulativeWeight = 0;

      for (const variation of finalRule.ab_testing.variations) {
        cumulativeWeight += variation.weight;
        if (random < cumulativeWeight) {
          finalRule.destination = variation.destination;
          break;
        }
      }
    }

    if (this.analyticsCollector) {
      // Async fire-and-forget analytics
      const payload = await buildAnalyticsPayload(
        path,
        finalRule.destination,
        ip,
        headers,
        finalRule.code,
        originalUrl
      );
      // We don't await the collector, but the collector implementation
      // is responsible for handling the async nature (e.g. waitUntil)
      this.analyticsCollector.collect(payload);
    }

    return finalRule;
  }

  private checkTarget(rule: { target: string, value: string }, headers: Headers): boolean {
    if (rule.target === 'language') {
      const acceptLanguage = headers.get('accept-language');
      if (!acceptLanguage) return false;
      // Simple check: if header contains the lang code.
      // Ideally we should parse q-values, but for "starts with" or "includes" might be enough for MVP.
      // E.g. value="fr", header="fr-FR,fr;q=0.9".
      // Let's use a regex or includes.
      // "fr" should match "fr", "fr-FR", "fr-CA".
      // But we should act smarter.
      const languages = acceptLanguage.split(',').map(l => l.split(';')[0].trim());
      return languages.some(l => l.startsWith(rule.value));
    }

    if (rule.target === 'device') {
      const ua = headers.get('user-agent') || '';
      const parser = new UAParser(ua);
      const device = parser.getDevice();
      const os = parser.getOS();

      // value can be "mobile", "tablet", "desktop", "ios", "android"
      const target = rule.value.toLowerCase();

      if (target === 'mobile') {
        return device.type === 'mobile';
      }
      if (target === 'tablet') {
        return device.type === 'tablet';
      }
      if (target === 'desktop') {
        return !device.type; // UAParser returns undefined type for desktop usually
      }
      if (target === 'ios') {
        return os.name === 'iOS';
      }
      if (target === 'android') {
        return os.name === 'Android';
      }
    }

    if (rule.target === 'country') {
       // Geo targeting usually relies on Cloudflare headers or similar
       const country = headers.get('cf-ipcountry');
       if (country) {
         return country.toLowerCase() === rule.value.toLowerCase();
       }
    }

    return false;
  }
}
