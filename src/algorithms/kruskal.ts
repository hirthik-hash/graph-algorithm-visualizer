/**
 * Kruskal's minimum spanning tree/forest (Day 9): consider edges from cheapest
 * to most expensive; keep an edge unless it would connect two nodes that are
 * already connected (which would form a cycle).
 *
 * "Already connected?" is answered by the standalone UnionFind from Day 8.
 *
 * Every edge is examined, and every refusal is an explicit reject_edge event
 * with its reason: seeing WHY an edge was skipped is the point of the lesson.
 * Event order per edge: relax_edge, then add_to_mst or reject_edge.
 *
 * On a disconnected graph the result is a minimum spanning FOREST (one tree per
 * component); finish.result.treeCount says how many. Ties are broken by edge
 * order in the graph, so runs are deterministic.
 *
 * Works on undirected graphs. Weights default to 1 for an unweighted graph.
 */
import type { Algorithm } from '../engine/algorithm'
import type { AlgorithmEvent } from '../engine/events'
import { UnionFind } from './unionFind'

export const kruskalAlgorithm: Algorithm = {
  id: 'kruskal',
  name: "Kruskal's Algorithm (MST)",
  category: 'spanning-tree',
  requirements: { graphType: 'undirected' },

  run(graph) {
    const sorted = graph.edges
      // Stored weights are IGNORED while the graph is unweighted (Day 2: turning
      // "weighted" off keeps them hidden), so they must not affect sorting or totals.
      .map((edge, order) => ({ edge, order, weight: graph.weighted ? (edge.weight ?? 1) : 1 }))
      .sort((a, b) => a.weight - b.weight || a.order - b.order)

    const sets = new UnionFind(graph.nodes.map((n) => n.id))
    const events: AlgorithmEvent[] = []
    const mstEdgeIds: string[] = []
    let totalWeight = 0

    for (const { edge, weight } of sorted) {
      const details = {
        edgeId: edge.id,
        source: edge.source,
        target: edge.target,
        ...(graph.weighted ? { weight } : {}),
      }
      events.push({ type: 'relax_edge', ...details })
      if (sets.union(edge.source, edge.target).merged) {
        events.push({ type: 'add_to_mst', ...details })
        mstEdgeIds.push(edge.id)
        totalWeight += weight
      } else {
        events.push({ type: 'reject_edge', ...details, reason: 'would_form_cycle' })
      }
    }

    events.push({ type: 'finish', result: { mstEdgeIds, totalWeight, treeCount: sets.componentCount } })
    return events
  },
}
