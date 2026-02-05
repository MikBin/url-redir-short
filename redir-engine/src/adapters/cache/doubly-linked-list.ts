
export class ListNode<T> {
  value: T;
  prev: ListNode<T> | null = null;
  next: ListNode<T> | null = null;

  constructor(value: T) {
    this.value = value;
  }
}

export class DoublyLinkedList<T> {
  private head: ListNode<T> | null = null;
  private tail: ListNode<T> | null = null;
  private length: number = 0;

  public push(value: T): ListNode<T> {
    const node = new ListNode(value);
    if (!this.tail) {
      this.head = node;
      this.tail = node;
    } else {
      this.tail.next = node;
      node.prev = this.tail;
      this.tail = node;
    }
    this.length++;
    return node;
  }

  public remove(node: ListNode<T>): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      // It was the head
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      // It was the tail
      this.tail = node.prev;
    }

    // Clean up references
    node.prev = null;
    node.next = null;
    this.length--;
  }

  public shift(): T | undefined {
    if (!this.head) {
      return undefined;
    }
    const node = this.head;
    this.remove(node);
    return node.value;
  }

  public moveToTail(node: ListNode<T>): void {
    if (node === this.tail) {
      return;
    }

    // DETACH
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    }

    // ATTACH TO TAIL
    // Since we checked (node === this.tail) at start, we know it's not the tail.
    // And if list was size 1, it is the tail, so we returned.
    // So there is a tail.

    this.tail!.next = node;
    node.prev = this.tail;
    node.next = null;
    this.tail = node;

    // Length stays same.
  }

  public get size(): number {
    return this.length;
  }

  public clear(): void {
    this.head = null;
    this.tail = null;
    this.length = 0;
  }
}
