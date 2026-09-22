import { describe, expect, it } from 'vitest'
import { ALGORITHM_REGISTRY } from './registry'
import { hasPseudocode, linesForEvent, pseudocodeFor, PSEUDOCODE } from './pseudocode'
import { bellmanFordAlgorithm } from './bellmanFord'
import { bfsAlgorithm } from './bfs'
import { dijkstraAlgorithm } from './dijkstra'
import { kruskalAlgorithm } from './kruskal'
import { createGraph, addEdge, addNode } from '../model/graph'
import type { AlgorithmEvent } from '../engine/events'

describe('pseudocode', () => {
  it('has entries for exactly the four documented algorithms', () => {
    expect(Object.keys(PSEUDOCODE).sort()).toEqual(['bellman-ford', 'bfs', 'dijkstra', 'kruskal'])
    expect(hasPseudocode('bfs')).toBe(true)
    expect(hasPseudocode('astar')).toBe(false)
  })

  it('every registered algorithm without pseudocode returns null, not an empty array', () => {
    for (const algorithm of ALGORITHM_REGISTRY) {
      if (hasPseudocode(algorithm.id)) continue
      expect(pseudocodeFor(algorithm.id)).toBeNull()
    }
  })

  it('every algorithm has unique, sequential line numbers starting at 1', () => {
    for (const lines of Object.values(PSEUDOCODE)) {
      expect(lines.map((l) => l.line)).toEqual(lines.map((_, i) => i + 1))
    }
  })

  it('linesForEvent matches purely by event type, with no algorithm-specific logic', () => {
    const lines = pseudocodeFor('bfs')!
    const dequeueLines = linesForEvent(lines, 'dequeue')
    expect(dequeueLines).toHaveLength(1)
    expect(dequeueLines[0].text).toContain('dequeue')
    expect(linesForEvent(lines, 'add_to_mst')).toEqual([]) // BFS never emits this type
  })

  it('every event type a real BFS run emits has at least one matching line', () => {
    let g = createGraph()
    g = addNode(addNode(addNode(g, { id: 'A' }), { id: 'B' }), { id: 'C' })
    g = addEdge(addEdge(g, { id: 'e1', source: 'A', target: 'B' }), { id: 'e2', source: 'B', target: 'C' })
    const lines = pseudocodeFor('bfs')!
    const seen = new Set(bfsAlgorithm.run(g, { startNodeId: 'A' }).map((e) => e.type))
    seen.delete('finish') // finishing has no pseudocode line; there's nothing left to "do"
    for (const type of seen) expect(linesForEvent(lines, type).length).toBeGreaterThan(0)
  })

  it('every event type a real Dijkstra run emits has at least one matching line', () => {
    let g = createGraph({ weighted: true })
    g = addNode(addNode(addNode(g, { id: 'A' }), { id: 'B' }), { id: 'C' })
    g = addEdge(g, { id: 'e1', source: 'A', target: 'B', weight: 2 })
    g = addEdge(g, { id: 'e2', source: 'B', target: 'C', weight: 3 })
    const lines = pseudocodeFor('dijkstra')!
    const seen = new Set(dijkstraAlgorithm.run(g, { startNodeId: 'A' }).map((e) => e.type))
    seen.delete('finish')
    for (const type of seen) expect(linesForEvent(lines, type).length).toBeGreaterThan(0)
  })

  it('every event type a real Bellman-Ford run emits (including a negative cycle) has a matching line', () => {
    let g = createGraph({ directed: true, weighted: true })
    g = addNode(addNode(g, { id: 'A' }), { id: 'B' })
    g = addEdge(addEdge(g, { id: 'e1', source: 'A', target: 'B', weight: 1 }), {
      id: 'e2',
      source: 'B',
      target: 'A',
      weight: -2,
    })
    const lines = pseudocodeFor('bellman-ford')!
    const events: AlgorithmEvent[] = bellmanFordAlgorithm.run(g, { startNodeId: 'A' })
    expect(events.some((e) => e.type === 'negative_cycle_detected')).toBe(true) // make sure this test graph actually exercises it
    const seen = new Set(events.map((e) => e.type))
    seen.delete('finish')
    for (const type of seen) expect(linesForEvent(lines, type).length).toBeGreaterThan(0)
  })

  it('every event type a real Kruskal run emits (accept AND reject) has a matching line', () => {
    let g = createGraph({ weighted: true })
    g = addNode(addNode(addNode(g, { id: 'A' }), { id: 'B' }), { id: 'C' })
    g = addEdge(g, { id: 'e1', source: 'A', target: 'B', weight: 1 })
    g = addEdge(g, { id: 'e2', source: 'B', target: 'C', weight: 1 })
    g = addEdge(g, { id: 'e3', source: 'A', target: 'C', weight: 1 }) // closes a cycle: rejected
    const lines = pseudocodeFor('kruskal')!
    const events = kruskalAlgorithm.run(g)
    expect(events.some((e) => e.type === 'reject_edge')).toBe(true)
    const seen = new Set(events.map((e) => e.type))
    seen.delete('finish')
    for (const type of seen) expect(linesForEvent(lines, type).length).toBeGreaterThan(0)
  })
})
