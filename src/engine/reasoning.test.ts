import { describe, expect, it } from 'vitest'
import { aStarAlgorithm } from '../algorithms/aStar'
import { bellmanFordAlgorithm } from '../algorithms/bellmanFord'
import { bfsAlgorithm } from '../algorithms/bfs'
import { dfsAlgorithm } from '../algorithms/dfs'
import { dijkstraAlgorithm } from '../algorithms/dijkstra'
import { addEdge, addNode, createGraph } from '../model/graph'
import type { Graph } from '../model/graph'
import type { AlgorithmEvent } from './events'
import { buildStepReasoning } from './reasoning'

function upTo(events: AlgorithmEvent[], index: number): AlgorithmEvent[] {
  return events.slice(0, index + 1) // inclusive: "events so far, ending at this one"
}

describe('buildStepReasoning: hand-built event sequences', () => {
  it('returns null before any events', () => {
    expect(buildStepReasoning([])).toBeNull()
  })

  it('relax_edge: target has no known distance yet', () => {
    const events: AlgorithmEvent[] = [
      { type: 'update_distance', nodeId: 'A', distance: 0, previousDistance: null },
      { type: 'relax_edge', edgeId: 'e1', source: 'A', target: 'B', weight: 4 },
    ]
    const r = buildStepReasoning(events)!
    expect(r.lines).toEqual([
      'Current distance to A: 0',
      'Edge A → B, weight 4',
      'Candidate distance to B: 0 + 4 = 4',
      'B has no known distance yet — this would set it to 4',
    ])
  })

  it('relax_edge: candidate improves an existing distance', () => {
    const events: AlgorithmEvent[] = [
      { type: 'update_distance', nodeId: 'A', distance: 0, previousDistance: null },
      { type: 'update_distance', nodeId: 'C', distance: 10, previousDistance: null, viaNodeId: 'A' },
      { type: 'update_distance', nodeId: 'B', distance: 4, previousDistance: null, viaNodeId: 'A' },
      { type: 'relax_edge', edgeId: 'e2', source: 'B', target: 'C', weight: 3 },
    ]
    const r = buildStepReasoning(events)!
    expect(r.lines).toEqual([
      'Current distance to B: 4',
      'Edge B → C, weight 3',
      'Candidate distance to C: 4 + 3 = 7',
      'Existing distance to C: 10 — 7 is shorter, so this improves it',
    ])
  })

  it('relax_edge: candidate does NOT improve an existing distance', () => {
    const events: AlgorithmEvent[] = [
      { type: 'update_distance', nodeId: 'A', distance: 0, previousDistance: null },
      { type: 'update_distance', nodeId: 'C', distance: 2, previousDistance: null, viaNodeId: 'A' },
      { type: 'update_distance', nodeId: 'B', distance: 4, previousDistance: null, viaNodeId: 'A' },
      { type: 'relax_edge', edgeId: 'e2', source: 'B', target: 'C', weight: 3 },
    ]
    const r = buildStepReasoning(events)!
    expect(r.lines[3]).toBe('Existing distance to C: 2 — 7 is not shorter, so nothing changes')
  })

  it('relax_edge: returns null when the source has no known distance (nothing to reason about)', () => {
    const events: AlgorithmEvent[] = [{ type: 'relax_edge', edgeId: 'e1', source: 'A', target: 'B' }]
    expect(buildStepReasoning(events)).toBeNull()
  })

  it('relax_edge: a missing weight is treated as 1 (unweighted graphs)', () => {
    const events: AlgorithmEvent[] = [
      { type: 'update_distance', nodeId: 'A', distance: 0, previousDistance: null },
      { type: 'relax_edge', edgeId: 'e1', source: 'A', target: 'B' },
    ]
    const r = buildStepReasoning(events)!
    expect(r.lines[1]).toBe('Edge A → B, weight 1')
    expect(r.lines[2]).toBe('Candidate distance to B: 0 + 1 = 1')
  })

  it('update_distance: the start node\'s own initialization has no viaNodeId and returns null', () => {
    const events: AlgorithmEvent[] = [{ type: 'update_distance', nodeId: 'A', distance: 0, previousDistance: null }]
    expect(buildStepReasoning(events)).toBeNull()
  })

  it('update_distance: first path found (previousDistance null) via a real predecessor', () => {
    const events: AlgorithmEvent[] = [
      { type: 'update_distance', nodeId: 'A', distance: 0, previousDistance: null },
      { type: 'relax_edge', edgeId: 'e1', source: 'A', target: 'B', weight: 5 },
      { type: 'update_distance', nodeId: 'B', distance: 5, previousDistance: null, viaNodeId: 'A' },
    ]
    const r = buildStepReasoning(events)!
    expect(r.lines).toEqual([
      'Current distance to A: 0',
      'Edge A → B, weight 5',
      'Candidate distance to B: 0 + 5 = 5',
      'B had no known distance yet — set to 5',
    ])
  })

  it('update_distance: an improvement over a previous distance', () => {
    const events: AlgorithmEvent[] = [
      { type: 'update_distance', nodeId: 'A', distance: 0, previousDistance: null },
      { type: 'update_distance', nodeId: 'C', distance: 10, previousDistance: null, viaNodeId: 'A' },
      { type: 'update_distance', nodeId: 'B', distance: 4, previousDistance: null, viaNodeId: 'A' },
      { type: 'relax_edge', edgeId: 'e2', source: 'B', target: 'C', weight: 3 },
      { type: 'update_distance', nodeId: 'C', distance: 7, previousDistance: 10, viaNodeId: 'B' },
    ]
    const r = buildStepReasoning(events)!
    expect(r.lines).toEqual([
      'Current distance to B: 4',
      'Edge B → C, weight 3',
      'Candidate distance to C: 4 + 3 = 7',
      'Existing distance to C: 10 — 7 is shorter, so it\'s updated',
    ])
  })

  it('update_distance: returns null when no matching relax_edge can be found (defensive fallback)', () => {
    const events: AlgorithmEvent[] = [
      { type: 'update_distance', nodeId: 'A', distance: 0, previousDistance: null },
      { type: 'update_distance', nodeId: 'B', distance: 5, previousDistance: null, viaNodeId: 'A' }, // no relax_edge A->B before this
    ]
    expect(buildStepReasoning(events)).toBeNull()
  })

  it('uses display labels when given a labelOf function', () => {
    const events: AlgorithmEvent[] = [
      { type: 'update_distance', nodeId: 'A', distance: 0, previousDistance: null },
      { type: 'relax_edge', edgeId: 'e1', source: 'A', target: 'B', weight: 2 },
    ]
    const labels: Record<string, string> = { A: 'Start', B: 'Goal' }
    const r = buildStepReasoning(events, (id) => labels[id] ?? id)!
    expect(r.lines[0]).toBe('Current distance to Start: 0')
    expect(r.lines[1]).toBe('Edge Start → Goal, weight 2')
  })
})

describe('buildStepReasoning: real algorithm runs', () => {
  function weightedTriangle(): Graph {
    let g = createGraph({ weighted: true })
    g = addNode(addNode(addNode(g, { id: 'A' }), { id: 'B' }), { id: 'C' })
    g = addEdge(g, { id: 'e1', source: 'A', target: 'B', weight: 4 })
    g = addEdge(g, { id: 'e2', source: 'A', target: 'C', weight: 1 })
    g = addEdge(g, { id: 'e3', source: 'C', target: 'B', weight: 2 })
    return g
  }

  it('gives non-null reasoning for every relax_edge/update_distance step of a real Dijkstra run', () => {
    const g = weightedTriangle()
    const events = dijkstraAlgorithm.run(g, { startNodeId: 'A' })
    let sawReasoning = false
    events.forEach((event, i) => {
      if (event.type === 'relax_edge' || (event.type === 'update_distance' && event.viaNodeId !== undefined)) {
        const r = buildStepReasoning(upTo(events, i))
        expect(r).not.toBeNull()
        expect(r!.lines.length).toBeGreaterThan(0)
        sawReasoning = true
      }
    })
    expect(sawReasoning).toBe(true) // the graph actually exercised this, not a vacuous pass
  })

  it('gives non-null reasoning for a real Bellman-Ford run, including a negative-weight edge', () => {
    let g = createGraph({ directed: true, weighted: true })
    g = addNode(addNode(g, { id: 'A' }), { id: 'B' })
    g = addEdge(g, { id: 'e1', source: 'A', target: 'B', weight: -3 })
    const events = bellmanFordAlgorithm.run(g, { startNodeId: 'A' })
    const relax = events.find((e) => e.type === 'relax_edge' && e.source === 'A')
    const index = events.indexOf(relax!)
    const r = buildStepReasoning(upTo(events, index))!
    expect(r.lines[1]).toBe('Edge A → B, weight -3')
  })

  it('gives non-null reasoning for a real A* run (same event shapes as Dijkstra)', () => {
    let g = createGraph({ weighted: true })
    g = addNode(addNode(addNode(g, { id: 'A', x: 0, y: 0 }), { id: 'B', x: 5, y: 0 }), { id: 'C', x: 10, y: 0 })
    g = addEdge(g, { id: 'e1', source: 'A', target: 'B', weight: 5 })
    g = addEdge(g, { id: 'e2', source: 'B', target: 'C', weight: 5 })
    const events = aStarAlgorithm.run(g, { startNodeId: 'A', goalNodeId: 'C' })
    const updateIndex = events.findIndex((e) => e.type === 'update_distance' && e.nodeId === 'C')
    const r = buildStepReasoning(upTo(events, updateIndex))!
    expect(r.lines.some((l) => l.includes('Candidate distance to C'))).toBe(true)
  })

  it('returns null for every step of a plain BFS or DFS run (no distance concept)', () => {
    let g = createGraph()
    g = addNode(addNode(addNode(g, { id: 'A' }), { id: 'B' }), { id: 'C' })
    g = addEdge(addEdge(g, { id: 'e1', source: 'A', target: 'B' }), { id: 'e2', source: 'B', target: 'C' })
    for (const algorithm of [bfsAlgorithm, dfsAlgorithm]) {
      const events = algorithm.run(g, { startNodeId: 'A' })
      events.forEach((_, i) => {
        expect(buildStepReasoning(upTo(events, i))).toBeNull()
      })
    }
  })
})
