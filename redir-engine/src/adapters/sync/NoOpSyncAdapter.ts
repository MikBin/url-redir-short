import { ISyncManager } from '../../ports/ISyncManager';
import { RedirectRuleUpdate } from '../../core/config/types';

/**
 * A dummy synchronization adapter that performs no actions.
 * Useful for environments that do not support persistent connections (like Cloudflare Workers)
 * or for testing environments where state is handled externally.
 */
export class NoOpSyncAdapter implements ISyncManager {
  async start(): Promise<void> {
    // No-op: nothing to start
  }

  stop(): void {
    // No-op: nothing to stop
  }

  onUpdate(callback: (update: RedirectRuleUpdate) => void): void {
    // No-op: no updates will ever be emitted
  }
}
