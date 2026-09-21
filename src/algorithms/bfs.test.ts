import { describe, expect, it } from 'vitest'
import { addEdge, addNode, createGraph } from '../model/graph'
import type { Graph } from '../model/graph'
import { bfsAlgorithm } from './bfs'
import { bfsOrder } from './bfs-poc'
import type { AlgorithmEvent } from '../engine/events'

function build(
  options: { directed?: boolean; weighted?: boolean },
  nodeIds: string[],
  edges: [string, string, number?][],
): Graph {
  let g = createGraph(options)
  for (const id of nodeIds) g = addNode(g, { id })
  edges.forEach(([source, target, weight], i) => {
    g = addEdge(g, { id: `e${i + 1}`, source, target, ...(weight === undefined ? {} : { weight }) })
  })
  return g
}

const finishOrder = (events: AlgorithmEvent[]) => {
  const last = events[events.length - 1]
  if (last.type !== 'finish') throw new Error('last event is not finish')
  return last.result.order
}

describe('BFS', () => {
  it('emits the exact documented event sequence for a small graph', () => {
    const g = build({}, ['A', 'B', 'C'], [
      ['A', 'B'],
      ['A', 'C'],
    ])
    expect(bfsAlgorithm.run(g, { startNodeId: 'A' })).toEqual([
      { type: 'enqueue', nodeId: 'A', structure: 'queue' },
      // --- A
      { type: 'dequeue', nodeId: 'A', structure: 'queue' },
      { type: 'visit_node', nodeId: 'A' },
      { type: 'relax_edge', edgeId: 'e1', source: 'A', target: 'B' },
      { type: 'enqueue', nodeId: 'B', structure: 'queue', fromNodeId: 'A' },
      { type: 'relax_edge', edgeId: 'e2', source: 'A', target: 'C' },
      { type: 'enqueue', nodeId: 'C', structure: 'queue', fromNodeId: 'A' },
      { type: 'mark_visited', nodeId: 'A' },
      // --- B (its edge back to A is examined but A is already discovered)
      { type: 'dequeue', nodeId: 'B', structure: 'queue' },
      { type: 'visit_node', nodeId: 'B' },
      { type: 'relax_edge', edgeId: 'e1', source: 'B', target: 'A' },
      { type: 'mark_visited', nodeId: 'B' },
      // --- C
      { type: 'dequeue', nodeId: 'C', structure: 'queue' },
      { type: 'visit_node', nodeId: 'C' },
      { type: 'relax_edge', edgeId: 'e2', source: 'C', target: 'A' },
      { type: 'mark_visited', nodeId: 'C' },
      { type: 'finish', result: { order: ['A', 'B', 'C'], reachableCount: 3 } },
    ])
  })

  it('visits level by level', () => {
    const g = build({}, ['A', 'B', 'C', 'D'], [
      ['A', 'B'],
      ['A', 'C'],
      ['B', 'D'],
    ])
    expect(finishOrder(bfsAlgorithm.run(g, { startNodeId: 'A' }))).toEqual(['A', 'B', 'C', 'D'])
  })

  it('agrees with the Day 1 proof-of-life BFS on several graphs', () => {
    const cases: Graph[] = [
      build({}, ['A', 'B', 'C', 'D', 'E'], [['A', 'B'], ['A', 'C'], ['B', 'D'], ['C', 'D'], ['D', 'E']]),
      build({ directed: true }, ['A', 'B', 'C', 'D'], [['A', 'B'], ['C', 'A'], ['B', 'D'], ['D', 'C']]),
      build({}, ['A', 'B', 'C'], [['A', 'A'], ['A', 'B']]), // self-loop
    ]
    for (const g of cases) {
      for (const n of g.nodes) {
        expect(finishOrder(bfsAlgorithm.run(g, { startNodeId: n.id }))).toEqual(bfsOrder(g, n.id))
      }
    }
  })

  it('never reaches nodes that are unreachable, and respects direction', () => {
    const g = build({ directed: true }, ['A', 'B', 'C', 'D'], [
      ['A', 'B'],
      ['C', 'A'],
    ])
    const events = bfsAlgorithm.run(g, { startNodeId: 'A' })
    expect(finishOrder(events)).toEqual(['A', 'B'])
    expect(events.some((e) => 'nodeId' in e && (e.nodeId === 'C' || e.nodeId === 'D'))).toBe(false)
  })

  it('reports an undirected edge in the direction it was traversed', () => {
    const g = build({}, ['A', 'B'], [['A', 'B']]) // stored A -> B
    const events = bfsAlgorithm.run(g, { startNodeId: 'B' })
    expect(events).toContainEqual({ type: 'relax_edge', edgeId: 'e1', source: 'B', target: 'A' })
  })

  it('includes edge weights only for weighted graphs', () => {
    const weighted = build({ weighted: true }, ['A', 'B'], [['A', 'B', 7]])
    expect(bfsAlgorithm.run(weighted, { startNodeId: 'A' })).toContainEqual({
      type: 'relax_edge',
      edgeId: 'e1',
      source: 'A',
      target: 'B',
      weight: 7,
    })
    const plain = build({}, ['A', 'B'], [['A', 'B']])
    const relax = bfsAlgorithm.run(plain, { startNodeId: 'A' }).find((e) => e.type === 'relax_edge')
    expect(relax).not.toHaveProperty('weight')
  })

  it('enqueues each node once and dequeues in the same (FIFO) order', () => {
    const g = build({}, ['A', 'B', 'C', 'D', 'E', 'F'], [
      ['A', 'B'], ['A', 'C'], ['B', 'D'], ['C', 'D'], ['D', 'E'], ['E', 'F'], ['C', 'F'],
    ])
    const events = bfsAlgorithm.run(g, { startNodeId: 'A' })
    const enqueued = events.filter((e) => e.type === 'enqueue').map((e) => e.nodeId)
    const dequeued = events.filter((e) => e.type === 'dequeue').map((e) => e.nodeId)
    expect(new Set(enqueued).size).toBe(enqueued.length)
    expect(dequeued).toEqual(enqueued)
  })

  it('declares that it needs a start node and throws without a valid one', () => {
    expect(bfsAlgorithm.requirements).toEqual({ startNode: true })
    expect(bfsAlgorithm.category).toBe('traversal')
    const g = build({}, ['A'], [])
    expect(() => bfsAlgorithm.run(g)).toThrow(/start node/i)
    expect(() => bfsAlgorithm.run(g, { startNodeId: 'Z' })).toThrow(/start node/i)
  })
})
