import { beforeEach, describe, expect, it } from 'vitest'
import { createGraph } from '../model/graph'
import { useGraphStore } from './graphStore'

const s = () => useGraphStore.getState()

beforeEach(() => {
  useGraphStore.setState({
    graph: createGraph(),
    connectFromId: null,
    newEdgeWeight: 1,
    notice: null,
  })
})

function threeNodes() {
  s().addNodeAt(10, 10)
  s().addNodeAt(100, 10)
  s().addNodeAt(200, 10)
}

describe('graph store', () => {
  it('addNodeAt creates nodes with sequential ids at the given coordinates', () => {
    s().addNodeAt(10.4, 20.6)
    s().addNodeAt(50, 60)
    expect(s().graph.nodes).toEqual([
      { id: 'A', x: 10, y: 21 },
      { id: 'B', x: 50, y: 60 },
    ])
  })

  it('clicking two different nodes creates an edge and clears the selection', () => {
    threeNodes()
    s().clickNode('A')
    expect(s().connectFromId).toBe('A')
    s().clickNode('B')
    expect(s().graph.edges).toEqual([{ id: 'e1', source: 'A', target: 'B' }])
    expect(s().connectFromId).toBeNull()
  })

  it('clicking the same node twice cancels without creating a self-loop', () => {
    threeNodes()
    s().clickNode('A')
    s().clickNode('A')
    expect(s().connectFromId).toBeNull()
    expect(s().graph.edges).toHaveLength(0)
  })

  it('blocks duplicate edges (either direction when undirected) but allows the reverse when directed', () => {
    threeNodes()
    s().clickNode('A')
    s().clickNode('B')
    s().clickNode('B')
    s().clickNode('A') // reverse of an undirected edge = duplicate
    expect(s().graph.edges).toHaveLength(1)
    expect(s().notice).toMatch(/already exists/i)

    s().clearGraph()
    threeNodes()
    s().setDirected(true)
    s().clickNode('A')
    s().clickNode('B')
    s().clickNode('B')
    s().clickNode('A') // directed: B -> A is a different edge
    expect(s().graph.edges.map((e) => `${e.source}${e.target}`)).toEqual(['AB', 'BA'])
  })

  it('uses newEdgeWeight for new edges only when the graph is weighted', () => {
    threeNodes()
    s().setNewEdgeWeight(9)
    s().clickNode('A')
    s().clickNode('B')
    expect(s().graph.edges[0].weight).toBeUndefined()

    s().setWeighted(true) // existing edge gets default weight 1
    expect(s().graph.edges[0].weight).toBe(1)
    s().clickNode('B')
    s().clickNode('C')
    expect(s().graph.edges[1].weight).toBe(9)
  })

  it('removing a node removes its edges and clears it as a pending source', () => {
    threeNodes()
    s().clickNode('A')
    s().clickNode('B')
    s().clickNode('B') // B is now the pending source
    s().removeNodeById('B')
    expect(s().graph.nodes.map((n) => n.id)).toEqual(['A', 'C'])
    expect(s().graph.edges).toHaveLength(0)
    expect(s().connectFromId).toBeNull()
  })

  it('moveNode, renameNode and setEdgeWeight go through the model', () => {
    threeNodes()
    s().setWeighted(true)
    s().clickNode('A')
    s().clickNode('B')
    s().moveNode('A', 300, 40)
    s().renameNode('A', 'Start')
    s().setEdgeWeight('e1', 12)
    expect(s().graph.nodes[0]).toMatchObject({ id: 'A', label: 'Start', x: 300, y: 40 })
    expect(s().graph.edges[0].weight).toBe(12)
  })

  it('an invalid weight becomes a notice instead of throwing', () => {
    threeNodes()
    s().setWeighted(true)
    s().clickNode('A')
    s().clickNode('B')
    s().setEdgeWeight('e1', NaN)
    expect(s().notice).toMatch(/finite/i)
    expect(s().graph.edges[0].weight).toBe(1)
    s().dismissNotice()
    expect(s().notice).toBeNull()
  })

  it('clearGraph empties the drawing but keeps the directed/weighted settings', () => {
    threeNodes()
    s().setDirected(true)
    s().setWeighted(true)
    s().clearGraph()
    expect(s().graph.nodes).toHaveLength(0)
    expect(s().graph.directed).toBe(true)
    expect(s().graph.weighted).toBe(true)
  })
})
