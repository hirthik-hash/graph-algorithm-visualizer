import { describe, expect, it } from 'vitest'
import { checkRequirements } from '../engine/algorithm'
import type { AlgorithmEvent } from '../engine/events'
import { createGraph } from '../model/graph'
import type { Graph } from '../model/graph'
import { kruskalAlgorithm } from './kruskal'

function graphOf(
  options: { directed?: boolean; weighted?: boolean },
  nodeIds: string[],
  edges: [string, string, number][],
): Graph {
  return {
    ...createGraph({ weighted: true, ...options }),
    nodes: nodeIds.map((id) => ({ id })),
    edges: edges.map(([source, target, weight], i) => ({ id: `e${i + 1}`, source, target, weight })),
  }
}

const run = (g: Graph) => kruskalAlgorithm.run(g)

function finishResult(events: AlgorithmEvent[]) {
  const last = events[events.length - 1]
  if (last.type !== 'finish') throw new Error('last event is not finish')
  return last.result
}

describe("Kruskal's algorithm", () => {
  it('emits the exact documented events, rejecting the cycle-forming edge with a reason', () => {
    const g = graphOf({}, ['A', 'B', 'C'], [
      ['A', 'C', 3], // drawn first but most expensive
      ['A', 'B', 1],
      ['B', 'C', 2],
    ])
    // sorted: e2 (1), e3 (2), e1 (3)
    expect(run(g)).toEqual([
      { type: 'relax_edge', edgeId: 'e2', source: 'A', target: 'B', weight: 1 },
      { type: 'add_to_mst', edgeId: 'e2', source: 'A', target: 'B', weight: 1 },
      { type: 'relax_edge', edgeId: 'e3', source: 'B', target: 'C', weight: 2 },
      { type: 'add_to_mst', edgeId: 'e3', source: 'B', target: 'C', weight: 2 },
      { type: 'relax_edge', edgeId: 'e1', source: 'A', target: 'C', weight: 3 },
      { type: 'reject_edge', edgeId: 'e1', source: 'A', target: 'C', weight: 3, reason: 'would_form_cycle' },
      { type: 'finish', result: { mstEdgeIds: ['e2', 'e3'], totalWeight: 3, treeCount: 1 } },
    ])
  })

  it('produces a spanning forest on a disconnected graph', () => {
    const g = graphOf({}, ['A', 'B', 'C', 'D', 'E'], [
      ['A', 'B', 2],
      ['C', 'D', 5],
      ['D', 'E', 1],
    ])
    const result = finishResult(run(g))
    expect(result).toEqual({ mstEdgeIds: ['e3', 'e1', 'e2'], totalWeight: 8, treeCount: 2 })
  })

  it('rejects a self-loop and the costlier of two parallel edges', () => {
    const g = graphOf({}, ['A', 'B'], [
      ['A', 'B', 9],
      ['A', 'B', 2],
      ['A', 'A', 1],
    ])
    const events = run(g)
    const rejected = events.flatMap((e) => (e.type === 'reject_edge' ? [e.edgeId] : []))
    expect(rejected).toEqual(['e3', 'e1']) // the self-loop (weight 1) is looked at first, then the 9
    expect(finishResult(events)).toMatchObject({ mstEdgeIds: ['e2'], totalWeight: 2 })
  })

  it('breaks weight ties by edge order, deterministically', () => {
    const g = graphOf({}, ['A', 'B', 'C'], [
      ['A', 'B', 1],
      ['B', 'C', 1],
      ['A', 'C', 1],
    ])
    expect(finishResult(run(g)).mstEdgeIds).toEqual(['e1', 'e2']) // e3 closes the cycle
  })

  it('handles negative weights and the empty graph', () => {
    const g = graphOf({}, ['A', 'B', 'C'], [
      ['A', 'B', -2],
      ['B', 'C', 5],
      ['A', 'C', 1],
    ])
    expect(finishResult(run(g))).toMatchObject({ mstEdgeIds: ['e1', 'e3'], totalWeight: -1 })
    expect(run(createGraph())).toEqual([
      { type: 'finish', result: { mstEdgeIds: [], totalWeight: 0, treeCount: 0 } },
    ])
  })

  it('works on unweighted graphs: no weight fields in events, every edge counts as 1', () => {
    const g = { ...graphOf({}, ['A', 'B', 'C'], [['A', 'B', 7], ['B', 'C', 7]]), weighted: false }
    const events = run(g)
    expect(events).toContainEqual({ type: 'add_to_mst', edgeId: 'e1', source: 'A', target: 'B' })
    expect(finishResult(events).totalWeight).toBe(2)
  })

  it('requires an undirected graph (and no start node)', () => {
    expect(kruskalAlgorithm.requirements).toEqual({ graphType: 'undirected' })
    const directed = graphOf({ directed: true }, ['A', 'B'], [['A', 'B', 1]])
    expect(checkRequirements(kruskalAlgorithm, directed)).toEqual(['Requires an undirected graph.'])
    expect(checkRequirements(kruskalAlgorithm, graphOf({}, ['A'], []))).toEqual([])
  })
})
