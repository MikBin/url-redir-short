import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { streamSSE } from 'hono/streaming';
import { EventEmitter } from 'events';

export class BetterMockAdminService extends EventEmitter {
  private app: Hono;
  private server: ReturnType<typeof serve> | undefined;
  public readonly port: number;
  private running: boolean = false;
  private connectionCount: number = 0;

  // Track engine port. The E2E tests always use 3001, 3002, etc. (starts at 3001 in T01)
  // Engine controller passes port but we don't have it explicitly here. We'll default to 3001.

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

        const listener = async (payload: { type: string; data: unknown }) => {
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

    if (process.env.TEST_RUNTIME === 'cf-worker') {
        const ports = [3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010, 3011, 3012, 3013];
        for (const p of ports) {
            fetch(`http://127.0.0.1:${p}/_test/clear`, {
                method: 'POST',
            }).catch(err => {});
        }
    }

    if (this.server) {
      this.server.close();
    }
  }

  public pushUpdate(data: { type: string; data: unknown }) {
    this.emit('push', data);

    // For CF Worker mode tests, inject directly to the engine's hack endpoint
    // We scan standard ports for the engine.
    if (process.env.TEST_RUNTIME === 'cf-worker') {
        const ports = [3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010, 3011, 3012, 3013];
        for (const p of ports) {
            fetch(`http://127.0.0.1:${p}/_test/inject`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            }).catch(err => {});
        }
    }
  }

  public async waitForConnection(timeoutMs: number = 10000) {
      if (process.env.TEST_RUNTIME === 'cf-worker') {
         return;
      }

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
