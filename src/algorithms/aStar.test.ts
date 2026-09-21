import { describe, expect, it } from 'vitest'
import { checkRequirements } from '../engine/algorithm'
import type { AlgorithmEvent } from '../engine/events'
import { createGraph } from '../model/graph'
import type { Graph } from '../model/graph'
import { aStarAlgorithm } from './aStar'
import { dijkstraAlgorithm } from './dijkstra'

type Pos = [number, number] | null

function graphOf(
  options: { directed?: boolean },
  nodes: [string, Pos][],
  edges: [string, string, number][],
): Graph {
  return {
    ...createGraph({ weighted: true, ...options }),
    nodes: nodes.map(([id, pos]) => (pos === null ? { id } : { id, x: pos[0], y: pos[1] })),
    edges: edges.map(([source, target, weight], i) => ({ id: `e${i + 1}`, source, target, weight })),
  }
}

const run = (g: Graph, start: string, goal: string) => aStarAlgorithm.run(g, { startNodeId: start, goalNodeId: goal })

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

describe('A*', () => {
  it('emits the exact documented events and stops as soon as the goal is taken off the queue', () => {
    // S --5-- M --5-- G on a line (weights equal pixel lengths, so the scale is 1); S--G directly costs 20.
    const g = graphOf({}, [['S', [0, 0]], ['M', [5, 0]], ['G', [10, 0]]], [
      ['S', 'M', 5],
      ['M', 'G', 5],
      ['S', 'G', 20],
    ])
    expect(run(g, 'S', 'G')).toEqual([
      { type: 'update_distance', nodeId: 'S', distance: 0, previousDistance: null },
      { type: 'enqueue', nodeId: 'S', structure: 'priority_queue', priority: 10 }, // f = 0 + h(S) = 10
      // --- S
      { type: 'dequeue', nodeId: 'S', structure: 'priority_queue' },
      { type: 'visit_node', nodeId: 'S' },
      { type: 'relax_edge', edgeId: 'e1', source: 'S', target: 'M', weight: 5 },
      { type: 'update_distance', nodeId: 'M', distance: 5, previousDistance: null, viaNodeId: 'S' },
      { type: 'enqueue', nodeId: 'M', structure: 'priority_queue', fromNodeId: 'S', priority: 10 },
      { type: 'relax_edge', edgeId: 'e3', source: 'S', target: 'G', weight: 20 },
      { type: 'update_distance', nodeId: 'G', distance: 20, previousDistance: null, viaNodeId: 'S' },
      { type: 'enqueue', nodeId: 'G', structure: 'priority_queue', fromNodeId: 'S', priority: 20 },
      { type: 'mark_visited', nodeId: 'S' },
      // --- M: finds the cheaper way to G (no second enqueue)
      { type: 'dequeue', nodeId: 'M', structure: 'priority_queue' },
      { type: 'visit_node', nodeId: 'M' },
      { type: 'relax_edge', edgeId: 'e1', source: 'M', target: 'S', weight: 5 },
      { type: 'relax_edge', edgeId: 'e2', source: 'M', target: 'G', weight: 5 },
      { type: 'update_distance', nodeId: 'G', distance: 10, previousDistance: 20, viaNodeId: 'M' },
      { type: 'mark_visited', nodeId: 'M' },
      // --- G: the goal. The search ends here; the stale entry (distance 20) is never looked at.
      { type: 'dequeue', nodeId: 'G', structure: 'priority_queue' },
      { type: 'visit_node', nodeId: 'G' },
      { type: 'mark_visited', nodeId: 'G' },
      { type: 'finish', result: { found: true, path: ['S', 'M', 'G'], distance: 10, nodesExpanded: 3 } },
    ])
  })

  it('scales the heuristic to the edge weights so it can never overestimate', () => {
    const at = (weight: number) =>
      graphOf({ directed: true }, [['S', [0, 0]], ['G', [3, 4]]], [['S', 'G', weight]]) // 5 px apart
    const startPriority = (g: Graph) => {
      const e = run(g, 'S', 'G')[1]
      return e.type === 'enqueue' ? e.priority : undefined
    }
    expect(startPriority(at(10))).toBe(10) // weight 2x the pixels: h = 2 * 5
    expect(startPriority(at(1))).toBe(1) // weight 1/5 of the pixels: h = 0.2 * 5, NOT the raw 5
  })

  it('finds a shortest path on random graphs whatever the weights are relative to pixel distances', () => {
    const rand = seededRandom(404)
    for (const weightBase of [1, 60, 400]) {
      // small, comparable and huge weights compared with coordinates in 0..200
      for (let trial = 0; trial < 25; trial++) {
        const directed = trial % 2 === 0
        const nodes: [string, Pos][] = Array.from({ length: 9 }, (_, i) => [`n${i}`, [rand(200), rand(200)]])
        const edges: [string, string, number][] = Array.from({ length: 16 }, () => [
          `n${rand(9)}`,
          `n${rand(9)}`,
          weightBase + rand(5),
        ])
        const g = graphOf({ directed }, nodes, edges)
        const goal = `n${1 + rand(8)}`

        const result = finishResult(run(g, 'n0', goal))
        const expected = (finishResult(dijkstraAlgorithm.run(g, { startNodeId: 'n0' })).distances as Record<string, number | null>)[goal]
        expect(result.found).toBe(expected !== null)
        expect(result.distance).toBe(expected)

        if (result.found) {
          // The path must be real and add up to the distance using the cheapest connecting edges.
          const path = result.path as string[]
          expect(path[0]).toBe('n0')
          expect(path[path.length - 1]).toBe(goal)
          let total = 0
          for (let i = 1; i < path.length; i++) {
            const options = g.edges
              .filter((e) => (e.source === path[i - 1] && e.target === path[i]) || (!directed && e.target === path[i - 1] && e.source === path[i]))
              .map((e) => e.weight!)
            expect(options.length).toBeGreaterThan(0)
            total += Math.min(...options)
          }
          expect(total).toBe(result.distance)
        }
      }
    }
  })

  it('falls back to Dijkstra-like behaviour (priority = distance) when any node has no coordinates', () => {
    const g = graphOf({}, [['A', [0, 0]], ['B', null], ['C', [9, 9]]], [
      ['A', 'B', 2],
      ['B', 'C', 3],
    ])
    const events = run(g, 'A', 'C')
    expect(events[1]).toEqual({ type: 'enqueue', nodeId: 'A', structure: 'priority_queue', priority: 0 })
    expect(finishResult(events)).toMatchObject({ found: true, path: ['A', 'B', 'C'], distance: 5 })
  })

  it('expands far fewer nodes than a full Dijkstra run when the goal is close', () => {
    // 5x5 grid, unit weights, unit spacing: from the corner to the node just below it.
    const nodes: [string, Pos][] = []
    const edges: [string, string, number][] = []
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        nodes.push([`n${y * 5 + x}`, [x, y]])
        if (x < 4) edges.push([`n${y * 5 + x}`, `n${y * 5 + x + 1}`, 1])
        if (y < 4) edges.push([`n${y * 5 + x}`, `n${(y + 1) * 5 + x}`, 1])
      }
    }
    const g = graphOf({}, nodes, edges)
    const result = finishResult(run(g, 'n0', 'n5'))
    expect(result).toMatchObject({ found: true, distance: 1, nodesExpanded: 2 })
    const dijkstraVisits = dijkstraAlgorithm.run(g, { startNodeId: 'n0' }).filter((e) => e.type === 'visit_node').length
    expect(dijkstraVisits).toBe(25)
  })

  it('reports an unreachable goal after exploring everything reachable', () => {
    const g = graphOf({ directed: true }, [['A', [0, 0]], ['B', [1, 0]], ['C', [2, 0]]], [['A', 'B', 1]])
    expect(finishResult(run(g, 'A', 'C'))).toEqual({ found: false, path: [], distance: null, nodesExpanded: 2 })
  })

  it('handles start equal to goal', () => {
    const g = graphOf({}, [['A', [0, 0]], ['B', [1, 0]]], [['A', 'B', 1]])
    expect(finishResult(run(g, 'A', 'A'))).toEqual({ found: true, path: ['A'], distance: 0, nodesExpanded: 1 })
  })

  it('declares its requirements and that it uses coordinates', () => {
    expect(aStarAlgorithm.requirements).toEqual({
      weighted: true,
      nonNegativeWeights: true,
      startNode: true,
      goalNode: true,
    })
    expect(aStarAlgorithm.usesCoordinates).toBe(true)
    const g = graphOf({}, [['A', [0, 0]]], [])
    expect(checkRequirements(aStarAlgorithm, g, { startNodeId: 'A' })).toEqual(['Requires a goal node.'])
  })

  it('throws when called directly without a valid start and goal', () => {
    const g = graphOf({}, [['A', [0, 0]]], [])
    expect(() => aStarAlgorithm.run(g)).toThrow(/start node and a goal node/i)
    expect(() => aStarAlgorithm.run(g, { startNodeId: 'A', goalNodeId: 'Z' })).toThrow(/goal node/i)
  })
})
