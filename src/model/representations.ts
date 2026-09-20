/**
 * Derived representations (Day 3).
 *
 * These are COMPUTED from the graph every time, never stored or hand-edited.
 * There is exactly one source of truth (the Graph); anything else is a view of
 * it, so the matrix, list and edge list can never disagree with the canvas.
 */
import type { Graph, GraphEdge } from './graph'

// ---------------------------------------------------------------------------
// Adjacency matrix
// ---------------------------------------------------------------------------

export interface AdjacencyMatrix {
  /** Row/column order: same order as graph.nodes. */
  nodeIds: string[]
  /**
   * cells[i][j] is the edge value from nodeIds[i] to nodeIds[j], or null when
   * there is no edge. Unweighted edges are 1; weighted edges are their weight.
   * null (not 0) means "no edge" so a genuine weight of 0 stays distinguishable.
   */
  cells: (number | null)[][]
}

export function toAdjacencyMatrix(graph: Graph): AdjacencyMatrix {
  const nodeIds = graph.nodes.map((n) => n.id)
  const index = new Map(nodeIds.map((id, i) => [id, i]))
  const cells: (number | null)[][] = nodeIds.map(() => nodeIds.map(() => null))

  // With parallel edges a matrix cell can only hold one value. Keep the
  // CHEAPEST: that is the one every shortest-path algorithm would use, and it
  // must not depend on the order the edges happen to be stored in.
  const put = (i: number, j: number, value: number) => {
    const current = cells[i][j]
    cells[i][j] = current === null ? value : Math.min(current, value)
  }

  for (const edge of graph.edges) {
    const i = index.get(edge.source)
    const j = index.get(edge.target)
    if (i === undefined || j === undefined) continue // unreachable via the model
    const value = graph.weighted ? (edge.weight ?? 1) : 1
    put(i, j, value)
    if (!graph.directed && i !== j) put(j, i, value) // undirected => symmetric; a self-loop is one cell
  }

  return { nodeIds, cells }
}

// ---------------------------------------------------------------------------
// Adjacency list
// ---------------------------------------------------------------------------

export interface Neighbor {
  nodeId: string
  edgeId: string
  /** Present only when the graph is weighted. */
  weight?: number
}

export interface AdjacencyListEntry {
  nodeId: string
  neighbors: Neighbor[]
}

/**
 * One entry per node (isolated nodes get an empty list), in graph.nodes order.
 * Unlike the matrix, parallel edges are all kept: a list has room for them.
 */
export function toAdjacencyList(graph: Graph): AdjacencyListEntry[] {
  const lists = new Map<string, Neighbor[]>(graph.nodes.map((n) => [n.id, []]))

  const neighborFor = (edge: GraphEdge, nodeId: string): Neighbor =>
    graph.weighted
      ? { nodeId, edgeId: edge.id, weight: edge.weight ?? 1 }
      : { nodeId, edgeId: edge.id }

  for (const edge of graph.edges) {
    lists.get(edge.source)?.push(neighborFor(edge, edge.target))
    if (!graph.directed && edge.source !== edge.target) {
      lists.get(edge.target)?.push(neighborFor(edge, edge.source))
    }
  }

  return graph.nodes.map((n) => ({ nodeId: n.id, neighbors: lists.get(n.id) ?? [] }))
}

// ---------------------------------------------------------------------------
// Edge list
// ---------------------------------------------------------------------------

/**
 * Edges in insertion order. Returns copies (so callers can't mutate the graph)
 * and drops weights when the graph is unweighted: toggling "weighted" off keeps
 * the stored weights hidden in the model, and they shouldn't leak into a view
 * of an unweighted graph.
 */
export function toEdgeList(graph: Graph): GraphEdge[] {
  return graph.edges.map((e) =>
    graph.weighted
      ? { ...e }
      : { id: e.id, source: e.source, target: e.target },
  )
}
