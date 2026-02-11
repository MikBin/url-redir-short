import { CuckooFilter as BloomCuckooFilter } from 'bloom-filters';

export class CuckooFilter {
  private filter: BloomCuckooFilter;

  constructor(size: number = 10000, bucketSize: number = 4, fingerprintSize: number = 2) {
    this.filter = new BloomCuckooFilter(size, bucketSize, fingerprintSize);
  }

  add(item: string): void {
    this.filter.add(item);
  }

  remove(item: string): void {
    if (this.filter.has(item)) {
      this.filter.remove(item);
    }
  }

  has(item: string): boolean {
    return this.filter.has(item);
  }
}
