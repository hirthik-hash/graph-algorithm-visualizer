import { describe, expect, it } from 'vitest'
import { addEdge, addNode, createGraph } from '../model/graph'
import type { Graph } from '../model/graph'
import { bfsAlgorithm } from './bfs'
import { dfsAlgorithm } from './dfs'
import type { AlgorithmEvent } from '../engine/events'

function build(options: { directed?: boolean }, nodeIds: string[], edges: [string, string][]): Graph {
  let g = createGraph(options)
  for (const id of nodeIds) g = addNode(g, { id })
  edges.forEach(([source, target], i) => {
    g = addEdge(g, { id: `e${i + 1}`, source, target })
  })
  return g
}

const finishOrder = (events: AlgorithmEvent[]) => {
  const last = events[events.length - 1]
  if (last.type !== 'finish') throw new Error('last event is not finish')
  return last.result.order
}

describe('DFS', () => {
  it('emits the exact documented event sequence for a small graph', () => {
    const g = build({}, ['A', 'B', 'C'], [
      ['A', 'B'],
      ['A', 'C'],
    ])
    expect(dfsAlgorithm.run(g, { startNodeId: 'A' })).toEqual([
      { type: 'enqueue', nodeId: 'A', structure: 'stack' },
      { type: 'visit_node', nodeId: 'A' },
      { type: 'relax_edge', edgeId: 'e1', source: 'A', target: 'B' },
      { type: 'enqueue', nodeId: 'B', structure: 'stack', fromNodeId: 'A' },
      { type: 'visit_node', nodeId: 'B' },
      { type: 'relax_edge', edgeId: 'e1', source: 'B', target: 'A' }, // A already visited: no descent
      { type: 'dequeue', nodeId: 'B', structure: 'stack' },
      { type: 'mark_visited', nodeId: 'B' },
      { type: 'relax_edge', edgeId: 'e2', source: 'A', target: 'C' },
      { type: 'enqueue', nodeId: 'C', structure: 'stack', fromNodeId: 'A' },
      { type: 'visit_node', nodeId: 'C' },
      { type: 'relax_edge', edgeId: 'e2', source: 'C', target: 'A' },
      { type: 'dequeue', nodeId: 'C', structure: 'stack' },
      { type: 'mark_visited', nodeId: 'C' },
      { type: 'dequeue', nodeId: 'A', structure: 'stack' },
      { type: 'mark_visited', nodeId: 'A' },
      { type: 'finish', result: { order: ['A', 'B', 'C'], reachableCount: 3 } },
    ])
  })

  it('goes deep before wide: differs from BFS on the same graph', () => {
    const g = build({}, ['A', 'B', 'C', 'D'], [
      ['A', 'B'],
      ['A', 'C'],
      ['B', 'D'],
    ])
    expect(finishOrder(dfsAlgorithm.run(g, { startNodeId: 'A' }))).toEqual(['A', 'B', 'D', 'C'])
    expect(finishOrder(bfsAlgorithm.run(g, { startNodeId: 'A' }))).toEqual(['A', 'B', 'C', 'D'])
  })

  it('respects direction and never reaches unreachable nodes', () => {
    const g = build({ directed: true }, ['A', 'B', 'C', 'D'], [
      ['A', 'B'],
      ['C', 'A'],
    ])
    expect(finishOrder(dfsAlgorithm.run(g, { startNodeId: 'A' }))).toEqual(['A', 'B'])
  })

  it('terminates on cycles and visits each node once', () => {
    const g = build({}, ['A', 'B', 'C'], [
      ['A', 'B'],
      ['B', 'C'],
      ['C', 'A'],
    ])
    const events = dfsAlgorithm.run(g, { startNodeId: 'A' })
    expect(events.filter((e) => e.type === 'visit_node')).toHaveLength(3)
    expect(finishOrder(events)).toEqual(['A', 'B', 'C'])
  })

  it('keeps the stack balanced: every push is matched by a pop, in LIFO order', () => {
    const g = build({}, ['A', 'B', 'C', 'D', 'E'], [
      ['A', 'B'], ['A', 'C'], ['B', 'D'], ['C', 'D'], ['D', 'E'],
    ])
    const stack: string[] = []
    for (const e of dfsAlgorithm.run(g, { startNodeId: 'A' })) {
      if (e.type === 'enqueue') stack.push(e.nodeId)
      if (e.type === 'dequeue') expect(stack.pop()).toBe(e.nodeId)
    }
    expect(stack).toEqual([])
  })

  it('handles a very deep path without overflowing the call stack (it is iterative)', () => {
    // Built as a literal: addNode/addEdge copy the arrays on every call (fine for
    // hand-drawn graphs), which would make 20,000 of them the slow part of this test.
    const n = 20000
    const g: Graph = {
      ...createGraph({ directed: true }),
      nodes: Array.from({ length: n }, (_, i) => ({ id: `n${i}` })),
      edges: Array.from({ length: n - 1 }, (_, i) => ({ id: `e${i}`, source: `n${i}`, target: `n${i + 1}` })),
    }
    const events = dfsAlgorithm.run(g, { startNodeId: 'n0' })
    const last = events[events.length - 1]
    expect(last.type === 'finish' && last.result.reachableCount).toBe(n)
  })

  it('declares that it needs a start node and throws without a valid one', () => {
    expect(dfsAlgorithm.requirements).toEqual({ startNode: true })
    const g = build({}, ['A'], [])
    expect(() => dfsAlgorithm.run(g)).toThrow(/start node/i)
    expect(() => dfsAlgorithm.run(g, { startNodeId: 'Z' })).toThrow(/start node/i)
  })
})
