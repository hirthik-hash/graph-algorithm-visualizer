import { describe, expect, it } from 'vitest'
import { checkRequirements } from '../engine/algorithm'
import type { AlgorithmEvent } from '../engine/events'
import { createGraph } from '../model/graph'
import type { Graph } from '../model/graph'
import { bellmanFordAlgorithm } from './bellmanFord'
import { dijkstraAlgorithm } from './dijkstra'

/** Literal construction (fast, and lets tests use any node/edge layout). */
function graphOf(
  options: { directed?: boolean },
  nodeIds: string[],
  edges: [string, string, number][],
): Graph {
  return {
    ...createGraph({ weighted: true, ...options }),
    nodes: nodeIds.map((id) => ({ id })),
    edges: edges.map(([source, target, weight], i) => ({ id: `e${i + 1}`, source, target, weight })),
  }
}

const run = (g: Graph, start: string) => bellmanFordAlgorithm.run(g, { startNodeId: start })

function finishResult(events: AlgorithmEvent[]) {
  const last = events[events.length - 1]
  if (last.type !== 'finish') throw new Error('last event is not finish')
  return last.result
}

function seededRandom(seed: number) {
  let s = seed
  return (n: number) => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s % n
  }
}

describe('Bellman-Ford', () => {
  it('emits the exact documented events, handles a negative edge, and stops after a pass with no change', () => {
    const g = graphOf({ directed: true }, ['A', 'B', 'C'], [
      ['A', 'B', 4],
      ['A', 'C', 5],
      ['C', 'B', -3],
    ])
    expect(run(g, 'A')).toEqual([
      { type: 'update_distance', nodeId: 'A', distance: 0, previousDistance: null },
      // --- pass 1
      { type: 'relax_edge', edgeId: 'e1', source: 'A', target: 'B', weight: 4 },
      { type: 'update_distance', nodeId: 'B', distance: 4, previousDistance: null, viaNodeId: 'A' },
      { type: 'relax_edge', edgeId: 'e2', source: 'A', target: 'C', weight: 5 },
      { type: 'update_distance', nodeId: 'C', distance: 5, previousDistance: null, viaNodeId: 'A' },
      { type: 'relax_edge', edgeId: 'e3', source: 'C', target: 'B', weight: -3 },
      { type: 'update_distance', nodeId: 'B', distance: 2, previousDistance: 4, viaNodeId: 'C' },
      // --- pass 2: nothing changes, so we stop (no verification pass needed)
      { type: 'relax_edge', edgeId: 'e1', source: 'A', target: 'B', weight: 4 },
      { type: 'relax_edge', edgeId: 'e2', source: 'A', target: 'C', weight: 5 },
      { type: 'relax_edge', edgeId: 'e3', source: 'C', target: 'B', weight: -3 },
      {
        type: 'finish',
        result: {
          distances: { A: 0, B: 2, C: 5 },
          previous: { A: null, B: 'C', C: 'A' },
          negativeCycle: false,
        },
      },
    ])
  })

  it('detects a reachable negative cycle with negative_cycle_detected', () => {
    // A -> B (1), B -> C (-2), C -> A (-1): total -2 per lap
    const g = graphOf({ directed: true }, ['A', 'B', 'C'], [
      ['A', 'B', 1],
      ['B', 'C', -2],
      ['C', 'A', -1],
    ])
    const events = run(g, 'A')
    expect(events[events.length - 2]).toEqual({ type: 'negative_cycle_detected', edgeId: 'e1' })
    expect(finishResult(events).negativeCycle).toBe(true)
  })

  it('treats an undirected negative edge as a negative cycle, but not a non-negative one', () => {
    expect(finishResult(run(graphOf({}, ['A', 'B'], [['A', 'B', -1]]), 'A')).negativeCycle).toBe(true)
    const ok = run(graphOf({}, ['A', 'B'], [['A', 'B', 3]]), 'B')
    expect(finishResult(ok)).toMatchObject({ distances: { A: 3, B: 0 }, negativeCycle: false })
    expect(ok).toContainEqual({ type: 'relax_edge', edgeId: 'e1', source: 'B', target: 'A', weight: 3 })
  })

  it('catches a negative self-loop even on a single-node graph (zero normal passes)', () => {
    const g = graphOf({ directed: true }, ['A'], [['A', 'A', -1]])
    expect(finishResult(run(g, 'A')).negativeCycle).toBe(true)
    const harmless = graphOf({ directed: true }, ['A'], [['A', 'A', 2]])
    expect(finishResult(run(harmless, 'A')).negativeCycle).toBe(false)
  })

  it('reports unreachable nodes as null and ignores a negative cycle it cannot reach', () => {
    const g = graphOf({ directed: true }, ['A', 'B', 'C', 'D'], [
      ['A', 'B', 2],
      ['C', 'D', -5],
      ['D', 'C', 1], // a negative cycle, but not reachable from A
    ])
    const result = finishResult(run(g, 'A'))
    expect(result.negativeCycle).toBe(false)
    expect(result.distances).toEqual({ A: 0, B: 2, C: null, D: null })
  })

  it('agrees with Dijkstra on random graphs with non-negative weights, and its predecessor chains add up', () => {
    const rand = seededRandom(2024)
    for (let trial = 0; trial < 30; trial++) {
      const directed = trial % 2 === 0
      const ids = Array.from({ length: 8 }, (_, i) => `n${i}`)
      const edges: [string, string, number][] = Array.from({ length: 14 }, () => [
        `n${rand(8)}`,
        `n${rand(8)}`,
        rand(10),
      ])
      const g = graphOf({ directed }, ids, edges)
      const bf = finishResult(run(g, 'n0'))
      expect(bf.distances).toEqual(finishResult(dijkstraAlgorithm.run(g, { startNodeId: 'n0' })).distances)

      // Following `previous` back must reproduce each distance using the cheapest connecting edge.
      const distances = bf.distances as Record<string, number | null>
      const previous = bf.previous as Record<string, string | null>
      for (const id of ids) {
        const p = previous[id]
        if (id === 'n0' || p === undefined || p === null) continue
        const cheapest = Math.min(
          ...g.edges
            .filter((e) => (e.source === p && e.target === id) || (!directed && e.source === id && e.target === p))
            .map((e) => e.weight!),
        )
        expect(distances[id]).toBe(distances[p]! + cheapest)
      }
    }
  })

  it('handles negative weights correctly on random acyclic graphs (where no negative cycle can exist)', () => {
    const rand = seededRandom(99)
    for (let trial = 0; trial < 30; trial++) {
      const ids = Array.from({ length: 8 }, (_, i) => `n${i}`)
      const edges: [string, string, number][] = []
      for (let k = 0; k < 14; k++) {
        const a = rand(7)
        const b = a + 1 + rand(7 - a) // always forward: a < b, so the graph is a DAG
        edges.push([`n${a}`, `n${b}`, rand(11) - 5])
      }
      const g = graphOf({ directed: true }, ids, edges)

      const ref = new Map<string, number>([['n0', 0]])
      for (let changed = true; changed; ) {
        changed = false
        for (const [s, t, w] of edges) {
          const d = ref.get(s)
          if (d !== undefined && d + w < (ref.get(t) ?? Infinity)) {
            ref.set(t, d + w)
            changed = true
          }
        }
      }
      const expected = Object.fromEntries(ids.map((id) => [id, ref.get(id) ?? null]))
      const result = finishResult(run(g, 'n0'))
      expect(result.negativeCycle).toBe(false)
      expect(result.distances).toEqual(expected)
    }
  })

  it('allows negative weights in its requirements (unlike Dijkstra) and needs a start node', () => {
    expect(bellmanFordAlgorithm.requirements).toEqual({ weighted: true, startNode: true })
    const g = graphOf({ directed: true }, ['A', 'B'], [['A', 'B', -4]])
    expect(checkRequirements(bellmanFordAlgorithm, g, { startNodeId: 'A' })).toEqual([])
    expect(checkRequirements(dijkstraAlgorithm, g, { startNodeId: 'A' })).toHaveLength(1)
    expect(() => bellmanFordAlgorithm.run(g)).toThrow(/start node/i)
  })
})
