import { describe, expect, it } from 'vitest'
import { addEdge, addNode, createGraph } from './graph'
import type { Graph } from './graph'
import {
  analyzeGraph,
  bipartiteColoring,
  computeDegrees,
  connectedComponents,
  findCycle,
} from './analyzer'

/** Builds a graph from node ids and [source, target] pairs; edge ids are e1, e2, ... */
function build(
  options: { directed?: boolean },
  nodeIds: string[],
  pairs: [string, string][],
): Graph {
  let g = createGraph(options)
  for (const id of nodeIds) g = addNode(g, { id })
  pairs.forEach(([source, target], i) => {
    g = addEdge(g, { id: `e${i + 1}`, source, target })
  })
  return g
}

const sorted = (xs: string[] | null) => (xs === null ? null : [...xs].sort())

describe('computeDegrees', () => {
  it('counts undirected degree, with a self-loop contributing 2', () => {
    const g = build({}, ['A', 'B', 'C'], [
      ['A', 'B'],
      ['A', 'A'],
    ])
    expect(computeDegrees(g)).toEqual([
      { nodeId: 'A', degree: 3 }, // A-B plus a self-loop (2)
      { nodeId: 'B', degree: 1 },
      { nodeId: 'C', degree: 0 },
    ])
  })

  it('reports in-, out- and total degree for directed graphs', () => {
    const g = build({ directed: true }, ['A', 'B', 'C'], [
      ['A', 'B'],
      ['A', 'C'],
      ['C', 'B'],
    ])
    expect(computeDegrees(g)).toEqual([
      { nodeId: 'A', degree: 2, inDegree: 0, outDegree: 2 },
      { nodeId: 'B', degree: 2, inDegree: 2, outDegree: 0 },
      { nodeId: 'C', degree: 2, inDegree: 1, outDegree: 1 },
    ])
  })
})

describe('connectedComponents', () => {
  it('finds components in node order and treats an isolated node as its own', () => {
    const g = build({}, ['A', 'B', 'C', 'D', 'E'], [
      ['A', 'B'],
      ['C', 'D'],
    ])
    expect(connectedComponents(g)).toEqual([['A', 'B'], ['C', 'D'], ['E']])
  })

  it('uses weak connectivity for directed graphs (direction ignored)', () => {
    const g = build({ directed: true }, ['A', 'B', 'C'], [
      ['A', 'B'],
      ['C', 'B'],
    ])
    expect(connectedComponents(g)).toEqual([['A', 'B', 'C']])
  })
})

describe('findCycle: undirected', () => {
  it('finds no cycle in a tree, including a simple path (the parent edge is not a cycle)', () => {
    const path = build({}, ['A', 'B', 'C'], [
      ['A', 'B'],
      ['B', 'C'],
    ])
    expect(findCycle(path)).toBeNull()
  })

  it('finds a triangle and returns its three nodes', () => {
    const g = build({}, ['A', 'B', 'C', 'D'], [
      ['A', 'B'],
      ['B', 'C'],
      ['C', 'A'],
      ['C', 'D'],
    ])
    expect(sorted(findCycle(g))).toEqual(['A', 'B', 'C'])
  })

  it('treats parallel edges as a 2-cycle (parent is tracked by edge, not by node)', () => {
    const g = build({}, ['A', 'B'], [
      ['A', 'B'],
      ['A', 'B'],
    ])
    expect(sorted(findCycle(g))).toEqual(['A', 'B'])
  })

  it('treats a self-loop as a cycle of length 1', () => {
    const g = build({}, ['A', 'B'], [['B', 'B']])
    expect(findCycle(g)).toEqual(['B'])
  })

  it('finds a cycle that lives in a later component', () => {
    const g = build({}, ['A', 'B', 'C', 'D', 'E'], [
      ['A', 'B'],
      ['C', 'D'],
      ['D', 'E'],
      ['E', 'C'],
    ])
    expect(sorted(findCycle(g))).toEqual(['C', 'D', 'E'])
  })
})

describe('findCycle: directed', () => {
  it('finds no cycle in a chain', () => {
    const g = build({ directed: true }, ['A', 'B', 'C'], [
      ['A', 'B'],
      ['B', 'C'],
    ])
    expect(findCycle(g)).toBeNull()
  })

  it('finds A -> B -> C -> A', () => {
    const g = build({ directed: true }, ['A', 'B', 'C'], [
      ['A', 'B'],
      ['B', 'C'],
      ['C', 'A'],
    ])
    expect(findCycle(g)).toEqual(['A', 'B', 'C'])
  })

  it('does NOT flag a diamond (two paths to the same node is not a cycle)', () => {
    const g = build({ directed: true }, ['A', 'B', 'C', 'D'], [
      ['A', 'B'],
      ['A', 'C'],
      ['B', 'D'],
      ['C', 'D'],
    ])
    expect(findCycle(g)).toBeNull()
  })

  it('finds a self-loop and a 2-cycle A <-> B', () => {
    expect(findCycle(build({ directed: true }, ['A'], [['A', 'A']]))).toEqual(['A'])
    const two = build({ directed: true }, ['A', 'B'], [
      ['A', 'B'],
      ['B', 'A'],
    ])
    expect(sorted(findCycle(two))).toEqual(['A', 'B'])
  })

  it('returns only the cycle, not the path leading into it', () => {
    const g = build({ directed: true }, ['S', 'A', 'B'], [
      ['S', 'A'],
      ['A', 'B'],
      ['B', 'A'],
    ])
    expect(sorted(findCycle(g))).toEqual(['A', 'B'])
  })
})

describe('bipartiteColoring', () => {
  const validColoring = (g: Graph, c: Record<string, 0 | 1> | null) =>
    c !== null && g.edges.every((e) => c[e.source] !== c[e.target])

  it('2-colours an even cycle so every edge joins different colours', () => {
    const g = build({}, ['A', 'B', 'C', 'D'], [
      ['A', 'B'],
      ['B', 'C'],
      ['C', 'D'],
      ['D', 'A'],
    ])
    expect(validColoring(g, bipartiteColoring(g))).toBe(true)
  })

  it('rejects an odd cycle and a self-loop', () => {
    const triangle = build({}, ['A', 'B', 'C'], [
      ['A', 'B'],
      ['B', 'C'],
      ['C', 'A'],
    ])
    expect(bipartiteColoring(triangle)).toBeNull()
    expect(bipartiteColoring(build({}, ['A'], [['A', 'A']]))).toBeNull()
  })

  it('colours every component of a disconnected graph', () => {
    const g = build({}, ['A', 'B', 'C', 'D', 'E'], [
      ['A', 'B'],
      ['C', 'D'],
    ])
    const c = bipartiteColoring(g)
    expect(validColoring(g, c)).toBe(true)
    expect(Object.keys(c!).sort()).toEqual(['A', 'B', 'C', 'D', 'E']) // includes isolated E
  })

  it('ignores edge direction', () => {
    const cycle3 = build({ directed: true }, ['A', 'B', 'C'], [
      ['A', 'B'],
      ['B', 'C'],
      ['C', 'A'],
    ])
    expect(bipartiteColoring(cycle3)).toBeNull()
    const diamond = build({ directed: true }, ['A', 'B', 'C', 'D'], [
      ['A', 'B'],
      ['A', 'C'],
      ['B', 'D'],
      ['C', 'D'],
    ])
    expect(validColoring(diamond, bipartiteColoring(diamond))).toBe(true)
  })
})

describe('analyzeGraph', () => {
  it('summarises a directed acyclic graph', () => {
    const g = build({ directed: true }, ['A', 'B', 'C', 'D'], [
      ['A', 'B'],
      ['A', 'C'],
      ['B', 'D'],
      ['C', 'D'],
    ])
    const a = analyzeGraph(g)
    expect(a).toMatchObject({
      nodeCount: 4,
      edgeCount: 4,
      isConnected: true,
      hasCycle: false,
      cycle: null,
      isDag: true,
      isBipartite: true,
    })
    expect(a.components).toEqual([['A', 'B', 'C', 'D']])
  })

  it('reports isDag as null (not applicable) for undirected graphs, and false for a directed cycle', () => {
    expect(analyzeGraph(build({}, ['A', 'B'], [['A', 'B']])).isDag).toBeNull()
    const cyc = build({ directed: true }, ['A', 'B'], [
      ['A', 'B'],
      ['B', 'A'],
    ])
    expect(analyzeGraph(cyc)).toMatchObject({ isDag: false, hasCycle: true })
  })

  it('handles the empty graph', () => {
    expect(analyzeGraph(createGraph())).toMatchObject({
      nodeCount: 0,
      edgeCount: 0,
      degrees: [],
      components: [],
      isConnected: true,
      hasCycle: false,
      isBipartite: true,
    })
  })
})
