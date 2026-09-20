import { describe, expect, it } from 'vitest'
import {
  addEdge,
  addNode,
  createGraph,
  removeEdge,
  removeNode,
  SCHEMA_VERSION,
} from './graph'

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
