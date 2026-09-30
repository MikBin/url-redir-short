import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IRedirectStore } from '../../src/ports/IRedirectStore';
import { RedirectRule } from '../../src/core/config/types';

interface ContractContext {
  store: IRedirectStore;
  teardown?: () => Promise<void>;
}

const sampleRule: RedirectRule = {
  id: 'rule-1',
  path: '/hello',
  destination: 'https://example.com',
  code: 301,
};

const sampleRule2: RedirectRule = {
  id: 'rule-2',
  path: '/world',
  destination: 'https://other.com',
  code: 302,
};

const ruleWithFeatures: RedirectRule = {
  id: 'rule-3',
  path: '/advanced',
  destination: 'https://advanced.com',
  code: 301,
  ab_testing: {
    enabled: true,
    variations: [
      { id: 'v1', destination: 'https://var1.com', weight: 50 },
      { id: 'v2', destination: 'https://var2.com', weight: 50 },
    ],
  },
  targeting: {
    enabled: true,
    rules: [
      { id: 't1', target: 'country', value: 'us', destination: 'https://us.com' },
    ],
  },
  hsts: { enabled: true, maxAge: 31536000 },
  password_protection: { enabled: false, password: '' },
  expiresAt: Date.now() + 86400000,
  maxClicks: 100,
  isActive: true,
};

export function redirectStoreContract(
  name: string,
  factory: () => Promise<ContractContext>
) {
  describe(`IRedirectStore contract: ${name}`, () => {
    let ctx: ContractContext;

    beforeEach(async () => {
      ctx = await factory();
    });

    afterEach(async () => {
      await ctx.teardown?.();
    });

    // --- CRUD roundtrip ---

    it('stores and retrieves a rule by path', async () => {
      await ctx.store.addRedirect(sampleRule);
      const result = await ctx.store.getRedirect('/hello');
      expect(result).toEqual(sampleRule);
    });

    it('returns null for a non-existent path', async () => {
      const result = await ctx.store.getRedirect('/nonexistent');
      expect(result).toBeNull();
    });

    it('overwrites an existing rule on re-add', async () => {
      await ctx.store.addRedirect(sampleRule);
      const updated: RedirectRule = { ...sampleRule, destination: 'https://updated.com' };
      await ctx.store.addRedirect(updated);
      const result = await ctx.store.getRedirect('/hello');
      expect(result?.destination).toBe('https://updated.com');
    });

    it('removes a rule by path', async () => {
      await ctx.store.addRedirect(sampleRule);
      await ctx.store.removeRedirect('/hello');
      const result = await ctx.store.getRedirect('/hello');
      expect(result).toBeNull();
    });

    it('removeRedirect is a no-op for non-existent paths', async () => {
      await expect(ctx.store.removeRedirect('/ghost')).resolves.not.toThrow();
    });

    // --- Multiple rules ---

    it('stores and retrieves multiple independent rules', async () => {
      await ctx.store.addRedirect(sampleRule);
      await ctx.store.addRedirect(sampleRule2);

      expect(await ctx.store.getRedirect('/hello')).toEqual(sampleRule);
      expect(await ctx.store.getRedirect('/world')).toEqual(sampleRule2);
    });

    it('removing one rule does not affect another', async () => {
      await ctx.store.addRedirect(sampleRule);
      await ctx.store.addRedirect(sampleRule2);
      await ctx.store.removeRedirect('/hello');

      expect(await ctx.store.getRedirect('/hello')).toBeNull();
      expect(await ctx.store.getRedirect('/world')).toEqual(sampleRule2);
    });

    // --- mightExist ---

    it('mightExist returns true for a stored slug', async () => {
      await ctx.store.addRedirect(sampleRule);
      expect(await ctx.store.mightExist('/hello')).toBe(true);
    });

    it('mightExist returns false or true for non-existent slug (probabilistic OK)', async () => {
      const result = await ctx.store.mightExist('/does-not-exist');
      expect(typeof result).toBe('boolean');
    });

    // --- Complex rules ---

    it('preserves all fields of a complex rule through roundtrip', async () => {
      await ctx.store.addRedirect(ruleWithFeatures);
      const result = await ctx.store.getRedirect('/advanced');
      expect(result).toEqual(ruleWithFeatures);
    });
  });
}
