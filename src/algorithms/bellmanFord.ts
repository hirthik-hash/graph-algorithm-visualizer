/**
 * Bellman-Ford (Day 8): single-source shortest paths that ALLOW negative
 * weights and DETECT negative cycles.
 *
 * Passes: up to (V - 1) passes over every edge, relaxing each one. If a whole
 * pass changes nothing the distances are final, so we stop early. Otherwise
 * one extra "check" pass looks for an edge that can STILL be relaxed; if there
 * is one, a negative cycle is reachable from the start node and we emit
 * negative_cycle_detected (this is the first algorithm to use that event).
 *
 * Undirected graphs: every undirected edge is treated as TWO directed edges
 * (same edge id). That makes any undirected edge with a negative weight a
 * negative 2-cycle (A -> B -> A), which is the correct answer.
 *
 * Only cycles REACHABLE from the start node are found; a negative cycle in an
 * unreachable part of the graph cannot affect distances from the start.
 */
import type { Algorithm } from '../engine/algorithm'
import type { AlgorithmEvent } from '../engine/events'

interface DirectedEdge {
  edgeId: string
  source: string
  target: string
  weight: number
}

export const bellmanFordAlgorithm: Algorithm = {
  id: 'bellman-ford',
  name: 'Bellman-Ford',
  category: 'shortest-path',
  requirements: { weighted: true, startNode: true },

  run(graph, options = {}) {
    const start = options.startNodeId
    if (start === undefined || !graph.nodes.some((n) => n.id === start)) {
      throw new Error(`Bellman-Ford needs a start node that exists in the graph (got ${String(start)})`)
    }

    const edges: DirectedEdge[] = []
    for (const e of graph.edges) {
      const weight = graph.weighted ? (e.weight ?? 1) : 1 // hidden weights on an unweighted graph are ignored
      edges.push({ edgeId: e.id, source: e.source, target: e.target, weight })
      if (!graph.directed && e.source !== e.target) {
        edges.push({ edgeId: e.id, source: e.target, target: e.source, weight })
      }
    }

    const events: AlgorithmEvent[] = []
    const dist = new Map<string, number>([[start, 0]])
    const previous = new Map<string, string | null>([[start, null]])
    events.push({ type: 'update_distance', nodeId: start, distance: 0, previousDistance: null })

    const examine = (edge: DirectedEdge) => {
      events.push({
        type: 'relax_edge',
        edgeId: edge.edgeId,
        source: edge.source,
        target: edge.target,
        ...(graph.weighted ? { weight: edge.weight } : {}),
      })
    }
    /** true if this edge could shorten its target (its source must already be reached). */
    const improves = (edge: DirectedEdge): number | null => {
      const du = dist.get(edge.source)
      if (du === undefined) return null
      const candidate = du + edge.weight
      return candidate < (dist.get(edge.target) ?? Infinity) ? candidate : null
    }

    const n = graph.nodes.length
    let stable = false
    for (let pass = 1; pass <= n - 1 && !stable; pass++) {
      let changed = false
      for (const edge of edges) {
        examine(edge)
        const candidate = improves(edge)
        if (candidate === null) continue
        events.push({
          type: 'update_distance',
          nodeId: edge.target,
          distance: candidate,
          previousDistance: dist.get(edge.target) ?? null,
          viaNodeId: edge.source,
        })
        dist.set(edge.target, candidate)
        previous.set(edge.target, edge.source)
        changed = true
      }
      stable = !changed
    }

    // Verification pass: only needed if we never reached a pass with no changes
    // (this also covers a 1-node graph, where the loop above runs zero times).
    let negativeCycle = false
    if (!stable) {
      for (const edge of edges) {
        examine(edge)
        if (improves(edge) !== null) {
          events.push({ type: 'negative_cycle_detected', edgeId: edge.edgeId })
          negativeCycle = true
          break
        }
      }
    }

    const distances: Record<string, number | null> = {}
    const predecessors: Record<string, string | null> = {}
    for (const node of graph.nodes) {
      distances[node.id] = dist.get(node.id) ?? null // null = unreachable
      if (previous.has(node.id)) predecessors[node.id] = previous.get(node.id) ?? null
    }
    // With a negative cycle the distances above are NOT meaningful; check negativeCycle first.
    events.push({ type: 'finish', result: { distances, previous: predecessors, negativeCycle } })
    return events
  },
}
