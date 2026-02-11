
/**
 * A simple LRU (Least Recently Used) cache implementation using Map.
 * Map in JavaScript preserves insertion order, which we can leverage for LRU.
 */
export class LRUCache<K, V> {
  private cache: Map<K, V>;
  private maxSize: number;

  constructor(maxSize: number) {
    this.cache = new Map<K, V>();
    this.maxSize = maxSize;
  }

  /**
   * Retrieves an item from the cache.
   * If the item exists, it is marked as most recently used.
   */
  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Re-insert to mark as most recently used
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  /**
   * Adds or updates an item in the cache.
   * If the cache exceeds maxSize, the least recently used item is removed.
   */
  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used (first item in Map)
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  /**
   * Returns the number of items in the cache.
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Clears the cache.
   */
  clear(): void {
    this.cache.clear();
  }
}
