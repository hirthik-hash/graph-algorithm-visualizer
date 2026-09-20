/**
 * THROWAWAY proof-of-life (Day 1).
 *
 * Purpose: prove the graph model is actually traversable before we build the
 * step/event engine on top of it. It returns only a visit order — no events,
 * no steps. The real BFS (Day 8) replaces it and emits AlgorithmEvents.
 */
import type { Graph } from '../model/graph'

export function bfsOrder(graph: Graph, startId: string): string[] {
  if (!graph.nodes.some((n) => n.id === startId)) {
    throw new Error(`Start node not found: "${startId}"`)
  }

  const neighbors = (id: string): string[] => {
    const out: string[] = []
    for (const e of graph.edges) {
      if (e.source === id) out.push(e.target)
      else if (!graph.directed && e.target === id) out.push(e.source)
    }
    return out
  }

  const visited = new Set<string>([startId])
  const queue: string[] = [startId]
  const order: string[] = []

  while (queue.length > 0) {
    const current = queue.shift()!
    order.push(current)
    for (const next of neighbors(current)) {
      if (!visited.has(next)) {
        visited.add(next)
        queue.push(next)
      }
    }
  }
  return order
}
