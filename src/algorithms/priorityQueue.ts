/**
 * A small binary min-heap (Day 7), used by Dijkstra (and later A* and Prim's).
 * The caller supplies the comparator, so tie-breaking is explicit and
 * deterministic rather than an accident of insertion order.
 */
export class MinHeap<T> {
  private readonly items: T[] = []

  constructor(private readonly compare: (a: T, b: T) => number) {}

  get size(): number {
    return this.items.length
  }

  push(item: T): void {
    this.items.push(item)
    let i = this.items.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this.compare(this.items[i], this.items[parent]) >= 0) break
      ;[this.items[i], this.items[parent]] = [this.items[parent], this.items[i]]
      i = parent
    }
  }

  /** Removes and returns the smallest item, or undefined when empty. */
  pop(): T | undefined {
    if (this.items.length === 0) return undefined
    const top = this.items[0]
    const last = this.items.pop()!
    if (this.items.length > 0) {
      this.items[0] = last
      let i = 0
      for (;;) {
        const left = 2 * i + 1
        const right = left + 1
        let smallest = i
        if (left < this.items.length && this.compare(this.items[left], this.items[smallest]) < 0) smallest = left
        if (right < this.items.length && this.compare(this.items[right], this.items[smallest]) < 0) smallest = right
        if (smallest === i) break
        ;[this.items[i], this.items[smallest]] = [this.items[smallest], this.items[i]]
        i = smallest
      }
    }
    return top
  }
}
