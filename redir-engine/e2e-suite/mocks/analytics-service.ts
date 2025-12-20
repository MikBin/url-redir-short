import { Hono } from 'hono';
import { serve } from '@hono/node-server';

export class MockAnalyticsService {
  private app: Hono;
  private server: any;
  public readonly port: number;
  private collectedEvents: any[] = [];

  constructor(port: number = 0) {
    this.port = port;
    this.app = new Hono();
    this.setupRoutes();
  }

  private setupRoutes() {
    this.app.post('/v1/collect', async (c) => {
      const body = await c.req.json();
      this.collectedEvents.push(body);
      return c.json({ success: true });
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
        console.log(`Mock Analytics running on port ${this.port}`);
        resolve();
      });
    });
  }

  public async stop() {
    if (this.server) {
      this.server.close();
    }
  }

  public getEvents() {
    return [...this.collectedEvents];
  }

  public clear() {
    this.collectedEvents = [];
  }
}
