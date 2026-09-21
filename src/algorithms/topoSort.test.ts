/**
 * Cross-checks: both topological sorts, and the Day 4 analyzer's cycle
 * detection (a completely separate implementation), must agree.
 */
import { describe, expect, it } from 'vitest'
import type { AlgorithmEvent } from '../engine/events'
import { createGraph } from '../model/graph'
import type { Graph } from '../model/graph'
import { findCycle } from '../model/analyzer'
import { dfsTopoSortAlgorithm } from './dfsTopoSort'
import { kahnsTopoSortAlgorithm } from './kahnsTopoSort'

function seededRandom(seed: number) {
  let s = seed
  return (n: number) => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s % n
  }
}

function finishResult(events: AlgorithmEvent[]) {
  const last = events[events.length - 1]
  if (last.type !== 'finish') throw new Error('last event is not finish')
  return last.result
}

function isValidTopologicalOrder(g: Graph, order: string[]): boolean {
  if (order.length !== g.nodes.length || new Set(order).size !== order.length) return false
  const position = new Map(order.map((id, i) => [id, i]))
  return g.edges.every((e) => position.get(e.source)! < position.get(e.target)!)
}

/** Random DAG: edges always go from a lower to a higher hidden rank; node ORDER in the graph is shuffled. */
function randomDag(rand: (n: number) => number, n: number, m: number): Graph {
  const ids = Array.from({ length: n }, (_, i) => `n${i}`)
  const shuffled = [...ids]
  for (let i = n - 1; i > 0; i--) {
    const j = rand(i + 1)
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  const edges = Array.from({ length: m }, (_, k) => {
    const a = rand(n - 1)
    const b = a + 1 + rand(n - 1 - a)
    return { id: `e${k}`, source: ids[a], target: ids[b] }
  })
  return { ...createGraph({ directed: true }), nodes: shuffled.map((id) => ({ id })), edges }
}

function randomDigraph(rand: (n: number) => number, n: number, m: number): Graph {
  const nodes = Array.from({ length: n }, (_, i) => ({ id: `n${i}` }))
  const edges = Array.from({ length: m }, (_, k) => ({ id: `e${k}`, source: `n${rand(n)}`, target: `n${rand(n)}` }))
  return { ...createGraph({ directed: true }), nodes, edges }
}

describe('topological sorts (cross-checks)', () => {
  it('both return a valid topological order on random DAGs, even when the node list is shuffled', () => {
    const rand = seededRandom(17)
    for (let trial = 0; trial < 40; trial++) {
      const g = randomDag(rand, 10, 14)
      for (const algorithm of [kahnsTopoSortAlgorithm, dfsTopoSortAlgorithm]) {
        const result = finishResult(algorithm.run(g))
        expect(result.hasCycle).toBe(false)
        expect(isValidTopologicalOrder(g, result.order as string[])).toBe(true)
      }
    }
  })

  it('both agree with the analyzer’s cycle detection on random directed graphs (cyclic and acyclic)', () => {
    const rand = seededRandom(23)
    let cyclic = 0
    for (let trial = 0; trial < 60; trial++) {
      const g = randomDigraph(rand, 7, 5 + rand(6))
      const expected = findCycle(g) !== null
      if (expected) cyclic++
      expect(finishResult(kahnsTopoSortAlgorithm.run(g)).hasCycle).toBe(expected)
      expect(finishResult(dfsTopoSortAlgorithm.run(g)).hasCycle).toBe(expected)
    }
    expect(cyclic).toBeGreaterThan(5) // the sample really contains both kinds
    expect(cyclic).toBeLessThan(60)
  })

  it('return an empty order whenever there is a cycle', () => {
    const rand = seededRandom(5)
    for (let trial = 0; trial < 40; trial++) {
      const g = randomDigraph(rand, 6, 9)
      if (findCycle(g) === null) continue
      expect(finishResult(kahnsTopoSortAlgorithm.run(g)).order).toEqual([])
      expect(finishResult(dfsTopoSortAlgorithm.run(g)).order).toEqual([])
    }
  })
})
