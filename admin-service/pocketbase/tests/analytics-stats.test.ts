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
    defineEventHandler: (handler: any) => handler,
    createError: (err: any) => err,
  };
});

import { serverPocketBase } from '../server/utils/pocketbase';
import statsGetHandler from '../server/api/analytics/stats.get';

describe('GET /api/analytics/stats', () => {
  let mockEvent: any;
  let mockPb: any;

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
    mockEvent.context.user = null;

    try {
      await (statsGetHandler as any)(mockEvent);
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.statusCode).toBe(401);
      expect(err.statusMessage).toBe('Unauthorized');
    }
  });

  it('should return events and total clicks on success', async () => {
    mockEvent.context.user = { id: 'user123' };
    vi.mocked(serverPocketBase).mockResolvedValueOnce(mockPb);

    const mockEvents = [{ id: 'evt1' }, { id: 'evt2' }];
    mockPb.getList.mockImplementation((page: number, perPage: number, options?: any) => {
      if (perPage === 100) {
        return Promise.resolve({ items: mockEvents, totalItems: 2 });
      } else if (perPage === 1) {
        return Promise.resolve({ items: [mockEvents[0]], totalItems: 50 });
      }
      return Promise.resolve({ items: [], totalItems: 0 });
    });

    const result = await (statsGetHandler as any)(mockEvent as H3Event);

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
    mockEvent.context.user = { id: 'user123' };
    vi.mocked(serverPocketBase).mockResolvedValueOnce(mockPb);

    mockPb.getList.mockRejectedValueOnce(new Error('DB Error'));

    try {
      await (statsGetHandler as any)(mockEvent as H3Event);
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.statusCode).toBe(500);
      expect(err.statusMessage).toBe('Database error');
    }
  });
});
