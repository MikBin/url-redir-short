import { describe, it } from 'vitest';
import fc from 'fast-check';
import { CuckooFilter } from '../../../src/core/filtering/cuckoo-filter';

describe('CuckooFilter Properties', () => {
  it('should contain added items', () => {
    fc.assert(
      fc.property(fc.string(), (item) => {
        const filter = new CuckooFilter();
        filter.add(item);
        return filter.has(item);
      })
    );
  });

  it('should not contain removed items (single item scenario)', () => {
    fc.assert(
      fc.property(fc.string(), (item) => {
        const filter = new CuckooFilter();
        filter.add(item);
        filter.remove(item);
        return !filter.has(item);
      })
    );
  });

  it('should handle multiple unique additions', () => {
    fc.assert(
      fc.property(fc.uniqueArray(fc.string()), (items) => {
        const filter = new CuckooFilter(items.length * 2 + 100); // Ensure enough capacity to minimize failures
        items.forEach(item => filter.add(item));
        return items.every(item => filter.has(item));
      })
    );
  });
});
