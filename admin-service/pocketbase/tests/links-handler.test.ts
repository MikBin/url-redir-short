import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as pbUtils from '../server/utils/pocketbase';
import * as broadcaster from '../server/utils/broadcaster';
import * as aliasGen from '../server/utils/alias-generator';
import * as auditUtils from '../server/utils/audit';
import * as h3 from 'h3';

vi.mock('../server/utils/pocketbase', () => ({
  serverPocketBase: vi.fn(),
  serverPocketBaseUser: vi.fn()
}));

vi.mock('../server/utils/broadcaster', () => ({
  broadcaster: { broadcast: vi.fn() }
}));

vi.mock('../server/utils/alias-generator', () => ({
  generateUniqueAlias: vi.fn()
}));

vi.mock('../server/utils/audit', () => ({
  logAudit: vi.fn()
}));

vi.stubGlobal('defineEventHandler', h3.defineEventHandler);
vi.stubGlobal('createError', h3.createError);
vi.stubGlobal('getRouterParam', vi.fn().mockReturnValue('mock_id'));
// Prevent readBody from running using h3 implementation directly
vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal() as unknown;
  return {
    ...actual,
    readBody: vi.fn().mockImplementation(async (event: unknown) => event._requestBody)
  };
});
vi.stubGlobal('readBody', vi.fn().mockImplementation(async (event: unknown) => event._requestBody));

// Handlers
const getIndexHandler = () => import('../server/api/links/index.get').then(m => m.default);
const getCreateHandler = () => import('../server/api/links/create.post').then(m => m.default);
const getPatchHandler = () => import('../server/api/links/[id].patch').then(m => m.default);
const getDeleteHandler = () => import('../server/api/links/[id].delete').then(m => m.default);

describe('Links Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockEvent = (method: string, url: string, body?: Record<string, unknown> | null, user: unknown = { id: 'user1' }) => {
    return {
      node: {
        req: { method, url, headers: {} },
        res: { setHeader: vi.fn(), statusCode: 200 }
      },
      context: { user },
      _requestBody: body
    } as unknown;
  }

  describe('index.get.ts', () => {
    it('should throw 401 if unauthorized', async () => {
      const event = createMockEvent('GET', '/api/links', null, null);
      vi.mocked(pbUtils.serverPocketBaseUser).mockResolvedValue(null);
      const handler = await getIndexHandler();
      await expect(handler(event)).rejects.toThrow('Unauthorized');
    });

    it('should return links list', async () => {
      const mockPb = { collection: vi.fn().mockReturnThis(), getFullList: vi.fn().mockResolvedValue([{ id: '1' }]) };
      vi.mocked(pbUtils.serverPocketBase).mockResolvedValue(mockPb as unknown);
      const event = createMockEvent('GET', '/api/links');
      const handler = await getIndexHandler();
      const result = await handler(event);
      expect(result).toEqual([{ id: '1' }]);
    });
  });

  describe('create.post.ts', () => {
    it('should throw 401 if unauthorized', async () => {
      const event = createMockEvent('POST', '/api/links', { destination: 'url' }, null);
      vi.mocked(pbUtils.serverPocketBaseUser).mockResolvedValue(null);
      const handler = await getCreateHandler();
      await expect(handler(event)).rejects.toThrow('Unauthorized');
    });

    it('should throw 400 for invalid payload', async () => {
      const event = createMockEvent('POST', '/api/links', { invalid: 'data' });
      const handler = await getCreateHandler();
      await expect(handler(event)).rejects.toThrow('Invalid payload');
    });

    it('should successfully create link without slug', async () => {
      vi.mocked(aliasGen.generateUniqueAlias).mockResolvedValue('unique-alias');
      const mockPb = { collection: vi.fn().mockReturnThis(), create: vi.fn().mockResolvedValue({ id: 'new-id', slug: 'unique-alias' }) };
      vi.mocked(pbUtils.serverPocketBase).mockResolvedValue(mockPb as unknown);

      const event = createMockEvent('POST', '/api/links', { destination: 'https://example.com' });
      const handler = await getCreateHandler();
      const result = await handler(event);

      expect(result.id).toBe('new-id');
      expect(mockPb.create).toHaveBeenCalledWith(expect.objectContaining({ slug: 'unique-alias', destination: 'https://example.com' }));
      expect(broadcaster.broadcaster.broadcast).toHaveBeenCalledWith('create', result);
      expect(auditUtils.logAudit).toHaveBeenCalled();
    });

    it('should throw if creation fails', async () => {
      const mockPb = { collection: vi.fn().mockReturnThis(), create: vi.fn().mockRejectedValue(new Error('DB Error')) };
      vi.mocked(pbUtils.serverPocketBase).mockResolvedValue(mockPb as unknown);

      const event = createMockEvent('POST', '/api/links', { destination: 'https://example.com', slug: 'test' });
      const handler = await getCreateHandler();

      // Error handling wraps it to h3 error but DB Error is logged
      await expect(handler(event)).rejects.toThrow();
      expect(auditUtils.logAudit).toHaveBeenCalledWith(expect.objectContaining({ status: 'failure' }));
    });
  });

  describe('[id].patch.ts', () => {
    it('should successfully update link', async () => {
      const mockPb = { collection: vi.fn().mockReturnThis(), getOne: vi.fn().mockResolvedValue({ id: 'mock_id' }), update: vi.fn().mockResolvedValue({ id: 'mock_id', destination: 'https://new.com' }) };
      vi.mocked(pbUtils.serverPocketBase).mockResolvedValue(mockPb as unknown);

      const event = createMockEvent('PATCH', '/api/links/mock_id', { destination: 'https://new.com' });
      const handler = await getPatchHandler();
      const result = await handler(event);

      expect(result.destination).toBe('https://new.com');
      expect(broadcaster.broadcaster.broadcast).toHaveBeenCalledWith('update', result);
      expect(auditUtils.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'update', status: 'success' }));
    });

    it('should throw 404 if link not found', async () => {
      const mockPb = { collection: vi.fn().mockReturnThis(), getOne: vi.fn().mockRejectedValue(new Error('Not found')) };
      vi.mocked(pbUtils.serverPocketBase).mockResolvedValue(mockPb as unknown);

      const event = createMockEvent('PATCH', '/api/links/mock_id', { destination: 'https://new.com' });
      const handler = await getPatchHandler();

      await expect(handler(event)).rejects.toThrow('Link not found');
    });
  });

  describe('[id].delete.ts', () => {
    it('should successfully delete link', async () => {
      const mockPb = { collection: vi.fn().mockReturnThis(), getOne: vi.fn().mockResolvedValue({ id: 'mock_id' }), delete: vi.fn().mockResolvedValue(true) };
      vi.mocked(pbUtils.serverPocketBase).mockResolvedValue(mockPb as unknown);
      vi.mocked(pbUtils.serverPocketBaseUser).mockResolvedValue({ id: 'user1' } as unknown);

      const event = createMockEvent('DELETE', '/api/links/mock_id', null);
      const handler = await getDeleteHandler();
      const result = await handler(event);

      expect(result).toEqual({ success: true });
      expect(broadcaster.broadcaster.broadcast).toHaveBeenCalledWith('delete', { id: 'mock_id' });
    });

    it('should throw error if delete fails', async () => {
      const mockPb = { collection: vi.fn().mockReturnThis(), getOne: vi.fn().mockResolvedValue({ id: 'mock_id' }), delete: vi.fn().mockRejectedValue(new Error('Delete err')) };
      vi.mocked(pbUtils.serverPocketBase).mockResolvedValue(mockPb as unknown);
      vi.mocked(pbUtils.serverPocketBaseUser).mockResolvedValue({ id: 'user1' } as unknown);

      const event = createMockEvent('DELETE', '/api/links/mock_id', null);
      const handler = await getDeleteHandler();

      await expect(handler(event)).rejects.toThrow('Delete err');
    });
  });
});
