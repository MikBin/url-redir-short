import { describe, it, expect, beforeEach } from 'vitest';
import { CuckooFilter } from '../../../src/core/filtering/cuckoo-filter';

describe('CuckooFilter', () => {
  let filter: CuckooFilter;

  beforeEach(() => {
    filter = new CuckooFilter(100, 4, 2);
  });

  it('should add and check item existence', () => {
    filter.add('/test');
    expect(filter.has('/test')).toBe(true);
  });

  it('should return false for non-existent item', () => {
    expect(filter.has('/not-there')).toBe(false);
  });

  it('should remove an item', () => {
    filter.add('/test');
    expect(filter.has('/test')).toBe(true);

    filter.remove('/test');
    expect(filter.has('/test')).toBe(false);
  });

  it('should handle duplicate adds gracefully (multiset behavior)', () => {
    filter.add('/test');
    filter.add('/test');
    expect(filter.has('/test')).toBe(true);

    filter.remove('/test');
    expect(filter.has('/test')).toBe(true); // Still exists

    filter.remove('/test');
    expect(filter.has('/test')).toBe(false); // Gone
  });
});
