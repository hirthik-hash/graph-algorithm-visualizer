/**
 * Zustand store (Day 2; undo/redo added Day 21).
 *
 * A THIN wrapper around the pure functions in model/graph.ts. The store owns
 * the single copy of the graph; components read it through selectors and never
 * keep their own copy. Model errors are caught here and surfaced as `notice`
 * so the UI can show a message instead of crashing.
 *
 * UNDO/REDO DESIGN: rather than recording and inverting individual actions,
 * `history` holds whole past Graph snapshots and `future` holds snapshots
 * available for redo. Graphs are plain immutable data, so this is simple and
 * can never drift out of sync with "what really happened" the way replaying
 * inverse operations could. The trade-off is memory for large graphs over a
 * very long editing session, which is why history is capped (MAX_HISTORY).
 *
 * Every action that changes the graph is responsible for calling
 * `recordHistory()` itself, and — this is the important rule — only AFTER
 * confirming the change will actually happen (computing the new graph, or
 * otherwise validating, before recording). An action that fails or is a no-op
 * (an invalid weight, clicking a node to just start a connection, a blocked
 * duplicate edge) must never push a phantom entry that undoes to an identical
 * graph. The one exception is `moveNode`, which is called continuously while
 * dragging (every pointermove) — recording history on every call would turn
 * one drag into dozens of undo steps. Instead, the caller (GraphCanvas)
 * records history ONCE, when a drag is first detected, via the exposed
 * `recordHistory` action, and every following moveNode call during that same
 * drag is history-free.
 */
import { create } from 'zustand'
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
  setDirected,
  setEdgeWeight,
  setWeighted,
} from '../model/graph'
import type { Graph, GraphEdge } from '../model/graph'

/** Oldest entries are dropped once history exceeds this, so a long session can't grow without bound. */
export const MAX_HISTORY = 50

interface GraphState {
  graph: Graph
  /** Source node of an in-progress "click node, then click another" connection. */
  connectFromId: string | null
  /** Weight given to edges created by clicking (only used when graph.weighted). */
  newEdgeWeight: number
  /** Last user-facing problem (duplicate edge, bad weight...). null when clear. */
  notice: string | null
  /** Past graph snapshots, oldest first; the last entry is what undo restores. */
  history: Graph[]
  /** Snapshots available for redo, next-to-restore first. Cleared by any new edit. */
  future: Graph[]

  addNodeAt: (x: number, y: number) => void
  moveNode: (id: string, x: number, y: number) => void
  removeNodeById: (id: string) => void
  renameNode: (id: string, label: string) => void
  clickNode: (id: string) => void
  cancelConnect: () => void
  removeEdgeById: (id: string) => void
  setEdgeWeight: (id: string, weight: number) => void
  setDirected: (directed: boolean) => void
  setWeighted: (weighted: boolean) => void
  setNewEdgeWeight: (weight: number) => void
  /** Swap in a whole new graph (e.g. from the generator, an import, or a share link). */
  replaceGraph: (graph: Graph) => void
  clearGraph: () => void
  dismissNotice: () => void
  /** Snapshots the CURRENT graph into history and clears the redo branch. Call before a graph-changing edit. */
  recordHistory: () => void
  undo: () => void
  redo: () => void
}

const nameOf = (graph: Graph, id: string): string =>
  graph.nodes.find((n) => n.id === id)?.label ?? id

export const useGraphStore = create<GraphState>()((set, get) => ({
  graph: createGraph(),
  connectFromId: null,
  newEdgeWeight: 1,
  notice: null,
  history: [],
  future: [],

  recordHistory: () => {
    const { graph, history } = get()
    const trimmed = history.length >= MAX_HISTORY ? history.slice(history.length - MAX_HISTORY + 1) : history
    set({ history: [...trimmed, graph], future: [] })
  },

  addNodeAt: (x, y) => {
    const { graph } = get()
    get().recordHistory()
    set({
      graph: addNode(graph, { id: nextNodeId(graph), x: Math.round(x), y: Math.round(y) }),
      connectFromId: null,
      notice: null,
    })
  },

  // No history here: called continuously while dragging. The caller
  // (GraphCanvas) records history once, at the start of a drag.
  moveNode: (id, x, y) => {
    set({ graph: moveNode(get().graph, id, Math.round(x), Math.round(y)) })
  },

  removeNodeById: (id) => {
    const { connectFromId, graph } = get()
    get().recordHistory()
    set({
      graph: removeNode(graph, id),
      connectFromId: connectFromId === id ? null : connectFromId,
      notice: null,
    })
  },

  renameNode: (id, label) => {
    get().recordHistory()
    set({ graph: renameNode(get().graph, id, label), notice: null })
  },

  clickNode: (id) => {
    const { connectFromId, graph, newEdgeWeight } = get()

    // First click: remember the source. Not a graph change, so no history.
    if (connectFromId === null) {
      set({ connectFromId: id, notice: null })
      return
    }
    // Clicking the source again cancels (no self-loops from the UI). No graph change.
    if (connectFromId === id) {
      set({ connectFromId: null })
      return
    }
    // Refuse duplicates. Parallel edges can still exist in the model
    // (import/generator), the UI just doesn't create them by accident.
    // Blocked, so no graph change and no history entry.
    if (findEdgeBetween(graph, connectFromId, id)) {
      set({
        connectFromId: null,
        notice: `An edge between ${nameOf(graph, connectFromId)} and ${nameOf(graph, id)} already exists.`,
      })
      return
    }

    const edge: GraphEdge = {
      id: nextEdgeId(graph),
      source: connectFromId,
      target: id,
      ...(graph.weighted ? { weight: newEdgeWeight } : {}),
    }
    const nextGraph = addEdge(graph, edge) // validate/compute first
    get().recordHistory() // only now that we know the edge is really being added
    set({ graph: nextGraph, connectFromId: null, notice: null })
  },

  cancelConnect: () => set({ connectFromId: null }),

  removeEdgeById: (id) => {
    const nextGraph = removeEdge(get().graph, id)
    get().recordHistory()
    set({ graph: nextGraph, notice: null })
  },

  setEdgeWeight: (id, weight) => {
    try {
      const nextGraph = setEdgeWeight(get().graph, id, weight) // throws before any history is touched
      get().recordHistory()
      set({ graph: nextGraph, notice: null })
    } catch (err) {
      set({ notice: err instanceof Error ? err.message : 'Invalid weight' })
    }
  },

  setDirected: (directed) => {
    get().recordHistory()
    set({ graph: setDirected(get().graph, directed), notice: null })
  },

  setWeighted: (weighted) => {
    get().recordHistory()
    set({ graph: setWeighted(get().graph, weighted), notice: null })
  },

  setNewEdgeWeight: (weight) => {
    if (Number.isFinite(weight)) set({ newEdgeWeight: weight })
  },

  replaceGraph: (graph) => {
    get().recordHistory()
    set({ graph, connectFromId: null, notice: null })
  },

  // Keeps the directed/weighted settings: "clear" means "remove the drawing,"
  // not "forget how I configured the graph." History and future are left
  // alone — clearing is itself one more undoable edit, not a history reset.
  clearGraph: () => {
    const { graph } = get()
    get().recordHistory()
    set({
      graph: createGraph({ directed: graph.directed, weighted: graph.weighted }),
      connectFromId: null,
      notice: null,
    })
  },

  dismissNotice: () => set({ notice: null }),

  undo: () => {
    const { history, future, graph } = get()
    if (history.length === 0) return
    const previous = history[history.length - 1]
    set({
      graph: previous,
      history: history.slice(0, -1),
      future: [graph, ...future],
      connectFromId: null,
      notice: null,
    })
  },

  redo: () => {
    const { history, future, graph } = get()
    if (future.length === 0) return
    const next = future[0]
    set({
      graph: next,
      history: [...history, graph],
      future: future.slice(1),
      connectFromId: null,
      notice: null,
    })
  },
}))
