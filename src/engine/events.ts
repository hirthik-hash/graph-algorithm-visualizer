/**
 * Algorithm events (Day 5).
 *
 * An algorithm does not draw anything. It runs to completion on a graph and
 * returns an ordered list of AlgorithmEvents describing what it did. Everything
 * else (playback, highlighting, plain-English explanations, comparison tables,
 * quizzes) is derived from that list. That is what makes each new algorithm
 * cheap: it only has to emit events.
 *
 * Rules for events:
 *  - Plain JSON only (no Map/Set/Infinity/undefined-as-value). Traces will be
 *    exported and shared later, and Infinity does not survive JSON, so
 *    "distance not known yet / infinite" is written as null.
 *  - Ids only (node ids, edge ids). Never object references into the graph.
 *  - Describe what HAPPENED, not how to draw it. Rendering lives in the UI.
 */

/**
 * Bump when an existing event's shape changes in a breaking way. Saved or
 * shared traces (Day 22 export) can then be recognised as old or unsupported.
 * Adding a NEW event type is not breaking.
 */
export const EVENT_SCHEMA_VERSION = 1 as const

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

/** The frontier data structure an algorithm is using. Lets one explainer say "queue" or "stack" without knowing which algorithm ran. */
export type FrontierStructure = 'queue' | 'stack' | 'priority_queue'

/** The algorithm starts processing this node (e.g. the node just taken off the frontier). */
export interface VisitNodeEvent {
  type: 'visit_node'
  nodeId: string
}

/** A node was added to the frontier. */
export interface EnqueueEvent {
  type: 'enqueue'
  nodeId: string
  structure: FrontierStructure
  /** The node whose neighbour this is, when there is one (the start node has none). */
  fromNodeId?: string
  /** Priority used by a priority queue (a distance, or distance + heuristic). */
  priority?: number
}

/** A node was taken off the frontier. */
export interface DequeueEvent {
  type: 'dequeue'
  nodeId: string
  structure: FrontierStructure
}

/**
 * An edge is being examined. `source`/`target` are in the direction the
 * algorithm traversed it, which for an undirected edge may be the reverse of
 * how it is stored.
 */
export interface RelaxEdgeEvent {
  type: 'relax_edge'
  edgeId: string
  source: string
  target: string
  weight?: number
}

/** A node's best-known distance changed. null means "infinite / not reached yet". */
export interface UpdateDistanceEvent {
  type: 'update_distance'
  nodeId: string
  distance: number
  previousDistance: number | null
  /** The node we arrived from, when the algorithm tracks predecessors. */
  viaNodeId?: string
}

/** A node is finished: the algorithm will not process it again. */
export interface MarkVisitedEvent {
  type: 'mark_visited'
  nodeId: string
}

/** A negative-weight cycle was found; `edgeId` is an edge that could still be relaxed. */
export interface NegativeCycleDetectedEvent {
  type: 'negative_cycle_detected'
  edgeId: string
}

/** The algorithm is done. `result` carries algorithm-specific outputs (JSON only). */
export interface FinishEvent {
  type: 'finish'
  result: { [key: string]: JsonValue }
}

export type AlgorithmEvent =
  | VisitNodeEvent
  | EnqueueEvent
  | DequeueEvent
  | RelaxEdgeEvent
  | UpdateDistanceEvent
  | MarkVisitedEvent
  | NegativeCycleDetectedEvent
  | FinishEvent

export type AlgorithmEventType = AlgorithmEvent['type']

/**
 * Typed as a Record so that adding a new event type to the union above without
 * listing it here is a COMPILE error. EVENT_TYPES is derived from it, so any
 * code that needs "every event type" (tests, explainers, exhaustive UI maps)
 * can never silently miss a new one.
 */
const EVENT_TYPE_SET: Record<AlgorithmEventType, true> = {
  visit_node: true,
  enqueue: true,
  dequeue: true,
  relax_edge: true,
  update_distance: true,
  mark_visited: true,
  negative_cycle_detected: true,
  finish: true,
}

export const EVENT_TYPES = Object.keys(EVENT_TYPE_SET) as AlgorithmEventType[]
