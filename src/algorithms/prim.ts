/**
 * Prim's minimum spanning tree (Day 9): grow ONE tree outward from the start
 * node, always adding the cheapest edge that leaves the tree.
 *
 * Event order:
 *   visit_node u (u joins the tree) -> relax_edge for each edge from u to a node
 *   NOT yet in the tree (a new candidate) -> mark_visited u -> then the cheapest
 *   candidate is chosen: add_to_mst, and its far end becomes the next visit_node.
 *
 * Candidates live in a heap that is never cleaned up: an edge whose far end
 * joined the tree in the meantime is simply skipped when popped (no event, it
 * was never a real decision). Ties are broken by edge order in the graph.
 *
 * Only the component containing the start node is spanned; nodes in other
 * components are never touched (finish.result.nodesReached says how many were).
 * Kruskal's, by contrast, produces a spanning FOREST of the whole graph.
 *
 * Works on undirected graphs. Weights default to 1 for an unweighted graph
 * (any spanning tree is then "minimum").
 */
import type { Algorithm } from '../engine/algorithm'
import type { AlgorithmEvent } from '../engine/events'
import { toAdjacencyList } from '../model/representations'
import { MinHeap } from './priorityQueue'

interface Candidate {
  edgeId: string
  from: string
  to: string
  weight: number
  edgeOrder: number
}

export const primAlgorithm: Algorithm = {
  id: 'prim',
  name: "Prim's Algorithm (MST)",
  category: 'spanning-tree',
  requirements: { graphType: 'undirected', startNode: true },

  run(graph, options = {}) {
    const start = options.startNodeId
    if (start === undefined || !graph.nodes.some((n) => n.id === start)) {
      throw new Error(`Prim's needs a start node that exists in the graph (got ${String(start)})`)
    }

    const adjacency = new Map(toAdjacencyList(graph).map((entry) => [entry.nodeId, entry.neighbors]))
    const edgeOrder = new Map(graph.edges.map((e, i) => [e.id, i]))
    const heap = new MinHeap<Candidate>((a, b) => a.weight - b.weight || a.edgeOrder - b.edgeOrder)
    const events: AlgorithmEvent[] = []
    const inTree = new Set<string>()
    const mstEdgeIds: string[] = []
    let totalWeight = 0

    const join = (nodeId: string) => {
      inTree.add(nodeId)
      events.push({ type: 'visit_node', nodeId })
      for (const nb of adjacency.get(nodeId) ?? []) {
        if (inTree.has(nb.nodeId)) continue // also skips self-loops
        events.push({
          type: 'relax_edge',
          edgeId: nb.edgeId,
          source: nodeId,
          target: nb.nodeId,
          ...(nb.weight === undefined ? {} : { weight: nb.weight }),
        })
        heap.push({
          edgeId: nb.edgeId,
          from: nodeId,
          to: nb.nodeId,
          weight: nb.weight ?? 1,
          edgeOrder: edgeOrder.get(nb.edgeId)!,
        })
      }
      events.push({ type: 'mark_visited', nodeId })
    }

    join(start)
    for (let c = heap.pop(); c !== undefined; c = heap.pop()) {
      if (inTree.has(c.to)) continue // stale candidate: its far end was reached another way
      events.push({
        type: 'add_to_mst',
        edgeId: c.edgeId,
        source: c.from,
        target: c.to,
        ...(graph.weighted ? { weight: c.weight } : {}),
      })
      mstEdgeIds.push(c.edgeId)
      totalWeight += c.weight
      join(c.to)
    }

    events.push({ type: 'finish', result: { mstEdgeIds, totalWeight, nodesReached: inTree.size } })
    return events
  },
}
