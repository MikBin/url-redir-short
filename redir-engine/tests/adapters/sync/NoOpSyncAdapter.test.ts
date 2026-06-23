import { describe, it, expect, vi } from 'vitest';
import { NoOpSyncAdapter } from '../../../src/adapters/sync/NoOpSyncAdapter';

describe('NoOpSyncAdapter', () => {
  it('start should resolve immediately without doing anything', async () => {
    const adapter = new NoOpSyncAdapter();
    await expect(adapter.start()).resolves.toBeUndefined();
  });

  it('stop should execute without throwing', () => {
    const adapter = new NoOpSyncAdapter();
    expect(() => adapter.stop()).not.toThrow();
  });

  it('onUpdate should accept a callback without error', () => {
    const adapter = new NoOpSyncAdapter();
    const mockCallback = vi.fn();
    expect(() => adapter.onUpdate(mockCallback)).not.toThrow();
    // Verify callback is not called
    expect(mockCallback).not.toHaveBeenCalled();
  });
});
