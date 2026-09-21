/**
 * The Algorithm interface (Day 5).
 *
 * An algorithm is a pure function from (graph, options) to an event list, plus
 * a little metadata. run() must never mutate the graph and must be
 * deterministic (same input, same events), because the Step Engine, the
 * comparison table and the quiz all re-run algorithms and rely on that.
 */
import type { Graph } from '../model/graph'
import type { AlgorithmEvent } from './events'

export type AlgorithmCategory =
  | 'traversal'
  | 'shortest-path'
  | 'all-pairs'
  | 'spanning-tree'
  | 'ordering'

/** Per-run inputs. A real object (not an encoded string) so A*'s goal node has a proper home. */
export interface AlgorithmOptions {
  startNodeId?: string
  goalNodeId?: string
}

/** What a graph (and the options) must look like for the algorithm to be valid. Omitted = no constraint. */
export interface AlgorithmRequirements {
  graphType?: 'directed' | 'undirected'
  /** true = the graph must be weighted. */
  weighted?: boolean
  nonNegativeWeights?: boolean
  startNode?: boolean
  goalNode?: boolean
}

export interface Algorithm {
  id: string
  name: string
  category: AlgorithmCategory
  requirements: AlgorithmRequirements
  /**
   * true if the result depends on node POSITIONS (A*'s heuristic). Moving a
   * node then invalidates a loaded run; for every other algorithm it doesn't.
   */
  usesCoordinates?: boolean
  run(graph: Graph, options?: AlgorithmOptions): AlgorithmEvent[]
}

/**
 * Returns human-readable reasons the algorithm can't run on this graph, or []
 * if it can. ALL problems are reported at once (not just the first) so the UI
 * can show the full list in one warning panel instead of making people fix
 * them one at a time.
 */
export function checkRequirements(
  algorithm: Pick<Algorithm, 'requirements'>,
  graph: Graph,
  options: AlgorithmOptions = {},
): string[] {
  const req = algorithm.requirements
  const problems: string[] = []

  if (req.graphType === 'directed' && !graph.directed) {
    problems.push('Requires a directed graph.')
  }
  if (req.graphType === 'undirected' && graph.directed) {
    problems.push('Requires an undirected graph.')
  }

  if (req.weighted && !graph.weighted) {
    problems.push('Requires a weighted graph.')
  }
  // Weights on an unweighted graph are hidden/ignored, so only check real ones.
  if (req.nonNegativeWeights && graph.weighted) {
    const negative = graph.edges.find((e) => (e.weight ?? 0) < 0)
    if (negative) {
      problems.push(
        `Requires non-negative edge weights (edge ${negative.id} has weight ${negative.weight}).`,
      )
    }
  }

  const hasNode = (id: string) => graph.nodes.some((n) => n.id === id)
  if (req.startNode) {
    if (options.startNodeId === undefined) problems.push('Requires a start node.')
    else if (!hasNode(options.startNodeId)) problems.push(`Start node "${options.startNodeId}" is not in the graph.`)
  }
  if (req.goalNode) {
    if (options.goalNodeId === undefined) problems.push('Requires a goal node.')
    else if (!hasNode(options.goalNodeId)) problems.push(`Goal node "${options.goalNodeId}" is not in the graph.`)
  }

  return problems
}
