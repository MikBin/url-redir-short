import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as pbUtils from '../server/utils/pocketbase';
import * as bulkUtils from '../server/utils/bulk';
import * as auditUtils from '../server/utils/audit';
import * as h3 from 'h3';

vi.mock('../server/utils/pocketbase', () => ({
  serverPocketBase: vi.fn()
}));

vi.mock('../server/utils/bulk', () => ({
  validateBulkLinks: vi.fn()
}));

vi.mock('../server/utils/audit', () => ({
  logAudit: vi.fn()
}));

vi.stubGlobal('defineEventHandler', h3.defineEventHandler);
vi.stubGlobal('createError', h3.createError);
// ReadBody in H3 checks method if it reads via readRawBody unless it's mocked before handler load properly.
// Best approach is to mock readBody completely and not let H3 handle it at all.
vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal() as unknown;
  return {
    ...actual,
    readBody: vi.fn().mockImplementation(async (event: unknown) => event._requestBody)
  };
});
vi.stubGlobal('readBody', vi.fn().mockImplementation(async (event: unknown) => event._requestBody));


const getHandler = () => import('../server/api/bulk.post').then(m => m.default);

describe('Bulk Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockEvent = (body: unknown, user: unknown = { id: 'user1' }) => {
    return {
      node: {
        req: { method: 'POST', url: '/api/bulk', headers: {} },
        res: { setHeader: vi.fn(), statusCode: 200 }
      },
      context: { user },
      _requestBody: body
    } as unknown;
  }

  it('should return 401 if unauthorized', async () => {
    const event = createMockEvent({}, null);
    const handler = await getHandler();
    await expect(handler(event)).rejects.toThrow('Unauthorized');
  });

  it('should return success 0 if all invalid', async () => {
    vi.mocked(bulkUtils.validateBulkLinks).mockReturnValue({ valid: [], invalid: [{ slug: 'a', destination: 'b', error: 'err' }] } as unknown);
    const event = createMockEvent({ links: [] });
    const handler = await getHandler();

    const result = await handler(event);
    expect(result).toEqual({ success: 0, failed: 1, invalid_items: [{ slug: 'a', destination: 'b', error: 'err' }] });
    expect(auditUtils.logAudit).toHaveBeenCalled();
  });

  it('should process batch creation correctly', async () => {
    const validLinks = [{ slug: 'a', destination: 'url_a' }, { slug: 'b', destination: 'url_b' }];
    vi.mocked(bulkUtils.validateBulkLinks).mockReturnValue({ valid: validLinks, invalid: [] } as unknown);

    const mockBatch = { collection: vi.fn().mockReturnThis(), create: vi.fn(), send: vi.fn().mockResolvedValue(true) };
    const mockPb = { createBatch: vi.fn().mockReturnValue(mockBatch) };
    vi.mocked(pbUtils.serverPocketBase).mockResolvedValue(mockPb as unknown);

    const event = createMockEvent({ links: validLinks });
    const handler = await getHandler();

    const result = await handler(event);
    expect(result).toEqual({ success: 2, failed: 0, invalid_items: [] });
    expect(mockBatch.create).toHaveBeenCalledTimes(2);
    expect(mockBatch.send).toHaveBeenCalled();
  });

  it('should process fallback gracefully', async () => {
    const validLinks = [{ slug: 'a', destination: 'url_a' }, { slug: 'b', destination: 'url_b' }];
    vi.mocked(bulkUtils.validateBulkLinks).mockReturnValue({ valid: validLinks, invalid: [] } as unknown);

    const mockBatch1 = { collection: vi.fn().mockReturnThis(), create: vi.fn(), send: vi.fn().mockRejectedValue(new Error('Batch failed')) };
    const mockBatch2 = { collection: vi.fn().mockReturnThis(), create: vi.fn(), send: vi.fn().mockResolvedValue(true) };

    const mockPb = {
        createBatch: vi.fn().mockReturnValueOnce(mockBatch1).mockReturnValueOnce(mockBatch2),
        collection: vi.fn().mockReturnThis(),
        getFullList: vi.fn().mockResolvedValue([{ slug: 'a' }]) // Simulating 'a' already exists
    };
    vi.mocked(pbUtils.serverPocketBase).mockResolvedValue(mockPb as unknown);

    const event = createMockEvent({ links: validLinks });
    const handler = await getHandler();

    const result = await handler(event);
    expect(result.success).toBe(1); // Only 'b' succeeds
    expect(result.failed).toBe(1);
    expect(result.invalid_items[0].error).toContain('Unique constraint failed for slug: a');
  });

  it('should handle complete fallback correctly', async () => {
     const validLinks = [{ slug: 'a', destination: 'url_a' }];
     vi.mocked(bulkUtils.validateBulkLinks).mockReturnValue({ valid: validLinks, invalid: [] } as unknown);

     const mockBatch1 = { collection: vi.fn().mockReturnThis(), create: vi.fn(), send: vi.fn().mockRejectedValue(new Error('Batch 1 failed')) };
     const mockBatch2 = { collection: vi.fn().mockReturnThis(), create: vi.fn(), send: vi.fn().mockRejectedValue(new Error('Batch 2 failed')) };

     const mockPb = {
         createBatch: vi.fn().mockReturnValueOnce(mockBatch1).mockReturnValueOnce(mockBatch2),
         collection: vi.fn().mockReturnThis(),
         getFullList: vi.fn().mockResolvedValue([]),
         create: vi.fn().mockResolvedValue(true)
     };
     vi.mocked(pbUtils.serverPocketBase).mockResolvedValue(mockPb as unknown);

     const event = createMockEvent({ links: validLinks });
     const handler = await getHandler();

     const result = await handler(event);
     expect(result.success).toBe(1);
     expect(mockPb.create).toHaveBeenCalled();
   });

   it('should handle complete failure correctly', async () => {
      const validLinks = [{ slug: 'a', destination: 'url_a' }];
      vi.mocked(bulkUtils.validateBulkLinks).mockReturnValue({ valid: validLinks, invalid: [] } as unknown);

      const mockBatch1 = { collection: vi.fn().mockReturnThis(), create: vi.fn(), send: vi.fn().mockRejectedValue(new Error('Batch 1 failed')) };
      const mockBatch2 = { collection: vi.fn().mockReturnThis(), create: vi.fn(), send: vi.fn().mockRejectedValue(new Error('Batch 2 failed')) };

      const mockPb = {
          createBatch: vi.fn().mockReturnValueOnce(mockBatch1).mockReturnValueOnce(mockBatch2),
          collection: vi.fn().mockReturnThis(),
          getFullList: vi.fn().mockResolvedValue([]),
          create: vi.fn().mockRejectedValue(new Error('System error'))
      };
      vi.mocked(pbUtils.serverPocketBase).mockResolvedValue(mockPb as unknown);

      const event = createMockEvent({ links: validLinks });
      const handler = await getHandler();

      const result = await handler(event);
      expect(result.success).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.invalid_items[0].error).toContain('System error');
    });
});
