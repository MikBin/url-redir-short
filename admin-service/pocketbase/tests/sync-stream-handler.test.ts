import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as h3 from 'h3';

const mockOn = vi.fn();
const mockOff = vi.fn();
vi.mock('../server/utils/broadcaster', () => ({
  syncEvents: {
      on: mockOn,
      off: mockOff
  },
  SYNC_EVENT_NAME: 'test_sync_event'
}));

vi.stubGlobal('defineEventHandler', h3.defineEventHandler);
vi.stubGlobal('createError', h3.createError);
vi.stubGlobal('setHeader', h3.setHeader);
vi.stubGlobal('getHeader', h3.getHeader);
vi.stubGlobal('getQuery', h3.getQuery);
vi.stubGlobal('setResponseStatus', h3.setResponseStatus);

// We need to provide a mock implementation for createEventStream before importing the handler
const mockPush = vi.fn();
const mockOnClosed = vi.fn();
const mockSend = vi.fn().mockReturnValue('stream-data');
vi.stubGlobal('createEventStream', vi.fn().mockReturnValue({
    push: mockPush,
    onClosed: mockOnClosed,
    send: mockSend
}));

const getSyncStreamHandler = () => import('../server/api/sync/stream.get').then(m => m.default);

describe('Sync Stream Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockEvent = (method: string, url: string, headers: Record<string, string> = {}) => {
    return {
      node: {
        req: { method, url, headers },
        res: { setHeader: vi.fn(), statusCode: 200 }
      },
      context: {}
    } as unknown;
  }

  it('should return 401 response if unauthorized', async () => {
    const event = createMockEvent('GET', '/api/sync/stream');
    process.env.SYNC_API_KEY = 'SYNC_API_KEY_MOCK';
    const handler = await getSyncStreamHandler();

    // Instead of throwing, it sets response status and returns an error object based on code
    const result = await handler(event);
    expect(result).toHaveProperty('error', 'Unauthorized');
  });

  it('should set up SSE correctly and subscribe', async () => {
    // Need to use the right casing for headers in mock req
    const event = createMockEvent('GET', '/api/sync/stream', { 'authorization': 'Bearer SYNC_API_KEY_MOCK' });
    process.env.SYNC_API_KEY = 'SYNC_API_KEY_MOCK';

    const handler = await getSyncStreamHandler();

    const result = await handler(event);

    // Check it sent stream-data as response
    expect(result).toBe('stream-data');

    // H3 createEventStream setup should be executed
    expect(mockPush).toHaveBeenCalledWith({ data: expect.stringContaining('connected') });

    // We expect it subscribed to the broadcaster events
    expect(mockOn).toHaveBeenCalledWith('test_sync_event', expect.any(Function));

    // Check callback invocation to verify payload sending
    const subscriptionCallback = mockOn.mock.calls[0][1];
    subscriptionCallback({ event: 'create', data: { id: '1' } });

    // The implementation stringifies the data and sends as event
    expect(mockPush).toHaveBeenCalledWith({ event: 'create', data: '{"id":"1"}' });

    // Verify cleanup
    expect(mockOnClosed).toHaveBeenCalled();
    const closeCallback = mockOnClosed.mock.calls[0][0] as Function;
    closeCallback();
    expect(mockOff).toHaveBeenCalledWith('test_sync_event', subscriptionCallback);
  });
});
