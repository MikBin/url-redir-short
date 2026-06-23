import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FireAndForgetCollector } from '../../../src/adapters/analytics/fire-and-forget';
import { AnalyticsPayload } from '../../../src/core/analytics/collector';

describe('FireAndForgetCollector', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  const samplePayload: AnalyticsPayload = {
    events: [
      {
        type: 'redirect',
        slug: 'test',
        timestamp: new Date().toISOString(),
      }
    ]
  };

  it('should call fetch to the specified URL with payload', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    const collector = new FireAndForgetCollector('http://analytics.local');
    await collector.collect(samplePayload);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith('http://analytics.local/v1/collect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(samplePayload),
    });
  });

  it('should catch unhandled fetch rejections and log error', async () => {
    const error = new Error('Network error');
    mockFetch.mockRejectedValueOnce(error);

    const consoleSpy = vi.spyOn(console, 'error');

    const collector = new FireAndForgetCollector('http://analytics.local');

    // Process shouldn't crash, the promise rejection is caught inside collect
    await expect(collector.collect(samplePayload)).resolves.not.toThrow();

    // Give time for catch block to execute (microtask)
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(consoleSpy).toHaveBeenCalledWith('Failed to send analytics:', error);
  });

  it('should call waitUntil if provided', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const waitUntilMock = vi.fn();

    const collector = new FireAndForgetCollector('http://analytics.local', waitUntilMock);
    await collector.collect(samplePayload);

    expect(waitUntilMock).toHaveBeenCalledTimes(1);
    // Argument should be a promise
    expect(waitUntilMock.mock.calls[0][0]).toBeInstanceOf(Promise);
  });
});
