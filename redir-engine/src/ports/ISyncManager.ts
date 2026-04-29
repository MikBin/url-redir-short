import { RedirectRuleUpdate } from '../core/config/types';

export interface ISyncManager {
  /**
   * Starts the synchronization process (e.g. opens SSE connection).
   */
  start(): Promise<void>;

  /**
   * Stops the synchronization process and cleans up resources.
   */
  stop(): void;

  /**
   * Registers a callback to be executed when a redirect update is received.
   */
  onUpdate(callback: (update: RedirectRuleUpdate) => void): void;
}
