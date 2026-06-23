import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as pbUtils from '../server/utils/pocketbase';
import * as aliasGen from '../server/utils/alias-generator';
import * as auditUtils from '../server/utils/audit';
import * as metricsUtils from '../server/utils/metrics';

// Need to mock PocketBase correctly as a class constructor
vi.mock('pocketbase', () => {
  return {
    default: class MockPocketBase {
      autoCancellation = vi.fn();
      authStore = { save: vi.fn(), clear: vi.fn(), isValid: true, model: { id: 'mock-user' } };
      collection = vi.fn().mockReturnValue({ authRefresh: vi.fn().mockResolvedValue(true) });
    }
  };
});

// We can just use h3 directly for the mocks instead of stubbing globals if we are importing utils that use global stubs
import * as h3 from 'h3';
vi.stubGlobal('getCookie', vi.fn());
vi.stubGlobal('getHeader', vi.fn());

describe('Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('alias-generator.ts', () => {
    it('should generate an alias of the requested length', () => {
      const alias = aliasGen.generateAlias(5);
      expect(alias).toHaveLength(5);
      expect(/^[a-zA-Z0-9]+$/.test(alias)).toBe(true);
    });

    it('should return unique alias if checkExists resolves false', async () => {
      const checkExists = vi.fn().mockResolvedValue(false);
      const alias = await aliasGen.generateUniqueAlias(checkExists);
      expect(alias).toBeDefined();
      expect(checkExists).toHaveBeenCalledTimes(1);
    });

    it('should retry if alias exists and fail after 3 retries', async () => {
      const checkExists = vi.fn().mockResolvedValue(true);
      await expect(aliasGen.generateUniqueAlias(checkExists)).rejects.toThrow('Failed to generate a unique alias');
      expect(checkExists).toHaveBeenCalledTimes(3);
    });
  });

  describe('audit.ts', () => {
    it('should log audit details to console', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      auditUtils.logAudit({
        actor: { id: 'user1' },
        action: 'create',
        resource: { type: 'link', id: 'l1' },
        status: 'success'
      });
      expect(consoleSpy).toHaveBeenCalled();
      const output = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(output.type).toBe('audit');
      expect(output.action).toBe('create');
      consoleSpy.mockRestore();
    });
  });

  describe('metrics.ts', () => {
    it('should have increment requests interface', () => {
      expect(metricsUtils.metrics.requestsTotal.inc).toBeDefined();
      expect(() => metricsUtils.metrics.requestsTotal.inc({ status: 200 })).not.toThrow();
    });

    it('should have observe duration interface', () => {
      expect(metricsUtils.metrics.requestDuration.observe).toBeDefined();
      expect(() => metricsUtils.metrics.requestDuration.observe({ status: 200 }, 0.5)).not.toThrow();
    });
  });

  describe('pocketbase.ts', () => {
    it('should extract cookie string token (JSON parseable)', async () => {
      const mockEvent = {} as unknown;
      vi.mocked(globalThis.getCookie as unknown).mockReturnValue(JSON.stringify({ token: 'cookie-token', model: {} }));
      const pb = await pbUtils.serverPocketBase(mockEvent);
      expect(pb).toBeDefined();
    });

    it('should extract cookie string token (Invalid JSON)', async () => {
      const mockEvent = {} as unknown;
      vi.mocked(globalThis.getCookie as unknown).mockReturnValue('invalid-json');
      const pb = await pbUtils.serverPocketBase(mockEvent);
      expect(pb).toBeDefined();
    });

    it('should extract auth header token', async () => {
      const mockEvent = {} as unknown;
      vi.mocked(globalThis.getCookie as unknown).mockReturnValue(undefined);
      vi.mocked(globalThis.getHeader as unknown).mockReturnValue('Bearer header-token');
      const pb = await pbUtils.serverPocketBase(mockEvent);
      expect(pb).toBeDefined();
    });

    it('should fetch user directly', async () => {
      const mockEvent = {} as unknown;
      vi.mocked(globalThis.getCookie as unknown).mockReturnValue(undefined);
      vi.mocked(globalThis.getHeader as unknown).mockReturnValue('Bearer header-token');
      const user = await pbUtils.serverPocketBaseUser(mockEvent);
      expect(user).toBeDefined();
      expect(user?.id).toBe('mock-user');
    });
  });
});
