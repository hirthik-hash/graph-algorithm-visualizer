/**
 * Algorithm comparison (Day 12).
 *
 * Runs algorithms on the same graph and turns each event log into one
 * normalised ComparisonRow. It lives in the engine layer, so the list of
 * algorithms is passed IN (it never imports the registry).
 *
 * Two honesty rules:
 *  - An algorithm that can't run on this graph is still a row (ran: false, with
 *    the reasons), never silently left out. "Kruskal's needs an undirected
 *    graph" is part of the comparison.
 *  - Step counts are a ROUGH PROXY for work. Algorithms emit events at very
 *    different granularity (Floyd-Warshall reports one snapshot per waypoint,
 *    not one event per cell), so steps say more about how much there is to WATCH
 *    than about real running time. Big-O below is a static reference table, not
 *    something measured from one run.
 */
import type { Algorithm, AlgorithmCategory, AlgorithmOptions } from './algorithm'
import { checkRequirements } from './algorithm'
import type { Graph } from '../model/graph'

export interface ComparisonRow {
  algorithmId: string
  name: string
  category: AlgorithmCategory
  ran: boolean
  /** Why it didn't run (requirement failures, or an unexpected error). Empty when ran. */
  problems: string[]
  /** Total events emitted, including the final one. null when it didn't run. */
  steps: number | null
  /** How many visit_node events. */
  nodesVisited: number | null
  /** How many relax_edge events (edges examined). */
  edgesExamined: number | null
  timeComplexity: string
  spaceComplexity: string
}

/** V = nodes, E = edges. Static reference values keyed by algorithm id. */
export const BIG_O: Record<string, { time: string; space: string }> = {
  bfs: { time: 'O(V + E)', space: 'O(V)' },
  dfs: { time: 'O(V + E)', space: 'O(V)' },
  dijkstra: { time: 'O((V + E) log V)', space: 'O(V)' },
  'bellman-ford': { time: 'O(V · E)', space: 'O(V)' },
  astar: { time: 'O(E log V) worst case', space: 'O(V)' },
  'floyd-warshall': { time: 'O(V³)', space: 'O(V²)' },
  prim: { time: 'O(E log V)', space: 'O(E)' },
  kruskal: { time: 'O(E log E)', space: 'O(V)' },
  kahn: { time: 'O(V + E)', space: 'O(V)' },
  'dfs-topo': { time: 'O(V + E)', space: 'O(V)' },
}

const UNKNOWN_COMPLEXITY = '—'

/** The same defaults the playback bar uses: start at the first node, goal at the last. */
export function defaultOptions(graph: Graph): AlgorithmOptions {
  const first = graph.nodes[0]?.id
  const last = graph.nodes[graph.nodes.length - 1]?.id
  return {
    ...(first === undefined ? {} : { startNodeId: first }),
    ...(last === undefined ? {} : { goalNodeId: last }),
  }
}

/**
 * Whether `algorithm` could run on `graph` right now, using the same default
 * start/goal the playback bar would fall back to. Returns the unmet
 * requirements (empty when it can run) — the same list `checkRequirements`
 * itself produces, just pre-filled with realistic defaults so the picker can
 * show this BEFORE the person selects an algorithm, not after pressing Play.
 */
export function algorithmProblems(graph: Graph, algorithm: Algorithm): string[] {
  return checkRequirements(algorithm, graph, defaultOptions(graph))
}

export function compareAlgorithms(
  graph: Graph,
  algorithms: readonly Algorithm[],
  options: AlgorithmOptions = defaultOptions(graph),
): ComparisonRow[] {
  return algorithms.map((algorithm) => {
    const complexity = BIG_O[algorithm.id]
    const base = {
      algorithmId: algorithm.id,
      name: algorithm.name,
      category: algorithm.category,
      timeComplexity: complexity?.time ?? UNKNOWN_COMPLEXITY,
      spaceComplexity: complexity?.space ?? UNKNOWN_COMPLEXITY,
    }
    const notRun = (problems: string[]): ComparisonRow => ({
      ...base,
      ran: false,
      problems,
      steps: null,
      nodesVisited: null,
      edgesExamined: null,
    })

    const problems = checkRequirements(algorithm, graph, options)
    if (problems.length > 0) return notRun(problems)

    try {
      const events = algorithm.run(graph, options)
      return {
        ...base,
        ran: true,
        problems: [],
        steps: events.length,
        nodesVisited: events.filter((e) => e.type === 'visit_node').length,
        edgesExamined: events.filter((e) => e.type === 'relax_edge').length,
      }
    } catch (err) {
      // An algorithm crashing must show up as a visible row, not take the whole table down.
      return notRun([`Error: ${err instanceof Error ? err.message : String(err)}`])
    }
  })
}

/**
 * One sentence comparing two rows by step count. Purely generic: it reads the
 * rows' numbers and names, with no per-pair wording.
 */
export function explainDifference(a: ComparisonRow, b: ComparisonRow): string {
  if (a.algorithmId === b.algorithmId) return 'Pick two different algorithms to compare.'
  const missing = [a, b].filter((r) => !r.ran || r.steps === null)
  if (missing.length > 0) {
    return `Can't compare step counts: ${missing.map((r) => `${r.name} did not run`).join(' and ')}.`
  }

  const sa = a.steps!
  const sb = b.steps!
  const steps = (n: number) => `${n} step${n === 1 ? '' : 's'}`
  if (sa === sb) return `${a.name} and ${b.name} both took ${steps(sa)}.`

  const [fewer, more] = sa < sb ? [a, b] : [b, a]
  const diff = more.steps! - fewer.steps!
  const percent = Math.round((diff / more.steps!) * 100)
  const percentText = percent === 0 ? 'under 1%' : `${percent}%`
  return (
    `${fewer.name} took ${steps(fewer.steps!)} and ${more.name} took ${more.steps}: ` +
    `${fewer.name} needed ${diff} fewer (${percentText} fewer). ` +
    'Step counts are a rough proxy for work, not a rigorous operation count.'
  )
}
