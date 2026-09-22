/**
 * Count Reachable Nodes (Day 15): the plugin-architecture proof.
 *
 * Deliberately trivial — it just counts how many nodes are reachable from the
 * start node, using only the standard events (a plain BFS walk with no
 * relax_edge, since there's nothing interesting to say about an edge here).
 * The point of this algorithm is not what it computes; it's that adding it
 * required exactly ONE import and ONE array entry in registry.ts, and ZERO
 * edits anywhere else — not PlaybackControls, not ComparisonPanel, not the
 * quiz engine, not any existing test. That's the architecture working as
 * intended: every consumer reads the registry, so a new entry there is
 * automatically playable, comparable, and (if it has pseudocode) sync-able.
 */
import type { Algorithm } from '../engine/algorithm'
import type { AlgorithmEvent } from '../engine/events'
import { toAdjacencyList } from '../model/representations'

export const countReachableAlgorithm: Algorithm = {
  id: 'count-reachable',
  name: 'Count Reachable Nodes',
  category: 'traversal',
  requirements: { startNode: true },

  run(graph, options = {}) {
    const start = options.startNodeId
    if (start === undefined || !graph.nodes.some((n) => n.id === start)) {
      throw new Error(`Count Reachable needs a start node that exists in the graph (got ${String(start)})`)
    }

    const adjacency = new Map(toAdjacencyList(graph).map((entry) => [entry.nodeId, entry.neighbors]))
    const events: AlgorithmEvent[] = []
    const visited = new Set<string>([start])
    const queue = [start]
    events.push({ type: 'enqueue', nodeId: start, structure: 'queue' })

    for (let head = 0; head < queue.length; head++) {
      const u = queue[head]
      events.push({ type: 'dequeue', nodeId: u, structure: 'queue' })
      events.push({ type: 'visit_node', nodeId: u })
      for (const nb of adjacency.get(u) ?? []) {
        if (!visited.has(nb.nodeId)) {
          visited.add(nb.nodeId)
          queue.push(nb.nodeId)
          events.push({ type: 'enqueue', nodeId: nb.nodeId, structure: 'queue', fromNodeId: u })
        }
      }
      events.push({ type: 'mark_visited', nodeId: u })
    }

    events.push({ type: 'finish', result: { count: visited.size } })
    return events
  },
}
