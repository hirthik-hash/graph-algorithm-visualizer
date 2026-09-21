/**
 * Dijkstra's shortest paths (Day 7): single source, non-negative weights.
 *
 * Implementation: binary heap with LAZY deletion (a shorter path just pushes a
 * new heap entry; outdated entries are skipped when popped). The EVENTS,
 * however, describe the textbook decrease-key version, because that is what a
 * learner should see:
 *   - a node is enqueued ONCE, the first time any path to it is found;
 *   - a better path later is an update_distance, not a second enqueue;
 *   - skipped stale heap entries produce no events (an implementation detail).
 *
 * Event order for each node u taken off the queue:
 *   dequeue u -> visit_node u -> for each edge out of u: relax_edge, then
 *   update_distance (+ enqueue if first discovery) when the path is shorter
 *   -> mark_visited u.
 *
 * Edges come from the adjacency list WITH their ids, so parallel edges are
 * handled exactly (each is examined, the cheaper one wins) instead of looking
 * an edge up by its endpoints and taking the first match.
 *
 * Ties in distance are broken by node order in the graph, so runs are
 * deterministic.
 */
import type { Algorithm } from '../engine/algorithm'
import type { AlgorithmEvent } from '../engine/events'
import { toAdjacencyList } from '../model/representations'
import { MinHeap } from './priorityQueue'

interface HeapEntry {
  nodeId: string
  distance: number
  nodeOrder: number
}

export const dijkstraAlgorithm: Algorithm = {
  id: 'dijkstra',
  name: "Dijkstra's Algorithm",
  category: 'shortest-path',
  requirements: { weighted: true, nonNegativeWeights: true, startNode: true },

  run(graph, options = {}) {
    const start = options.startNodeId
    if (start === undefined || !graph.nodes.some((n) => n.id === start)) {
      throw new Error(`Dijkstra needs a start node that exists in the graph (got ${String(start)})`)
    }

    const adjacency = new Map(toAdjacencyList(graph).map((entry) => [entry.nodeId, entry.neighbors]))
    const nodeOrder = new Map(graph.nodes.map((n, i) => [n.id, i]))
    const events: AlgorithmEvent[] = []

    const dist = new Map<string, number>()
    const previous = new Map<string, string | null>()
    const finalized = new Set<string>()
    const order: string[] = []
    const heap = new MinHeap<HeapEntry>((a, b) => a.distance - b.distance || a.nodeOrder - b.nodeOrder)

    dist.set(start, 0)
    previous.set(start, null)
    heap.push({ nodeId: start, distance: 0, nodeOrder: nodeOrder.get(start)! })
    events.push({ type: 'update_distance', nodeId: start, distance: 0, previousDistance: null })
    events.push({ type: 'enqueue', nodeId: start, structure: 'priority_queue', priority: 0 })

    for (let entry = heap.pop(); entry !== undefined; entry = heap.pop()) {
      const u = entry.nodeId
      // Stale entry: a shorter path was found after this one was pushed.
      if (finalized.has(u) || entry.distance > (dist.get(u) ?? Infinity)) continue

      finalized.add(u)
      order.push(u)
      events.push({ type: 'dequeue', nodeId: u, structure: 'priority_queue' })
      events.push({ type: 'visit_node', nodeId: u })

      for (const nb of adjacency.get(u) ?? []) {
        const weight = nb.weight ?? 1
        events.push({
          type: 'relax_edge',
          edgeId: nb.edgeId,
          source: u,
          target: nb.nodeId,
          ...(nb.weight === undefined ? {} : { weight: nb.weight }),
        })

        if (finalized.has(nb.nodeId)) continue
        const candidate = entry.distance + weight
        const known = dist.get(nb.nodeId)
        if (known !== undefined && candidate >= known) continue

        dist.set(nb.nodeId, candidate)
        previous.set(nb.nodeId, u)
        heap.push({ nodeId: nb.nodeId, distance: candidate, nodeOrder: nodeOrder.get(nb.nodeId)! })
        events.push({
          type: 'update_distance',
          nodeId: nb.nodeId,
          distance: candidate,
          previousDistance: known ?? null,
          viaNodeId: u,
        })
        if (known === undefined) {
          events.push({
            type: 'enqueue',
            nodeId: nb.nodeId,
            structure: 'priority_queue',
            fromNodeId: u,
            priority: candidate,
          })
        }
      }

      events.push({ type: 'mark_visited', nodeId: u })
    }

    const distances: Record<string, number | null> = {}
    const predecessors: Record<string, string | null> = {}
    for (const n of graph.nodes) {
      distances[n.id] = dist.get(n.id) ?? null // null = unreachable
      if (previous.has(n.id)) predecessors[n.id] = previous.get(n.id) ?? null
    }
    events.push({ type: 'finish', result: { distances, previous: predecessors, order } })
    return events
  },
}
