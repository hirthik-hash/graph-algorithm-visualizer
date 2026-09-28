/**
 * explainEvent (Day 7): one plain-English sentence for any AlgorithmEvent.
 *
 * The design rule: this reads ONLY the event's own shape. It never receives or
 * checks an algorithm id. Because events carry a `structure` ("queue", "stack",
 * "priority_queue"), the same code says "added to the queue" for BFS and
 * "pushed onto the stack" for DFS. Any algorithm that emits standard events is
 * explained for free, and a new event type that isn't handled here is a
 * COMPILE error (see assertNever).
 */
import type { AlgorithmEvent, FrontierStructure, RejectReason } from './events'

const structureName: Record<FrontierStructure, string> = {
  queue: 'the queue',
  stack: 'the stack',
  priority_queue: 'the priority queue',
}

const rejectReasonText: Record<RejectReason, string> = {
  would_form_cycle: 'it would form a cycle',
}

function assertNever(value: never): never {
  throw new Error(`Unhandled event: ${JSON.stringify(value)}`)
}

/** `labelOf` maps node ids to their display labels (defaults to the id itself). */
export function explainEvent(event: AlgorithmEvent, labelOf: (nodeId: string) => string = (id) => id): string {
  switch (event.type) {
    case 'visit_node':
      return `Visiting ${labelOf(event.nodeId)}.`

    case 'enqueue': {
      const node = labelOf(event.nodeId)
      const where = structureName[event.structure]
      const verb = event.structure === 'stack' ? 'Pushed' : 'Added'
      const prep = event.structure === 'stack' ? 'onto' : 'to'
      const from = event.fromNodeId === undefined ? '' : `, reached from ${labelOf(event.fromNodeId)}`
      const priority = event.priority === undefined ? '' : ` with priority ${event.priority}`
      return `${verb} ${node} ${prep} ${where}${priority}${from}.`
    }

    case 'dequeue': {
      const node = labelOf(event.nodeId)
      if (event.structure === 'stack') return `Popped ${node} off the stack.`
      if (event.structure === 'priority_queue') return `Took ${node} off the priority queue (lowest priority first).`
      return `Took ${node} off the queue.`
    }

    case 'relax_edge': {
      const weight = event.weight === undefined ? '' : ` (weight ${event.weight})`
      return `Following edge ${event.edgeId} from ${labelOf(event.source)} to ${labelOf(event.target)}${weight}.`
    }

    case 'update_distance': {
      const node = labelOf(event.nodeId)
      const via = event.viaNodeId === undefined ? '' : ` via ${labelOf(event.viaNodeId)}`
      if (event.previousDistance === null) {
        return `Distance to ${node} is now ${event.distance}${via} (first path found).`
      }
      return `Found a shorter path to ${node}: distance ${event.distance}, down from ${event.previousDistance}${via}.`
    }

    case 'mark_visited':
      return `Finished with ${labelOf(event.nodeId)}.`

    case 'negative_cycle_detected':
      return `Negative cycle detected: edge ${event.edgeId} can still be shortened.`

    case 'matrix_update': {
      if (event.waypointNodeId === undefined) return 'Built the starting distance matrix from the edges.'
      const node = labelOf(event.waypointNodeId)
      const n = event.changed.length
      if (n === 0) return `Allowing paths through ${node}: no distances improved.`
      return `Allowing paths through ${node}: ${n} distance${n === 1 ? '' : 's'} improved.`
    }

    case 'add_to_mst': {
      const weight = event.weight === undefined ? '' : `, weight ${event.weight}`
      return `Added edge ${event.edgeId} (${labelOf(event.source)} — ${labelOf(event.target)}${weight}) to the spanning tree.`
    }

    case 'reject_edge': {
      const weight = event.weight === undefined ? '' : `, weight ${event.weight}`
      const edge = `${event.edgeId} (${labelOf(event.source)} — ${labelOf(event.target)}${weight})`
      return `Rejected edge ${edge}: ${rejectReasonText[event.reason]}.`
    }

    case 'scc_found': {
      const names = event.nodeIds.map(labelOf).join(', ')
      return event.nodeIds.length === 1
        ? `${names} forms its own strongly connected component.`
        : `Found a strongly connected component: { ${names} }.`
    }

    case 'bridge_found':
      return `Edge ${event.edgeId} (${labelOf(event.source)} — ${labelOf(event.target)}) is a bridge: removing it would disconnect the graph.`

    case 'articulation_point_found':
      return `${labelOf(event.nodeId)} is an articulation point: removing it would disconnect the graph.`

    case 'finish':
      return 'Finished.'

    default:
      return assertNever(event)
  }
}
