import { describe, expect, it } from 'vitest'
import { MinHeap } from './priorityQueue'

const numeric = () => new MinHeap<number>((a, b) => a - b)

describe('MinHeap', () => {
  it('pops items in ascending order regardless of insertion order', () => {
    const heap = numeric()
    for (const n of [5, 1, 9, 3, 7, 2, 8]) heap.push(n)
    const out: number[] = []
    for (let x = heap.pop(); x !== undefined; x = heap.pop()) out.push(x)
    expect(out).toEqual([1, 2, 3, 5, 7, 8, 9])
  })

  it('returns undefined when empty and tracks its size', () => {
    const heap = numeric()
    expect(heap.pop()).toBeUndefined()
    heap.push(4)
    heap.push(2)
    expect(heap.size).toBe(2)
    heap.pop()
    expect(heap.size).toBe(1)
  })

  it('handles pushes interleaved with pops', () => {
    const heap = numeric()
    heap.push(10)
    heap.push(4)
    expect(heap.pop()).toBe(4)
    heap.push(1)
    heap.push(7)
    expect(heap.pop()).toBe(1)
    expect(heap.pop()).toBe(7)
    expect(heap.pop()).toBe(10)
  })

  it('uses the comparator for tie-breaking, so equal priorities come out in a chosen order', () => {
    const heap = new MinHeap<{ p: number; name: string }>((a, b) => a.p - b.p || a.name.localeCompare(b.name))
    for (const name of ['d', 'b', 'c', 'a']) heap.push({ p: 1, name })
    const names: string[] = []
    for (let x = heap.pop(); x !== undefined; x = heap.pop()) names.push(x.name)
    expect(names).toEqual(['a', 'b', 'c', 'd'])
  })
})
