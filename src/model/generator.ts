/**
 * Random graph generator (Day 12).
 *
 * Deterministic: the same options (including `seed`) always produce the same
 * graph, which makes tests reproducible and lets a graph be re-created from
 * its seed. The UI passes a fresh random seed per click.
 *
 * Structure guarantees, BY CONSTRUCTION rather than by checking afterwards:
 *  - no self-loops, no parallel edges (each node pair is considered once);
 *  - 'dag': edges only go from a lower to a higher node index, so a cycle is
 *    impossible; it is always directed;
 *  - 'tree': every node after the first picks exactly one earlier node as its
 *    parent, so it has n-1 edges, is connected, and has no cycle;
 *  - 'bipartite': edges only join the first half of the nodes to the second.
 *
 * Nodes get positions on a circle, so a generated graph renders immediately
 * and A* has real coordinates.
 */
import { makeRandom } from '../engine/random'
import type { Graph, GraphEdge, GraphNode } from './graph'
import { SCHEMA_VERSION } from './graph'
import { circleLayout } from './layout'

export type GraphShape = 'random' | 'complete' | 'bipartite' | 'dag' | 'tree' | 'sparse' | 'dense'

export const GRAPH_SHAPES: readonly GraphShape[] = [
  'random',
  'sparse',
  'dense',
  'complete',
  'bipartite',
  'dag',
  'tree',
]

export interface GeneratorOptions {
  shape: GraphShape
  /** 1 to 200. */
  nodeCount: number
  directed?: boolean
  weighted?: boolean
  seed?: number
  /** Weights are whole numbers from 1 to this value. Default 9. */
  maxWeight?: number
}

export const MAX_GENERATED_NODES = 200

/** Same sequence as the editor: A..Z, then N26, N27, ... */
export function nodeIdForIndex(i: number): string {
  return i < 26 ? String.fromCharCode(65 + i) : `N${i}`
}

export function generateGraph(options: GeneratorOptions): Graph {
  const { shape, nodeCount } = options
  if (!Number.isInteger(nodeCount) || nodeCount < 1 || nodeCount > MAX_GENERATED_NODES) {
    throw new RangeError(`nodeCount must be a whole number from 1 to ${MAX_GENERATED_NODES} (got ${nodeCount})`)
  }
  const directed = shape === 'dag' ? true : (options.directed ?? false)
  const weighted = options.weighted ?? false
  const maxWeight = Math.max(1, Math.floor(options.maxWeight ?? 9))
  const random = makeRandom(options.seed ?? 1)
  const chance = (p: number) => random() < p
  const randomInt = (n: number) => Math.floor(random() * n)

  const n = nodeCount
  const positions = circleLayout(n)
  const nodes: GraphNode[] = Array.from({ length: n }, (_, i) => ({
    id: nodeIdForIndex(i),
    x: positions[i].x,
    y: positions[i].y,
  }))

  // Pairs are (lower index, higher index). For directed graphs some shapes also add the reverse.
  const pairs: [number, number][] = []
  const addPair = (i: number, j: number) => pairs.push([i, j])

  switch (shape) {
    case 'complete':
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (i === j) continue
          if (directed) addPair(i, j)
          else if (i < j) addPair(i, j)
        }
      }
      break

    case 'random':
    case 'dense': {
      const p = shape === 'random' ? 0.3 : 0.7
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          if (chance(p)) addPair(i, j)
          if (directed && chance(p / 2)) addPair(j, i) // sometimes the reverse edge too
        }
      }
      break
    }

    case 'sparse': {
      // A random tree keeps it connected; a few extra edges make it a graph rather than a tree.
      const used = new Set<string>()
      for (let j = 1; j < n; j++) {
        const parent = randomInt(j)
        addPair(parent, j)
        used.add(`${parent},${j}`)
      }
      for (let extra = Math.ceil(n / 3), tries = 0; extra > 0 && tries < 10 * n; tries++) {
        const a = randomInt(n)
        const b = randomInt(n)
        const [i, j] = a < b ? [a, b] : [b, a]
        if (i === j || used.has(`${i},${j}`)) continue
        used.add(`${i},${j}`)
        addPair(i, j)
        extra--
      }
      break
    }

    case 'bipartite': {
      const leftSize = Math.ceil(n / 2)
      for (let i = 0; i < leftSize; i++) {
        for (let j = leftSize; j < n; j++) {
          if (chance(0.5)) addPair(i, j)
        }
      }
      break
    }

    case 'dag':
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          if (chance(0.3)) addPair(i, j)
        }
      }
      break

    case 'tree':
      for (let j = 1; j < n; j++) addPair(randomInt(j), j)
      break
  }

  const edges: GraphEdge[] = pairs.map(([i, j], k) => ({
    id: `e${k + 1}`,
    source: nodes[i].id,
    target: nodes[j].id,
    ...(weighted ? { weight: 1 + randomInt(maxWeight) } : {}),
  }))

  return { schemaVersion: SCHEMA_VERSION, directed, weighted, nodes, edges }
}
