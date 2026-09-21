import { describe, expect, it } from 'vitest'
import { bfsAlgorithm } from '../algorithms/bfs'
import { dfsAlgorithm } from '../algorithms/dfs'
import { addEdge, addNode, createGraph } from '../model/graph'
import { computeHighlights } from './highlights'
import type { AlgorithmEvent } from './events'

describe('computeHighlights', () => {
  it('is empty before any events', () => {
    const h = computeHighlights([])
    expect([...h.visited]).toEqual([])
    expect([...h.frontier]).toEqual([])
    expect(h.active).toBeNull()
    expect(h.examinedEdgeId).toBeNull()
  })

  it('tracks the frontier: enqueue adds, dequeue removes', () => {
    const events: AlgorithmEvent[] = [
      { type: 'enqueue', nodeId: 'A', structure: 'queue' },
      { type: 'enqueue', nodeId: 'B', structure: 'queue', fromNodeId: 'A' },
      { type: 'dequeue', nodeId: 'A', structure: 'queue' },
    ]
    expect([...computeHighlights(events).frontier]).toEqual(['B'])
  })

  it('makes a node active on visit_node and visited (not active) on mark_visited', () => {
    const visit: AlgorithmEvent[] = [{ type: 'visit_node', nodeId: 'A' }]
    expect(computeHighlights(visit).active).toBe('A')
    const done: AlgorithmEvent[] = [...visit, { type: 'mark_visited', nodeId: 'A' }]
    const h = computeHighlights(done)
    expect(h.active).toBeNull()
    expect([...h.visited]).toEqual(['A'])
  })

  it('returns to the parent as active after a nested (DFS-style) child finishes', () => {
    const events: AlgorithmEvent[] = [
      { type: 'visit_node', nodeId: 'A' },
      { type: 'visit_node', nodeId: 'B' },
    ]
    expect(computeHighlights(events).active).toBe('B')
    expect(computeHighlights([...events, { type: 'mark_visited', nodeId: 'B' }]).active).toBe('A')
  })

  it('reports an examined edge only while the latest event is a relax_edge', () => {
    const relax: AlgorithmEvent = { type: 'relax_edge', edgeId: 'e3', source: 'A', target: 'B' }
    expect(computeHighlights([relax]).examinedEdgeId).toBe('e3')
    expect(computeHighlights([relax, { type: 'visit_node', nodeId: 'B' }]).examinedEdgeId).toBeNull()
  })

  it('works on real BFS and DFS runs: everything reachable ends visited, nothing left active or queued', () => {
    let g = createGraph()
    for (const id of ['A', 'B', 'C', 'D']) g = addNode(g, { id })
    g = addEdge(g, { id: 'e1', source: 'A', target: 'B' })
    g = addEdge(g, { id: 'e2', source: 'A', target: 'C' })
    g = addEdge(g, { id: 'e3', source: 'B', target: 'D' })
    for (const algorithm of [bfsAlgorithm, dfsAlgorithm]) {
      const h = computeHighlights(algorithm.run(g, { startNodeId: 'A' }))
      expect([...h.visited].sort()).toEqual(['A', 'B', 'C', 'D'])
      expect(h.frontier.size).toBe(0)
      expect(h.active).toBeNull()
    }
  })

  it('tracks the latest known distance per node (Day 7)', () => {
    const events: AlgorithmEvent[] = [
      { type: 'update_distance', nodeId: 'A', distance: 0, previousDistance: null },
      { type: 'update_distance', nodeId: 'B', distance: 9, previousDistance: null, viaNodeId: 'A' },
      { type: 'update_distance', nodeId: 'B', distance: 4, previousDistance: 9, viaNodeId: 'C' },
    ]
    const d = computeHighlights(events).distances
    expect(d.get('A')).toBe(0)
    expect(d.get('B')).toBe(4) // the later update wins
    expect(d.has('C')).toBe(false) // never reached: absent, not Infinity
  })

  it('shows earlier distances again when you step backwards (it is recomputed from the prefix)', () => {
    const events: AlgorithmEvent[] = [
      { type: 'update_distance', nodeId: 'B', distance: 9, previousDistance: null },
      { type: 'update_distance', nodeId: 'B', distance: 4, previousDistance: 9 },
    ]
    expect(computeHighlights(events.slice(0, 1)).distances.get('B')).toBe(9)
    expect(computeHighlights(events.slice(0, 0)).distances.has('B')).toBe(false)
  })

  it('keeps the latest matrix snapshot and its waypoint (Floyd-Warshall)', () => {
    const first: AlgorithmEvent = { type: 'matrix_update', nodeIds: ['A', 'B'], matrix: [[0, 5], [null, 0]], changed: [] }
    const second: AlgorithmEvent = {
      type: 'matrix_update',
      nodeIds: ['A', 'B'],
      matrix: [[0, 3], [null, 0]],
      waypointNodeId: 'A',
      changed: [[0, 1]],
    }
    const initial = computeHighlights([first])
    expect(initial.matrix).toBe(first)
    expect(initial.waypoint).toBeNull()
    const later = computeHighlights([first, second])
    expect(later.matrix).toBe(second)
    expect(later.waypoint).toBe('A')
    expect(computeHighlights([]).matrix).toBeNull()
  })
})
