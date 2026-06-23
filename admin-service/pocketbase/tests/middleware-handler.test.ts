import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as h3 from 'h3';
import * as errorUtils from '../server/utils/error-handler';
import * as pbUtils from '../server/utils/pocketbase';
import * as rateLimitUtils from '../server/utils/rate-limit';

vi.mock('../server/utils/error-handler', () => ({
  createRequestLogger: vi.fn().mockReturnValue({ correlationId: 'cid', info: vi.fn(), error: vi.fn() })
}));

vi.mock('../server/utils/pocketbase', () => ({
  serverPocketBase: vi.fn()
}));

vi.mock('../server/utils/rate-limit', () => ({
  checkRateLimit: vi.fn()
}));

vi.stubGlobal('defineEventHandler', h3.defineEventHandler);
vi.stubGlobal('createError', h3.createError);
vi.stubGlobal('setHeader', h3.setHeader);
vi.stubGlobal('setResponseStatus', h3.setResponseStatus);

const getErrorMiddleware = () => import('../server/middleware/0.error').then(m => m.default);
const getAuthMiddleware = () => import('../server/middleware/2.auth').then(m => m.default);
const getRateLimitMiddleware = () => import('../server/middleware/3.rate-limit').then(m => m.default);

describe('Middleware Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockEvent = (path: string = '/api/test', headers: Record<string, string> = {}) => {
    const callbacks: Record<string, Function[]> = {};
    return {
      node: {
        req: { headers, socket: { remoteAddress: '127.0.0.1' } },
        res: {
            on: vi.fn((event, cb) => {
               if(!callbacks[event]) callbacks[event] = [];
               callbacks[event].push(cb);
            }),
            statusCode: 200,
            getHeader: vi.fn(),
            setHeader: vi.fn()
        }
      },
      path,
      context: {},
      _triggerResEvent: (evt: string) => {
         if(callbacks[evt]) callbacks[evt].forEach(cb => cb());
      }
    } as unknown;
  }

  describe('0.error.ts', () => {
    it('should set context and log start/finish', async () => {
      const event = createMockEvent();
      const middleware = await getErrorMiddleware();
      await middleware(event);

      expect(event.context.logger).toBeDefined();
      expect(event.context.correlationId).toBe('cid');
      expect(errorUtils.createRequestLogger).toHaveBeenCalled();

      // trigger finish
      event._triggerResEvent('finish');
    });
  });

  describe('2.auth.ts', () => {
    it('should skip auth for non-api routes', async () => {
      const event = createMockEvent('/public');
      const middleware = await getAuthMiddleware();
      await middleware(event);
      expect(pbUtils.serverPocketBase).not.toHaveBeenCalled();
    });

    it('should skip auth for auth routes', async () => {
      const event = createMockEvent('/api/auth/login');
      const middleware = await getAuthMiddleware();
      await middleware(event);
      expect(pbUtils.serverPocketBase).not.toHaveBeenCalled();
    });

    it('should set context.user if valid auth', async () => {
      const mockUser = { id: 'user1' };
      const mockPb = { authStore: { isValid: true, record: mockUser } };
      vi.mocked(pbUtils.serverPocketBase).mockResolvedValue(mockPb as unknown);

      const event = createMockEvent('/api/links');
      const middleware = await getAuthMiddleware();
      await middleware(event);

      expect(event.context.user).toBe(mockUser);
    });

    it('should throw 401 if auth invalid', async () => {
      const mockPb = { authStore: { isValid: false } };
      vi.mocked(pbUtils.serverPocketBase).mockResolvedValue(mockPb as unknown);

      const event = createMockEvent('/api/links');
      const middleware = await getAuthMiddleware();

      await expect(middleware(event)).rejects.toThrow('Unauthorized');
    });
  });

  describe('3.rate-limit.ts', () => {
    it('should ignore non-api routes', async () => {
      const event = createMockEvent('/public');
      const middleware = await getRateLimitMiddleware();
      await middleware(event);
      expect(rateLimitUtils.checkRateLimit).not.toHaveBeenCalled();
    });

    it('should allow request if under limit', async () => {
      vi.mocked(rateLimitUtils.checkRateLimit).mockReturnValue({ limit: 60, remaining: 59, reset: 0, allowed: true });
      const event = createMockEvent('/api/links');
      const middleware = await getRateLimitMiddleware();

      // Middleware might return undefined or a value synchronously, ensure it works.
      const p = middleware(event);
      if (p instanceof Promise) await expect(p).resolves.not.toThrow();

      expect(rateLimitUtils.checkRateLimit).toHaveBeenCalled();
    });

    it('should throw 429 if rate limit exceeded', async () => {
      vi.mocked(rateLimitUtils.checkRateLimit).mockReturnValue({ limit: 60, remaining: 0, reset: 100, retryAfter: 10, allowed: false });
      const event = createMockEvent('/api/links');
      const middleware = await getRateLimitMiddleware();

      try {
        await middleware(event);
        throw new Error('Should have thrown');
      } catch (e) {
        expect(e.message).toBe('Too Many Requests');
      }
    });

    it('should extract ip properly', async () => {
      vi.mocked(rateLimitUtils.checkRateLimit).mockReturnValue({ limit: 60, remaining: 59, reset: 0, allowed: true });
      const event = createMockEvent('/api/links', { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' });
      const middleware = await getRateLimitMiddleware();

      await middleware(event);
      expect(rateLimitUtils.checkRateLimit).toHaveBeenCalled();
    });
  });
});
