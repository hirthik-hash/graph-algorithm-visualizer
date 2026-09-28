/**
 * Bridges and articulation points (Milestone 6): one DFS that finds both.
 *
 * A BRIDGE is an edge whose removal disconnects the graph; an ARTICULATION
 * POINT (cut vertex) is a node whose removal does. Both fall out of the same
 * DFS bookkeeping: every node gets a discovery time, and a "low" value — the
 * earliest discovery time reachable from it via its DFS subtree plus at most
 * one back edge. Then, for a tree edge parent -> child:
 *   - it is a BRIDGE if low[child] > disc[parent] (nothing under the child
 *     can reach back above the parent, so this edge is the only link);
 *   - `parent` is an ARTICULATION POINT if low[child] >= disc[parent], with
 *     the root as a special case: a root is one only if it has 2+ DFS
 *     children (any single-child root is just a leaf of the whole tree).
 *
 * PARALLEL EDGES: the parent link is skipped by EDGE ID, exactly once, not by
 * "target == parent". Two parallel edges between a node and its parent form a
 * real cycle, so the SECOND one is a genuine back edge (it keeps the edge from
 * being a bridge). Skipping every edge to the parent would wrongly call it one.
 * SELF-LOOPS never affect connectivity and are examined but otherwise ignored.
 *
 * Iterative (explicit frame stack), matching dfs.ts, so a long chain can't
 * overflow the call stack. Event order reuses the DFS shapes:
 *   entering a node -> enqueue ('stack') + visit_node
 *   each edge       -> relax_edge
 *   leaving a node  -> dequeue + mark_visited, and just before that, any
 *                      bridge_found / articulation_point_found it triggers
 *
 * Requires an undirected graph (both notions are undirected). Considers every
 * node (one DFS per component), so there is no start node.
 */
import type { Algorithm } from '../engine/algorithm'
import type { AlgorithmEvent } from '../engine/events'
import { toAdjacencyList } from '../model/representations'
import type { Neighbor } from '../model/representations'

interface Frame {
  nodeId: string
  parentEdgeId: string | null
  neighbors: Neighbor[]
  neighborIndex: number
  skippedParentEdge: boolean
}

export const bridgesArticulationAlgorithm: Algorithm = {
  id: 'bridges-articulation',
  name: 'Bridges & Articulation Points',
  category: 'connectivity',
  requirements: { graphType: 'undirected' },

  run(graph) {
    const adjacency = new Map(toAdjacencyList(graph).map((entry) => [entry.nodeId, entry.neighbors]))
    const disc = new Map<string, number>()
    const low = new Map<string, number>()
    const events: AlgorithmEvent[] = []
    const bridgeEdgeIds: string[] = []
    const articulationPoints = new Set<string>()
    let timer = 0

    const markArticulationPoint = (nodeId: string) => {
      if (articulationPoints.has(nodeId)) return
      articulationPoints.add(nodeId)
      events.push({ type: 'articulation_point_found', nodeId })
    }

    const enter = (nodeId: string, parentEdgeId: string | null, fromNodeId?: string): Frame => {
      disc.set(nodeId, timer)
      low.set(nodeId, timer)
      timer++
      events.push({
        type: 'enqueue',
        nodeId,
        structure: 'stack',
        ...(fromNodeId === undefined ? {} : { fromNodeId }),
      })
      events.push({ type: 'visit_node', nodeId })
      return {
        nodeId,
        parentEdgeId,
        neighbors: adjacency.get(nodeId) ?? [],
        neighborIndex: 0,
        skippedParentEdge: false,
      }
    }

    for (const root of graph.nodes) {
      if (disc.has(root.id)) continue
      let rootChildCount = 0
      const frames: Frame[] = [enter(root.id, null)]

      while (frames.length > 0) {
        const frame = frames[frames.length - 1]

        if (frame.neighborIndex < frame.neighbors.length) {
          const nb = frame.neighbors[frame.neighborIndex++]
          events.push({
            type: 'relax_edge',
            edgeId: nb.edgeId,
            source: frame.nodeId,
            target: nb.nodeId,
            ...(nb.weight === undefined ? {} : { weight: nb.weight }),
          })

          if (nb.nodeId === frame.nodeId) continue // self-loop: never affects connectivity
          if (nb.edgeId === frame.parentEdgeId && !frame.skippedParentEdge) {
            frame.skippedParentEdge = true // the ONE edge we arrived by; a parallel twin is NOT skipped
            continue
          }

          if (!disc.has(nb.nodeId)) {
            if (frames.length === 1) rootChildCount++
            frames.push(enter(nb.nodeId, nb.edgeId, frame.nodeId)) // tree edge: "recurse"
          } else {
            // Back edge to an already-discovered node: may pull this node's low value down.
            low.set(frame.nodeId, Math.min(low.get(frame.nodeId)!, disc.get(nb.nodeId)!))
          }
        } else {
          frames.pop() // "return" from the recursive call
          if (frames.length > 0) {
            const parent = frames[frames.length - 1]
            low.set(parent.nodeId, Math.min(low.get(parent.nodeId)!, low.get(frame.nodeId)!))

            if (low.get(frame.nodeId)! > disc.get(parent.nodeId)!) {
              bridgeEdgeIds.push(frame.parentEdgeId!)
              events.push({
                type: 'bridge_found',
                edgeId: frame.parentEdgeId!,
                source: parent.nodeId,
                target: frame.nodeId,
              })
            }
            // Non-root parents use the >= rule; the root is handled after its whole tree, below.
            if (frames.length > 1 && low.get(frame.nodeId)! >= disc.get(parent.nodeId)!) {
              markArticulationPoint(parent.nodeId)
            }
          }
          events.push({ type: 'dequeue', nodeId: frame.nodeId, structure: 'stack' })
          events.push({ type: 'mark_visited', nodeId: frame.nodeId })
        }
      }

      if (rootChildCount > 1) markArticulationPoint(root.id)
    }

    events.push({
      type: 'finish',
      result: {
        bridges: bridgeEdgeIds,
        articulationPoints: [...articulationPoints],
        bridgeCount: bridgeEdgeIds.length,
        articulationPointCount: articulationPoints.size,
      },
    })
    return events
  },
}
