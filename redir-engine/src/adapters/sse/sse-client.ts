
export interface EventSourceConstructor {
  new (url: string, eventSourceInitDict?: EventSourceInit): EventSource;
}

const INITIAL_RETRY_INTERVAL = 1000;
const MAX_RETRY_INTERVAL = 30000;
const BACKOFF_FACTOR = 2;

export class SSEClient {
  private eventSource: EventSource | null = null;
  private url: string;
  private eventSourceClass: EventSourceConstructor;

  private onCreate?: (data: any) => void;
  private onUpdate?: (data: any) => void;
  private onDelete?: (data: any) => void;

  private retryCount = 0;
  private retryTimeout: any = null; // Use 'any' to avoid NodeJS.Timeout vs Window timer types issues
  private isExplicitlyClosed = false;

  constructor(url: string, eventSourceClass: EventSourceConstructor) {
    this.url = url;
    this.eventSourceClass = eventSourceClass;
  }

  public connect(
    onCreate?: (data: any) => void,
    onUpdate?: (data: any) => void,
    onDelete?: (data: any) => void
  ) {
    if (this.isExplicitlyClosed) {
      console.warn('[SSE] Cannot connect: Client is explicitly closed.');
      return;
    }

    if (onCreate) this.onCreate = onCreate;
    if (onUpdate) this.onUpdate = onUpdate;
    if (onDelete) this.onDelete = onDelete;

    // cleanup existing connection if any
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    console.log(`[SSE] Connecting to ${this.url}`);
    try {
      // @ts-ignore - The EventSource types might mismatch slightly between dom and node
      this.eventSource = new this.eventSourceClass(this.url);
    } catch (err) {
      console.error('[SSE] Failed to create EventSource:', err);
      this.scheduleReconnect();
      return;
    }

    if (this.eventSource) {
        this.eventSource.onopen = () => {
          console.log('[SSE] Connected');
          this.retryCount = 0;
        };

        this.eventSource.onerror = (err: any) => {
          console.error('[SSE] Error:', err);
          if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
          }
          this.scheduleReconnect();
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

  private scheduleReconnect() {
    if (this.isExplicitlyClosed) return;

    const delay = Math.min(
      MAX_RETRY_INTERVAL,
      INITIAL_RETRY_INTERVAL * Math.pow(BACKOFF_FACTOR, this.retryCount)
    );

    console.log(`[SSE] Reconnecting in ${delay}ms... (Attempt ${this.retryCount + 1})`);

    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }

    this.retryTimeout = setTimeout(() => {
      this.retryCount++;
      // Re-use stored callbacks
      this.connect();
    }, delay);
  }

  public close() {
    this.isExplicitlyClosed = true;
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}
