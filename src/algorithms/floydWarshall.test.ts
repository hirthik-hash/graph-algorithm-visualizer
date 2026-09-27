import { describe, expect, it } from 'vitest'
import { checkRequirements } from '../engine/algorithm'
import type { AlgorithmEvent } from '../engine/events'
import { createGraph } from '../model/graph'
import type { Graph } from '../model/graph'
import { bellmanFordAlgorithm } from './bellmanFord'
import { dijkstraAlgorithm } from './dijkstra'
import { floydWarshallAlgorithm } from './floydWarshall'
import { estimateFloydWarshallCells } from '../engine/scaleWarnings'

function graphOf(
  options: { directed?: boolean },
  nodeIds: string[],
  edges: [string, string, number][],
): Graph {
  return {
    ...createGraph({ weighted: true, ...options }),
    nodes: nodeIds.map((id) => ({ id })),
    edges: edges.map(([source, target, weight], i) => ({ id: `e${i + 1}`, source, target, weight })),
  }
}

const run = (g: Graph) => floydWarshallAlgorithm.run(g)

function finishResult(events: AlgorithmEvent[]) {
  const last = events[events.length - 1]
  if (last.type !== 'finish') throw new Error('last event is not finish')
  return last.result
}

function seededRandom(seed: number) {
  let s = seed
  return (n: number) => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s % n
  }
}

describe('Floyd-Warshall', () => {
  it('emits the exact documented snapshots: initial matrix, one per waypoint, then finish', () => {
    // A -> B (3), B -> C (4), A -> C (10): going through B improves A -> C to 7.
    const g = graphOf({ directed: true }, ['A', 'B', 'C'], [
      ['A', 'B', 3],
      ['B', 'C', 4],
      ['A', 'C', 10],
    ])
    const ids = ['A', 'B', 'C']
    expect(run(g)).toEqual([
      {
        type: 'matrix_update',
        nodeIds: ids,
        matrix: [[0, 3, 10], [null, 0, 4], [null, null, 0]],
        changed: [],
      },
      {
        type: 'matrix_update',
        nodeIds: ids,
        waypointNodeId: 'A',
        matrix: [[0, 3, 10], [null, 0, 4], [null, null, 0]],
        changed: [],
      },
      {
        type: 'matrix_update',
        nodeIds: ids,
        waypointNodeId: 'B',
        matrix: [[0, 3, 7], [null, 0, 4], [null, null, 0]],
        changed: [[0, 2]],
      },
      {
        type: 'matrix_update',
        nodeIds: ids,
        waypointNodeId: 'C',
        matrix: [[0, 3, 7], [null, 0, 4], [null, null, 0]],
        changed: [],
      },
      {
        type: 'finish',
        result: { nodeIds: ids, distances: [[0, 3, 7], [null, 0, 4], [null, null, 0]], negativeCycle: false },
      },
    ])
  })

  it('emits one snapshot per waypoint (n + 1 in total), each an independent copy', () => {
    const g = graphOf({}, ['A', 'B', 'C', 'D'], [
      ['A', 'B', 1],
      ['B', 'C', 1],
      ['C', 'D', 1],
    ])
    const snapshots = run(g).filter((e) => e.type === 'matrix_update')
    expect(snapshots).toHaveLength(5)
    // The first snapshot must not have been mutated by later waypoints.
    expect(snapshots[0].matrix[0][3]).toBeNull()
    expect(snapshots[4].matrix[0][3]).toBe(3)
  })

  it('gives a symmetric result for undirected graphs and leaves unreachable pairs null', () => {
    const g = graphOf({}, ['A', 'B', 'C', 'D'], [
      ['A', 'B', 2],
      ['B', 'C', 3],
    ])
    const d = finishResult(run(g)).distances as (number | null)[][]
    expect(d).toEqual([
      [0, 2, 5, null],
      [2, 0, 3, null],
      [5, 3, 0, null],
      [null, null, null, 0],
    ])
  })

  it('uses the cheaper of parallel edges', () => {
    const g = graphOf({ directed: true }, ['A', 'B'], [
      ['A', 'B', 9],
      ['A', 'B', 2],
    ])
    expect((finishResult(run(g)).distances as number[][])[0][1]).toBe(2)
  })

  it('detects a negative cycle as a negative diagonal', () => {
    const g = graphOf({ directed: true }, ['A', 'B'], [
      ['A', 'B', 1],
      ['B', 'A', -3],
    ])
    const result = finishResult(run(g))
    expect(result.negativeCycle).toBe(true)
    const d = result.distances as number[][]
    expect(d[0][0]).toBeLessThan(0)
  })

  it('does not hide a negative self-loop by forcing the diagonal to 0', () => {
    const g = graphOf({ directed: true }, ['A', 'B'], [['A', 'A', -2]])
    const events = run(g)
    expect(events[0]).toMatchObject({ matrix: [[-2, null], [null, 0]] }) // visible from the very first snapshot
    expect(finishResult(events).negativeCycle).toBe(true)
    // ...while a positive self-loop is harmless and the diagonal stays 0.
    const positive = graphOf({ directed: true }, ['A'], [['A', 'A', 5]])
    expect(finishResult(run(positive))).toMatchObject({ distances: [[0]], negativeCycle: false })
  })

  it('treats an undirected negative edge as a negative cycle', () => {
    expect(finishResult(run(graphOf({}, ['A', 'B'], [['A', 'B', -1]]))).negativeCycle).toBe(true)
  })

  it('matches Dijkstra from every source on random non-negative graphs', () => {
    const rand = seededRandom(7)
    for (let trial = 0; trial < 25; trial++) {
      const directed = trial % 2 === 0
      const ids = Array.from({ length: 7 }, (_, i) => `n${i}`)
      const edges: [string, string, number][] = Array.from({ length: 12 }, () => [`n${rand(7)}`, `n${rand(7)}`, rand(10)])
      const g = graphOf({ directed }, ids, edges)
      const all = finishResult(run(g)).distances as (number | null)[][]
      ids.forEach((source, i) => {
        const single = finishResult(dijkstraAlgorithm.run(g, { startNodeId: source })).distances as Record<string, number | null>
        expect(all[i]).toEqual(ids.map((id) => single[id]))
      })
    }
  })

  it('matches Bellman-Ford from every source on random acyclic graphs with negative weights', () => {
    const rand = seededRandom(31)
    for (let trial = 0; trial < 25; trial++) {
      const ids = Array.from({ length: 7 }, (_, i) => `n${i}`)
      const edges: [string, string, number][] = []
      for (let k = 0; k < 12; k++) {
        const a = rand(6)
        edges.push([`n${a}`, `n${a + 1 + rand(6 - a)}`, rand(11) - 5])
      }
      const g = graphOf({ directed: true }, ids, edges)
      const all = finishResult(run(g)).distances as (number | null)[][]
      ids.forEach((source, i) => {
        const single = finishResult(bellmanFordAlgorithm.run(g, { startNodeId: source })).distances as Record<string, number | null>
        expect(all[i]).toEqual(ids.map((id) => single[id]))
      })
    }
  })

  it('handles the empty graph and declares its requirements (weighted, no start node)', () => {
    const empty = { ...createGraph({ weighted: true }) }
    expect(run(empty)).toEqual([
      { type: 'matrix_update', nodeIds: [], matrix: [], changed: [] },
      { type: 'finish', result: { nodeIds: [], distances: [], negativeCycle: false } },
    ])
    expect(floydWarshallAlgorithm.requirements).toEqual({ weighted: true })
    expect(checkRequirements(floydWarshallAlgorithm, createGraph())).toEqual(['Requires a weighted graph.'])
  })
})

describe('Floyd-Warshall at real scale (Milestone 5 performance pass)', () => {
  it('completes correctly and quickly on a 120-node dense graph', () => {
    const n = 120
    let seed = 7
    const rand = (m: number) => {
      seed = (seed * 1664525 + 1013904223) % 4294967296
      return seed % m
    }
    const nodes = Array.from({ length: n }, (_, i) => ({ id: `n${i}` }))
    // Dense-ish: every pair of nodes gets an edge with ~40% probability.
    const edges: { id: string; source: string; target: string; weight: number }[] = []
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (rand(100) < 40) edges.push({ id: `e${edges.length}`, source: `n${i}`, target: `n${j}`, weight: 1 + rand(9) })
      }
    }
    const g: Graph = { ...createGraph({ weighted: true }), nodes, edges }

    const start = Date.now()
    const events = floydWarshallAlgorithm.run(g)
    const elapsedMs = Date.now() - start

    // Correctness at scale: right number of snapshots, right matrix shape, ends in finish.
    const snapshots = events.filter((e) => e.type === 'matrix_update')
    expect(snapshots).toHaveLength(n + 1) // one initial + one per waypoint
    for (const snap of snapshots) {
      expect(snap.type === 'matrix_update' && snap.matrix).toHaveLength(n)
      expect(snap.type === 'matrix_update' && snap.matrix[0]).toHaveLength(n)
    }
    const last = events[events.length - 1]
    expect(last.type).toBe('finish')

    // Generous bound: this is a correctness-regression guard (catches an
    // accidental O(V^4) bug, say), not a tight perf benchmark — real hardware
    // varies too much for a tight bound to be anything but flaky.
    expect(elapsedMs).toBeLessThan(5000)
  })

  it('the estimateFloydWarshallCells formula matches the real snapshot count at scale', () => {
    const n = 40
    const nodes = Array.from({ length: n }, (_, i) => ({ id: `n${i}` }))
    const edges = Array.from({ length: 80 }, (_, i) => ({
      id: `e${i}`,
      source: `n${i % n}`,
      target: `n${(i * 7 + 3) % n}`,
      weight: 1 + (i % 9),
    }))
    const g: Graph = { ...createGraph({ weighted: true }), nodes, edges }
    const events = floydWarshallAlgorithm.run(g)
    const snapshots = events.filter((e) => e.type === 'matrix_update')
    const realCellCount = snapshots.reduce((sum, s) => sum + (s.type === 'matrix_update' ? s.matrix.length * s.matrix.length : 0), 0)
    expect(realCellCount).toBe(estimateFloydWarshallCells(n))
  })
})
