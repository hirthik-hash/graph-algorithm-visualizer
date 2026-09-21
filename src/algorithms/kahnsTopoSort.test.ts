import { describe, expect, it } from 'vitest'
import { checkRequirements } from '../engine/algorithm'
import type { AlgorithmEvent } from '../engine/events'
import { createGraph } from '../model/graph'
import type { Graph } from '../model/graph'
import { kahnsTopoSortAlgorithm } from './kahnsTopoSort'

function digraph(nodeIds: string[], edges: [string, string][]): Graph {
  return {
    ...createGraph({ directed: true }),
    nodes: nodeIds.map((id) => ({ id })),
    edges: edges.map(([source, target], i) => ({ id: `e${i + 1}`, source, target })),
  }
}

const run = (g: Graph) => kahnsTopoSortAlgorithm.run(g)

function finishResult(events: AlgorithmEvent[]) {
  const last = events[events.length - 1]
  if (last.type !== 'finish') throw new Error('last event is not finish')
  return last.result
}

describe("Kahn's topological sort", () => {
  it('emits the exact documented events for a diamond DAG', () => {
    const g = digraph(['A', 'B', 'C', 'D'], [
      ['A', 'B'],
      ['A', 'C'],
      ['B', 'D'],
      ['C', 'D'],
    ])
    expect(run(g)).toEqual([
      { type: 'enqueue', nodeId: 'A', structure: 'queue' }, // the only node with no incoming edges
      // --- A
      { type: 'dequeue', nodeId: 'A', structure: 'queue' },
      { type: 'visit_node', nodeId: 'A' },
      { type: 'relax_edge', edgeId: 'e1', source: 'A', target: 'B' },
      { type: 'enqueue', nodeId: 'B', structure: 'queue', fromNodeId: 'A' },
      { type: 'relax_edge', edgeId: 'e2', source: 'A', target: 'C' },
      { type: 'enqueue', nodeId: 'C', structure: 'queue', fromNodeId: 'A' },
      { type: 'mark_visited', nodeId: 'A' },
      // --- B (D still waits for C)
      { type: 'dequeue', nodeId: 'B', structure: 'queue' },
      { type: 'visit_node', nodeId: 'B' },
      { type: 'relax_edge', edgeId: 'e3', source: 'B', target: 'D' },
      { type: 'mark_visited', nodeId: 'B' },
      // --- C (now D is free)
      { type: 'dequeue', nodeId: 'C', structure: 'queue' },
      { type: 'visit_node', nodeId: 'C' },
      { type: 'relax_edge', edgeId: 'e4', source: 'C', target: 'D' },
      { type: 'enqueue', nodeId: 'D', structure: 'queue', fromNodeId: 'C' },
      { type: 'mark_visited', nodeId: 'C' },
      // --- D
      { type: 'dequeue', nodeId: 'D', structure: 'queue' },
      { type: 'visit_node', nodeId: 'D' },
      { type: 'mark_visited', nodeId: 'D' },
      { type: 'finish', result: { order: ['A', 'B', 'C', 'D'], hasCycle: false } },
    ])
  })

  it('reports a cycle in finish.result only, with an empty order and the stuck nodes never dequeued', () => {
    // A -> B -> C -> B: B and C wait on each other forever
    const g = digraph(['A', 'B', 'C'], [
      ['A', 'B'],
      ['B', 'C'],
      ['C', 'B'],
    ])
    const events = run(g)
    expect(finishResult(events)).toEqual({ order: [], hasCycle: true })
    expect(events.some((e) => e.type === 'dequeue' && (e.nodeId === 'B' || e.nodeId === 'C'))).toBe(false)
    expect(events.some((e) => e.type === 'negative_cycle_detected')).toBe(false)
  })

  it('treats a self-loop as a cycle', () => {
    expect(finishResult(run(digraph(['A'], [['A', 'A']])))).toEqual({ order: [], hasCycle: true })
  })

  it('handles parallel edges: both must be "removed" before the target is free', () => {
    const g = digraph(['A', 'B'], [
      ['A', 'B'],
      ['A', 'B'],
    ])
    expect(finishResult(run(g))).toEqual({ order: ['A', 'B'], hasCycle: false })
  })

  it('places every node, including isolated ones and several sources, in graph order among the ready', () => {
    const g = digraph(['C', 'A', 'B', 'Z'], [['A', 'B']])
    // sources in graph order: C, A, Z; B becomes free after A
    expect(finishResult(run(g)).order).toEqual(['C', 'A', 'Z', 'B'])
  })

  it('handles the empty graph', () => {
    expect(run(createGraph({ directed: true }))).toEqual([
      { type: 'finish', result: { order: [], hasCycle: false } },
    ])
  })

  it('requires a directed graph and no start node', () => {
    expect(kahnsTopoSortAlgorithm.requirements).toEqual({ graphType: 'directed' })
    expect(kahnsTopoSortAlgorithm.category).toBe('ordering')
    expect(checkRequirements(kahnsTopoSortAlgorithm, createGraph())).toEqual(['Requires a directed graph.'])
  })
})
