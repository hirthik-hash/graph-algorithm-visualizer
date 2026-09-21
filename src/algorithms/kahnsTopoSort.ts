/**
 * Kahn's topological sort (Day 10): repeatedly take a node with no remaining
 * incoming edges, "remove" it, and lower the in-degree of its successors.
 *
 * Event order:
 *   - every node that starts with in-degree 0 is enqueued (in graph order);
 *   - for each node u taken off the queue: dequeue u -> visit_node u ->
 *     relax_edge for each edge out of u (a successor whose in-degree hits 0 is
 *     enqueued) -> mark_visited u.
 *
 * Cycles: if some nodes never reach in-degree 0 they are never placed, so the
 * order comes out shorter than the node count. There is no single moment at
 * which "the cycle is found", so it is reported only in finish.result.hasCycle
 * (not as a dedicated event). Self-loops count toward in-degree, so a node
 * with a self-loop is correctly treated as part of a cycle.
 *
 * finish.result.order is a complete topological order when hasCycle is false
 * and [] when it is true (a cyclic graph has no topological order).
 *
 * Considers every node, so there is no start node. Requires a directed graph.
 */
import type { Algorithm } from '../engine/algorithm'
import type { AlgorithmEvent } from '../engine/events'
import { toAdjacencyList } from '../model/representations'

export const kahnsTopoSortAlgorithm: Algorithm = {
  id: 'kahn',
  name: "Kahn's Topological Sort",
  category: 'ordering',
  requirements: { graphType: 'directed' },

  run(graph) {
    const adjacency = new Map(toAdjacencyList(graph).map((entry) => [entry.nodeId, entry.neighbors]))
    const inDegree = new Map(graph.nodes.map((n) => [n.id, 0]))
    for (const e of graph.edges) inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1)

    const events: AlgorithmEvent[] = []
    const queue: string[] = []
    for (const n of graph.nodes) {
      if (inDegree.get(n.id) === 0) {
        queue.push(n.id)
        events.push({ type: 'enqueue', nodeId: n.id, structure: 'queue' })
      }
    }

    const order: string[] = []
    for (let head = 0; head < queue.length; head++) {
      const u = queue[head]
      order.push(u)
      events.push({ type: 'dequeue', nodeId: u, structure: 'queue' })
      events.push({ type: 'visit_node', nodeId: u })

      for (const nb of adjacency.get(u) ?? []) {
        events.push({
          type: 'relax_edge',
          edgeId: nb.edgeId,
          source: u,
          target: nb.nodeId,
          ...(nb.weight === undefined ? {} : { weight: nb.weight }),
        })
        const remaining = (inDegree.get(nb.nodeId) ?? 0) - 1
        inDegree.set(nb.nodeId, remaining)
        if (remaining === 0) {
          queue.push(nb.nodeId)
          events.push({ type: 'enqueue', nodeId: nb.nodeId, structure: 'queue', fromNodeId: u })
        }
      }

      events.push({ type: 'mark_visited', nodeId: u })
    }

    const hasCycle = order.length < graph.nodes.length
    events.push({ type: 'finish', result: { order: hasCycle ? [] : order, hasCycle } })
    return events
  },
}
