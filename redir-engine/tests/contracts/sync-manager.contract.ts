import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ISyncManager } from '../../src/ports/ISyncManager';
import { RedirectRuleUpdate } from '../../src/core/config/types';

interface ContractContext {
  adapter: ISyncManager;
  triggerUpdate?: (update: RedirectRuleUpdate) => void;
  teardown?: () => Promise<void>;
}

export function syncManagerContract(
  name: string,
  factory: () => Promise<ContractContext>
) {
  describe(`ISyncManager contract: ${name}`, () => {
    let ctx: ContractContext;

    beforeEach(async () => {
      ctx = await factory();
    });

    afterEach(async () => {
      ctx.adapter.stop();
      await ctx.teardown?.();
    });

    it('start() resolves without throwing', async () => {
      await expect(ctx.adapter.start()).resolves.not.toThrow();
    });

    it('stop() does not throw', () => {
      expect(() => ctx.adapter.stop()).not.toThrow();
    });

    it('start() is idempotent (calling twice does not throw)', async () => {
      await ctx.adapter.start();
      await expect(ctx.adapter.start()).resolves.not.toThrow();
    });

    it('stop() is idempotent (calling twice does not throw)', async () => {
      await ctx.adapter.start();
      ctx.adapter.stop();
      expect(() => ctx.adapter.stop()).not.toThrow();
    });

    it('stop() before start() does not throw', () => {
      expect(() => ctx.adapter.stop()).not.toThrow();
    });

    it('onUpdate() accepts a callback without error', () => {
      const callback = vi.fn();
      expect(() => ctx.adapter.onUpdate(callback)).not.toThrow();
    });

    it('onUpdate() can be called before start()', () => {
      const callback = vi.fn();
      ctx.adapter.onUpdate(callback);
      expect(callback).not.toHaveBeenCalled();
    });

    it('delivers updates to registered callback', async () => {
      if (!ctx.triggerUpdate) return;

      const callback = vi.fn();
      ctx.adapter.onUpdate(callback);
      await ctx.adapter.start();

      const update: RedirectRuleUpdate = {
        type: 'create',
        data: { id: '1', path: '/test', destination: 'https://example.com', code: 301 },
      };

      ctx.triggerUpdate(update);

      expect(callback).toHaveBeenCalledWith(update);
    });
  });
}
