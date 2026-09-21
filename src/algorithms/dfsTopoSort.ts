/**
 * DFS-based topological sort (Day 10): run a depth-first search from every
 * unvisited node; a node is FINISHED (mark_visited) once everything reachable
 * from it is finished. Listing nodes in REVERSE finishing order gives a
 * topological order, because a node always finishes after all its successors.
 *
 * Cycle detection uses the classic three colours: meeting a node that is still
 * on the current DFS path (gray) means a back edge, i.e. a cycle. It is
 * reported in finish.result.hasCycle only; the search still runs to the end so
 * every node is shown. When hasCycle is true, result.order is [] (a cyclic
 * graph has no topological order).
 *
 * Iterative (explicit stack of frames), so a very long chain can't overflow the
 * call stack. Event order matches the DFS traversal: entering a node is
 * enqueue (push) + visit_node; leaving it is dequeue (pop) + mark_visited.
 *
 * Considers every node, so there is no start node. Requires a directed graph.
 */
import type { Algorithm } from '../engine/algorithm'
import type { AlgorithmEvent } from '../engine/events'
import { toAdjacencyList } from '../model/representations'

interface Frame {
  nodeId: string
  nextIndex: number
}

export const dfsTopoSortAlgorithm: Algorithm = {
  id: 'dfs-topo',
  name: 'DFS Topological Sort',
  category: 'ordering',
  requirements: { graphType: 'directed' },

  run(graph) {
    const adjacency = new Map(toAdjacencyList(graph).map((entry) => [entry.nodeId, entry.neighbors]))
    const state = new Map<string, 'gray' | 'black'>() // absent = unvisited
    const events: AlgorithmEvent[] = []
    const finishOrder: string[] = []
    let hasCycle = false

    const frames: Frame[] = []
    const enter = (nodeId: string, fromNodeId?: string) => {
      state.set(nodeId, 'gray')
      events.push({
        type: 'enqueue',
        nodeId,
        structure: 'stack',
        ...(fromNodeId === undefined ? {} : { fromNodeId }),
      })
      events.push({ type: 'visit_node', nodeId })
      frames.push({ nodeId, nextIndex: 0 })
    }

    for (const root of graph.nodes) {
      if (state.has(root.id)) continue
      enter(root.id)

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
          const s = state.get(nb.nodeId)
          if (s === undefined) enter(nb.nodeId, frame.nodeId)
          else if (s === 'gray') hasCycle = true // back edge: target is still on the current path
        } else {
          frames.pop()
          state.set(frame.nodeId, 'black')
          finishOrder.push(frame.nodeId)
          events.push({ type: 'dequeue', nodeId: frame.nodeId, structure: 'stack' })
          events.push({ type: 'mark_visited', nodeId: frame.nodeId })
        }
      }
    }

    const order = hasCycle ? [] : [...finishOrder].reverse()
    events.push({ type: 'finish', result: { order, hasCycle } })
    return events
  },
}
