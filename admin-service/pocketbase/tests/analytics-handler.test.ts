import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as pbUtils from '../server/utils/pocketbase';
import * as h3 from 'h3';

vi.mock('../server/utils/pocketbase', () => ({
  serverPocketBase: vi.fn(),
  serverPocketBaseUser: vi.fn()
}));

vi.stubGlobal('defineEventHandler', h3.defineEventHandler);
vi.stubGlobal('createError', h3.createError);
vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal() as unknown;
  return {
    ...actual,
    readBody: vi.fn().mockImplementation(async (event: unknown) => event._requestBody),
    setResponseHeader: vi.fn()
  };
});
vi.stubGlobal('readBody', vi.fn().mockImplementation(async (event: unknown) => event._requestBody));
vi.stubGlobal('setResponseHeader', vi.fn());

const getDashboardHandler = () => import('../server/api/analytics/dashboard.get').then(m => m.default);
const getOverviewHandler = () => import('../server/api/analytics/links/overview.get').then(m => m.default);
const getCollectHandler = () => import('../server/api/analytics/v1/collect.post').then(m => m.default);

describe('Analytics Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockEvent = (method: string, url: string, body?: Record<string, unknown>, user: unknown = { id: 'user1' }) => {
    return {
      node: {
        req: { method, url, headers: { 'x-forwarded-for': '127.0.0.1' } },
        res: { setHeader: vi.fn(), statusCode: 200 }
      },
      context: { user },
      _requestBody: body
    } as unknown;
  }

  describe('dashboard.get.ts', () => {
    it('should throw 401 if unauthorized', async () => {
      const event = createMockEvent('GET', '/api/analytics/dashboard', null, null);
      const handler = await getDashboardHandler();
      await expect(handler(event)).rejects.toThrow('Unauthorized');
    });

    it('should return analytics summary and aggregations', async () => {
      const mockPb = {
          collection: vi.fn().mockReturnThis(),
          getList: vi.fn().mockResolvedValue({ totalItems: 10, items: [] })
      };
      vi.mocked(pbUtils.serverPocketBase).mockResolvedValue(mockPb as unknown);

      const event = createMockEvent('GET', '/api/analytics/dashboard');
      const handler = await getDashboardHandler();
      const result = await handler(event);

      expect(result.summary.totalClicks).toBe(10);
      expect(result).toHaveProperty('generatedAt');
    });
  });

  describe('overview.get.ts', () => {
    it('should throw 401 if unauthorized', async () => {
      const event = createMockEvent('GET', '/api/analytics/links/overview', null, null);
      const handler = await getOverviewHandler();
      await expect(handler(event)).rejects.toThrow('Unauthorized');
    });

    it('should return aggregated clicks', async () => {
      const mockPb = {
          collection: vi.fn().mockReturnThis(),
          getList: vi.fn().mockResolvedValue({ items: [{ link_id: 'l1', click_count: 5 }] })
      };
      vi.mocked(pbUtils.serverPocketBase).mockResolvedValue(mockPb as unknown);

      const event = createMockEvent('GET', '/api/analytics/links/overview');
      const handler = await getOverviewHandler();
      const result = await handler(event);

      expect(result).toEqual({ l1: 5 });
    });

    it('should handle errors gracefully returning empty object', async () => {
      const mockPb = {
          collection: vi.fn().mockReturnThis(),
          getList: vi.fn().mockRejectedValue(new Error('DB failure'))
      };
      vi.mocked(pbUtils.serverPocketBase).mockResolvedValue(mockPb as unknown);

      const event = createMockEvent('GET', '/api/analytics/links/overview');
      const handler = await getOverviewHandler();
      const result = await handler(event);

      expect(result).toEqual({});
    });
  });

  describe('collect.post.ts', () => {
    it('should throw 400 for invalid payload', async () => {
      const event = createMockEvent('POST', '/api/analytics/v1/collect', { path: '' });
      const handler = await getCollectHandler();
      await expect(handler(event)).rejects.toThrow('Invalid payload format');
    });

    it('should process collection via event.waitUntil', async () => {
      const body = { path: 'test-path', destination: 'https://example.com', status: 200 };
      const event = createMockEvent('POST', '/api/analytics/v1/collect', body);
      event.waitUntil = vi.fn();

      const mockPb = {
          collection: vi.fn().mockReturnThis(),
          getFirstListItem: vi.fn().mockResolvedValue({ id: 'mock-link-id' }),
          create: vi.fn().mockResolvedValue({ id: 'evt-1' }),
          update: vi.fn().mockResolvedValue(true)
      };
      vi.mocked(pbUtils.serverPocketBase).mockResolvedValue(mockPb as unknown);

      const handler = await getCollectHandler();
      const result = await handler(event);

      expect(result).toEqual(expect.objectContaining({ success: true, queued: true }));
      expect(event.waitUntil).toHaveBeenCalled();

      // Await the task that was passed to waitUntil
      const task = event.waitUntil.mock.calls[0][0];
      await task;

      expect(mockPb.create).toHaveBeenCalled(); // create event
      expect(mockPb.update).toHaveBeenCalled(); // update aggregate
    });
  });
});
