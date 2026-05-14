import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { H3Event } from 'h3';

vi.mock('../server/utils/pocketbase', () => {
  return {
    serverPocketBase: vi.fn(),
  };
});

// Mock h3 to provide defineEventHandler and createError
vi.mock('h3', () => {
  return {
    defineEventHandler: (handler: Parameters<typeof import('h3').defineEventHandler>[0]) => handler,
    createError: (err: unknown) => err,
  };
});

import { serverPocketBase } from '../server/utils/pocketbase';
import statsGetHandler from '../server/api/analytics/stats.get';

describe('GET /api/analytics/stats', () => {
  let mockEvent: Partial<H3Event>;
  let mockPb: { collection: ReturnType<typeof vi.fn>; getList: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    mockEvent = {
      context: {},
    };
    mockPb = {
      collection: vi.fn().mockReturnThis(),
      getList: vi.fn(),
    };
  });

  it('should return 401 if user is not authenticated', async () => {
    mockEvent.context!.user = null;

    try {
      await (statsGetHandler as ReturnType<typeof import('h3').defineEventHandler>)(mockEvent as H3Event);
      expect.fail('Should have thrown');
    } catch (err: unknown) {
      const error = err as { statusCode: number; statusMessage: string };
      expect(error.statusCode).toBe(401);
      expect(error.statusMessage).toBe('Unauthorized');
    }
  });

  it('should return events and total clicks on success', async () => {
    mockEvent.context!.user = { id: 'user123' };
    vi.mocked(serverPocketBase).mockResolvedValueOnce(mockPb as unknown as import('pocketbase').default);

    const mockEvents = [{ id: 'evt1' }, { id: 'evt2' }];
    mockPb.getList.mockImplementation((page: number, perPage: number, options?: unknown) => {
      if (perPage === 100) {
        return Promise.resolve({ items: mockEvents, totalItems: 2 });
      } else if (perPage === 1) {
        return Promise.resolve({ items: [mockEvents[0]], totalItems: 50 });
      }
      return Promise.resolve({ items: [], totalItems: 0 });
    });

    const result = await (statsGetHandler as ReturnType<typeof import('h3').defineEventHandler>)(mockEvent as H3Event);

    expect(result).toEqual({
      events: mockEvents,
      totalClicks: 50,
    });
    expect(mockPb.collection).toHaveBeenCalledWith('analytics_events');
    expect(mockPb.getList).toHaveBeenCalledTimes(2);
    expect(mockPb.getList).toHaveBeenCalledWith(1, 100, { sort: '-created' });
    expect(mockPb.getList).toHaveBeenCalledWith(1, 1);
  });

  it('should return 500 on database error', async () => {
    mockEvent.context!.user = { id: 'user123' };
    vi.mocked(serverPocketBase).mockResolvedValueOnce(mockPb as unknown as import('pocketbase').default);

    mockPb.getList.mockRejectedValueOnce(new Error('DB Error'));

    try {
      await (statsGetHandler as ReturnType<typeof import('h3').defineEventHandler>)(mockEvent as H3Event);
      expect.fail('Should have thrown');
    } catch (err: unknown) {
      const error = err as { statusCode: number; statusMessage: string };
      expect(error.statusCode).toBe(500);
      expect(error.statusMessage).toBe('Database error');
    }
  });
});
