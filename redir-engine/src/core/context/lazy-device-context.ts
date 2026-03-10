import { UAParser } from 'ua-parser-js';
import { LRUCache } from '../utils/lru-cache';

// Shared LRU cache for parsed User Agent results
const uaCache = new LRUCache<string, { device: any; os: any }>(1000);

export class LazyDeviceContext {
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
