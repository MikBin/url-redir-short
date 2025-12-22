
export interface EventSourceConstructor {
  new (url: string, eventSourceInitDict?: EventSourceInit): EventSource;
}

export class SSEClient {
  private eventSource: EventSource | null = null;
  private url: string;
  private eventSourceClass: EventSourceConstructor;

  private onCreate?: (data: any) => void;
  private onUpdate?: (data: any) => void;
  private onDelete?: (data: any) => void;

  constructor(url: string, eventSourceClass: EventSourceConstructor) {
    this.url = url;
    this.eventSourceClass = eventSourceClass;
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
    // @ts-ignore - The EventSource types might mismatch slightly between dom and node
    this.eventSource = new this.eventSourceClass(this.url);

    if (this.eventSource) {
        this.eventSource.onopen = () => {
          console.log('[SSE] Connected');
        };

        this.eventSource.onerror = (err: any) => {
          console.error('[SSE] Error:', err);
        };

        // Listen to custom events
        this.eventSource.addEventListener('create', (e: any) => {
          if (this.onCreate) this.onCreate(JSON.parse(e.data));
        });

        this.eventSource.addEventListener('update', (e: any) => {
          if (this.onUpdate) this.onUpdate(JSON.parse(e.data));
        });

        this.eventSource.addEventListener('delete', (e: any) => {
          if (this.onDelete) this.onDelete(JSON.parse(e.data));
        });
    }
  }

  public close() {
    if (this.eventSource) {
      this.eventSource.close();
    }
  }
}
