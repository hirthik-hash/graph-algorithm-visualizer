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
