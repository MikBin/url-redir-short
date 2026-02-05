import { describe, it, expect } from 'vitest';
import { DoublyLinkedList } from '../../../src/adapters/cache/doubly-linked-list';

describe('DoublyLinkedList', () => {
  it('should push items to the tail', () => {
    const list = new DoublyLinkedList<string>();
    list.push('a');
    list.push('b');
    list.push('c');

    expect(list.size).toBe(3);
    expect(list.shift()).toBe('a');
    expect(list.shift()).toBe('b');
    expect(list.shift()).toBe('c');
    expect(list.size).toBe(0);
  });

  it('should remove items correctly', () => {
    const list = new DoublyLinkedList<string>();
    const nodeA = list.push('a');
    const nodeB = list.push('b');
    const nodeC = list.push('c');

    list.remove(nodeB);
    expect(list.size).toBe(2);
    expect(list.shift()).toBe('a');
    expect(list.shift()).toBe('c');
  });

  it('should remove head correctly', () => {
    const list = new DoublyLinkedList<string>();
    const nodeA = list.push('a');
    const nodeB = list.push('b');

    list.remove(nodeA);
    expect(list.size).toBe(1);
    expect(list.shift()).toBe('b');
  });

  it('should remove tail correctly', () => {
    const list = new DoublyLinkedList<string>();
    const nodeA = list.push('a');
    const nodeB = list.push('b');

    list.remove(nodeB);
    expect(list.size).toBe(1);
    expect(list.shift()).toBe('a');
  });

  it('should move to tail', () => {
    const list = new DoublyLinkedList<string>();
    const nodeA = list.push('a');
    const nodeB = list.push('b');
    const nodeC = list.push('c');

    // List is a -> b -> c
    list.moveToTail(nodeA);
    // List should be b -> c -> a

    expect(list.shift()).toBe('b');
    expect(list.shift()).toBe('c');
    expect(list.shift()).toBe('a');
  });

  it('should handle move to tail if already tail', () => {
    const list = new DoublyLinkedList<string>();
    const nodeA = list.push('a');
    const nodeB = list.push('b');

    list.moveToTail(nodeB);

    expect(list.shift()).toBe('a');
    expect(list.shift()).toBe('b');
  });

  it('should handle move to tail if only one item', () => {
    const list = new DoublyLinkedList<string>();
    const nodeA = list.push('a');

    list.moveToTail(nodeA);

    expect(list.shift()).toBe('a');
  });

  it('should clear', () => {
    const list = new DoublyLinkedList<string>();
    list.push('a');
    list.clear();
    expect(list.size).toBe(0);
    expect(list.shift()).toBeUndefined();
  });
});
