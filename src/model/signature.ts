/**
 * A string that changes exactly when a graph change would change an algorithm's
 * result: node ids, edge ids/endpoints, directed/weighted, and weights (only
 * while the graph is weighted, since hidden weights are ignored).
 *
 * It deliberately IGNORES node positions and labels. Dragging a node or
 * renaming it must not throw away a loaded run. (An algorithm that uses
 * coordinates, like A*, will need a coordinate-aware variant when it arrives.)
 */
import type { Graph } from './graph'

export function structureSignature(graph: Graph): string {
  return JSON.stringify([
    graph.directed,
    graph.weighted,
    graph.nodes.map((n) => n.id),
    graph.edges.map((e) => [e.id, e.source, e.target, graph.weighted ? (e.weight ?? null) : null]),
  ])
}
