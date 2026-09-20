/**
 * Graph Analyzer (Day 4).
 *
 * Pure functions that answer structural questions about a graph. Like the
 * representations, results are computed on demand and never stored.
 *
 * Conventions (worth knowing when reading results):
 *  - Degree: an undirected self-loop counts 2 (both ends touch the node).
 *  - Connected components on a DIRECTED graph are WEAK components (direction
 *    ignored). Strongly connected components (Kosaraju/Tarjan) are a v2 item.
 *  - Bipartiteness is a property of the underlying undirected graph, so
 *    direction is ignored there too.
 *  - Recursion is used for DFS. Depth equals the longest simple path, which is
 *    fine for editor-sized graphs; revisit if the Performance Lab ever needs 10k+ nodes.
 */
import type { Graph } from './graph'
import { toAdjacencyList } from './representations'

// ---------------------------------------------------------------------------
// Degrees
// ---------------------------------------------------------------------------

export interface DegreeInfo {
  nodeId: string
  /** Undirected: number of edge-ends at the node. Directed: inDegree + outDegree. */
  degree: number
  /** Directed graphs only. */
  inDegree?: number
  outDegree?: number
}

export function computeDegrees(graph: Graph): DegreeInfo[] {
  const inn = new Map(graph.nodes.map((n) => [n.id, 0]))
  const out = new Map(graph.nodes.map((n) => [n.id, 0]))
  const und = new Map(graph.nodes.map((n) => [n.id, 0]))

  for (const e of graph.edges) {
    if (graph.directed) {
      out.set(e.source, (out.get(e.source) ?? 0) + 1)
      inn.set(e.target, (inn.get(e.target) ?? 0) + 1)
    } else {
      und.set(e.source, (und.get(e.source) ?? 0) + 1)
      und.set(e.target, (und.get(e.target) ?? 0) + 1) // self-loop: same node twice => +2
    }
  }

  return graph.nodes.map((n) => {
    if (!graph.directed) return { nodeId: n.id, degree: und.get(n.id) ?? 0 }
    const i = inn.get(n.id) ?? 0
    const o = out.get(n.id) ?? 0
    return { nodeId: n.id, degree: i + o, inDegree: i, outDegree: o }
  })
}

// ---------------------------------------------------------------------------
// Connected components
// ---------------------------------------------------------------------------

/** Direction-ignoring neighbour map. A self-loop lists the node once. */
function undirectedNeighbors(graph: Graph): Map<string, string[]> {
  const map = new Map<string, string[]>(graph.nodes.map((n) => [n.id, []]))
  for (const e of graph.edges) {
    map.get(e.source)?.push(e.target)
    if (e.source !== e.target) map.get(e.target)?.push(e.source)
  }
  return map
}

/**
 * Components ordered by their first node (in graph.nodes order); members are
 * also in graph.nodes order, so the output is stable and easy to read.
 */
export function connectedComponents(graph: Graph): string[][] {
  const adj = undirectedNeighbors(graph)
  const order = new Map(graph.nodes.map((n, i) => [n.id, i]))
  const seen = new Set<string>()
  const components: string[][] = []

  for (const start of graph.nodes) {
    if (seen.has(start.id)) continue
    const members: string[] = []
    const stack = [start.id]
    seen.add(start.id)
    while (stack.length > 0) {
      const u = stack.pop()!
      members.push(u)
      for (const v of adj.get(u) ?? []) {
        if (!seen.has(v)) {
          seen.add(v)
          stack.push(v)
        }
      }
    }
    members.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
    components.push(members)
  }
  return components
}

// ---------------------------------------------------------------------------
// Cycle detection
// ---------------------------------------------------------------------------

/**
 * Returns the node ids of ONE cycle (in order, first node not repeated at the
 * end), or null if the graph is acyclic. A self-loop is a cycle of length 1.
 */
export function findCycle(graph: Graph): string[] | null {
  return graph.directed ? findDirectedCycle(graph) : findUndirectedCycle(graph)
}

/**
 * Directed: three-colour DFS. Absent from `state` = white (unseen), 'gray' =
 * on the current DFS path, 'black' = fully explored. A cycle exists exactly
 * when we meet a GRAY node again (a back edge). Meeting a BLACK node is fine:
 * that is just two paths reaching the same node (a diamond), not a cycle.
 * A plain "visited" set can't tell those two cases apart.
 */
function findDirectedCycle(graph: Graph): string[] | null {
  const out = new Map(
    toAdjacencyList(graph).map((entry) => [entry.nodeId, entry.neighbors.map((nb) => nb.nodeId)]),
  )
  const state = new Map<string, 'gray' | 'black'>()
  const path: string[] = []

  const visit = (u: string): string[] | null => {
    state.set(u, 'gray')
    path.push(u)
    for (const v of out.get(u) ?? []) {
      const s = state.get(v)
      if (s === 'gray') return path.slice(path.indexOf(v))
      if (s === undefined) {
        const found = visit(v)
        if (found) return found
      }
    }
    path.pop()
    state.set(u, 'black')
    return null
  }

  for (const n of graph.nodes) {
    if (state.get(n.id) === undefined) {
      const found = visit(n.id)
      if (found) return found
    }
  }
  return null
}

/**
 * Undirected: DFS that remembers the EDGE it arrived by. Reaching an
 * already-visited node through any OTHER edge closes a cycle.
 *
 * The parent is tracked by edge id, not by node id: two parallel edges between
 * A and B form a real 2-cycle, but "skip the parent node" would wrongly ignore
 * the second one.
 *
 * Why the visited neighbour is always on the current path: in an undirected
 * DFS every non-tree edge joins an ancestor and a descendant. The descendant
 * examines that edge first (while its ancestor is still on the path), so we
 * always find the cycle from the descendant's side.
 */
function findUndirectedCycle(graph: Graph): string[] | null {
  const adj = new Map(toAdjacencyList(graph).map((entry) => [entry.nodeId, entry.neighbors]))
  const visited = new Set<string>()
  const path: string[] = []

  const visit = (u: string, parentEdgeId: string | null): string[] | null => {
    visited.add(u)
    path.push(u)
    for (const { nodeId: v, edgeId } of adj.get(u) ?? []) {
      if (edgeId === parentEdgeId) continue
      if (visited.has(v)) return path.slice(path.indexOf(v))
      const found = visit(v, edgeId)
      if (found) return found
    }
    path.pop()
    return null
  }

  for (const n of graph.nodes) {
    if (!visited.has(n.id)) {
      const found = visit(n.id, null)
      if (found) return found
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Bipartite check (2-colouring)
// ---------------------------------------------------------------------------

/**
 * Self-contained BFS 2-colouring (deliberately independent of the general BFS
 * algorithm module, which arrives on Day 8). Returns a colour (0 or 1) for
 * every node, or null if the graph is not bipartite. A self-loop always makes
 * a graph non-bipartite (a node can't differ from itself).
 */
export function bipartiteColoring(graph: Graph): Record<string, 0 | 1> | null {
  const adj = undirectedNeighbors(graph)
  const color = new Map<string, 0 | 1>()

  for (const start of graph.nodes) {
    if (color.has(start.id)) continue
    color.set(start.id, 0)
    const queue = [start.id]
    for (let head = 0; head < queue.length; head++) {
      const u = queue[head]
      const cu = color.get(u)!
      const opposite: 0 | 1 = cu === 0 ? 1 : 0
      for (const v of adj.get(u) ?? []) {
        const cv = color.get(v)
        if (cv === undefined) {
          color.set(v, opposite)
          queue.push(v)
        } else if (cv === cu) {
          return null
        }
      }
    }
  }
  return Object.fromEntries(color)
}

// ---------------------------------------------------------------------------
// Everything at once
// ---------------------------------------------------------------------------

export interface GraphAnalysis {
  nodeCount: number
  edgeCount: number
  degrees: DegreeInfo[]
  components: string[][]
  /** An empty graph counts as connected (zero or one component). */
  isConnected: boolean
  hasCycle: boolean
  cycle: string[] | null
  /** null for undirected graphs: "DAG" only makes sense with direction. */
  isDag: boolean | null
  isBipartite: boolean
  coloring: Record<string, 0 | 1> | null
}

export function analyzeGraph(graph: Graph): GraphAnalysis {
  const components = connectedComponents(graph)
  const cycle = findCycle(graph)
  const coloring = bipartiteColoring(graph)
  return {
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    degrees: computeDegrees(graph),
    components,
    isConnected: components.length <= 1,
    hasCycle: cycle !== null,
    cycle,
    isDag: graph.directed ? cycle === null : null,
    isBipartite: coloring !== null,
    coloring,
  }
}
