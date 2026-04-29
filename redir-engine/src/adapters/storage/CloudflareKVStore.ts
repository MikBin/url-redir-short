import { IRedirectStore } from '../../ports/IRedirectStore';
import { RedirectRule } from '../../core/config/types';

export class CloudflareKVStore implements IRedirectStore {
  constructor(private env: { REDIRECTS_KV: KVNamespace }) {}

  async getRedirect(slug: string, domainId?: string): Promise<RedirectRule | null> {
    const key = domainId ? `${domainId}:${slug}` : slug;
    const value = await this.env.REDIRECTS_KV.get(key);

    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as RedirectRule;
    } catch (e) {
      console.error('Failed to parse RedirectRule from KV', e);
      return null;
    }
  }

  async mightExist(slug: string, domainId?: string): Promise<boolean> {
    // Cloudflare KV might Exist logic - return true as we fallback to fetching if true.
    return true;
  }
}
