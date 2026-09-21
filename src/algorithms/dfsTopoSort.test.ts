import { describe, expect, it } from 'vitest'
import { checkRequirements } from '../engine/algorithm'
import type { AlgorithmEvent } from '../engine/events'
import { createGraph } from '../model/graph'
import type { Graph } from '../model/graph'
import { dfsTopoSortAlgorithm } from './dfsTopoSort'

function digraph(nodeIds: string[], edges: [string, string][]): Graph {
  return {
    ...createGraph({ directed: true }),
    nodes: nodeIds.map((id) => ({ id })),
    edges: edges.map(([source, target], i) => ({ id: `e${i + 1}`, source, target })),
  }
}

const run = (g: Graph) => dfsTopoSortAlgorithm.run(g)

function finishResult(events: AlgorithmEvent[]) {
  const last = events[events.length - 1]
  if (last.type !== 'finish') throw new Error('last event is not finish')
  return last.result
}

describe('DFS topological sort', () => {
  it('emits the exact documented events; the order is the reverse of finishing order', () => {
    const g = digraph(['A', 'B', 'C'], [
      ['A', 'B'],
      ['B', 'C'],
      ['A', 'C'],
    ])
    expect(run(g)).toEqual([
      { type: 'enqueue', nodeId: 'A', structure: 'stack' },
      { type: 'visit_node', nodeId: 'A' },
      { type: 'relax_edge', edgeId: 'e1', source: 'A', target: 'B' },
      { type: 'enqueue', nodeId: 'B', structure: 'stack', fromNodeId: 'A' },
      { type: 'visit_node', nodeId: 'B' },
      { type: 'relax_edge', edgeId: 'e2', source: 'B', target: 'C' },
      { type: 'enqueue', nodeId: 'C', structure: 'stack', fromNodeId: 'B' },
      { type: 'visit_node', nodeId: 'C' },
      // C has no outgoing edges: it finishes first
      { type: 'dequeue', nodeId: 'C', structure: 'stack' },
      { type: 'mark_visited', nodeId: 'C' },
      { type: 'dequeue', nodeId: 'B', structure: 'stack' },
      { type: 'mark_visited', nodeId: 'B' },
      // back in A: the edge to C is examined, but C is already finished
      { type: 'relax_edge', edgeId: 'e3', source: 'A', target: 'C' },
      { type: 'dequeue', nodeId: 'A', structure: 'stack' },
      { type: 'mark_visited', nodeId: 'A' },
      { type: 'finish', result: { order: ['A', 'B', 'C'], hasCycle: false } },
    ])
  })

  it('detects a cycle via a back edge and reports it only in finish.result', () => {
    const g = digraph(['A', 'B'], [
      ['A', 'B'],
      ['B', 'A'],
    ])
    const events = run(g)
    expect(finishResult(events)).toEqual({ order: [], hasCycle: true })
    expect(events.filter((e) => e.type === 'visit_node')).toHaveLength(2) // the search still completes
  })

  it('treats a self-loop as a cycle, but a diamond as acyclic', () => {
    expect(finishResult(run(digraph(['A'], [['A', 'A']]))).hasCycle).toBe(true)
    const diamond = digraph(['A', 'B', 'C', 'D'], [
      ['A', 'B'],
      ['A', 'C'],
      ['B', 'D'],
      ['C', 'D'],
    ])
    expect(finishResult(run(diamond)).hasCycle).toBe(false)
  })

  it('starts a new search from every unvisited node, so disconnected nodes are included', () => {
    const g = digraph(['A', 'B', 'C', 'D'], [['B', 'A']])
    const order = finishResult(run(g)).order as string[]
    expect([...order].sort()).toEqual(['A', 'B', 'C', 'D'])
    expect(order.indexOf('B')).toBeLessThan(order.indexOf('A'))
  })

  it('handles a 20,000-node chain without overflowing the call stack (it is iterative)', () => {
    const n = 20000
    const g: Graph = {
      ...createGraph({ directed: true }),
      nodes: Array.from({ length: n }, (_, i) => ({ id: `n${i}` })),
      edges: Array.from({ length: n - 1 }, (_, i) => ({ id: `e${i}`, source: `n${i}`, target: `n${i + 1}` })),
    }
    const order = finishResult(run(g)).order as string[]
    expect(order).toHaveLength(n)
    expect(order[0]).toBe('n0')
    expect(order[n - 1]).toBe(`n${n - 1}`)
  })

  it('keeps the stack balanced and requires a directed graph', () => {
    const g = digraph(['A', 'B', 'C'], [['A', 'B'], ['A', 'C']])
    const stack: string[] = []
    for (const e of run(g)) {
      if (e.type === 'enqueue') stack.push(e.nodeId)
      if (e.type === 'dequeue') expect(stack.pop()).toBe(e.nodeId)
    }
    expect(stack).toEqual([])
    expect(dfsTopoSortAlgorithm.requirements).toEqual({ graphType: 'directed' })
    expect(checkRequirements(dfsTopoSortAlgorithm, createGraph())).toEqual(['Requires a directed graph.'])
  })
})
