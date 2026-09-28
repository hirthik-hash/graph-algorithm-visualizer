import { describe, expect, it } from 'vitest'
import { checkRequirements } from '../engine/algorithm'
import type { AlgorithmEvent } from '../engine/events'
import { createGraph } from '../model/graph'
import type { Graph } from '../model/graph'
import { tarjanSccAlgorithm } from './tarjanScc'

function digraph(nodeIds: string[], edges: [string, string][]): Graph {
  return {
    ...createGraph({ directed: true }),
    nodes: nodeIds.map((id) => ({ id })),
    edges: edges.map(([source, target], i) => ({ id: `e${i + 1}`, source, target })),
  }
}

const run = (g: Graph) => tarjanSccAlgorithm.run(g)

function components(events: AlgorithmEvent[]): string[][] {
  const last = events[events.length - 1]
  if (last.type !== 'finish') throw new Error('last event is not finish')
  return last.result.components as string[][]
}

/** Canonical form for comparing component sets: each group sorted, groups sorted by first member. */
const canonical = (groups: string[][]) =>
  groups.map((g) => [...g].sort()).sort((a, b) => a[0].localeCompare(b[0]))

/** Independent reference: two nodes share an SCC iff each can reach the other, checked by plain BFS reachability from every node. */
function bruteForceScc(g: Graph): string[][] {
  const out = new Map<string, string[]>(g.nodes.map((n) => [n.id, []]))
  for (const e of g.edges) out.get(e.source)!.push(e.target)
  const reach = (from: string) => {
    const seen = new Set([from])
    const queue = [from]
    for (let head = 0; head < queue.length; head++) {
      for (const next of out.get(queue[head])!) {
        if (!seen.has(next)) {
          seen.add(next)
          queue.push(next)
        }
      }
    }
    return seen
  }
  const reachable = new Map(g.nodes.map((n) => [n.id, reach(n.id)]))
  const assigned = new Set<string>()
  const groups: string[][] = []
  for (const n of g.nodes) {
    if (assigned.has(n.id)) continue
    const group = g.nodes.map((m) => m.id).filter((m) => reachable.get(n.id)!.has(m) && reachable.get(m)!.has(n.id))
    group.forEach((m) => assigned.add(m))
    groups.push(group)
  }
  return groups
}

function seededRandom(seed: number) {
  let s = seed
  return (n: number) => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s % n
  }
}

describe("Tarjan's strongly connected components", () => {
  it('emits the exact documented events for a 2-cycle', () => {
    const g = digraph(['A', 'B'], [
      ['A', 'B'],
      ['B', 'A'],
    ])
    expect(run(g)).toEqual([
      { type: 'enqueue', nodeId: 'A', structure: 'stack' },
      { type: 'visit_node', nodeId: 'A' },
      { type: 'relax_edge', edgeId: 'e1', source: 'A', target: 'B' },
      { type: 'enqueue', nodeId: 'B', structure: 'stack', fromNodeId: 'A' },
      { type: 'visit_node', nodeId: 'B' },
      { type: 'relax_edge', edgeId: 'e2', source: 'B', target: 'A' }, // back into A, still on the stack: lowers B's low-link
      { type: 'dequeue', nodeId: 'B', structure: 'stack' },
      { type: 'mark_visited', nodeId: 'B' }, // B's low-link (0) != its index (1): not a root, no component yet
      { type: 'dequeue', nodeId: 'A', structure: 'stack' },
      { type: 'mark_visited', nodeId: 'A' }, // A's low-link == its index: root of a component
      { type: 'scc_found', nodeIds: ['B', 'A'] }, // popped off Tarjan's stack in stack order
      { type: 'finish', result: { components: [['B', 'A']], componentCount: 1 } },
    ])
  })

  it('finds two components in the classic "two cycles joined by a one-way edge" example', () => {
    const g = digraph(['A', 'B', 'C', 'D', 'E', 'F'], [
      ['A', 'B'],
      ['B', 'C'],
      ['C', 'A'], // A, B, C form a cycle
      ['C', 'D'], // one-way bridge between the two cycles
      ['D', 'E'],
      ['E', 'F'],
      ['F', 'D'], // D, E, F form a cycle
    ])
    expect(canonical(components(run(g)))).toEqual([['A', 'B', 'C'], ['D', 'E', 'F']])
  })

  it('a DAG has every node as its own single-node component', () => {
    const g = digraph(['A', 'B', 'C', 'D'], [
      ['A', 'B'],
      ['A', 'C'],
      ['B', 'D'],
      ['C', 'D'],
    ])
    const groups = components(run(g))
    expect(groups).toHaveLength(4)
    expect(groups.every((group) => group.length === 1)).toBe(true)
  })

  it('a self-loop node is still just its own single-node component', () => {
    const g = digraph(['A', 'B'], [['A', 'A']])
    expect(canonical(components(run(g)))).toEqual([['A'], ['B']])
  })

  it('isolated nodes are each their own component, and an empty graph has none', () => {
    expect(canonical(components(run(digraph(['A', 'B', 'C'], []))))).toEqual([['A'], ['B'], ['C']])
    expect(components(run(digraph([], [])))).toEqual([])
  })

  it('every node appears in exactly one component, and each scc_found event matches a component', () => {
    const g = digraph(['A', 'B', 'C', 'D', 'E'], [
      ['A', 'B'],
      ['B', 'A'],
      ['B', 'C'],
      ['C', 'D'],
      ['D', 'C'],
      ['D', 'E'],
    ])
    const events = run(g)
    const groups = components(events)
    const all = groups.flat().sort()
    expect(all).toEqual(['A', 'B', 'C', 'D', 'E']) // partition: nothing missing, nothing duplicated
    const foundEvents = events.flatMap((e) => (e.type === 'scc_found' ? [e.nodeIds] : []))
    expect(foundEvents).toEqual(groups)
  })

  it('agrees with an independent brute-force reachability check on many random directed graphs', () => {
    const rand = seededRandom(101)
    for (let trial = 0; trial < 60; trial++) {
      const n = 9
      const ids = Array.from({ length: n }, (_, i) => `n${i}`)
      const edges: [string, string][] = Array.from({ length: 4 + rand(14) }, () => [`n${rand(n)}`, `n${rand(n)}`])
      const g = digraph(ids, edges) // includes self-loops and parallel edges by chance
      expect(canonical(components(run(g)))).toEqual(canonical(bruteForceScc(g)))
    }
  })

  it('handles a 20,000-node chain without overflowing the call stack (it is iterative)', () => {
    const n = 20000
    const g: Graph = {
      ...createGraph({ directed: true }),
      nodes: Array.from({ length: n }, (_, i) => ({ id: `n${i}` })),
      edges: Array.from({ length: n - 1 }, (_, i) => ({ id: `e${i}`, source: `n${i}`, target: `n${i + 1}` })),
    }
    expect(components(run(g))).toHaveLength(n) // a chain has no cycles: every node alone
  })

  it('requires a directed graph and no start node', () => {
    expect(tarjanSccAlgorithm.requirements).toEqual({ graphType: 'directed' })
    expect(tarjanSccAlgorithm.category).toBe('connectivity')
    expect(checkRequirements(tarjanSccAlgorithm, createGraph())).toEqual(['Requires a directed graph.'])
  })
})
