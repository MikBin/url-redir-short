import { createParser } from 'eventsource-parser';

export interface SSEMessageEvent {
  data: string;
}

export class FetchEventSource {
  private controller: AbortController;
  public onopen: (() => void) | null = null;
  public onerror: ((err: unknown) => void) | null = null;
  private listeners: Map<string, ((e: SSEMessageEvent) => void)[]> = new Map();

  public promise: Promise<void>;

  constructor(url: string) {
    this.controller = new AbortController();
    this.promise = this.start(url).catch((err) => {
      console.error('[FetchEventSource] Unhandled error:', err);
    });
  }

  private async start(url: string) {
    try {
      const response = await fetch(url, {
        signal: this.controller.signal,
        headers: {
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to connect: ${response.status} ${response.statusText}`);
      }

      if (this.onopen) {
        this.onopen();
      }

      const parser = createParser({
        onEvent: (event) => {
          // EventSourceMessage in v3+ doesn't have a 'type' property
          const listeners = this.listeners.get(event.event || 'message');
          if (listeners) {
            // Mimic Event interface
            const e: SSEMessageEvent = { data: event.data };
            listeners.forEach(fn => fn(e));
          }
        }
      });

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parser.feed(decoder.decode(value, { stream: true }));
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      if (this.onerror) {
        this.onerror(err);
      }
    }
  }

  public close() {
    this.controller.abort();
  }

  public addEventListener(type: string, listener: (e: SSEMessageEvent) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(listener);
  }
}
