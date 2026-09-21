/**
 * Depth-First Search (Day 6).
 *
 * Iterative, with an explicit stack of "frames" (a node plus how many of its
 * neighbours we've looked at), instead of recursion. It visits nodes in exactly
 * the order recursive DFS would, but a long path graph can't overflow the JS
 * call stack.
 *
 * Event order: entering a node u  -> enqueue u (structure 'stack', i.e. push)
 * then visit_node u; each edge out of u -> relax_edge, and if the neighbour is
 * new we enter it; leaving u -> dequeue u (pop) then mark_visited u.
 *
 * Like BFS, only nodes reachable from the start node are explored.
 */
import type { Algorithm } from '../engine/algorithm'
import type { AlgorithmEvent } from '../engine/events'
import { toAdjacencyList } from '../model/representations'

interface Frame {
  nodeId: string
  nextIndex: number
}

export const dfsAlgorithm: Algorithm = {
  id: 'dfs',
  name: 'Depth-First Search',
  category: 'traversal',
  requirements: { startNode: true },

  run(graph, options = {}) {
    const start = options.startNodeId
    if (start === undefined || !graph.nodes.some((n) => n.id === start)) {
      throw new Error(`DFS needs a start node that exists in the graph (got ${String(start)})`)
    }

    const adjacency = new Map(toAdjacencyList(graph).map((entry) => [entry.nodeId, entry.neighbors]))
    const events: AlgorithmEvent[] = []
    const visited = new Set<string>([start])
    const order: string[] = [start]
    const frames: Frame[] = [{ nodeId: start, nextIndex: 0 }]

    events.push({ type: 'enqueue', nodeId: start, structure: 'stack' })
    events.push({ type: 'visit_node', nodeId: start })

    while (frames.length > 0) {
      const frame = frames[frames.length - 1]
      const neighbors = adjacency.get(frame.nodeId) ?? []

      if (frame.nextIndex < neighbors.length) {
        const nb = neighbors[frame.nextIndex++]
        events.push({
          type: 'relax_edge',
          edgeId: nb.edgeId,
          source: frame.nodeId,
          target: nb.nodeId,
          ...(nb.weight === undefined ? {} : { weight: nb.weight }),
        })
        if (!visited.has(nb.nodeId)) {
          visited.add(nb.nodeId)
          order.push(nb.nodeId)
          events.push({ type: 'enqueue', nodeId: nb.nodeId, structure: 'stack', fromNodeId: frame.nodeId })
          events.push({ type: 'visit_node', nodeId: nb.nodeId })
          frames.push({ nodeId: nb.nodeId, nextIndex: 0 })
        }
      } else {
        frames.pop()
        events.push({ type: 'dequeue', nodeId: frame.nodeId, structure: 'stack' })
        events.push({ type: 'mark_visited', nodeId: frame.nodeId })
      }
    }

    events.push({ type: 'finish', result: { order, reachableCount: order.length } })
    return events
  },
}
