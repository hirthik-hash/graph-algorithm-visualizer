import { describe, expect, it } from 'vitest'
import { bfsAlgorithm } from '../algorithms/bfs'
import { dfsAlgorithm } from '../algorithms/dfs'
import { dijkstraAlgorithm } from '../algorithms/dijkstra'
import { addEdge, addNode, createGraph } from '../model/graph'
import { explainEvent } from './explain'
import { EVENT_TYPES } from './events'
import type { AlgorithmEvent } from './events'

const SAMPLES: Record<AlgorithmEvent['type'], AlgorithmEvent> = {
  visit_node: { type: 'visit_node', nodeId: 'A' },
  enqueue: { type: 'enqueue', nodeId: 'B', structure: 'queue', fromNodeId: 'A' },
  dequeue: { type: 'dequeue', nodeId: 'B', structure: 'queue' },
  relax_edge: { type: 'relax_edge', edgeId: 'e1', source: 'A', target: 'B', weight: 3 },
  update_distance: { type: 'update_distance', nodeId: 'B', distance: 3, previousDistance: null, viaNodeId: 'A' },
  mark_visited: { type: 'mark_visited', nodeId: 'B' },
  negative_cycle_detected: { type: 'negative_cycle_detected', edgeId: 'e2' },
  matrix_update: { type: 'matrix_update', nodeIds: ['A', 'B'], matrix: [[0, 3], [null, 0]], waypointNodeId: 'A', changed: [[0, 1]] },
  finish: { type: 'finish', result: {} },
}

describe('explainEvent', () => {
  it('explains every event type with a non-empty sentence', () => {
    for (const type of EVENT_TYPES) {
      const text = explainEvent(SAMPLES[type])
      expect(text.length).toBeGreaterThan(5)
      expect(text).not.toMatch(/undefined|\[object/)
    }
  })

  it('names the data structure from the event itself: queue vs stack vs priority queue', () => {
    const enqueue = (structure: 'queue' | 'stack' | 'priority_queue'): AlgorithmEvent => ({
      type: 'enqueue',
      nodeId: 'B',
      structure,
      fromNodeId: 'A',
    })
    expect(explainEvent(enqueue('queue'))).toBe('Added B to the queue, reached from A.')
    expect(explainEvent(enqueue('stack'))).toBe('Pushed B onto the stack, reached from A.')
    expect(explainEvent(enqueue('priority_queue'))).toBe('Added B to the priority queue, reached from A.')
    expect(explainEvent({ type: 'dequeue', nodeId: 'B', structure: 'stack' })).toBe('Popped B off the stack.')
    expect(explainEvent({ type: 'dequeue', nodeId: 'B', structure: 'queue' })).toBe('Took B off the queue.')
  })

  it('mentions priority and omits "reached from" when the event has none', () => {
    expect(explainEvent({ type: 'enqueue', nodeId: 'A', structure: 'priority_queue', priority: 0 })).toBe(
      'Added A to the priority queue with priority 0.',
    )
  })

  it('describes edges with and without weights', () => {
    expect(explainEvent(SAMPLES.relax_edge)).toBe('Following edge e1 from A to B (weight 3).')
    expect(explainEvent({ type: 'relax_edge', edgeId: 'e1', source: 'A', target: 'B' })).toBe(
      'Following edge e1 from A to B.',
    )
  })

  it('distinguishes a first path from a shorter path', () => {
    expect(explainEvent(SAMPLES.update_distance)).toBe('Distance to B is now 3 via A (first path found).')
    expect(
      explainEvent({ type: 'update_distance', nodeId: 'B', distance: 3, previousDistance: 4, viaNodeId: 'C' }),
    ).toBe('Found a shorter path to B: distance 3, down from 4 via C.')
  })

  it('uses display labels when given a labelOf function', () => {
    const labels: Record<string, string> = { A: 'Start', B: 'Goal' }
    const labelOf = (id: string) => labels[id] ?? id
    expect(explainEvent(SAMPLES.relax_edge, labelOf)).toBe('Following edge e1 from Start to Goal (weight 3).')
  })

  it('explains real runs of three different algorithms without knowing which one produced them', () => {
    let g = createGraph({ weighted: true })
    for (const id of ['A', 'B', 'C']) g = addNode(g, { id })
    g = addEdge(g, { id: 'e1', source: 'A', target: 'B', weight: 2 })
    g = addEdge(g, { id: 'e2', source: 'B', target: 'C', weight: 3 })
    for (const algorithm of [bfsAlgorithm, dfsAlgorithm, dijkstraAlgorithm]) {
      const sentences = algorithm.run(g, { startNodeId: 'A' }).map((e) => explainEvent(e))
      expect(sentences.length).toBeGreaterThan(3)
      for (const s of sentences) expect(s).toMatch(/^[A-Z].*\.$/)
    }
  })

  it('explains matrix snapshots: the initial one, a waypoint with no change, one change, several changes', () => {
    const base = { type: 'matrix_update' as const, nodeIds: ['A', 'B'], matrix: [[0, 1], [1, 0]] }
    expect(explainEvent({ ...base, changed: [] })).toBe('Built the starting distance matrix from the edges.')
    expect(explainEvent({ ...base, waypointNodeId: 'A', changed: [] })).toBe(
      'Allowing paths through A: no distances improved.',
    )
    expect(explainEvent({ ...base, waypointNodeId: 'B', changed: [[0, 1]] })).toBe(
      'Allowing paths through B: 1 distance improved.',
    )
    expect(explainEvent({ ...base, waypointNodeId: 'B', changed: [[0, 1], [1, 0]] })).toBe(
      'Allowing paths through B: 2 distances improved.',
    )
  })
})
