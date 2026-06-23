import { describe, it, expect, vi } from 'vitest';
import { SSEClient, EventSourceConstructor } from '../../../src/adapters/sse/sse-client';

describe('SSEClient extended', () => {
  it('does not throw when receiving events but no callback is registered', () => {
    const listeners: Record<string, Function> = {};

    class MockEventSource {
      url: string;
      constructor(url: string) {
        this.url = url;
      }
      close = vi.fn();
      addEventListener = (evt: string, cb: Function) => {
        listeners[evt] = cb;
      };
      onopen = null;
      onerror = null;
      onmessage = null;
      dispatchEvent = vi.fn();
      removeEventListener = vi.fn();
      readyState = 0;
      CONNECTING = 0 as const;
      OPEN = 1 as const;
      CLOSED = 2 as const;
      withCredentials = false;
    }

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const client = new SSEClient('http://test', MockEventSource as unknown as EventSourceConstructor);

    // Connect without providing callbacks for update and delete
    client.connect();

    // Fire the update and delete events explicitly
    if (listeners['update']) listeners['update']({ data: '{"path":"/a"}' });
    if (listeners['delete']) listeners['delete']({ data: '{"path":"/b"}' });

    // Expect no errors to be thrown since we're just triggering logs and optional callbacks.
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[SSE] Custom event "update"'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[SSE] Custom event "delete"'));
  });

  it('close safely returns when eventSource is null and handles retryTimeout', () => {
    vi.useFakeTimers();

    class MockEventSource {
      url: string;
      constructor(url: string) {
        this.url = url;
      }
      close = vi.fn();
      addEventListener = vi.fn();
      onopen = null;
      onerror = null;
      onmessage = null;
      dispatchEvent = vi.fn();
      removeEventListener = vi.fn();
      readyState = 0;
      CONNECTING = 0 as const;
      OPEN = 1 as const;
      CLOSED = 2 as const;
      withCredentials = false;
    }

    const client = new SSEClient('http://test', MockEventSource as unknown as EventSourceConstructor);

    // Simulate error to trigger scheduleReconnect and thus set retryTimeout
    vi.spyOn(console, 'error').mockImplementation(() => {});
    client.connect();

    // Safe access relying on expected runtime properties
    const internalClient = client as unknown as { eventSource: { onerror: (e: Event) => void }, retryTimeout: unknown };
    const internalES = internalClient.eventSource;
    if (internalES && internalES.onerror) {
      internalES.onerror(new Event('error'));
    }

    // Verify retryTimeout is set
    expect(internalClient.retryTimeout).not.toBeNull();

    // Call close
    client.close();

    // Verify retryTimeout is cleared
    expect(internalClient.retryTimeout).toBeNull();

    // If we call close again with null eventSource, it shouldn't crash
    (client as unknown as { eventSource: unknown }).eventSource = null;
    expect(() => client.close()).not.toThrow();

    vi.useRealTimers();
  });
});
