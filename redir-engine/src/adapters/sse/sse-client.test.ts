
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { SSEClient, EventSourceConstructor } from './sse-client';

describe('SSEClient', () => {
  let mockEventSource: Partial<EventSource>;
  let MockEventSourceClass: unknown;
  let constructorSpy: Mock;

  beforeEach(() => {
    vi.useFakeTimers();
    mockEventSource = {
      close: vi.fn(),
      addEventListener: vi.fn(),
      onopen: null,
      onerror: null,
      readyState: 0,
    };

    constructorSpy = vi.fn();

    MockEventSourceClass = class {
      constructor(url: string) {
        constructorSpy(url);
        // We return the same mock instance for simplicity, or we could create new ones.
        // If we return the same one, we need to be careful about listeners piling up or being overwritten.
        // SSEClient overwrites onopen/onerror on the instance it gets.
        // addEventListener appends.

        // Let's return a shallow copy so we can track listeners per instance if needed
        // But for these tests, returning the same object is probably fine as long as we reset it
        return mockEventSource;
      }
    } as unknown as EventSourceConstructor;

    // Add mock properties to the class constructor to simulate vi.fn() if needed,
    // but we use constructorSpy for tracking.
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should connect to the given URL', () => {
    const client = new SSEClient('http://test.com', MockEventSourceClass as EventSourceConstructor);
    client.connect(vi.fn(), vi.fn(), vi.fn());
    expect(constructorSpy).toHaveBeenCalledWith('http://test.com');
  });

  it('should set up event listeners', () => {
    const client = new SSEClient('http://test.com', MockEventSourceClass as EventSourceConstructor);
    client.connect(vi.fn(), vi.fn(), vi.fn());

    expect(mockEventSource.addEventListener).toHaveBeenCalledWith('create', expect.any(Function));
    expect(mockEventSource.addEventListener).toHaveBeenCalledWith('update', expect.any(Function));
    expect(mockEventSource.addEventListener).toHaveBeenCalledWith('delete', expect.any(Function));
  });

  it('should reconnect with exponential backoff on error', async () => {
    const client = new SSEClient('http://test.com', MockEventSourceClass as EventSourceConstructor);
    client.connect(vi.fn(), vi.fn(), vi.fn());

    // Simulate error
    expect(mockEventSource.onerror).toBeDefined();
    if (mockEventSource.onerror) {
      mockEventSource.onerror.call(mockEventSource as EventSource, new Event('error'));
    }

    // Should have closed the failing connection
    expect(mockEventSource.close).toHaveBeenCalled();

    // Advance time less than delay (assuming initial 1000ms)
    vi.advanceTimersByTime(500);
    expect(constructorSpy).toHaveBeenCalledTimes(1);

    // Advance time to cover delay
    vi.advanceTimersByTime(500);
    expect(constructorSpy).toHaveBeenCalledTimes(2); // Reconnected

    // Simulate another error on the second connection
    // Since we return same mock object, on error is overwritten by SSEClient on new connection.
    // So calling mockEventSource.onerror works.
    if (mockEventSource.onerror) {
      mockEventSource.onerror.call(mockEventSource as EventSource, new Event('error'));
    }

    // Second retry: should be exponential (e.g. 2000ms)
    vi.advanceTimersByTime(1500);
    expect(constructorSpy).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(500);
    expect(constructorSpy).toHaveBeenCalledTimes(3); // Reconnected
  });

  it('should reset retry count on successful connection', () => {
    const client = new SSEClient('http://test.com', MockEventSourceClass as EventSourceConstructor);
    client.connect(vi.fn(), vi.fn(), vi.fn());

    // Simulate error
    if (mockEventSource.onerror) {
      mockEventSource.onerror.call(mockEventSource as EventSource, new Event('error'));
    }
    vi.advanceTimersByTime(1000); // Wait for first reconnect
    expect(constructorSpy).toHaveBeenCalledTimes(2);

    // Simulate success on second connection
    if (mockEventSource.onopen) {
      mockEventSource.onopen.call(mockEventSource as EventSource, new Event('open'));
    }

    // Simulate error on second connection later
    if (mockEventSource.onerror) {
      mockEventSource.onerror.call(mockEventSource as EventSource, new Event('error'));
    }

    // Should reset to initial delay (1000ms) instead of exponential (2000ms)
    vi.advanceTimersByTime(1000);
    expect(constructorSpy).toHaveBeenCalledTimes(3);
  });

  it('should not reconnect if manually closed', () => {
    const client = new SSEClient('http://test.com', MockEventSourceClass as EventSourceConstructor);
    client.connect(vi.fn(), vi.fn(), vi.fn());

    client.close();
    expect(mockEventSource.close).toHaveBeenCalled();

    // Simulate error event firing after close
    if (mockEventSource.onerror) {
      mockEventSource.onerror.call(mockEventSource as EventSource, new Event('error'));
    }

    vi.advanceTimersByTime(10000);
    // Should not have reconnected (still called 1 time for initial connect)
    expect(constructorSpy).toHaveBeenCalledTimes(1);
  });
});
