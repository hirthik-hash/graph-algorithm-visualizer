/**
 * Breadth-First Search (Day 6).
 *
 * Emits events only; it draws nothing. Event order for each node u taken off
 * the queue:  dequeue u -> visit_node u -> (relax_edge, then enqueue if the
 * neighbour is new) for every edge out of u -> mark_visited u.
 *
 * A node is marked "discovered" when it is ENQUEUED, not when it is dequeued.
 * Marking on dequeue would let the same node enter the queue many times.
 *
 * Only the component reachable from the start node is explored; other nodes
 * are never touched (a traversal from one start node can't reach them).
 */
import type { Algorithm } from '../engine/algorithm'
import type { AlgorithmEvent } from '../engine/events'
import { toAdjacencyList } from '../model/representations'

export const bfsAlgorithm: Algorithm = {
  id: 'bfs',
  name: 'Breadth-First Search',
  category: 'traversal',
  requirements: { startNode: true },

  run(graph, options = {}) {
    const start = options.startNodeId
    if (start === undefined || !graph.nodes.some((n) => n.id === start)) {
      throw new Error(`BFS needs a start node that exists in the graph (got ${String(start)})`)
    }

    const adjacency = new Map(toAdjacencyList(graph).map((entry) => [entry.nodeId, entry.neighbors]))
    const events: AlgorithmEvent[] = []
    const discovered = new Set<string>([start])
    const queue: string[] = [start]
    const order: string[] = []

    events.push({ type: 'enqueue', nodeId: start, structure: 'queue' })

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
        if (!discovered.has(nb.nodeId)) {
          discovered.add(nb.nodeId)
          queue.push(nb.nodeId)
          events.push({ type: 'enqueue', nodeId: nb.nodeId, structure: 'queue', fromNodeId: u })
        }
      }

      events.push({ type: 'mark_visited', nodeId: u })
    }

    events.push({ type: 'finish', result: { order, reachableCount: order.length } })
    return events
  },
}
