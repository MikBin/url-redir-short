import { vi } from 'vitest';
import { syncManagerContract } from './sync-manager.contract';
import { SSESyncAdapter } from '../../src/adapters/sync/SSESyncAdapter';
import { EventSourceConstructor } from '../../src/adapters/sse/sse-client';

class MockEventSource {
  url: string;
  constructor(url: string) {
    this.url = url;
  }
  close = vi.fn();
  addEventListener = vi.fn();
  onopen: null = null;
  onerror: null = null;
  onmessage: null = null;
  dispatchEvent = vi.fn();
  removeEventListener = vi.fn();
  readyState = 0;
  CONNECTING = 0 as const;
  OPEN = 1 as const;
  CLOSED = 2 as const;
  withCredentials = false;
}

syncManagerContract('SSESyncAdapter', async () => ({
  adapter: new SSESyncAdapter(
    'http://mock-admin.test/api/sync/stream',
    MockEventSource as unknown as EventSourceConstructor
  ),
}));
