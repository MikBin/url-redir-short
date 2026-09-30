import { redirectStoreContract } from './redirect-store.contract';
import { CloudflareKVStore } from '../../src/adapters/storage/CloudflareKVStore';

function createMockKV(): KVNamespace {
  const data = new Map<string, string>();
  return {
    get: async (key: string) => data.get(key) ?? null,
    put: async (key: string, value: string) => { data.set(key, value); },
    delete: async (key: string) => { data.delete(key); },
    list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
    getWithMetadata: async () => ({ value: null, metadata: null, cacheStatus: null }),
  } as unknown as KVNamespace;
}

redirectStoreContract('CloudflareKVStore', async () => ({
  store: new CloudflareKVStore({ REDIRECTS_KV: createMockKV() }),
}));
