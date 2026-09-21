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
 *  - matrix / waypoint: the latest matrix snapshot and its waypoint node (Day 8, Floyd-Warshall)
 */
import type { AlgorithmEvent, MatrixUpdateEvent } from './events'

export interface Highlights {
  visited: Set<string>
  frontier: Set<string>
  active: string | null
  examinedEdgeId: string | null
  distances: Map<string, number>
  matrix: MatrixUpdateEvent | null
  waypoint: string | null
}

export function computeHighlights(eventsSoFar: readonly AlgorithmEvent[]): Highlights {
  const visited = new Set<string>()
  const frontier = new Set<string>()
  const distances = new Map<string, number>()
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
    matrix,
    waypoint: matrix?.waypointNodeId ?? null,
  }
}
