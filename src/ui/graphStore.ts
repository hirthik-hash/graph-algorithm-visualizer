/**
 * Zustand store (Day 2).
 *
 * A THIN wrapper around the pure functions in model/graph.ts. The store owns
 * the single copy of the graph; components read it through selectors and never
 * keep their own copy. Model errors are caught here and surfaced as `notice`
 * so the UI can show a message instead of crashing.
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

interface GraphState {
  graph: Graph
  /** Source node of an in-progress "click node, then click another" connection. */
  connectFromId: string | null
  /** Weight given to edges created by clicking (only used when graph.weighted). */
  newEdgeWeight: number
  /** Last user-facing problem (duplicate edge, bad weight...). null when clear. */
  notice: string | null

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
  clearGraph: () => void
  dismissNotice: () => void
}

const nameOf = (graph: Graph, id: string): string =>
  graph.nodes.find((n) => n.id === id)?.label ?? id

export const useGraphStore = create<GraphState>()((set, get) => ({
  graph: createGraph(),
  connectFromId: null,
  newEdgeWeight: 1,
  notice: null,

  addNodeAt: (x, y) => {
    const { graph } = get()
    set({
      graph: addNode(graph, { id: nextNodeId(graph), x: Math.round(x), y: Math.round(y) }),
      connectFromId: null,
      notice: null,
    })
  },

  moveNode: (id, x, y) => {
    set({ graph: moveNode(get().graph, id, Math.round(x), Math.round(y)) })
  },

  removeNodeById: (id) => {
    const { connectFromId, graph } = get()
    set({
      graph: removeNode(graph, id),
      connectFromId: connectFromId === id ? null : connectFromId,
      notice: null,
    })
  },

  renameNode: (id, label) => {
    set({ graph: renameNode(get().graph, id, label), notice: null })
  },

  clickNode: (id) => {
    const { connectFromId, graph, newEdgeWeight } = get()

    // First click: remember the source.
    if (connectFromId === null) {
      set({ connectFromId: id, notice: null })
      return
    }
    // Clicking the source again cancels (no self-loops from the UI).
    if (connectFromId === id) {
      set({ connectFromId: null })
      return
    }
    // Refuse duplicates. Parallel edges can still exist in the model
    // (import/generator), the UI just doesn't create them by accident.
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
    set({ graph: addEdge(graph, edge), connectFromId: null, notice: null })
  },

  cancelConnect: () => set({ connectFromId: null }),

  removeEdgeById: (id) => {
    set({ graph: removeEdge(get().graph, id), notice: null })
  },

  setEdgeWeight: (id, weight) => {
    try {
      set({ graph: setEdgeWeight(get().graph, id, weight), notice: null })
    } catch (err) {
      set({ notice: err instanceof Error ? err.message : 'Invalid weight' })
    }
  },

  setDirected: (directed) => set({ graph: setDirected(get().graph, directed), notice: null }),

  setWeighted: (weighted) => set({ graph: setWeighted(get().graph, weighted), notice: null }),

  setNewEdgeWeight: (weight) => {
    if (Number.isFinite(weight)) set({ newEdgeWeight: weight })
  },

  // Keeps the directed/weighted settings: "clear" means "remove the drawing",
  // not "forget how I configured the graph".
  clearGraph: () => {
    const { graph } = get()
    set({
      graph: createGraph({ directed: graph.directed, weighted: graph.weighted }),
      connectFromId: null,
      notice: null,
    })
  },

  dismissNotice: () => set({ notice: null }),
}))
