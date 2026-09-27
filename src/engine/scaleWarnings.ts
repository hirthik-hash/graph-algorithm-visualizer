/**
 * Scale warnings (Milestone 5): a non-blocking heads-up when an algorithm's
 * memory footprint could genuinely matter for the graph in front of it.
 *
 * This deliberately WARNS rather than caps or refuses. The generator already
 * allows up to 200 nodes, hand-drawn graphs have no limit at all, and picking
 * a large graph is a legitimate thing to do — the goal is just to make an
 * invisible cost visible before the browser has to find out the hard way,
 * matching how the algorithm picker (Milestone 2) informs rather than blocks.
 *
 * Structured as a lookup keyed by algorithm id (like compare.ts's BIG_O
 * table), so a second algorithm that deserves a scale warning later is one
 * more entry, not a rewrite.
 */
import type { Algorithm } from './algorithm'
import type { Graph } from '../model/graph'

const FLOYD_WARSHALL_WARNING_THRESHOLD = 50

/** How many numbers Floyd-Warshall holds in memory across a full run: one (n+1)-node-squared matrix per waypoint snapshot, including the initial one. */
export function estimateFloydWarshallCells(nodeCount: number): number {
  return (nodeCount + 1) * nodeCount * nodeCount
}

/**
 * A human-readable warning if `algorithm` could be genuinely heavy on
 * `graph`, or null if there's nothing worth flagging. Only Floyd-Warshall has
 * a rule today — it's the one algorithm in this project whose memory use
 * grows as the CUBE of the node count (see docs/audit-v1.md).
 */
export function algorithmScaleWarning(graph: Graph, algorithm: Algorithm): string | null {
  if (algorithm.id !== 'floyd-warshall') return null
  const n = graph.nodes.length
  if (n <= FLOYD_WARSHALL_WARNING_THRESHOLD) return null

  const cells = estimateFloydWarshallCells(n)
  return (
    `Floyd-Warshall stores a full ${n}×${n} distance matrix at every step. ` +
    `At ${n} nodes, this run holds roughly ${cells.toLocaleString()} numbers in memory across ${n + 1} snapshots — ` +
    'this may be slow or use a lot of memory on very large graphs.'
  )
}
