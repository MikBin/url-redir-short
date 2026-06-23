import { describe, it, expect, vi, beforeEach } from 'vitest';
import handler from '../server/api/metrics.get';
import * as monitoring from '../server/utils/monitoring';

vi.mock('../server/utils/monitoring', () => ({
  getMetrics: vi.fn()
}));

vi.mock('../server/utils/error-handler', () => ({
  createRequestLogger: vi.fn(() => ({ error: vi.fn() })),
  handleError: vi.fn((event, err) => {
    throw err;
  })
}));

describe('Metrics Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockEvent = (user: unknown) => {
    return {
      node: {
        req: { method: 'GET', url: '/api/metrics', headers: {} },
        res: { setHeader: vi.fn(), statusCode: 200 }
      },
      context: { user }
    } as unknown;
  }

  it('should return metrics if authorized', async () => {
    vi.mocked(monitoring.getMetrics).mockReturnValue({ timestamp: 'now' } as unknown);
    const event = createMockEvent({ id: 'user1' });
    const result = await handler(event);

    expect(result).toEqual({ timestamp: 'now' });
  });

  it('should throw 401 if unauthorized', async () => {
    const event = createMockEvent(null);
    await expect(handler(event)).rejects.toThrow('Unauthorized');
  });
});
