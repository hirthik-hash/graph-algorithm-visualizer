/**
 * Floyd-Warshall (Day 8): shortest paths between EVERY pair of nodes.
 *
 * For each waypoint node k (in graph order) it asks, for every pair (i, j):
 * "is going i -> k -> j shorter than what I have?" It emits ONE matrix_update
 * snapshot per waypoint, not one event per cell (that would be O(n^3) events).
 * The first snapshot is the starting matrix with no waypoint.
 *
 * Negative weights are fine. A negative cycle shows up as a NEGATIVE value on
 * the diagonal (a node that can reach itself for less than 0), reported as
 * finish.result.negativeCycle.
 *
 * The diagonal starts at min(0, self-loop weight), not a blanket 0. Forcing it
 * to 0 would hide a negative self-loop, which is a valid 1-node negative cycle.
 *
 * Undirected graphs use a symmetric matrix, so an undirected negative edge is a
 * negative 2-cycle, exactly as in Bellman-Ford.
 *
 * Each snapshot copies an n x n matrix, so a run stores about n^3 numbers in
 * its events. That is fine for editor-sized graphs (30 nodes = 27,000 numbers).
 */
import type { Algorithm } from '../engine/algorithm'
import type { AlgorithmEvent } from '../engine/events'
import { toAdjacencyMatrix } from '../model/representations'

const copy = (matrix: (number | null)[][]) => matrix.map((row) => [...row])

export const floydWarshallAlgorithm: Algorithm = {
  id: 'floyd-warshall',
  name: 'Floyd-Warshall',
  category: 'all-pairs',
  requirements: { weighted: true },

  run(graph) {
    // The Day 3 matrix already keeps the CHEAPEST of any parallel edges and is symmetric when undirected.
    const { nodeIds, cells } = toAdjacencyMatrix(graph)
    const n = nodeIds.length
    const dist = copy(cells)
    for (let i = 0; i < n; i++) dist[i][i] = Math.min(0, dist[i][i] ?? 0)

    const events: AlgorithmEvent[] = []
    events.push({ type: 'matrix_update', nodeIds: [...nodeIds], matrix: copy(dist), changed: [] })

    for (let k = 0; k < n; k++) {
      const changed: [number, number][] = []
      for (let i = 0; i < n; i++) {
        const ik = dist[i][k]
        if (ik === null) continue
        for (let j = 0; j < n; j++) {
          const kj = dist[k][j]
          if (kj === null) continue
          const candidate = ik + kj
          const current = dist[i][j]
          if (current === null || candidate < current) {
            dist[i][j] = candidate
            changed.push([i, j])
          }
        }
      }
      events.push({
        type: 'matrix_update',
        nodeIds: [...nodeIds],
        matrix: copy(dist),
        waypointNodeId: nodeIds[k],
        changed,
      })
    }

    const negativeCycle = dist.some((row, i) => (row[i] ?? 0) < 0)
    events.push({ type: 'finish', result: { nodeIds: [...nodeIds], distances: copy(dist), negativeCycle } })
    return events
  },
}
