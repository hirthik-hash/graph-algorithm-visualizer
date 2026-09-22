import { describe, expect, it } from 'vitest'
import { addEdge, addNode, createGraph } from './graph'
import { GRAPH_SHAPES, MAX_GENERATED_NODES, generateGraph, nodeIdForIndex } from './generator'
import type { GraphShape } from './generator'
import { findCycle, connectedComponents, bipartiteColoring } from './analyzer'

describe('generateGraph', () => {
  it('is deterministic: the same seed and options always give the same graph', () => {
    const a = generateGraph({ shape: 'random', nodeCount: 12, seed: 42 })
    const b = generateGraph({ shape: 'random', nodeCount: 12, seed: 42 })
    expect(a).toEqual(b)
  })

  it('a different seed gives a different graph (with overwhelming probability)', () => {
    const a = generateGraph({ shape: 'random', nodeCount: 12, seed: 1 })
    const b = generateGraph({ shape: 'random', nodeCount: 12, seed: 2 })
    expect(a).not.toEqual(b)
  })

  it('produces a structurally valid graph for every shape', () => {
    for (const shape of GRAPH_SHAPES) {
      const g = generateGraph({ shape, nodeCount: 10, seed: 7 })
      expect(g.nodes).toHaveLength(10)
      expect(g.nodes.map((n) => n.id)).toEqual(g.nodes.map((_, i) => nodeIdForIndex(i)))
      // Every node has real coordinates, so it renders immediately and A* has something to use.
      for (const n of g.nodes) {
        expect(Number.isFinite(n.x)).toBe(true)
        expect(Number.isFinite(n.y)).toBe(true)
      }
      // The result must be a valid Graph as far as the model's own rules are concerned:
      // re-inserting every node and edge through the real model functions must not throw.
      let rebuilt = createGraph({ directed: g.directed, weighted: g.weighted })
      for (const n of g.nodes) rebuilt = addNode(rebuilt, n)
      for (const e of g.edges) rebuilt = addEdge(rebuilt, e)
      expect(rebuilt.edges).toHaveLength(g.edges.length)
    }
  })

  it('never generates self-loops or parallel edges, for any shape', () => {
    for (const shape of GRAPH_SHAPES) {
      const g = generateGraph({ shape, nodeCount: 14, seed: 99, directed: true })
      expect(g.edges.some((e) => e.source === e.target)).toBe(false)
      const seen = new Set<string>()
      for (const e of g.edges) {
        const key = g.directed ? `${e.source}->${e.target}` : [e.source, e.target].sort().join('-')
        expect(seen.has(key)).toBe(false)
        seen.add(key)
      }
    }
  })

  it('"dag" is always directed and always acyclic, whatever "directed" is passed', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const g = generateGraph({ shape: 'dag', nodeCount: 15, seed, directed: false })
      expect(g.directed).toBe(true)
      expect(findCycle(g)).toBeNull()
    }
  })

  it('"tree" has exactly n-1 edges, is connected, and acyclic', () => {
    for (const seed of [1, 2, 3]) {
      const g = generateGraph({ shape: 'tree', nodeCount: 20, seed })
      expect(g.edges).toHaveLength(19)
      expect(findCycle(g)).toBeNull()
      expect(connectedComponents(g)).toHaveLength(1)
    }
  })

  it('"bipartite" only joins the first half of nodes to the second, so it really is bipartite', () => {
    for (const seed of [1, 2, 3]) {
      const g = generateGraph({ shape: 'bipartite', nodeCount: 11, seed, weighted: false })
      expect(bipartiteColoring(g)).not.toBeNull()
    }
  })

  it('"complete" connects every pair exactly once (or twice for directed)', () => {
    const undirected = generateGraph({ shape: 'complete', nodeCount: 6, seed: 1 })
    expect(undirected.edges).toHaveLength((6 * 5) / 2)
    const directed = generateGraph({ shape: 'complete', nodeCount: 6, seed: 1, directed: true })
    expect(directed.edges).toHaveLength(6 * 5)
  })

  it('"sparse" stays connected and "dense" has noticeably more edges on the same node count', () => {
    const sparse = generateGraph({ shape: 'sparse', nodeCount: 16, seed: 3 })
    expect(connectedComponents(sparse)).toHaveLength(1)
    const dense = generateGraph({ shape: 'dense', nodeCount: 16, seed: 3 })
    expect(dense.edges.length).toBeGreaterThan(sparse.edges.length)
  })

  it('adds weights only when asked, as whole numbers within range', () => {
    const unweighted = generateGraph({ shape: 'dense', nodeCount: 8, seed: 1 })
    expect(unweighted.edges.every((e) => e.weight === undefined)).toBe(true)
    const weighted = generateGraph({ shape: 'dense', nodeCount: 8, seed: 1, weighted: true, maxWeight: 5 })
    for (const e of weighted.edges) {
      expect(Number.isInteger(e.weight)).toBe(true)
      expect(e.weight).toBeGreaterThanOrEqual(1)
      expect(e.weight).toBeLessThanOrEqual(5)
    }
  })

  it('handles n = 1 without dividing by zero, and rejects out-of-range counts', () => {
    const single = generateGraph({ shape: 'tree', nodeCount: 1, seed: 1 })
    expect(single.nodes).toHaveLength(1)
    expect(single.edges).toHaveLength(0)
    expect(() => generateGraph({ shape: 'random', nodeCount: 0, seed: 1 })).toThrow(RangeError)
    expect(() => generateGraph({ shape: 'random', nodeCount: 1.5, seed: 1 })).toThrow(RangeError)
    expect(() => generateGraph({ shape: 'random', nodeCount: MAX_GENERATED_NODES + 1, seed: 1 })).toThrow(RangeError)
  })

  it('stress test: every shape at 30+ nodes still produces a structurally valid graph quickly', () => {
    const start = Date.now()
    for (const shape of GRAPH_SHAPES as readonly GraphShape[]) {
      const g = generateGraph({ shape, nodeCount: 40, seed: 123, weighted: true })
      expect(g.nodes).toHaveLength(40)
      expect(g.edges.every((e) => e.source !== e.target)).toBe(true)
    }
    expect(Date.now() - start).toBeLessThan(1000)
  })
})
