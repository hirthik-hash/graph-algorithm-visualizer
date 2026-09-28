import { describe, expect, it } from 'vitest'
import { checkRequirements } from '../engine/algorithm'
import type { AlgorithmEvent } from '../engine/events'
import { createGraph } from '../model/graph'
import type { Graph } from '../model/graph'
import { bridgesArticulationAlgorithm } from './bridgesArticulation'

function ugraph(nodeIds: string[], edges: [string, string][]): Graph {
  return {
    ...createGraph(),
    nodes: nodeIds.map((id) => ({ id })),
    edges: edges.map(([source, target], i) => ({ id: `e${i + 1}`, source, target })),
  }
}

const run = (g: Graph) => bridgesArticulationAlgorithm.run(g)

function finishResult(events: AlgorithmEvent[]) {
  const last = events[events.length - 1]
  if (last.type !== 'finish') throw new Error('last event is not finish')
  return last.result
}

const bridgesOf = (g: Graph) => [...(finishResult(run(g)).bridges as string[])].sort()
const pointsOf = (g: Graph) => [...(finishResult(run(g)).articulationPoints as string[])].sort()

/** Number of connected components among `nodeIds`, using only the edges whose ids are NOT excluded and whose endpoints are both kept. */
function countComponents(g: Graph, keepNodes: Set<string>, excludedEdgeIds: Set<string>): number {
  const adj = new Map<string, string[]>([...keepNodes].map((id) => [id, []]))
  for (const e of g.edges) {
    if (excludedEdgeIds.has(e.id) || !keepNodes.has(e.source) || !keepNodes.has(e.target)) continue
    adj.get(e.source)!.push(e.target)
    adj.get(e.target)!.push(e.source)
  }
  const seen = new Set<string>()
  let count = 0
  for (const start of keepNodes) {
    if (seen.has(start)) continue
    count++
    const stack = [start]
    seen.add(start)
    while (stack.length > 0) {
      for (const next of adj.get(stack.pop()!)!) {
        if (!seen.has(next)) {
          seen.add(next)
          stack.push(next)
        }
      }
    }
  }
  return count
}

/** Independent reference: an edge is a bridge if deleting IT raises the component count; a node is an articulation point if deleting IT (and its edges) raises it. */
function bruteForce(g: Graph): { bridges: string[]; points: string[] } {
  const all = new Set(g.nodes.map((n) => n.id))
  const base = countComponents(g, all, new Set())
  const bridges = g.edges.filter((e) => countComponents(g, all, new Set([e.id])) > base).map((e) => e.id)
  const points = g.nodes
    .filter((n) => countComponents(g, new Set([...all].filter((id) => id !== n.id)), new Set()) > base)
    .map((n) => n.id)
  return { bridges: bridges.sort(), points: points.sort() }
}

function seededRandom(seed: number) {
  let s = seed
  return (n: number) => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s % n
  }
}

describe('Bridges & articulation points', () => {
  it('emits the exact documented events for a single edge', () => {
    const g = ugraph(['A', 'B'], [['A', 'B']])
    expect(run(g)).toEqual([
      { type: 'enqueue', nodeId: 'A', structure: 'stack' },
      { type: 'visit_node', nodeId: 'A' },
      { type: 'relax_edge', edgeId: 'e1', source: 'A', target: 'B' },
      { type: 'enqueue', nodeId: 'B', structure: 'stack', fromNodeId: 'A' },
      { type: 'visit_node', nodeId: 'B' },
      { type: 'relax_edge', edgeId: 'e1', source: 'B', target: 'A' }, // the edge we arrived by: examined, then skipped
      { type: 'bridge_found', edgeId: 'e1', source: 'A', target: 'B' }, // nothing under B reaches back above A
      { type: 'dequeue', nodeId: 'B', structure: 'stack' },
      { type: 'mark_visited', nodeId: 'B' },
      { type: 'dequeue', nodeId: 'A', structure: 'stack' },
      { type: 'mark_visited', nodeId: 'A' },
      {
        type: 'finish',
        result: { bridges: ['e1'], articulationPoints: [], bridgeCount: 1, articulationPointCount: 0 },
      },
    ])
  })

  it('a barbell (two triangles joined by one edge): that edge is the only bridge, its two ends the only articulation points', () => {
    const g = ugraph(['A', 'B', 'C', 'D', 'E', 'F'], [
      ['A', 'B'],
      ['B', 'C'],
      ['C', 'A'],
      ['C', 'D'], // e4: the bridge
      ['D', 'E'],
      ['E', 'F'],
      ['F', 'D'],
    ])
    expect(bridgesOf(g)).toEqual(['e4'])
    expect(pointsOf(g)).toEqual(['C', 'D'])
  })

  it('a path: every edge is a bridge, every inner node an articulation point, the ends are not', () => {
    const g = ugraph(['A', 'B', 'C', 'D'], [
      ['A', 'B'],
      ['B', 'C'],
      ['C', 'D'],
    ])
    expect(bridgesOf(g)).toEqual(['e1', 'e2', 'e3'])
    expect(pointsOf(g)).toEqual(['B', 'C'])
  })

  it('a star: every edge is a bridge and the centre is the only articulation point (root rule when the centre is first)', () => {
    const g = ugraph(['C', 'A', 'B', 'D'], [
      ['C', 'A'],
      ['C', 'B'],
      ['C', 'D'],
    ])
    expect(bridgesOf(g)).toEqual(['e1', 'e2', 'e3'])
    expect(pointsOf(g)).toEqual(['C'])
  })

  it('a bowtie (two triangles sharing one node): no bridges, exactly that node is an articulation point', () => {
    const g = ugraph(['A', 'B', 'C', 'D', 'E'], [
      ['A', 'B'],
      ['B', 'C'],
      ['C', 'A'],
      ['C', 'D'],
      ['D', 'E'],
      ['E', 'C'],
    ])
    expect(bridgesOf(g)).toEqual([])
    expect(pointsOf(g)).toEqual(['C'])
  })

  it('a plain cycle has neither bridges nor articulation points', () => {
    const g = ugraph(['A', 'B', 'C', 'D'], [
      ['A', 'B'],
      ['B', 'C'],
      ['C', 'D'],
      ['D', 'A'],
    ])
    expect(bridgesOf(g)).toEqual([])
    expect(pointsOf(g)).toEqual([])
  })

  it('parallel edges: a doubled edge is NOT a bridge, but the single edge beyond it still is', () => {
    const g = ugraph(['A', 'B', 'C'], [
      ['A', 'B'],
      ['A', 'B'], // parallel twin of e1
      ['B', 'C'],
    ])
    expect(bridgesOf(g)).toEqual(['e3'])
    expect(pointsOf(g)).toEqual(['B'])
  })

  it('self-loops are ignored: they neither create bridges nor make anything an articulation point', () => {
    const g = ugraph(['A', 'B'], [
      ['A', 'A'],
      ['A', 'B'],
    ])
    expect(bridgesOf(g)).toEqual(['e2'])
    expect(pointsOf(g)).toEqual([])
  })

  it('handles disconnected graphs and isolated nodes: each component is analysed on its own', () => {
    const g = ugraph(['A', 'B', 'C', 'D', 'E', 'Z'], [
      ['A', 'B'],
      ['B', 'C'], // component 1: a path
      ['D', 'E'], // component 2: a single edge; Z is isolated
    ])
    expect(bridgesOf(g)).toEqual(['e1', 'e2', 'e3'])
    expect(pointsOf(g)).toEqual(['B'])
  })

  it('reports no bridges or points for an empty graph or a single node', () => {
    expect(finishResult(run(ugraph([], [])))).toMatchObject({ bridgeCount: 0, articulationPointCount: 0 })
    expect(finishResult(run(ugraph(['A'], [])))).toMatchObject({ bridgeCount: 0, articulationPointCount: 0 })
  })

  it('emits each bridge and articulation point exactly once, matching the finish result', () => {
    const g = ugraph(['A', 'B', 'C', 'D', 'E'], [
      ['A', 'B'],
      ['B', 'C'],
      ['B', 'D'],
      ['B', 'E'], // B is reached by several bridges but must only be reported once
    ])
    const events = run(g)
    const points = events.flatMap((e) => (e.type === 'articulation_point_found' ? [e.nodeId] : []))
    const bridges = events.flatMap((e) => (e.type === 'bridge_found' ? [e.edgeId] : []))
    expect(points).toEqual(['B'])
    expect(new Set(bridges).size).toBe(bridges.length)
    expect([...bridges].sort()).toEqual([...(finishResult(events).bridges as string[])].sort())
  })

  it('agrees with an independent brute-force check on many random undirected graphs (parallel edges and self-loops included)', () => {
    const rand = seededRandom(555)
    for (let trial = 0; trial < 80; trial++) {
      const n = 8
      const ids = Array.from({ length: n }, (_, i) => `n${i}`)
      const edges: [string, string][] = Array.from({ length: 3 + rand(12) }, () => [`n${rand(n)}`, `n${rand(n)}`])
      const g = ugraph(ids, edges)
      const expected = bruteForce(g)
      expect(bridgesOf(g), `bridges, trial ${trial}`).toEqual(expected.bridges)
      expect(pointsOf(g), `articulation points, trial ${trial}`).toEqual(expected.points)
    }
  })

  it('handles a 20,000-node path without overflowing the call stack (it is iterative)', () => {
    const n = 20000
    const g: Graph = {
      ...createGraph(),
      nodes: Array.from({ length: n }, (_, i) => ({ id: `n${i}` })),
      edges: Array.from({ length: n - 1 }, (_, i) => ({ id: `e${i}`, source: `n${i}`, target: `n${i + 1}` })),
    }
    const result = finishResult(run(g))
    expect(result.bridgeCount).toBe(n - 1) // every edge of a path is a bridge
    expect(result.articulationPointCount).toBe(n - 2) // every inner node
  })

  it('requires an undirected graph and no start node', () => {
    expect(bridgesArticulationAlgorithm.requirements).toEqual({ graphType: 'undirected' })
    expect(bridgesArticulationAlgorithm.category).toBe('connectivity')
    expect(checkRequirements(bridgesArticulationAlgorithm, { ...createGraph(), directed: true })).toEqual([
      'Requires an undirected graph.',
    ])
  })
})
