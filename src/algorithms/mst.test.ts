/**
 * Cross-checks between the two MST algorithms, and against a brute-force
 * search that shares no code with either of them.
 */
import { describe, expect, it } from 'vitest'
import type { AlgorithmEvent } from '../engine/events'
import { createGraph } from '../model/graph'
import type { Graph } from '../model/graph'
import { kruskalAlgorithm } from './kruskal'
import { primAlgorithm } from './prim'
import { UnionFind } from './unionFind'

function seededRandom(seed: number) {
  let s = seed
  return (n: number) => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s % n
  }
}

/** A random CONNECTED undirected weighted graph: a random spanning path plus extra edges. */
function randomConnectedGraph(rand: (n: number) => number, n: number, extra: number): Graph {
  const nodes = Array.from({ length: n }, (_, i) => ({ id: `n${i}` }))
  const edges: Graph['edges'] = []
  for (let i = 1; i < n; i++) {
    edges.push({ id: `e${edges.length}`, source: `n${rand(i)}`, target: `n${i}`, weight: rand(9) + 1 })
  }
  for (let k = 0; k < extra; k++) {
    edges.push({ id: `e${edges.length}`, source: `n${rand(n)}`, target: `n${rand(n)}`, weight: rand(9) + 1 })
  }
  return { ...createGraph({ weighted: true }), nodes, edges }
}

function finishResult(events: AlgorithmEvent[]) {
  const last = events[events.length - 1]
  if (last.type !== 'finish') throw new Error('last event is not finish')
  return last.result
}

/** Minimum weight over ALL edge subsets of size n-1 that form a spanning tree. */
function bruteForceMstWeight(g: Graph): number {
  const n = g.nodes.length
  const m = g.edges.length
  let best = Infinity
  for (let mask = 0; mask < 1 << m; mask++) {
    let bits = 0
    for (let b = mask; b; b &= b - 1) bits++
    if (bits !== n - 1) continue
    const uf = new UnionFind(g.nodes.map((nd) => nd.id))
    let weight = 0
    let acyclic = true
    for (let i = 0; i < m && acyclic; i++) {
      if (!(mask & (1 << i))) continue
      acyclic = uf.union(g.edges[i].source, g.edges[i].target).merged
      weight += g.edges[i].weight!
    }
    if (acyclic) best = Math.min(best, weight)
  }
  return best
}

describe('Prim vs Kruskal', () => {
  it('produce the same total weight on random connected graphs', () => {
    const rand = seededRandom(321)
    for (let trial = 0; trial < 40; trial++) {
      const g = randomConnectedGraph(rand, 9, 10)
      const prim = finishResult(primAlgorithm.run(g, { startNodeId: 'n0' }))
      const kruskal = finishResult(kruskalAlgorithm.run(g))
      expect(prim.totalWeight).toBe(kruskal.totalWeight)
    }
  })

  it('both return a real spanning tree: n-1 edges, connected, no cycle', () => {
    const rand = seededRandom(654)
    for (let trial = 0; trial < 30; trial++) {
      const n = 9
      const g = randomConnectedGraph(rand, n, 8)
      const results = [
        finishResult(primAlgorithm.run(g, { startNodeId: 'n0' })).mstEdgeIds,
        finishResult(kruskalAlgorithm.run(g)).mstEdgeIds,
      ] as string[][]
      for (const ids of results) {
        expect(ids).toHaveLength(n - 1)
        const uf = new UnionFind(g.nodes.map((nd) => nd.id))
        for (const id of ids) {
          const edge = g.edges.find((e) => e.id === id)!
          expect(uf.union(edge.source, edge.target).merged).toBe(true) // never closes a cycle
        }
        expect(uf.componentCount).toBe(1) // everything connected
      }
    }
  })

  it('both match an independent brute-force minimum', () => {
    const rand = seededRandom(987)
    for (let trial = 0; trial < 20; trial++) {
      const g = randomConnectedGraph(rand, 6, 4) // 5 + 4 = 9 edges: 512 subsets
      const best = bruteForceMstWeight(g)
      expect(finishResult(primAlgorithm.run(g, { startNodeId: 'n0' })).totalWeight).toBe(best)
      expect(finishResult(kruskalAlgorithm.run(g)).totalWeight).toBe(best)
    }
  })

  it('Prim from any start node finds the same total weight', () => {
    const rand = seededRandom(11)
    const g = randomConnectedGraph(rand, 8, 9)
    const totals = g.nodes.map((n) => finishResult(primAlgorithm.run(g, { startNodeId: n.id })).totalWeight)
    expect(new Set(totals).size).toBe(1)
  })
})
