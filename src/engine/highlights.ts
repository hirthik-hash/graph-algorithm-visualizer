/**
 * Highlights: what the canvas should emphasise after N events.
 *
 * Derived purely by folding over the events applied so far, never by asking
 * "which algorithm is this". Any algorithm that emits the standard events gets
 * highlighting for free.
 *
 *  - visited:  nodes with a mark_visited (finished)
 *  - frontier: nodes enqueued and not yet dequeued (queue / stack contents)
 *  - active:   the node being processed right now. Tracked as a path so that
 *              after a DFS child finishes, the parent becomes active again.
 *  - examinedEdgeId: the edge from the LATEST event, if that event examined one
 *  - distances: each node's latest known distance (Day 7); unreached nodes are absent
 *  - mstEdges / rejectedEdges: edges accepted / refused so far (Day 9, spanning trees)
 *  - matrix / waypoint: the latest matrix snapshot and its waypoint node (Day 8, Floyd-Warshall)
 *  - sccMembers: every node placed into SOME strongly connected component found so far
 *    (Milestone 6). Not grouped by which component — see the events themselves
 *    (scc_found) for that — this is only "has this node's component been found yet".
 *  - bridgeEdges / articulationPoints: edges/nodes found so far to be a bridge /
 *    an articulation point (Milestone 6, bridges & articulation points).
 */
import type { AlgorithmEvent, MatrixUpdateEvent } from './events'

export interface Highlights {
  visited: Set<string>
  frontier: Set<string>
  active: string | null
  examinedEdgeId: string | null
  distances: Map<string, number>
  mstEdges: Set<string>
  rejectedEdges: Set<string>
  matrix: MatrixUpdateEvent | null
  waypoint: string | null
  sccMembers: Set<string>
  bridgeEdges: Set<string>
  articulationPoints: Set<string>
}

export function computeHighlights(eventsSoFar: readonly AlgorithmEvent[]): Highlights {
  const visited = new Set<string>()
  const frontier = new Set<string>()
  const distances = new Map<string, number>()
  const mstEdges = new Set<string>()
  const rejectedEdges = new Set<string>()
  const sccMembers = new Set<string>()
  const bridgeEdges = new Set<string>()
  const articulationPoints = new Set<string>()
  const activePath: string[] = []
  let matrix: MatrixUpdateEvent | null = null

  for (const event of eventsSoFar) {
    switch (event.type) {
      case 'enqueue':
        frontier.add(event.nodeId)
        break
      case 'dequeue':
        frontier.delete(event.nodeId)
        break
      case 'visit_node':
        activePath.push(event.nodeId)
        break
      case 'mark_visited': {
        visited.add(event.nodeId)
        const i = activePath.lastIndexOf(event.nodeId)
        if (i >= 0) activePath.splice(i, 1)
        break
      }
      case 'update_distance':
        distances.set(event.nodeId, event.distance)
        break
      case 'matrix_update':
        matrix = event
        break
      case 'add_to_mst':
        mstEdges.add(event.edgeId)
        break
      case 'reject_edge':
        rejectedEdges.add(event.edgeId)
        break
      case 'scc_found':
        for (const nodeId of event.nodeIds) sccMembers.add(nodeId)
        break
      case 'bridge_found':
        bridgeEdges.add(event.edgeId)
        break
      case 'articulation_point_found':
        articulationPoints.add(event.nodeId)
        break
      default:
        break // relax_edge, finish, ... don't change node state
    }
  }

  const last = eventsSoFar[eventsSoFar.length - 1]
  return {
    visited,
    frontier,
    active: activePath.length > 0 ? activePath[activePath.length - 1] : null,
    examinedEdgeId: last?.type === 'relax_edge' ? last.edgeId : null,
    distances,
    mstEdges,
    rejectedEdges,
    matrix,
    waypoint: matrix?.waypointNodeId ?? null,
    sccMembers,
    bridgeEdges,
    articulationPoints,
  }
}
