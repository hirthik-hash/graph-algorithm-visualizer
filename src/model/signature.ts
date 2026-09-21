/**
 * A string that changes exactly when a graph change would change an algorithm's
 * result: node ids, edge ids/endpoints, directed/weighted, and weights (only
 * while the graph is weighted, since hidden weights are ignored).
 *
 * By default it IGNORES node positions and labels: dragging a node or renaming
 * it must not throw away a loaded run. An algorithm whose result depends on
 * positions (A*, via its heuristic) asks for `includeCoordinates`, so moving a
 * node correctly invalidates ITS run.
 */
import type { Graph } from './graph'

export function structureSignature(graph: Graph, options: { includeCoordinates?: boolean } = {}): string {
  return JSON.stringify([
    graph.directed,
    graph.weighted,
    graph.nodes.map((n) => (options.includeCoordinates ? [n.id, n.x ?? null, n.y ?? null] : n.id)),
    graph.edges.map((e) => [e.id, e.source, e.target, graph.weighted ? (e.weight ?? null) : null]),
  ])
}
