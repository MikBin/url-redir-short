import { redirectStoreContract } from './redirect-store.contract';
import { InMemoryStore } from '../../src/adapters/store/in-memory-store';
import { RadixTree } from '../../src/core/routing/radix-tree';
import { CuckooFilter } from '../../src/core/filtering/cuckoo-filter';

redirectStoreContract('InMemoryStore', async () => ({
  store: new InMemoryStore(new RadixTree(), new CuckooFilter(10000)),
}));
