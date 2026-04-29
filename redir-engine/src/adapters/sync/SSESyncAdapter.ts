import { ISyncManager } from '../../ports/ISyncManager';
import { RedirectRuleUpdate } from '../../core/config/types';
import { SSEClient, EventSourceConstructor } from '../sse/sse-client';

export class SSESyncAdapter implements ISyncManager {
  private client: SSEClient;
  private updateCallback?: (update: RedirectRuleUpdate) => void;

  constructor(url: string, eventSourceClass: EventSourceConstructor, apiKey?: string) {
    this.client = new SSEClient(url, eventSourceClass, apiKey);
  }

  async start(): Promise<void> {
    this.client.connect(
      (data) => this.updateCallback?.({ type: 'create', data }),
      (data) => this.updateCallback?.({ type: 'update', data }),
      (data) => this.updateCallback?.({ type: 'delete', data })
    );
  }

  stop(): void {
    this.client.close();
  }

  onUpdate(callback: (update: RedirectRuleUpdate) => void): void {
    this.updateCallback = callback;
  }
}
