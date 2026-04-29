import { RedirectRule } from '../core/config/types';

export interface IRedirectStore {
  /**
   * Retrieves a redirect rule by slug/path.
   * Optionally scoped by domainId for multi-tenant support.
   */
  getRedirect(slug: string, domainId?: string): Promise<RedirectRule | null>;

  /**
   * Quick check if a slug might exist (e.g. Cuckoo Filter).
   * Implementations for Cloudflare KV might always return true or check a local bloom filter.
   */
  mightExist(slug: string, domainId?: string): Promise<boolean>;

  /**
   * Adds or updates a redirect rule.
   */
  addRedirect(rule: RedirectRule): Promise<void>;

  /**
   * Removes a redirect rule by path.
   */
  removeRedirect(path: string): Promise<void>;
}
