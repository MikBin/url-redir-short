import { RadixTree } from '../core/routing/radix-tree';
import { CuckooFilter } from '../core/filtering/cuckoo-filter';
import { RedirectRule } from '../core/config/types';
import { AnalyticsCollector } from '../core/analytics/collector';
import { buildAnalyticsPayload } from '../core/analytics/payload-builder';
import { UAParser } from 'ua-parser-js';
import { LRUCache } from '../core/utils/lru-cache';

// Shared LRU cache for parsed User Agent results
const uaCache = new LRUCache<string, { device: any; os: any }>(1000);

class LazyDeviceContext {
  private ua: string;
  private data?: { device: any; os: any };

  constructor(ua: string) {
    this.ua = ua;
  }

  get() {
    if (!this.data) {
      // Check cache first
      const cached = uaCache.get(this.ua);
      if (cached) {
        this.data = cached;
      } else {
        const parser = new UAParser(this.ua);
        this.data = {
          device: parser.getDevice(),
          os: parser.getOS(),
        };
        // Store in cache for future requests with same UA
        uaCache.set(this.ua, this.data);
      }
    }
    return this.data;
  }
}

class LazyLanguageContext {
  private header: string | null;
  private languages?: string[];

  constructor(header: string | null) {
    this.header = header;
  }

  get(): string[] {
    if (!this.languages) {
      if (!this.header) {
        this.languages = [];
      } else {
        this.languages = this.header.toLowerCase().split(',').map((l) => l.split(';')[0].trim());
      }
    }
    return this.languages;
  }
}

// Define the result type for handleRequest
export type HandleRequestResult =
  | { type: 'redirect'; rule: RedirectRule }
  | { type: 'password_required'; rule: RedirectRule; error?: boolean }
  | null;

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
    originalUrl: URL,
    passwordProvider?: () => Promise<string | undefined> | string | undefined
  ): Promise<HandleRequestResult> {
    // 1. Check Cuckoo Filter
    if (!this.cuckooFilter.has(path)) {
      return null; // Definitely 404
    }

    // 2. Check Radix Tree (verify Cuckoo positive)
    const rule = this.radixTree.find(path);

    if (!rule) {
      return null;
    }

    // Check Expiration Logic
    const now = Date.now();
    if (rule.expiresAt && now > rule.expiresAt) {
      return null;
    }

    if (rule.maxClicks && rule.clicks !== undefined && rule.clicks >= rule.maxClicks) {
      return null;
    }

    // Clone rule
    let finalRule = { ...rule };

    // --- Phase 4: Password Protection ---
    if (finalRule.password_protection?.enabled) {
      let bodyPassword: string | undefined;
      if (passwordProvider) {
        bodyPassword = await passwordProvider();
      }

      // If user provided a password
      if (bodyPassword) {
        if (bodyPassword !== finalRule.password_protection.password) {
          // Wrong password
          return { type: 'password_required', rule: finalRule, error: true };
        }
        // Correct password -> proceed to redirection logic
      } else {
        // No password provided -> show form
        return { type: 'password_required', rule: finalRule };
      }
    }

    // 3. Apply Targeting Logic (Phase 3.2)
    let targetingMatched = false;

    if (finalRule.targeting?.enabled && finalRule.targeting.rules) {
      const deviceContext = new LazyDeviceContext(headers.get('user-agent') || '');
      const languageContext = new LazyLanguageContext(headers.get('accept-language'));

      for (const targetRule of finalRule.targeting.rules) {
        if (this.checkTarget(targetRule, headers, deviceContext, languageContext)) {
          finalRule.destination = targetRule.destination;
          targetingMatched = true;
          break; // First match wins
        }
      }
    }

    // 4. Apply A/B Testing Logic
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
      buildAnalyticsPayload(
        path,
        finalRule.destination,
        ip,
        headers,
        finalRule.code,
        originalUrl
      )
        .then((payload) => this.analyticsCollector?.collect(payload))
        .catch((err) => {
          console.error('Failed to collect analytics:', err);
        });
    }

    return { type: 'redirect', rule: finalRule };
  }

  private checkTarget(
    rule: { target: string; value: string },
    headers: Headers,
    deviceContext: LazyDeviceContext,
    languageContext: LazyLanguageContext
  ): boolean {
    if (rule.target === 'language') {
      const languages = languageContext.get();
      if (languages.length === 0) return false;
      return languages.some((l) => l.startsWith(rule.value));
    }

    if (rule.target === 'device') {
      const { device, os } = deviceContext.get();
      const target = rule.value;

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
       const country = headers.get('cf-ipcountry');
       if (country) {
         return country.toLowerCase() === rule.value;
       }
    }

    return false;
  }
}
