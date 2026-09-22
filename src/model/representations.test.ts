import { describe, expect, it } from 'vitest'
import { addEdge, addNode, createGraph } from './graph'
import type { Graph } from './graph'
import { toAdjacencyList, toAdjacencyMatrix, toEdgeList } from './representations'
import { parallelEdgesGraph } from '../test/fixtures'

function build(
  options: { directed?: boolean; weighted?: boolean },
  nodeIds: string[],
  edges: [string, string, string, number?][], // [edgeId, source, target, weight?]
): Graph {
  let g = createGraph(options)
  for (const id of nodeIds) g = addNode(g, { id })
  for (const [id, source, target, weight] of edges) {
    g = addEdge(g, { id, source, target, ...(weight === undefined ? {} : { weight }) })
  }
  return g
}

describe('toAdjacencyMatrix', () => {
  it('is symmetric with 1/null cells for an unweighted undirected graph', () => {
    const g = build({}, ['A', 'B', 'C'], [['e1', 'A', 'B']])
    expect(toAdjacencyMatrix(g)).toEqual({
      nodeIds: ['A', 'B', 'C'],
      cells: [
        [null, 1, null],
        [1, null, null],
        [null, null, null],
      ],
    })
  })

  it('is asymmetric for a directed graph', () => {
    const g = build({ directed: true }, ['A', 'B'], [['e1', 'A', 'B']])
    expect(toAdjacencyMatrix(g).cells).toEqual([
      [null, 1],
      [null, null],
    ])
  })

  it('stores weights, and a real weight of 0 is distinct from "no edge"', () => {
    const g = build({ directed: true, weighted: true }, ['A', 'B', 'C'], [
      ['e1', 'A', 'B', 0],
      ['e2', 'B', 'C', -4],
    ])
    const { cells } = toAdjacencyMatrix(g)
    expect(cells[0][1]).toBe(0)
    expect(cells[1][2]).toBe(-4)
    expect(cells[0][2]).toBeNull()
  })

  it('keeps the CHEAPEST parallel edge regardless of insertion order', () => {
    // Shared fixture: A -> B twice, weights 9 then 2 — see src/test/fixtures.ts.
    expect(toAdjacencyMatrix(parallelEdgesGraph()).cells[0][1]).toBe(2)
    const cheapFirst = build({ directed: true, weighted: true }, ['A', 'B'], [
      ['e1', 'A', 'B', 2],
      ['e2', 'A', 'B', 9],
    ])
    expect(toAdjacencyMatrix(cheapFirst).cells[0][1]).toBe(2)
  })

  it('puts a self-loop on the diagonal exactly once', () => {
    const g = build({ weighted: true }, ['A', 'B'], [['e1', 'A', 'A', 5]])
    expect(toAdjacencyMatrix(g).cells).toEqual([
      [5, null],
      [null, null],
    ])
  })

  it('handles an empty graph', () => {
    expect(toAdjacencyMatrix(createGraph())).toEqual({ nodeIds: [], cells: [] })
  })
})

describe('toAdjacencyList', () => {
  it('lists both directions for undirected edges and keeps isolated nodes', () => {
    const g = build({}, ['A', 'B', 'C', 'D'], [
      ['e1', 'A', 'B'],
      ['e2', 'A', 'C'],
    ])
    expect(toAdjacencyList(g)).toEqual([
      {
        nodeId: 'A',
        neighbors: [
          { nodeId: 'B', edgeId: 'e1' },
          { nodeId: 'C', edgeId: 'e2' },
        ],
      },
      { nodeId: 'B', neighbors: [{ nodeId: 'A', edgeId: 'e1' }] },
      { nodeId: 'C', neighbors: [{ nodeId: 'A', edgeId: 'e2' }] },
      { nodeId: 'D', neighbors: [] },
    ])
  })

  it('lists only out-neighbours for directed graphs, with weights and parallel edges kept', () => {
    const g = build({ directed: true, weighted: true }, ['A', 'B'], [
      ['e1', 'A', 'B', 3],
      ['e2', 'A', 'B', 8],
    ])
    expect(toAdjacencyList(g)).toEqual([
      {
        nodeId: 'A',
        neighbors: [
          { nodeId: 'B', edgeId: 'e1', weight: 3 },
          { nodeId: 'B', edgeId: 'e2', weight: 8 },
        ],
      },
      { nodeId: 'B', neighbors: [] },
    ])
  })

  it('lists an undirected self-loop once', () => {
    const g = build({}, ['A'], [['e1', 'A', 'A']])
    expect(toAdjacencyList(g)[0].neighbors).toEqual([{ nodeId: 'A', edgeId: 'e1' }])
  })
})

describe('toEdgeList', () => {
  it('returns copies in insertion order', () => {
    const g = build({ weighted: true }, ['A', 'B', 'C'], [
      ['e1', 'A', 'B', 1],
      ['e2', 'B', 'C', 2],
    ])
    const list = toEdgeList(g)
    expect(list.map((e) => e.id)).toEqual(['e1', 'e2'])
    expect(list[0]).not.toBe(g.edges[0]) // a copy, not the model's own object
  })

  it('hides stored weights when the graph is unweighted', () => {
    const weighted = build({ weighted: true }, ['A', 'B'], [['e1', 'A', 'B', 7]])
    const unweighted = { ...weighted, weighted: false }
    expect(toEdgeList(unweighted)).toEqual([{ id: 'e1', source: 'A', target: 'B' }])
  })
})

describe('consistency between representations', () => {
  it('matrix non-null cells equal total adjacency-list entries (no parallel edges)', () => {
    for (const directed of [false, true]) {
      const g = build({ directed }, ['A', 'B', 'C', 'D'], [
        ['e1', 'A', 'B'],
        ['e2', 'B', 'C'],
        ['e3', 'C', 'A'],
        ['e4', 'C', 'D'],
      ])
      const filled = toAdjacencyMatrix(g).cells.flat().filter((c) => c !== null).length
      const listed = toAdjacencyList(g).reduce((sum, entry) => sum + entry.neighbors.length, 0)
      expect(filled).toBe(listed)
    }
  })
})
