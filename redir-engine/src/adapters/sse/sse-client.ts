import { EventSource } from 'eventsource';

export class SSEClient {
  private eventSource: EventSource | null = null;
  private url: string;

  private onCreate?: (data: any) => void;
  private onUpdate?: (data: any) => void;
  private onDelete?: (data: any) => void;

  constructor(url: string) {
    this.url = url;
  }

  public connect(
    onCreate: (data: any) => void,
    onUpdate: (data: any) => void,
    onDelete: (data: any) => void
  ) {
    this.onCreate = onCreate;
    this.onUpdate = onUpdate;
    this.onDelete = onDelete;

    console.log(`[SSE] Connecting to ${this.url}`);
    this.eventSource = new EventSource(this.url);

    this.eventSource.onopen = () => {
      console.log('[SSE] Connected');
    };

    this.eventSource.onerror = (err) => {
      console.error('[SSE] Error:', err);
      // Optional: Reconnect logic is usually handled by EventSource but good to log
    };

    // Listen to custom events
    this.eventSource.addEventListener('create', (e: MessageEvent) => {
      if (this.onCreate) this.onCreate(JSON.parse(e.data));
    });

    this.eventSource.addEventListener('update', (e: MessageEvent) => {
      if (this.onUpdate) this.onUpdate(JSON.parse(e.data));
    });

    this.eventSource.addEventListener('delete', (e: MessageEvent) => {
      if (this.onDelete) this.onDelete(JSON.parse(e.data));
    });
  }

  public close() {
    if (this.eventSource) {
      this.eventSource.close();
    }
  }
}
