import { beforeEach, describe, expect, it } from 'vitest'
import { createGraph } from '../model/graph'
import { MAX_HISTORY, useGraphStore } from './graphStore'

const s = () => useGraphStore.getState()

beforeEach(() => {
  useGraphStore.setState({
    graph: createGraph(),
    connectFromId: null,
    newEdgeWeight: 1,
    notice: null,
    history: [],
    future: [],
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

  it('replaceGraph swaps in a whole graph and clears any pending connection and notice', () => {
    threeNodes()
    s().clickNode('A') // pending source
    useGraphStore.setState({ notice: 'old message' })
    const replacement = { ...createGraph({ directed: true }), nodes: [{ id: 'Q' }] }
    s().replaceGraph(replacement)
    expect(s().graph).toBe(replacement)
    expect(s().connectFromId).toBeNull()
    expect(s().notice).toBeNull()
  })
})

describe('undo / redo', () => {
  it('undo reverses adding a node; redo brings it back', () => {
    s().addNodeAt(10, 10)
    expect(s().graph.nodes).toHaveLength(1)
    s().undo()
    expect(s().graph.nodes).toHaveLength(0)
    s().redo()
    expect(s().graph.nodes).toHaveLength(1)
    expect(s().graph.nodes[0].id).toBe('A')
  })

  it('undo reverses deleting a node (including its edges)', () => {
    threeNodes()
    s().clickNode('A')
    s().clickNode('B')
    const beforeDelete = s().graph
    s().removeNodeById('B')
    expect(s().graph.nodes).toHaveLength(2)
    s().undo()
    expect(s().graph).toEqual(beforeDelete)
    expect(s().graph.edges).toHaveLength(1)
  })

  it('undo reverses adding an edge, but NOT the first click that only starts a connection', () => {
    threeNodes() // 3 history entries, one per addNodeAt
    const beforeConnect = s().history.length
    s().clickNode('A') // just sets connectFromId — must not be undoable on its own
    expect(s().history.length).toBe(beforeConnect)
    s().clickNode('B') // this click actually adds the edge
    expect(s().graph.edges).toHaveLength(1)
    s().undo()
    expect(s().graph.edges).toHaveLength(0)
    expect(s().connectFromId).toBeNull()
  })

  it('does not record history for a blocked duplicate edge or a cancelled connection', () => {
    threeNodes() // 3 history entries, one per addNodeAt
    s().clickNode('A')
    s().clickNode('B') // creates e1 — +1 history entry
    const afterEdgeCreated = s().history.length
    s().clickNode('B') // connectFromId was reset to null, so this just starts a NEW pending connection from B — no entry
    s().clickNode('A') // B -> A is a duplicate of e1 (undirected), blocked — no entry
    expect(s().notice).toMatch(/already exists/i)
    s().clickNode('A') // starts a pending connection from A
    s().clickNode('A') // clicking the same pending source again cancels — no entry
    s().clickNode('B') // starts a pending connection from B (no second click to attempt a connect)
    expect(s().history.length).toBe(afterEdgeCreated) // nothing after the edge creation added a new entry
  })

  it('undo reverses removing an edge', () => {
    threeNodes()
    s().clickNode('A')
    s().clickNode('B')
    s().removeEdgeById('e1')
    expect(s().graph.edges).toHaveLength(0)
    s().undo()
    expect(s().graph.edges).toHaveLength(1)
  })

  it('undo reverses renaming a node', () => {
    threeNodes()
    s().renameNode('A', 'Start')
    expect(s().graph.nodes[0].label).toBe('Start')
    s().undo()
    expect(s().graph.nodes[0].label).toBeUndefined()
  })

  it('undo reverses an edge-weight edit, and an INVALID weight never enters history at all', () => {
    threeNodes()
    s().setWeighted(true)
    s().clickNode('A')
    s().clickNode('B')
    const historyBeforeWeightEdit = s().history.length
    s().setEdgeWeight('e1', 9)
    expect(s().graph.edges[0].weight).toBe(9)
    expect(s().history.length).toBe(historyBeforeWeightEdit + 1)

    s().setEdgeWeight('e1', NaN) // invalid: must not push a history entry
    expect(s().notice).toMatch(/finite/i)
    expect(s().history.length).toBe(historyBeforeWeightEdit + 1) // unchanged

    s().undo()
    expect(s().graph.edges[0].weight).toBe(1) // back to the default set by setWeighted(true)
  })

  it('undo reverses toggling directed/weighted', () => {
    threeNodes()
    s().setDirected(true)
    s().setWeighted(true)
    expect(s().graph).toMatchObject({ directed: true, weighted: true })
    s().undo()
    expect(s().graph.weighted).toBe(false)
    s().undo()
    expect(s().graph.directed).toBe(false)
  })

  it('undo reverses clearing the graph', () => {
    threeNodes()
    s().clickNode('A')
    s().clickNode('B')
    const before = s().graph
    s().clearGraph()
    expect(s().graph.nodes).toHaveLength(0)
    s().undo()
    expect(s().graph).toEqual(before)
  })

  it('undo reverses replaceGraph (import/generate/share-link load)', () => {
    threeNodes()
    const before = s().graph
    const replacement = { ...createGraph(), nodes: [{ id: 'Q' }], edges: [] }
    s().replaceGraph(replacement)
    expect(s().graph).toBe(replacement)
    s().undo()
    expect(s().graph).toEqual(before)
  })

  it('undo reverses a full drag gesture as ONE step, not one per moveNode call', () => {
    threeNodes() // 3 history entries already, one per addNodeAt
    const beforeDrag = s().history.length
    s().recordHistory() // what GraphCanvas does once, when a drag is first detected
    s().moveNode('A', 50, 50)
    s().moveNode('A', 60, 60)
    s().moveNode('A', 70, 70) // simulates many pointermove calls in one drag
    expect(s().graph.nodes[0]).toMatchObject({ x: 70, y: 70 })
    expect(s().history.length).toBe(beforeDrag + 1) // one entry for the whole gesture, not three
    s().undo()
    expect(s().graph.nodes[0]).toMatchObject({ x: 10, y: 10 }) // back to before the drag started
  })

  it('supports multiple sequential undo and redo in the correct order', () => {
    s().addNodeAt(10, 10) // A
    s().addNodeAt(100, 10) // B
    s().addNodeAt(200, 10) // C
    expect(s().graph.nodes).toHaveLength(3)

    s().undo()
    expect(s().graph.nodes).toHaveLength(2)
    s().undo()
    expect(s().graph.nodes).toHaveLength(1)
    s().undo()
    expect(s().graph.nodes).toHaveLength(0)

    s().redo()
    expect(s().graph.nodes).toHaveLength(1)
    s().redo()
    expect(s().graph.nodes).toHaveLength(2)
    s().redo()
    expect(s().graph.nodes).toHaveLength(3)
  })

  it('a new edit after undo clears the redo branch', () => {
    s().addNodeAt(10, 10) // A
    s().addNodeAt(100, 10) // B
    s().undo() // back to just A; "add B" is now redoable
    expect(s().future).toHaveLength(1)

    // A fresh edit. The freed id "B" is reused (same rule as Day 2's
    // nextNodeId), so this checks POSITION, not id, to prove it's a new node.
    s().addNodeAt(200, 20)
    expect(s().future).toHaveLength(0) // the old redo branch (the first "B" at x=100) is gone
    expect(s().graph.nodes.map((n) => n.id)).toEqual(['A', 'B'])
    expect(s().graph.nodes[1]).toMatchObject({ x: 200, y: 20 })
    s().redo() // nothing to redo anymore
    expect(s().graph.nodes[1]).toMatchObject({ x: 200, y: 20 })
  })

  it('undo with empty history and redo with empty future are both safe no-ops', () => {
    const graph = s().graph
    s().undo()
    expect(s().graph).toBe(graph)
    s().redo()
    expect(s().graph).toBe(graph)
  })

  it('undo and redo reset a pending connection and any notice', () => {
    threeNodes()
    s().clickNode('A')
    s().clickNode('B') // records history, connectFromId back to null
    s().clickNode('B') // start a new pending connection (no history)
    expect(s().connectFromId).toBe('B')
    s().undo()
    expect(s().connectFromId).toBeNull()

    useGraphStore.setState({ notice: 'stale message' })
    s().redo()
    expect(s().notice).toBeNull()
  })

  it('caps history at MAX_HISTORY, dropping the oldest entries first', () => {
    for (let i = 0; i < MAX_HISTORY + 10; i++) s().addNodeAt(i, i)
    expect(s().history.length).toBe(MAX_HISTORY)
    // The oldest surviving snapshot should be the empty graph is long gone;
    // undoing MAX_HISTORY times must not throw and must land on a real graph.
    for (let i = 0; i < MAX_HISTORY; i++) s().undo()
    expect(s().history).toHaveLength(0)
    expect(s().graph.nodes.length).toBeGreaterThan(0) // couldn't undo all the way back past the cap
  })
})
