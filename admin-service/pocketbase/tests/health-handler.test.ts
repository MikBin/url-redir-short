import { describe, it, expect, vi, beforeEach } from 'vitest';
import handler from '../server/api/health.get';
import * as monitoring from '../server/utils/monitoring';
import { createEvent, toWebRequest } from 'h3';

vi.mock('../server/utils/monitoring', () => ({
  getHealthStatus: vi.fn()
}));

describe('Health Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockEvent = () => {
    return {
      node: {
        req: { method: 'GET', url: '/api/health', headers: {} },
        res: { setHeader: vi.fn(), statusCode: 200 }
      },
      context: {}
    } as unknown;
  }

  it('should return 200 and healthy status', async () => {
    vi.mocked(monitoring.getHealthStatus).mockResolvedValue({ status: 'healthy', components: {} } as unknown);
    const event = createMockEvent();
    const result = await handler(event);

    expect(result).toEqual({ status: 'healthy', components: {} });
    expect(event.node.res.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, max-age=10');
  });

  it('should return 503 and unhealthy status', async () => {
    vi.mocked(monitoring.getHealthStatus).mockResolvedValue({ status: 'unhealthy', components: {} } as unknown);
    const event = createMockEvent();
    const result = await handler(event);

    expect(result).toEqual({ status: 'unhealthy', components: {} });
    expect(event.node.res.statusCode).toBe(503);
    expect(event.node.res.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, max-age=10');
  });

  it('should return 200 and degraded status', async () => {
    vi.mocked(monitoring.getHealthStatus).mockResolvedValue({ status: 'degraded', components: {} } as unknown);
    const event = createMockEvent();
    const result = await handler(event);

    expect(result).toEqual({ status: 'degraded', components: {} });
    expect(event.node.res.statusCode).toBe(200);
    expect(event.node.res.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, max-age=10');
  });
});
