/**
 * The algorithm registry (pulled forward to Day 12).
 *
 * Two consumers now need "the list of algorithms" (the playback picker and the
 * comparison table), which is exactly the moment to stop hardcoding it in each.
 * ADDING an algorithm means writing its file and adding ONE import and ONE
 * array entry here. Nothing else needs to change.
 */
import type { Algorithm } from '../engine/algorithm'
import { aStarAlgorithm } from './aStar'
import { bellmanFordAlgorithm } from './bellmanFord'
import { bfsAlgorithm } from './bfs'
import { dfsAlgorithm } from './dfs'
import { dfsTopoSortAlgorithm } from './dfsTopoSort'
import { dijkstraAlgorithm } from './dijkstra'
import { floydWarshallAlgorithm } from './floydWarshall'
import { kahnsTopoSortAlgorithm } from './kahnsTopoSort'
import { kruskalAlgorithm } from './kruskal'
import { primAlgorithm } from './prim'

export const ALGORITHM_REGISTRY: readonly Algorithm[] = [
  bfsAlgorithm,
  dfsAlgorithm,
  dijkstraAlgorithm,
  bellmanFordAlgorithm,
  aStarAlgorithm,
  floydWarshallAlgorithm,
  primAlgorithm,
  kruskalAlgorithm,
  kahnsTopoSortAlgorithm,
  dfsTopoSortAlgorithm,
]

export function getAlgorithmById(id: string): Algorithm | undefined {
  return ALGORITHM_REGISTRY.find((a) => a.id === id)
}
