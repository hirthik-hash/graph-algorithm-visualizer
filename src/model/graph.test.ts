import { describe, expect, it } from 'vitest'
import {
  addEdge,
  addNode,
  createGraph,
  findEdgeBetween,
  moveNode,
  nextEdgeId,
  nextNodeId,
  removeEdge,
  removeNode,
  renameNode,
  SCHEMA_VERSION,
  setDirected,
  setEdgeWeight,
  setWeighted,
} from './graph'
import type { Graph } from './graph'

describe('graph model', () => {
  it('creates an empty undirected, unweighted graph with schemaVersion 1', () => {
    const g = createGraph()
    expect(g.schemaVersion).toBe(SCHEMA_VERSION)
    expect(g.schemaVersion).toBe(1)
    expect(g.directed).toBe(false)
    expect(g.weighted).toBe(false)
    expect(g.nodes).toEqual([])
    expect(g.edges).toEqual([])
  })

  it('adds nodes immutably and keeps optional x/y coordinates', () => {
    const g0 = createGraph()
    const g1 = addNode(g0, { id: 'A', x: 10, y: 20 })
    expect(g0.nodes).toHaveLength(0) // original untouched
    expect(g1.nodes).toEqual([{ id: 'A', x: 10, y: 20 }])
  })

  it('rejects duplicate node ids', () => {
    const g = addNode(createGraph(), { id: 'A' })
    expect(() => addNode(g, { id: 'A' })).toThrow(/duplicate node/i)
  })

  it('rejects edges that reference nonexistent nodes', () => {
    const g = addNode(createGraph(), { id: 'A' })
    expect(() => addEdge(g, { id: 'e1', source: 'A', target: 'Z' })).toThrow(
      /missing node/i,
    )
  })

  it('requires a weight on every edge in a weighted graph', () => {
    let g = createGraph({ weighted: true })
    g = addNode(addNode(g, { id: 'A' }), { id: 'B' })
    expect(() => addEdge(g, { id: 'e1', source: 'A', target: 'B' })).toThrow(
      /weight/i,
    )
    const ok = addEdge(g, { id: 'e1', source: 'A', target: 'B', weight: 4 })
    expect(ok.edges[0].weight).toBe(4)
  })

  it('removing a node also removes its incident edges', () => {
    let g = createGraph()
    g = ['A', 'B', 'C'].reduce((acc, id) => addNode(acc, { id }), g)
    g = addEdge(g, { id: 'e1', source: 'A', target: 'B' })
    g = addEdge(g, { id: 'e2', source: 'B', target: 'C' })
    const after = removeNode(g, 'B')
    expect(after.nodes.map((n) => n.id)).toEqual(['A', 'C'])
    expect(after.edges).toEqual([])
  })

  it('removes an edge by id and throws if it does not exist', () => {
    let g = addNode(addNode(createGraph(), { id: 'A' }), { id: 'B' })
    g = addEdge(g, { id: 'e1', source: 'A', target: 'B' })
    expect(removeEdge(g, 'e1').edges).toHaveLength(0)
    expect(() => removeEdge(g, 'nope')).toThrow(/not found/i)
  })
})

function abGraph(options: { directed?: boolean; weighted?: boolean } = {}): Graph {
  let g = createGraph(options)
  g = addNode(addNode(g, { id: 'A', x: 0, y: 0 }), { id: 'B', x: 50, y: 50 })
  return g
}

describe('graph editing helpers', () => {
  it('moveNode updates coordinates immutably and throws for unknown nodes', () => {
    const g = abGraph()
    const moved = moveNode(g, 'A', 100, 200)
    expect(moved.nodes[0]).toMatchObject({ id: 'A', x: 100, y: 200 })
    expect(g.nodes[0]).toMatchObject({ x: 0, y: 0 })
    expect(() => moveNode(g, 'Z', 1, 1)).toThrow(/not found/i)
  })

  it('renameNode changes only the label; empty label clears it', () => {
    const g = renameNode(abGraph(), 'A', '  Start  ')
    expect(g.nodes[0]).toMatchObject({ id: 'A', label: 'Start' })
    expect(renameNode(g, 'A', '   ').nodes[0].label).toBeUndefined()
  })

  it('setDirected flips the flag without touching edges', () => {
    const g = addEdge(abGraph(), { id: 'e1', source: 'A', target: 'B' })
    const d = setDirected(g, true)
    expect(d.directed).toBe(true)
    expect(d.edges).toEqual(g.edges)
  })

  it('setWeighted(true) gives unweighted edges a default weight of 1 and keeps existing ones', () => {
    let g = abGraph()
    g = addNode(g, { id: 'C' })
    g = addEdge(g, { id: 'e1', source: 'A', target: 'B' })
    g = addEdge(g, { id: 'e2', source: 'B', target: 'C', weight: 7 })
    const w = setWeighted(g, true)
    expect(w.weighted).toBe(true)
    expect(w.edges.map((e) => e.weight)).toEqual([1, 7])
  })

  it('setWeighted(false) keeps stored weights so toggling back loses nothing', () => {
    const g = addEdge(abGraph({ weighted: true }), {
      id: 'e1',
      source: 'A',
      target: 'B',
      weight: 5,
    })
    const off = setWeighted(g, false)
    expect(off.weighted).toBe(false)
    expect(setWeighted(off, true).edges[0].weight).toBe(5)
  })

  it('setEdgeWeight updates a weight and rejects non-finite values', () => {
    const g = addEdge(abGraph({ weighted: true }), {
      id: 'e1',
      source: 'A',
      target: 'B',
      weight: 1,
    })
    expect(setEdgeWeight(g, 'e1', -3).edges[0].weight).toBe(-3) // negatives are legal (Bellman-Ford)
    expect(() => setEdgeWeight(g, 'e1', NaN)).toThrow(/finite/i)
    expect(() => setEdgeWeight(g, 'nope', 1)).toThrow(/not found/i)
  })

  it('nextNodeId hands out A, B, ..., reuses gaps, and continues as N26 after Z', () => {
    expect(nextNodeId(createGraph())).toBe('A')
    let g = abGraph() // A, B
    expect(nextNodeId(g)).toBe('C')
    g = removeNode(g, 'A')
    expect(nextNodeId(g)).toBe('A')
    let full = createGraph()
    for (let i = 0; i < 26; i++) full = addNode(full, { id: String.fromCharCode(65 + i) })
    expect(nextNodeId(full)).toBe('N26')
  })

  it('nextEdgeId and findEdgeBetween respect direction', () => {
    const undirected = addEdge(abGraph(), { id: 'e1', source: 'A', target: 'B' })
    expect(nextEdgeId(undirected)).toBe('e2')
    expect(findEdgeBetween(undirected, 'B', 'A')?.id).toBe('e1') // undirected: either way

    const directed = addEdge(abGraph({ directed: true }), { id: 'e1', source: 'A', target: 'B' })
    expect(findEdgeBetween(directed, 'A', 'B')?.id).toBe('e1')
    expect(findEdgeBetween(directed, 'B', 'A')).toBeUndefined() // directed: B->A is a different edge
  })
})
