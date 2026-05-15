
import { describe, it, expect, vi } from 'vitest';
import { InMemoryStore } from './InMemoryStore';
import { CloudflareKVStore } from './CloudflareKVStore';
import { RedirectRule } from '../../core/config/types';

describe('InMemoryStore', () => {
  it('should store and retrieve a redirect rule', async () => {
    const store = new InMemoryStore();
    const rule: RedirectRule = { id: '1', path: '/test', destination: 'https://example.com', code: 301 };

    store.insert(rule);

    const retrieved = await store.getRedirect('/test');
    expect(retrieved).toEqual(rule);
  });

  it('should return null for non-existent path', async () => {
    const store = new InMemoryStore();

    const retrieved = await store.getRedirect('/missing');
    expect(retrieved).toBeNull();
  });

  it('should correctly report mightExist', async () => {
    const store = new InMemoryStore();
    const rule: RedirectRule = { id: '1', path: '/test', destination: 'https://example.com', code: 301 };

    store.insert(rule);

    expect(await store.mightExist('/test')).toBe(true);
    // Note: Cuckoo filters might have false positives, but for simple tests, a false negative won't happen.
    // Testing negative case for a string we didn't insert
    expect(await store.mightExist('/missing')).toBe(false);
  });

  it('should handle remove correctly', async () => {
    const store = new InMemoryStore();
    const rule: RedirectRule = { id: '1', path: '/test', destination: 'https://example.com', code: 301 };

    store.insert(rule);
    store.remove('/test');

    expect(await store.getRedirect('/test')).toBeNull();
    expect(await store.mightExist('/test')).toBe(false);
  });
});

describe('CloudflareKVStore', () => {
  it('should retrieve a redirect rule from KV', async () => {
    const rule: RedirectRule = { id: '1', path: '/test', destination: 'https://example.com', code: 301 };
    const mockKv = {
      get: vi.fn().mockResolvedValue(JSON.stringify(rule))
    };


    const store = new CloudflareKVStore({ REDIRECTS_KV: mockKv as unknown as KVNamespace });

    const retrieved = await store.getRedirect('/test');
    expect(retrieved).toEqual(rule);
    expect(mockKv.get).toHaveBeenCalledWith('/test');
  });

  it('should use domainId in key if provided', async () => {
    const rule: RedirectRule = { id: '1', path: '/test', destination: 'https://example.com', code: 301 };
    const mockKv = {
      get: vi.fn().mockResolvedValue(JSON.stringify(rule))
    };


    const store = new CloudflareKVStore({ REDIRECTS_KV: mockKv as unknown as KVNamespace });

    const retrieved = await store.getRedirect('/test', 'domain1');
    expect(retrieved).toEqual(rule);
    expect(mockKv.get).toHaveBeenCalledWith('domain1:/test');
  });

  it('should return null if KV returns null', async () => {
    const mockKv = {
      get: vi.fn().mockResolvedValue(null)
    };


    const store = new CloudflareKVStore({ REDIRECTS_KV: mockKv as unknown as KVNamespace });

    const retrieved = await store.getRedirect('/missing');
    expect(retrieved).toBeNull();
  });

  it('should return null if KV data is invalid JSON', async () => {
    const mockKv = {
      get: vi.fn().mockResolvedValue('invalid-json')
    };


    const store = new CloudflareKVStore({ REDIRECTS_KV: mockKv as unknown as KVNamespace });

    // Mock console.error to avoid noise in test output
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const retrieved = await store.getRedirect('/test');
    expect(retrieved).toBeNull();

    consoleSpy.mockRestore();
  });

  it('should always return true for mightExist', async () => {

    const store = new CloudflareKVStore({ REDIRECTS_KV: {} as unknown as KVNamespace });

    expect(await store.mightExist('/test')).toBe(true);
    expect(await store.mightExist('/missing')).toBe(true);
  });
});
