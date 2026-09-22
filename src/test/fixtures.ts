/**
 * Shared test-graph fixtures (Day 16, pulled forward alongside the Day 15
 * plugin-architecture proof since both are "housekeeping" days). Several test
 * files were building small variants of the same handful of edge-case graphs
 * (disconnected, single node, self-loop, parallel edges, equal weights) by
 * hand. Centralising the common ones here means a fixture's shape is defined
 * once, and every test using it is exercising the exact same graph.
 *
 * These are the RECURRING edge cases, not a general-purpose graph builder —
 * a test with a genuinely one-off shape should still build it inline.
 * Each fixture is a function, not a constant, so two tests that both mutate
 * their copy (or hold two independent Graph objects) can never interfere with
 * each other.
 */
import { createGraph } from '../model/graph'
import type { Graph } from '../model/graph'

/** A-B and C-D, plus an isolated E. Two components of size 2 and one of size 1. */
export function disconnectedGraph(): Graph {
  return {
    ...createGraph(),
    nodes: ['A', 'B', 'C', 'D', 'E'].map((id) => ({ id })),
    edges: [
      { id: 'e1', source: 'A', target: 'B' },
      { id: 'e2', source: 'C', target: 'D' },
    ],
  }
}

/** Exactly one node, no edges. The smallest graph that isn't empty. */
export function singleNodeGraph(): Graph {
  return { ...createGraph(), nodes: [{ id: 'A' }], edges: [] }
}

/** A has a self-loop (weight 3) and an edge to B (weight 1). Weighted, undirected. */
export function selfLoopGraph(): Graph {
  return {
    ...createGraph({ weighted: true }),
    nodes: ['A', 'B'].map((id) => ({ id })),
    edges: [
      { id: 'e1', source: 'A', target: 'A', weight: 3 },
      { id: 'e2', source: 'A', target: 'B', weight: 1 },
    ],
  }
}

/** Two directed edges A -> B with different weights (9 and 2) — the same pair, twice. */
export function parallelEdgesGraph(): Graph {
  return {
    ...createGraph({ directed: true, weighted: true }),
    nodes: ['A', 'B'].map((id) => ({ id })),
    edges: [
      { id: 'e1', source: 'A', target: 'B', weight: 9 },
      { id: 'e2', source: 'A', target: 'B', weight: 2 },
    ],
  }
}

/** A triangle where every edge has weight 1, so any two of the three edges tie for cheapest. */
export function equalWeightsGraph(): Graph {
  return {
    ...createGraph({ weighted: true }),
    nodes: ['A', 'B', 'C'].map((id) => ({ id })),
    edges: [
      { id: 'e1', source: 'A', target: 'B', weight: 1 },
      { id: 'e2', source: 'B', target: 'C', weight: 1 },
      { id: 'e3', source: 'A', target: 'C', weight: 1 },
    ],
  }
}
