import { describe, expect, it } from 'vitest'
import { checkRequirements } from '../engine/algorithm'
import type { AlgorithmEvent } from '../engine/events'
import { createGraph } from '../model/graph'
import type { Graph } from '../model/graph'
import { primAlgorithm } from './prim'

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

const run = (g: Graph, start: string) => primAlgorithm.run(g, { startNodeId: start })

function finishResult(events: AlgorithmEvent[]) {
  const last = events[events.length - 1]
  if (last.type !== 'finish') throw new Error('last event is not finish')
  return last.result
}

describe("Prim's algorithm", () => {
  it('emits the exact documented events for a triangle', () => {
    const g = graphOf({}, ['A', 'B', 'C'], [
      ['A', 'B', 1],
      ['B', 'C', 2],
      ['A', 'C', 3],
    ])
    expect(run(g, 'A')).toEqual([
      // A joins the tree; its two edges become candidates
      { type: 'visit_node', nodeId: 'A' },
      { type: 'relax_edge', edgeId: 'e1', source: 'A', target: 'B', weight: 1 },
      { type: 'relax_edge', edgeId: 'e3', source: 'A', target: 'C', weight: 3 },
      { type: 'mark_visited', nodeId: 'A' },
      // cheapest candidate: e1
      { type: 'add_to_mst', edgeId: 'e1', source: 'A', target: 'B', weight: 1 },
      { type: 'visit_node', nodeId: 'B' },
      { type: 'relax_edge', edgeId: 'e2', source: 'B', target: 'C', weight: 2 }, // e1 back to A is skipped: A is in the tree
      { type: 'mark_visited', nodeId: 'B' },
      // e2 (2) beats e3 (3)
      { type: 'add_to_mst', edgeId: 'e2', source: 'B', target: 'C', weight: 2 },
      { type: 'visit_node', nodeId: 'C' },
      { type: 'mark_visited', nodeId: 'C' },
      // e3 is now stale (C is in the tree) and is skipped without an event
      { type: 'finish', result: { mstEdgeIds: ['e1', 'e2'], totalWeight: 3, nodesReached: 3 } },
    ])
  })

  it('only spans the start node’s component on a disconnected graph', () => {
    const g = graphOf({}, ['A', 'B', 'C', 'D'], [
      ['A', 'B', 4],
      ['C', 'D', 1],
    ])
    const events = run(g, 'A')
    expect(finishResult(events)).toEqual({ mstEdgeIds: ['e1'], totalWeight: 4, nodesReached: 2 })
    expect(events.some((e) => 'nodeId' in e && (e.nodeId === 'C' || e.nodeId === 'D'))).toBe(false)
  })

  it('takes the cheaper of parallel edges and ignores self-loops', () => {
    const g = graphOf({}, ['A', 'B'], [
      ['A', 'B', 9],
      ['A', 'B', 2],
      ['A', 'A', 1],
    ])
    expect(finishResult(run(g, 'A'))).toMatchObject({ mstEdgeIds: ['e2'], totalWeight: 2 })
  })

  it('handles negative weights', () => {
    const g = graphOf({}, ['A', 'B', 'C'], [
      ['A', 'B', -2],
      ['B', 'C', 5],
      ['A', 'C', 1],
    ])
    expect(finishResult(run(g, 'A'))).toMatchObject({ mstEdgeIds: ['e1', 'e3'], totalWeight: -1 })
  })

  it('breaks weight ties by edge order, deterministically', () => {
    const g = graphOf({}, ['A', 'B', 'C'], [
      ['A', 'C', 1],
      ['A', 'B', 1],
    ])
    expect(finishResult(run(g, 'A')).mstEdgeIds).toEqual(['e1', 'e2']) // e1 (A-C) was drawn first
  })

  it('omits weights from events on an unweighted graph and treats every edge as weight 1', () => {
    const g = { ...graphOf({}, ['A', 'B'], [['A', 'B', 7]]), weighted: false }
    const events = run(g, 'A')
    expect(events).toContainEqual({ type: 'add_to_mst', edgeId: 'e1', source: 'A', target: 'B' })
    expect(finishResult(events).totalWeight).toBe(1)
  })

  it('requires an undirected graph and a start node', () => {
    expect(primAlgorithm.requirements).toEqual({ graphType: 'undirected', startNode: true })
    const directed = graphOf({ directed: true }, ['A', 'B'], [['A', 'B', 1]])
    expect(checkRequirements(primAlgorithm, directed, { startNodeId: 'A' })).toEqual(['Requires an undirected graph.'])
    expect(() => primAlgorithm.run(directed)).toThrow(/start node/i)
  })
})
