import { describe, expect, it } from 'vitest'
import { UnionFind } from './unionFind'

const ids = (n: number) => Array.from({ length: n }, (_, i) => `n${i}`)

describe('UnionFind', () => {
  it('starts with every element in its own set', () => {
    const uf = new UnionFind(['A', 'B', 'C'])
    expect(uf.componentCount).toBe(3)
    expect(uf.sets()).toEqual([['A'], ['B'], ['C']])
    expect(uf.connected('A', 'B')).toBe(false)
  })

  it('merges sets, reports whether a merge happened, and tracks the component count', () => {
    const uf = new UnionFind(['A', 'B', 'C', 'D'])
    expect(uf.union('A', 'B').merged).toBe(true)
    expect(uf.union('B', 'A').merged).toBe(false) // already together
    uf.union('C', 'D')
    expect(uf.componentCount).toBe(2)
    expect(uf.connected('A', 'B')).toBe(true)
    expect(uf.connected('A', 'C')).toBe(false)
    uf.union('B', 'D')
    expect(uf.componentCount).toBe(1)
    expect(uf.sets()).toEqual([['A', 'B', 'C', 'D']])
  })

  it('unions by rank: the shallower tree goes under the deeper one; ties favour the first argument', () => {
    const uf = new UnionFind(['A', 'B', 'C'])
    expect(uf.union('A', 'B')).toEqual({ merged: true, root: 'A', attachedRoot: 'B' }) // tie: A wins
    // A's tree now has rank 1, C's has rank 0, so C goes under A even though C is the first argument.
    expect(uf.union('C', 'A')).toEqual({ merged: true, root: 'A', attachedRoot: 'C' })
  })

  it('compresses paths: after find(), a deep node points straight at the root', () => {
    const uf = new UnionFind(['A', 'B', 'C', 'D'])
    uf.union('A', 'B') // A root
    uf.union('C', 'D') // C root
    uf.union('A', 'C') // equal ranks: A root, C under A, D under C
    expect(uf.findPath('D')).toEqual(['D', 'C', 'A'])
    expect(uf.find('D')).toBe('A')
    expect(uf.findPath('D')).toEqual(['D', 'A']) // flattened
    expect(uf.findPath('C')).toEqual(['C', 'A'])
  })

  it('findPath does not change anything', () => {
    const uf = new UnionFind(['A', 'B', 'C', 'D'])
    uf.union('A', 'B')
    uf.union('C', 'D')
    uf.union('A', 'C')
    uf.findPath('D')
    expect(uf.findPath('D')).toEqual(['D', 'C', 'A'])
  })

  it('throws on unknown elements and on duplicate ids', () => {
    const uf = new UnionFind(['A'])
    expect(() => uf.find('Z')).toThrow(/unknown/i)
    expect(() => uf.union('A', 'Z')).toThrow(/unknown/i)
    expect(() => new UnionFind(['A', 'A'])).toThrow(/duplicate/i)
  })

  it('entries() exposes parent and rank in element order', () => {
    const uf = new UnionFind(['A', 'B'])
    uf.union('A', 'B')
    expect(uf.entries()).toEqual([
      { id: 'A', parent: 'A', rank: 1 },
      { id: 'B', parent: 'A', rank: 0 },
    ])
  })

  it('clone() is independent of the original', () => {
    const uf = new UnionFind(['A', 'B', 'C'])
    uf.union('A', 'B')
    const copy = uf.clone()
    copy.union('A', 'C')
    expect(uf.componentCount).toBe(2)
    expect(copy.componentCount).toBe(1)
    expect(uf.connected('A', 'C')).toBe(false)
  })

  it('handles a long chain of unions without overflowing the call stack', () => {
    const n = 50000
    const uf = new UnionFind(ids(n))
    for (let i = 1; i < n; i++) uf.union(`n${i - 1}`, `n${i}`)
    expect(uf.componentCount).toBe(1)
    expect(uf.connected('n0', `n${n - 1}`)).toBe(true)
  })

  it('agrees with a naive reference on random operations', () => {
    let seed = 5
    const rand = (m: number) => {
      seed = (seed * 1664525 + 1013904223) % 4294967296
      return seed % m
    }
    const n = 20
    const uf = new UnionFind(ids(n))
    const label = Array.from({ length: n }, (_, i) => i) // naive: relabel the whole set on every union
    for (let step = 0; step < 200; step++) {
      const a = rand(n)
      const b = rand(n)
      const naiveMerge = label[a] !== label[b]
      const from = label[b]
      const to = label[a]
      if (naiveMerge) for (let i = 0; i < n; i++) if (label[i] === from) label[i] = to
      expect(uf.union(`n${a}`, `n${b}`).merged).toBe(naiveMerge)
    }
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) expect(uf.connected(`n${i}`, `n${j}`)).toBe(label[i] === label[j])
    }
    expect(uf.componentCount).toBe(new Set(label).size)
  })
})
