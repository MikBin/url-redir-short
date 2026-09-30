import { syncManagerContract } from './sync-manager.contract';
import { NoOpSyncAdapter } from '../../src/adapters/sync/NoOpSyncAdapter';

syncManagerContract('NoOpSyncAdapter', async () => ({
  adapter: new NoOpSyncAdapter(),
}));
