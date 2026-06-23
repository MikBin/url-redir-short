import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncStateUseCase } from '../../src/use-cases/sync-state';
import { IRedirectStore } from '../../src/ports/IRedirectStore';
import { RedirectRule } from '../../src/core/config/types';

describe('SyncStateUseCase', () => {
  let storeMock: Partial<IRedirectStore>;
  let syncState: SyncStateUseCase;
  let addRedirectSpy: ReturnType<typeof vi.fn>;
  let removeRedirectSpy: ReturnType<typeof vi.fn>;

  const activeRule: RedirectRule = {
    path: '/active',
    destination: 'http://active.local',
    code: 301,
    isActive: true,
  };

  const inactiveRule: RedirectRule = {
    path: '/inactive',
    destination: 'http://inactive.local',
    code: 301,
    isActive: false,
  };

  beforeEach(() => {
    addRedirectSpy = vi.fn().mockResolvedValue(undefined);
    removeRedirectSpy = vi.fn().mockResolvedValue(undefined);

    storeMock = {
      addRedirect: addRedirectSpy,
      removeRedirect: removeRedirectSpy,
    };

    syncState = new SyncStateUseCase(storeMock as IRedirectStore, {
      maxHeapMB: 10,
      enableMetrics: false,
    });

    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('handleCreate adds an active rule', async () => {
    await syncState.handleCreate(activeRule);
    expect(addRedirectSpy).toHaveBeenCalledWith(activeRule);
    expect(removeRedirectSpy).not.toHaveBeenCalled();
    expect(syncState.getCacheInfo().size).toBe(1);
  });

  it('handleCreate removes an inactive rule', async () => {
    await syncState.handleCreate(inactiveRule);
    expect(addRedirectSpy).not.toHaveBeenCalled();
    expect(removeRedirectSpy).toHaveBeenCalledWith(inactiveRule.path);
    expect(syncState.getCacheInfo().size).toBe(1); // It records access for the rule path
  });

  it('handleUpdate adds an active rule', async () => {
    await syncState.handleUpdate(activeRule);
    expect(addRedirectSpy).toHaveBeenCalledWith(activeRule);
    expect(removeRedirectSpy).not.toHaveBeenCalled();
    expect(syncState.getCacheInfo().size).toBe(1);
  });

  it('handleUpdate removes an inactive rule', async () => {
    await syncState.handleUpdate(inactiveRule);
    expect(addRedirectSpy).not.toHaveBeenCalled();
    expect(removeRedirectSpy).toHaveBeenCalledWith(inactiveRule.path);
    expect(syncState.getCacheInfo().size).toBe(1); // Still tracks access
  });

  it('handleDelete removes a rule entirely', async () => {
    await syncState.handleCreate(activeRule);
    expect(syncState.getCacheInfo().size).toBe(1);

    await syncState.handleDelete(activeRule);
    expect(removeRedirectSpy).toHaveBeenCalledWith(activeRule.path);

    // Also removes from cache access explicitly via recordRemoval
    expect(syncState.getCacheInfo().size).toBe(0);
  });

  it('normalizes targeting rules correctly', async () => {
    const rule: RedirectRule = {
      path: '/targeted',
      destination: 'http://targeted.local',
      code: 301,
      isActive: true,
      targeting: {
        enabled: true,
        rules: [
          { target: 'country', operator: 'eq', value: 'US' },
          { target: 'device', operator: 'eq', value: 'MOBILE' },
          { target: 'language', operator: 'in', value: 'EN,ES' },
          { target: 'browser', operator: 'eq', value: 'CHROME' } // shouldn't be touched by the specific check
        ]
      } as unknown as NonNullable<RedirectRule['targeting']>
    };

    await syncState.handleCreate(rule);

    expect(addRedirectSpy).toHaveBeenCalled();
    const passedRule = addRedirectSpy.mock.calls[0][0] as RedirectRule;

    expect(passedRule.targeting?.rules?.[0].value).toBe('us');
    expect(passedRule.targeting?.rules?.[1].value).toBe('mobile');
    expect(passedRule.targeting?.rules?.[2].value).toBe('en,es');
    expect(passedRule.targeting?.rules?.[3].value).toBe('CHROME'); // Retains original case
  });

  it('records cache access properly', () => {
    syncState.recordCacheAccess('/test-manual', activeRule);
    expect(syncState.getCacheInfo().size).toBe(1);
  });

  it('provides metrics and reports', () => {
    syncState.recordCacheAccess('/test', activeRule);

    expect(syncState.getEvictionMetrics()).toBeDefined();
    expect(syncState.getEvictionMetrics().misses).toBe(1);

    const report = syncState.printCacheReport();
    expect(typeof report).toBe('string');
    expect(report).toContain('Cache Eviction Report');
  });

  it('shuts down cleanly', () => {
    expect(() => syncState.shutdown()).not.toThrow();
    // Cache size should be 0 after shutdown clear
    expect(syncState.getCacheInfo().size).toBe(0);
  });
});
