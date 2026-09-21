import { describe, expect, it } from 'vitest'
import { checkRequirements } from '../engine/algorithm'
import type { AlgorithmEvent } from '../engine/events'
import { addEdge, addNode, createGraph } from '../model/graph'
import type { Graph } from '../model/graph'
import { dijkstraAlgorithm } from './dijkstra'

function build(
  options: { directed?: boolean; weighted?: boolean },
  nodeIds: string[],
  edges: [string, string, number][],
): Graph {
  let g = createGraph({ weighted: true, ...options })
  for (const id of nodeIds) g = addNode(g, { id })
  edges.forEach(([source, target, weight], i) => {
    g = addEdge(g, { id: `e${i + 1}`, source, target, weight })
  })
  return g
}

function finishResult(events: AlgorithmEvent[]) {
  const last = events[events.length - 1]
  if (last.type !== 'finish') throw new Error('last event is not finish')
  return last.result
}

const run = (g: Graph, start: string) => dijkstraAlgorithm.run(g, { startNodeId: start })

describe('Dijkstra', () => {
  it('emits the exact documented event sequence, including a later shorter path', () => {
    // A->B (4), A->C (1), C->B (2): B is first reached at 4, then improved to 3 via C.
    const g = build({ directed: true }, ['A', 'B', 'C'], [
      ['A', 'B', 4],
      ['A', 'C', 1],
      ['C', 'B', 2],
    ])
    expect(run(g, 'A')).toEqual([
      { type: 'update_distance', nodeId: 'A', distance: 0, previousDistance: null },
      { type: 'enqueue', nodeId: 'A', structure: 'priority_queue', priority: 0 },
      // --- A
      { type: 'dequeue', nodeId: 'A', structure: 'priority_queue' },
      { type: 'visit_node', nodeId: 'A' },
      { type: 'relax_edge', edgeId: 'e1', source: 'A', target: 'B', weight: 4 },
      { type: 'update_distance', nodeId: 'B', distance: 4, previousDistance: null, viaNodeId: 'A' },
      { type: 'enqueue', nodeId: 'B', structure: 'priority_queue', fromNodeId: 'A', priority: 4 },
      { type: 'relax_edge', edgeId: 'e2', source: 'A', target: 'C', weight: 1 },
      { type: 'update_distance', nodeId: 'C', distance: 1, previousDistance: null, viaNodeId: 'A' },
      { type: 'enqueue', nodeId: 'C', structure: 'priority_queue', fromNodeId: 'A', priority: 1 },
      { type: 'mark_visited', nodeId: 'A' },
      // --- C (closest), improves B without a second enqueue
      { type: 'dequeue', nodeId: 'C', structure: 'priority_queue' },
      { type: 'visit_node', nodeId: 'C' },
      { type: 'relax_edge', edgeId: 'e3', source: 'C', target: 'B', weight: 2 },
      { type: 'update_distance', nodeId: 'B', distance: 3, previousDistance: 4, viaNodeId: 'C' },
      { type: 'mark_visited', nodeId: 'C' },
      // --- B (the stale entry with distance 4 is skipped silently)
      { type: 'dequeue', nodeId: 'B', structure: 'priority_queue' },
      { type: 'visit_node', nodeId: 'B' },
      { type: 'mark_visited', nodeId: 'B' },
      {
        type: 'finish',
        result: {
          distances: { A: 0, B: 3, C: 1 },
          previous: { A: null, B: 'C', C: 'A' },
          order: ['A', 'C', 'B'],
        },
      },
    ])
  })

  it('finds the right distances on a classic example', () => {
    const g = build({}, ['A', 'B', 'C', 'D', 'E'], [
      ['A', 'B', 6],
      ['A', 'D', 1],
      ['B', 'D', 2],
      ['B', 'E', 2],
      ['B', 'C', 5],
      ['D', 'E', 1],
      ['E', 'C', 5],
    ])
    expect(finishResult(run(g, 'A')).distances).toEqual({ A: 0, B: 3, C: 7, D: 1, E: 2 })
  })

  it('reports unreachable nodes as null and never touches them', () => {
    const g = build({ directed: true }, ['A', 'B', 'C'], [['A', 'B', 2]])
    const events = run(g, 'A')
    expect(finishResult(events).distances).toEqual({ A: 0, B: 2, C: null })
    expect(events.some((e) => 'nodeId' in e && e.nodeId === 'C')).toBe(false)
  })

  it('works on undirected graphs and reports edges in the direction traversed', () => {
    const g = build({}, ['A', 'B'], [['A', 'B', 3]]) // stored A -> B
    const events = run(g, 'B')
    expect(finishResult(events).distances).toEqual({ A: 3, B: 0 })
    expect(events).toContainEqual({ type: 'relax_edge', edgeId: 'e1', source: 'B', target: 'A', weight: 3 })
  })

  it('uses the cheaper of two parallel edges and examines both', () => {
    const g = build({ directed: true }, ['A', 'B'], [
      ['A', 'B', 9],
      ['A', 'B', 2],
    ])
    const events = run(g, 'A')
    expect(finishResult(events).distances).toEqual({ A: 0, B: 2 })
    expect(events.filter((e) => e.type === 'relax_edge').map((e) => e.edgeId)).toEqual(['e1', 'e2'])
    expect(
      events.flatMap((e) => (e.type === 'update_distance' && e.nodeId === 'B' ? [e.distance] : [])),
    ).toEqual([9, 2])
  })

  it('handles zero-weight edges and ignores a self-loop', () => {
    const g = build({ directed: true }, ['A', 'B'], [
      ['A', 'A', 5],
      ['A', 'B', 0],
    ])
    const events = run(g, 'A')
    expect(finishResult(events).distances).toEqual({ A: 0, B: 0 })
    expect(events.filter((e) => e.type === 'update_distance' && e.nodeId === 'A')).toHaveLength(1)
  })

  it('breaks distance ties by node order, deterministically', () => {
    const g = build({ directed: true }, ['A', 'B', 'C'], [
      ['A', 'C', 1],
      ['A', 'B', 1],
    ])
    expect(finishResult(run(g, 'A')).order).toEqual(['A', 'B', 'C']) // B before C, though C's edge came first
  })

  it('finalises nodes in non-decreasing distance order and enqueues each node once', () => {
    const g = build({}, ['A', 'B', 'C', 'D', 'E', 'F'], [
      ['A', 'B', 7], ['A', 'C', 9], ['A', 'F', 14], ['B', 'C', 10], ['B', 'D', 15],
      ['C', 'D', 11], ['C', 'F', 2], ['D', 'E', 6], ['E', 'F', 9],
    ])
    const events = run(g, 'A')
    const result = finishResult(events)
    const order = result.order as string[]
    const distances = result.distances as Record<string, number>
    const ordered = order.map((id) => distances[id])
    expect(ordered).toEqual([...ordered].sort((a, b) => a - b))
    const enqueued = events.filter((e) => e.type === 'enqueue').map((e) => e.nodeId)
    expect(new Set(enqueued).size).toBe(enqueued.length)
  })

  it('matches a brute-force reference on many random graphs', () => {
    let seed = 12345
    const rand = (n: number) => {
      seed = (seed * 1664525 + 1013904223) % 4294967296
      return seed % n
    }
    for (let trial = 0; trial < 40; trial++) {
      const n = 8
      const directed = trial % 2 === 0
      const nodes = Array.from({ length: n }, (_, i) => ({ id: `n${i}` }))
      const edges = Array.from({ length: 14 }, (_, i) => ({
        id: `e${i}`,
        source: `n${rand(n)}`,
        target: `n${rand(n)}`,
        weight: rand(10), // includes 0
      }))
      const g: Graph = { ...createGraph({ directed, weighted: true }), nodes, edges }

      // Reference: repeated relaxation until nothing changes.
      const ref = new Map<string, number>([['n0', 0]])
      for (let changed = true; changed; ) {
        changed = false
        for (const e of edges) {
          const pairs = directed ? [[e.source, e.target]] : [[e.source, e.target], [e.target, e.source]]
          for (const [from, to] of pairs) {
            const d = ref.get(from)
            if (d !== undefined && d + e.weight < (ref.get(to) ?? Infinity)) {
              ref.set(to, d + e.weight)
              changed = true
            }
          }
        }
      }
      const expected = Object.fromEntries(nodes.map((nd) => [nd.id, ref.get(nd.id) ?? null]))
      expect(finishResult(run(g, 'n0')).distances).toEqual(expected)
    }
  })

  it('declares its requirements: weighted, non-negative, start node', () => {
    expect(dijkstraAlgorithm.requirements).toEqual({ weighted: true, nonNegativeWeights: true, startNode: true })
    const negative = build({ directed: true }, ['A', 'B'], [['A', 'B', -1]])
    expect(checkRequirements(dijkstraAlgorithm, negative, { startNodeId: 'A' })).toEqual([
      'Requires non-negative edge weights (edge e1 has weight -1).',
    ])
    const unweighted = { ...negative, weighted: false }
    expect(checkRequirements(dijkstraAlgorithm, unweighted, { startNodeId: 'A' })).toEqual(['Requires a weighted graph.'])
  })

  it('throws when called directly without a valid start node', () => {
    const g = build({}, ['A'], [])
    expect(() => dijkstraAlgorithm.run(g)).toThrow(/start node/i)
    expect(() => dijkstraAlgorithm.run(g, { startNodeId: 'Z' })).toThrow(/start node/i)
  })
})
