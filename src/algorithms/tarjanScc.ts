/**
 * Tarjan's strongly connected components (Milestone 6): one DFS pass that
 * assigns each node a discovery index and a "low-link" (the smallest index
 * reachable from it via its DFS subtree plus at most one back edge to a node
 * still on the algorithm's own stack). When a node's low-link equals its own
 * index, it is the root of a component, and everything above it on that
 * stack is popped off as one strongly connected component.
 *
 * Iterative (an explicit stack of frames simulating the recursion), matching
 * dfs.ts and dfsTopoSort.ts — a long chain can't overflow the call stack.
 *
 * Event order (reuses the DFS shapes):
 *   entering a node   -> enqueue (structure 'stack') + visit_node
 *   each edge         -> relax_edge
 *   leaving a node    -> dequeue + mark_visited, then, if that node turned out
 *                        to be a component's root, scc_found for the group
 * Updating a low-link has no event of its own: unlike a distance, it isn't a
 * quantity worth narrating step by step, only its consequence (a component
 * being found) is.
 *
 * SCCs are a directed-graph concept (in an undirected graph every connected
 * component is trivially one), so this requires a directed graph. Considers
 * every node, so there is no start node. Components are found in reverse
 * topological order of the "condensation" graph — a natural property of
 * Tarjan's, not something added here.
 */
import type { Algorithm } from '../engine/algorithm'
import type { AlgorithmEvent } from '../engine/events'
import { toAdjacencyList } from '../model/representations'
import type { Neighbor } from '../model/representations'

interface Frame {
  nodeId: string
  neighborIndex: number
  neighbors: Neighbor[]
}

export const tarjanSccAlgorithm: Algorithm = {
  id: 'tarjan-scc',
  name: "Tarjan's Strongly Connected Components",
  category: 'connectivity',
  requirements: { graphType: 'directed' },

  run(graph) {
    const adjacency = new Map(toAdjacencyList(graph).map((entry) => [entry.nodeId, entry.neighbors]))
    const index = new Map<string, number>()
    const lowLink = new Map<string, number>()
    const onStack = new Set<string>()
    const sccStack: string[] = []
    const events: AlgorithmEvent[] = []
    const components: string[][] = []
    let counter = 0

    const enter = (nodeId: string, fromNodeId?: string): Frame => {
      index.set(nodeId, counter)
      lowLink.set(nodeId, counter)
      counter++
      sccStack.push(nodeId)
      onStack.add(nodeId)
      events.push({
        type: 'enqueue',
        nodeId,
        structure: 'stack',
        ...(fromNodeId === undefined ? {} : { fromNodeId }),
      })
      events.push({ type: 'visit_node', nodeId })
      return { nodeId, neighborIndex: 0, neighbors: adjacency.get(nodeId) ?? [] }
    }

    for (const root of graph.nodes) {
      if (index.has(root.id)) continue
      const callStack: Frame[] = [enter(root.id)]

      while (callStack.length > 0) {
        const frame = callStack[callStack.length - 1]

        if (frame.neighborIndex < frame.neighbors.length) {
          const nb = frame.neighbors[frame.neighborIndex++]
          events.push({
            type: 'relax_edge',
            edgeId: nb.edgeId,
            source: frame.nodeId,
            target: nb.nodeId,
            ...(nb.weight === undefined ? {} : { weight: nb.weight }),
          })
          if (!index.has(nb.nodeId)) {
            callStack.push(enter(nb.nodeId, frame.nodeId)) // tree edge: "recurse"
          } else if (onStack.has(nb.nodeId)) {
            // Edge back into a node still waiting for its component: it can pull this node's low-link down.
            lowLink.set(frame.nodeId, Math.min(lowLink.get(frame.nodeId)!, index.get(nb.nodeId)!))
          }
          // else: an edge into an already-finished component — irrelevant to this node's own component.
        } else {
          callStack.pop() // "return" from the recursive call
          events.push({ type: 'dequeue', nodeId: frame.nodeId, structure: 'stack' })
          if (callStack.length > 0) {
            const parent = callStack[callStack.length - 1]
            lowLink.set(parent.nodeId, Math.min(lowLink.get(parent.nodeId)!, lowLink.get(frame.nodeId)!))
          }
          events.push({ type: 'mark_visited', nodeId: frame.nodeId })

          if (lowLink.get(frame.nodeId) === index.get(frame.nodeId)) {
            // This node is a component's root: pop everything above it (inclusive) as one SCC.
            const component: string[] = []
            let member: string
            do {
              member = sccStack.pop()!
              onStack.delete(member)
              component.push(member)
            } while (member !== frame.nodeId)
            components.push(component)
            events.push({ type: 'scc_found', nodeIds: component })
          }
        }
      }
    }

    events.push({ type: 'finish', result: { components, componentCount: components.length } })
    return events
  },
}
