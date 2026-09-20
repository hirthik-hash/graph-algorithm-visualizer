/**
 * Graph data model (Day 1).
 *
 * Design rules:
 *  - Every function is PURE and IMMUTABLE: it returns a new Graph and never
 *    mutates its input. Zustand (Day 3) will wrap these; components never own
 *    graph state.
 *  - Invalid operations THROW rather than silently doing nothing, so bugs
 *    surface in tests instead of as mysteriously-wrong visualizations.
 */

export const SCHEMA_VERSION = 1 as const

export interface GraphNode {
  id: string
  label?: string
  /** Optional layout coordinates. Present from day one so A* (Day 15) can use them. */
  x?: number
  y?: number
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  /** Required when graph.weighted is true; ignored otherwise. */
  weight?: number
}

export interface Graph {
  schemaVersion: typeof SCHEMA_VERSION
  directed: boolean
  weighted: boolean
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export function createGraph(
  options: { directed?: boolean; weighted?: boolean } = {},
): Graph {
  return {
    schemaVersion: SCHEMA_VERSION,
    directed: options.directed ?? false,
    weighted: options.weighted ?? false,
    nodes: [],
    edges: [],
  }
}

export function addNode(graph: Graph, node: GraphNode): Graph {
  if (graph.nodes.some((n) => n.id === node.id)) {
    throw new Error(`Duplicate node id: "${node.id}"`)
  }
  return { ...graph, nodes: [...graph.nodes, { ...node }] }
}

export function removeNode(graph: Graph, nodeId: string): Graph {
  if (!graph.nodes.some((n) => n.id === nodeId)) {
    throw new Error(`Node not found: "${nodeId}"`)
  }
  return {
    ...graph,
    nodes: graph.nodes.filter((n) => n.id !== nodeId),
    // Removing a node must also remove incident edges, or edges would
    // reference a node that no longer exists.
    edges: graph.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
  }
}

export function addEdge(graph: Graph, edge: GraphEdge): Graph {
  if (graph.edges.some((e) => e.id === edge.id)) {
    throw new Error(`Duplicate edge id: "${edge.id}"`)
  }
  for (const endpoint of [edge.source, edge.target]) {
    if (!graph.nodes.some((n) => n.id === endpoint)) {
      throw new Error(`Edge "${edge.id}" references missing node: "${endpoint}"`)
    }
  }
  if (graph.weighted && (edge.weight === undefined || Number.isNaN(edge.weight))) {
    throw new Error(`Edge "${edge.id}" needs a numeric weight in a weighted graph`)
  }
  return { ...graph, edges: [...graph.edges, { ...edge }] }
}

export function removeEdge(graph: Graph, edgeId: string): Graph {
  if (!graph.edges.some((e) => e.id === edgeId)) {
    throw new Error(`Edge not found: "${edgeId}"`)
  }
  return { ...graph, edges: graph.edges.filter((e) => e.id !== edgeId) }
}

// ---------------------------------------------------------------------------
// Day 2 additions: editing helpers used by the store/canvas
// ---------------------------------------------------------------------------

function requireNode(graph: Graph, nodeId: string): void {
  if (!graph.nodes.some((n) => n.id === nodeId)) {
    throw new Error(`Node not found: "${nodeId}"`)
  }
}

export function moveNode(graph: Graph, nodeId: string, x: number, y: number): Graph {
  requireNode(graph, nodeId)
  return {
    ...graph,
    nodes: graph.nodes.map((n) => (n.id === nodeId ? { ...n, x, y } : n)),
  }
}

/** Changes the DISPLAY label only. The id never changes, so edges stay valid. */
export function renameNode(graph: Graph, nodeId: string, label: string): Graph {
  requireNode(graph, nodeId)
  const trimmed = label.trim()
  return {
    ...graph,
    nodes: graph.nodes.map((n) =>
      n.id === nodeId ? { ...n, label: trimmed === '' ? undefined : trimmed } : n,
    ),
  }
}

export function setDirected(graph: Graph, directed: boolean): Graph {
  return { ...graph, directed }
}

/**
 * Turning weighted ON gives every edge that lacks a weight a default of 1, so
 * the invariant "weighted graph => every edge has a weight" always holds.
 * Turning it OFF keeps stored weights (they're just ignored), so toggling back
 * doesn't destroy the user's data.
 */
export function setWeighted(graph: Graph, weighted: boolean): Graph {
  if (!weighted) return { ...graph, weighted: false }
  return {
    ...graph,
    weighted: true,
    edges: graph.edges.map((e) =>
      e.weight === undefined || Number.isNaN(e.weight) ? { ...e, weight: 1 } : e,
    ),
  }
}

export function setEdgeWeight(graph: Graph, edgeId: string, weight: number): Graph {
  if (!Number.isFinite(weight)) {
    throw new Error('Edge weight must be a finite number')
  }
  if (!graph.edges.some((e) => e.id === edgeId)) {
    throw new Error(`Edge not found: "${edgeId}"`)
  }
  return {
    ...graph,
    edges: graph.edges.map((e) => (e.id === edgeId ? { ...e, weight } : e)),
  }
}

/** First unused node id: A..Z, then N26, N27, ... (gaps left by deletions are reused). */
export function nextNodeId(graph: Graph): string {
  const used = new Set(graph.nodes.map((n) => n.id))
  for (let i = 0; ; i++) {
    const candidate = i < 26 ? String.fromCharCode(65 + i) : `N${i}`
    if (!used.has(candidate)) return candidate
  }
}

/** First unused edge id: e1, e2, ... */
export function nextEdgeId(graph: Graph): string {
  const used = new Set(graph.edges.map((e) => e.id))
  for (let i = 1; ; i++) {
    const candidate = `e${i}`
    if (!used.has(candidate)) return candidate
  }
}

/**
 * Finds an existing edge joining a -> b. In an undirected graph b -> a counts
 * too. The UI uses this to refuse duplicate edges.
 */
export function findEdgeBetween(graph: Graph, a: string, b: string): GraphEdge | undefined {
  return graph.edges.find(
    (e) =>
      (e.source === a && e.target === b) ||
      (!graph.directed && e.source === b && e.target === a),
  )
}
