/**
 * Scale/robustness stress test (Milestone 5, roadmap item: "a light pass
 * across the graph-type matrix at a realistic size — not 1000, since that's
 * far past what a person draws or studies by hand").
 *
 * Two things this checks that no other test file checks:
 *  1. Every registered algorithm, run against every generator shape at a
 *     realistic-but-nontrivial size (80 nodes), never throws and always
 *     finishes — for whichever algorithms actually meet that shape's
 *     requirements (an algorithm that can't run on a given shape is simply
 *     skipped, exactly like the comparison table would skip it).
 *  2. The generator deliberately never produces self-loops or parallel
 *     edges (see model/generator.ts), so those two structural edge cases are
 *     tested separately here with a HAND-BUILT graph at the same realistic
 *     scale, not left untested just because the generator can't produce them.
 *
 * This is a correctness-and-crash guard at scale, not a tight benchmark —
 * the time bounds are generous on purpose.
 */
import { describe, expect, it } from 'vitest'
import { ALGORITHM_REGISTRY } from './registry'
import { algorithmProblems, defaultOptions } from '../engine/compare'
import { generateGraph, GRAPH_SHAPES } from '../model/generator'
import { createGraph } from '../model/graph'
import type { Graph } from '../model/graph'

const STRESS_NODE_COUNT = 80
const PER_ALGORITHM_TIME_LIMIT_MS = 2000

function runEveryApplicableAlgorithm(graph: Graph, label: string) {
  for (const algorithm of ALGORITHM_REGISTRY) {
    if (algorithmProblems(graph, algorithm).length > 0) continue // this algorithm doesn't apply to this graph — skip, don't fail

    const start = Date.now()
    let events
    expect(() => {
      events = algorithm.run(graph, defaultOptions(graph))
    }, `${algorithm.name} threw on ${label}`).not.toThrow()
    const elapsed = Date.now() - start

    expect(events, `${algorithm.name} produced no events on ${label}`).toBeDefined()
    const last = events![events!.length - 1]
    expect(last.type, `${algorithm.name} did not finish cleanly on ${label}`).toBe('finish')
    expect(elapsed, `${algorithm.name} took ${elapsed}ms on ${label}`).toBeLessThan(PER_ALGORITHM_TIME_LIMIT_MS)
  }
}

describe('every generator shape at realistic scale (80 nodes)', () => {
  for (const shape of GRAPH_SHAPES) {
    it(`${shape}: every applicable algorithm runs cleanly, weighted and unweighted, directed and undirected`, () => {
      for (const weighted of [false, true]) {
        for (const directed of [false, true]) {
          const graph = generateGraph({ shape, nodeCount: STRESS_NODE_COUNT, weighted, directed, seed: 42 })
          runEveryApplicableAlgorithm(graph, `${shape} (weighted=${weighted}, directed=${directed})`)
        }
      }
    })
  }
})

describe('self-loops and parallel edges at realistic scale (hand-built, since the generator never produces either)', () => {
  function selfLoopAndParallelEdgeGraph(directed: boolean): Graph {
    const n = 60
    const nodes = Array.from({ length: n }, (_, i) => ({ id: `n${i}` }))
    const edges: Graph['edges'] = []
    // A connected backbone so shortest-path/MST/topo algorithms have something real to do.
    for (let i = 1; i < n; i++) {
      edges.push({ id: `e${edges.length}`, source: `n${i - 1}`, target: `n${i}`, weight: 1 + (i % 7) })
    }
    // Self-loops sprinkled throughout.
    for (let i = 0; i < n; i += 5) {
      edges.push({ id: `e${edges.length}`, source: `n${i}`, target: `n${i}`, weight: 1 + (i % 3) })
    }
    // Parallel edges: a second, differently-weighted edge between several existing pairs.
    for (let i = 0; i < n - 1; i += 4) {
      edges.push({ id: `e${edges.length}`, source: `n${i}`, target: `n${i + 1}`, weight: 20 })
    }
    return { ...createGraph({ directed, weighted: true }), nodes, edges }
  }

  it('undirected: every applicable algorithm handles self-loops and parallel edges without throwing', () => {
    runEveryApplicableAlgorithm(selfLoopAndParallelEdgeGraph(false), 'hand-built self-loop/parallel-edge graph (undirected)')
  })

  it('directed: every applicable algorithm handles self-loops and parallel edges without throwing', () => {
    runEveryApplicableAlgorithm(selfLoopAndParallelEdgeGraph(true), 'hand-built self-loop/parallel-edge graph (directed)')
  })
})

describe('disconnected graphs at realistic scale', () => {
  it('a graph split into several disconnected components: every applicable algorithm still runs cleanly', () => {
    const n = 80
    const nodes = Array.from({ length: n }, (_, i) => ({ id: `n${i}` }))
    const edges: Graph['edges'] = []
    // Four separate connected clusters of 20 nodes each, with NOTHING joining them.
    for (let cluster = 0; cluster < 4; cluster++) {
      const start = cluster * 20
      for (let i = start + 1; i < start + 20; i++) {
        edges.push({ id: `e${edges.length}`, source: `n${i - 1}`, target: `n${i}`, weight: 1 + (i % 5) })
      }
    }
    const graph: Graph = { ...createGraph({ weighted: true }), nodes, edges }
    runEveryApplicableAlgorithm(graph, 'disconnected graph (4 clusters of 20)')
  })
})
