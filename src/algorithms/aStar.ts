/**
 * A* search (Day 11): shortest path from a start node to a GOAL node, guided by
 * a heuristic so it explores fewer nodes than Dijkstra would.
 *
 * Each node is queued with priority f = g + h, where g is the best distance
 * found so far and h estimates the remaining distance to the goal.
 *
 * THE HEURISTIC. A* is only guaranteed to return a shortest path if h never
 * OVERestimates the true remaining cost. Plain straight-line (Euclidean)
 * distance in pixels does not guarantee that here, because users type arbitrary
 * edge weights: an edge that is 200px long but has weight 1 makes the pixel
 * distance a big overestimate, and A* could return a longer path than
 * necessary. So the heuristic is Euclidean distance times a scale = the
 * smallest (weight / pixel-length) ratio over all edges. That guarantees
 * h(u) - h(v) <= w(u, v)
 * for every edge (the heuristic is CONSISTENT), which means:
 *   - the path found is a shortest path, whatever weights were typed;
 *   - a node's distance is final the moment it is taken off the queue, so
 *     nothing ever needs to be re-opened.
 * When weights already match pixel lengths the scale is 1 and this is exactly
 * Euclidean distance.
 *
 * If ANY node lacks coordinates, or no edge gives a usable ratio, h is 0
 * everywhere and A* behaves exactly like Dijkstra with an early exit. (It has
 * to be all-or-nothing: mixing zero and non-zero estimates breaks consistency.)
 *
 * Events mirror Dijkstra's (a node is enqueued once; a better path later is an
 * update_distance; stale heap entries are skipped silently), except that the
 * search STOPS as soon as the goal is taken off the queue. enqueue.priority is f.
 *
 * finish.result: { found, path (start..goal, or []), distance (or null), nodesExpanded }.
 * Ties in f are broken by node order in the graph, so runs are deterministic.
 * Tiny floating-point noise in h can only affect ties, never the integer-weight
 * shortest-path result.
 */
import type { Algorithm } from '../engine/algorithm'
import type { AlgorithmEvent } from '../engine/events'
import type { Graph } from '../model/graph'
import { toAdjacencyList } from '../model/representations'
import { MinHeap } from './priorityQueue'

interface HeapEntry {
  nodeId: string
  g: number
  f: number
  nodeOrder: number
}

function makeHeuristic(graph: Graph, goalId: string): (nodeId: string) => number {
  const zero = () => 0
  const position = new Map<string, { x: number; y: number }>()
  for (const n of graph.nodes) {
    if (n.x === undefined || n.y === undefined) return zero
    position.set(n.id, { x: n.x, y: n.y })
  }
  const distance = (a: string, b: string) => {
    const p = position.get(a)!
    const q = position.get(b)!
    return Math.hypot(p.x - q.x, p.y - q.y)
  }

  let scale = Infinity
  for (const e of graph.edges) {
    const length = distance(e.source, e.target)
    if (length > 0) scale = Math.min(scale, (graph.weighted ? (e.weight ?? 1) : 1) / length)
  }
  if (!Number.isFinite(scale)) return zero
  scale = Math.max(0, scale)
  return (nodeId) => scale * distance(nodeId, goalId)
}

export const aStarAlgorithm: Algorithm = {
  id: 'astar',
  name: 'A* Search',
  category: 'shortest-path',
  requirements: { weighted: true, nonNegativeWeights: true, startNode: true, goalNode: true },
  usesCoordinates: true,

  run(graph, options = {}) {
    const { startNodeId: start, goalNodeId: goal } = options
    const exists = (id: string | undefined): id is string => id !== undefined && graph.nodes.some((n) => n.id === id)
    if (!exists(start) || !exists(goal)) {
      throw new Error(
        `A* needs a start node and a goal node that exist in the graph (got ${String(start)}, ${String(goal)})`,
      )
    }

    const h = makeHeuristic(graph, goal)
    const adjacency = new Map(toAdjacencyList(graph).map((entry) => [entry.nodeId, entry.neighbors]))
    const nodeOrder = new Map(graph.nodes.map((n, i) => [n.id, i]))
    const events: AlgorithmEvent[] = []

    const dist = new Map<string, number>([[start, 0]])
    const previous = new Map<string, string | null>([[start, null]])
    const finalized = new Set<string>()
    const heap = new MinHeap<HeapEntry>((a, b) => a.f - b.f || a.nodeOrder - b.nodeOrder)

    heap.push({ nodeId: start, g: 0, f: h(start), nodeOrder: nodeOrder.get(start)! })
    events.push({ type: 'update_distance', nodeId: start, distance: 0, previousDistance: null })
    events.push({ type: 'enqueue', nodeId: start, structure: 'priority_queue', priority: h(start) })

    let nodesExpanded = 0
    let found = false

    for (let entry = heap.pop(); entry !== undefined; entry = heap.pop()) {
      const u = entry.nodeId
      if (finalized.has(u) || entry.g > (dist.get(u) ?? Infinity)) continue // stale entry

      finalized.add(u)
      nodesExpanded++
      events.push({ type: 'dequeue', nodeId: u, structure: 'priority_queue' })
      events.push({ type: 'visit_node', nodeId: u })

      if (u === goal) {
        events.push({ type: 'mark_visited', nodeId: u })
        found = true
        break
      }

      for (const nb of adjacency.get(u) ?? []) {
        events.push({
          type: 'relax_edge',
          edgeId: nb.edgeId,
          source: u,
          target: nb.nodeId,
          ...(nb.weight === undefined ? {} : { weight: nb.weight }),
        })
        if (finalized.has(nb.nodeId)) continue

        const candidate = entry.g + (nb.weight ?? 1)
        const known = dist.get(nb.nodeId)
        if (known !== undefined && candidate >= known) continue

        dist.set(nb.nodeId, candidate)
        previous.set(nb.nodeId, u)
        const f = candidate + h(nb.nodeId)
        heap.push({ nodeId: nb.nodeId, g: candidate, f, nodeOrder: nodeOrder.get(nb.nodeId)! })
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
            priority: f,
          })
        }
      }

      events.push({ type: 'mark_visited', nodeId: u })
    }

    const path: string[] = []
    if (found) {
      for (let cur: string | null = goal; cur !== null; cur = previous.get(cur) ?? null) path.push(cur)
      path.reverse()
    }
    events.push({
      type: 'finish',
      result: { found, path, distance: found ? (dist.get(goal) ?? null) : null, nodesExpanded },
    })
    return events
  },
}
