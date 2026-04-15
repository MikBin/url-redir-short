import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { streamSSE } from 'hono/streaming';
import { EventEmitter } from 'events';

export class BetterMockAdminService extends EventEmitter {
  private app: Hono;
  private server: any;
  public readonly port: number;
  private running: boolean = false;
  private connectionCount: number = 0;

  constructor(port: number = 0) { // 0 for random port
    super();
    this.port = port;
    this.app = new Hono();
    this.setupRoutes();
  }

  private setupRoutes() {
    this.app.get('/sync/stream', async (c) => {
      return streamSSE(c, async (stream) => {
        this.connectionCount++;

        const listener = async (payload: any) => {
          if (!this.running) return;
          try {
            await stream.writeSSE({
              data: JSON.stringify(payload.data),
              event: payload.type,
              id: String(Date.now()),
            });
          } catch (e) {
            console.error('[MockAdmin] Error writing SSE:', e);
          }
        };

        this.on('push', listener);
        this.emit('connection');

        // Let the client know it connected successfully
        await stream.writeSSE({
          data: 'connected',
          event: 'connected',
          id: String(Date.now()),
        });

        this.emit('connection');
        console.log(`[MockAdmin] Client connected (Total: ${this.connectionCount})`);

        let aborted = false;
        stream.onAbort(() => {
          aborted = true;
          this.connectionCount--;
          console.log(`[MockAdmin] Client disconnected (Total: ${this.connectionCount})`);
          this.off('push', listener);
        });

        // Keep connection open
        while (this.running && !aborted) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        if (!aborted) {
             this.connectionCount--;
        }
        this.off('push', listener);
      });
    });
  }

  public async start() {
    this.running = true;
    return new Promise<void>((resolve) => {
      this.server = serve({
        fetch: this.app.fetch,
        port: this.port,
        hostname: '0.0.0.0'
      }, (info) => {
        // @ts-ignore
        this.port = info.port;
        console.log(`Mock Admin running on port ${this.port}`);
        resolve();
      });
    });
  }

  public async stop() {
    this.running = false;
    if (this.server) {
      this.server.close();
    }
  }

  public pushUpdate(data: any) {
    this.emit('push', data);
  }

  public async waitForConnection(timeoutMs: number = 10000) {
      if (this.connectionCount > 0) return;

      return new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
              this.off('connection', onConnect);
              reject(new Error('Timeout waiting for SSE connection'));
          }, timeoutMs);

          const onConnect = () => {
              clearTimeout(timeout);
              this.off('connection', onConnect);
              resolve();
          };

          this.on('connection', onConnect);
      });
  }
}
