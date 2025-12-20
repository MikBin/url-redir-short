import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { streamSSE } from 'hono/streaming';
import { EventEmitter } from 'events';

export class BetterMockAdminService extends EventEmitter {
  private app: Hono;
  private server: any;
  public readonly port: number;

  constructor(port: number = 0) { // 0 for random port
    super();
    this.port = port;
    this.app = new Hono();
    this.setupRoutes();
  }

  private setupRoutes() {
    this.app.get('/sync/stream', async (c) => {
      return streamSSE(c, async (stream) => {
        const listener = async (payload: any) => {
          await stream.writeSSE({
            data: JSON.stringify(payload),
            event: 'message',
            id: String(Date.now()),
          });
        };

        this.on('push', listener);

        stream.onAbort(() => {
          this.off('push', listener);
        });

        // Keep connection open
        while (true) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      });
    });
  }

  public async start() {
    return new Promise<void>((resolve) => {
      this.server = serve({
        fetch: this.app.fetch,
        port: this.port
      }, (info) => {
        // @ts-ignore
        this.port = info.port;
        console.log(`Mock Admin running on port ${this.port}`);
        resolve();
      });
    });
  }

  public async stop() {
    if (this.server) {
      this.server.close();
    }
  }

  public pushUpdate(data: any) {
    this.emit('push', data);
  }
}
