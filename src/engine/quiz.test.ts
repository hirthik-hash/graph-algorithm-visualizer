import { describe, expect, it } from 'vitest'
import { createGraph } from '../model/graph'
import type { Graph } from '../model/graph'
import {
  availableQuestionTypes,
  canGenerateBfsOrder,
  canGenerateMstWeight,
  canGenerateShortestPath,
  generateBfsOrderQuestion,
  generateMstWeightQuestion,
  generateQuiz,
  generateShortestPathQuestion,
} from './quiz'
import { makeRandom } from './random'

function graphOf(
  options: { directed?: boolean; weighted?: boolean },
  nodeIds: string[],
  edges: [string, string, number?][],
): Graph {
  return {
    ...createGraph(options),
    nodes: nodeIds.map((id) => ({ id })),
    edges: edges.map(([source, target, weight], i) => ({
      id: `e${i + 1}`,
      source,
      target,
      ...(weight === undefined ? {} : { weight }),
    })),
  }
}

/** A well-connected weighted graph, big enough for all three question types. */
function richGraph(): Graph {
  return graphOf(
    { weighted: true },
    ['A', 'B', 'C', 'D', 'E'],
    [
      ['A', 'B', 2],
      ['A', 'C', 5],
      ['B', 'C', 1],
      ['B', 'D', 4],
      ['C', 'D', 1],
      ['D', 'E', 3],
    ],
  )
}

describe('generateShortestPathQuestion', () => {
  it('is unavailable on an unweighted graph, even if otherwise connected', () => {
    const g = graphOf({}, ['A', 'B'], [['A', 'B']])
    expect(canGenerateShortestPath(g)).toBe(false)
    expect(generateShortestPathQuestion(g)).toBeNull()
  })

  it('is unavailable when no two nodes are connected', () => {
    const g = graphOf({ weighted: true }, ['A', 'B'], [])
    expect(canGenerateShortestPath(g)).toBe(false)
  })

  it('produces 4 distinct non-negative options with exactly one correct, matching a real Dijkstra run', () => {
    const g = richGraph()
    const random = makeRandom(1)
    for (let i = 0; i < 20; i++) {
      const q = generateShortestPathQuestion(g, random)
      if (q === null) continue
      expect(q.options).toHaveLength(4)
      expect(new Set(q.options).size).toBe(4)
      expect(q.options.every((o) => Number(o) >= 0)).toBe(true)
      expect(q.correctIndex).toBeGreaterThanOrEqual(0)
      expect(q.type).toBe('shortest-path')
    }
  })

  it('is reproducible for the same seed', () => {
    const g = richGraph()
    const a = generateShortestPathQuestion(g, makeRandom(42))
    const b = generateShortestPathQuestion(g, makeRandom(42))
    expect(a).toEqual(b)
  })

  it('never asks about an unreachable pair', () => {
    const g = graphOf({ weighted: true, directed: true }, ['A', 'B', 'C'], [['A', 'B', 1]])
    // C is unreachable from A, and nothing reaches C
    const random = makeRandom(7)
    for (let i = 0; i < 30; i++) {
      const q = generateShortestPathQuestion(g, random)
      expect(q?.prompt).not.toContain(' to C?')
    }
  })
})

describe('generateBfsOrderQuestion', () => {
  it('is unavailable when no start reaches at least 3 nodes', () => {
    const g = graphOf({}, ['A', 'B'], [['A', 'B']])
    expect(canGenerateBfsOrder(g)).toBe(false)
    expect(generateBfsOrderQuestion(g)).toBeNull()
  })

  it('the correct option matches the real BFS order exactly, arrow-joined', () => {
    const g = richGraph()
    const q = generateBfsOrardOrThrow(g)
    expect(q.options[q.correctIndex]).toMatch(/^[A-E]( → [A-E]){2,}$/)
  })

  it('produces 4 distinct options and documents the tie-breaking caveat', () => {
    const g = richGraph()
    const random = makeRandom(3)
    for (let i = 0; i < 15; i++) {
      const q = generateBfsOrderQuestion(g, random)
      if (q === null) continue
      expect(q.options.length).toBeGreaterThanOrEqual(2)
      expect(new Set(q.options).size).toBe(q.options.length)
      expect(q.explanation).toMatch(/same-level neighbour/)
    }
  })

  it('never fabricates a wrong option using a different set of nodes', () => {
    const g = richGraph()
    const random = makeRandom(9)
    const q = generateBfsOrderQuestion(g, random)!
    const correctNodes = q.options[q.correctIndex].split(' → ').sort()
    for (const option of q.options) {
      expect(option.split(' → ').sort()).toEqual(correctNodes)
    }
  })
})

function generateBfsOrardOrThrow(g: Graph) {
  const q = generateBfsOrderQuestion(g, makeRandom(5))
  if (q === null) throw new Error('expected a question')
  return q
}

describe('generateMstWeightQuestion', () => {
  it('is unavailable for directed graphs, even if otherwise valid', () => {
    const g = graphOf({ directed: true, weighted: true }, ['A', 'B'], [['A', 'B', 3]])
    expect(canGenerateMstWeight(g)).toBe(false)
    expect(generateMstWeightQuestion(g)).toBeNull()
  })

  it('is unavailable when there are no edges', () => {
    const g = graphOf({}, ['A', 'B'], [])
    expect(canGenerateMstWeight(g)).toBe(false)
  })

  it('the correct answer matches a real Kruskal run, including on unweighted graphs (edges count as 1)', () => {
    const g = richGraph()
    const q = generateMstWeightQuestion(g, makeRandom(2))!
    // MST: B-C(1), C-D(1), A-B(2), D-E(3) = 7
    expect(Number(q.options[q.correctIndex])).toBe(7)
  })

  it('mentions a spanning forest when the graph is disconnected', () => {
    const g = graphOf({ weighted: true }, ['A', 'B', 'C', 'D'], [
      ['A', 'B', 1],
      ['C', 'D', 2],
    ])
    const q = generateMstWeightQuestion(g, makeRandom(1))!
    expect(q.explanation).toMatch(/spanning forest of 2 trees/)
    expect(q.prompt).toMatch(/forest/)
  })

  it('does not mention a forest for a connected graph', () => {
    const g = richGraph()
    const q = generateMstWeightQuestion(g, makeRandom(1))!
    expect(q.explanation).not.toMatch(/forest/)
  })
})

describe('availableQuestionTypes', () => {
  it('lists exactly the types usable on a rich graph', () => {
    expect(availableQuestionTypes(richGraph()).sort()).toEqual(['bfs-order', 'mst-weight', 'shortest-path'])
  })

  it('lists none for a graph too small for anything', () => {
    const g = graphOf({}, ['A'], [])
    expect(availableQuestionTypes(g)).toEqual([])
  })

  it('never touches randomness: repeated calls agree', () => {
    const g = richGraph()
    const first = availableQuestionTypes(g)
    for (let i = 0; i < 5; i++) expect(availableQuestionTypes(g)).toEqual(first)
  })
})

describe('generateQuiz', () => {
  it('is fully reproducible for the same seed', () => {
    const g = richGraph()
    expect(generateQuiz(g, 5, 123)).toEqual(generateQuiz(g, 5, 123))
  })

  it('a different seed gives a different quiz', () => {
    const g = richGraph()
    expect(generateQuiz(g, 5, 1)).not.toEqual(generateQuiz(g, 5, 2))
  })

  it('returns no duplicate question ids within one quiz', () => {
    const g = richGraph()
    const quiz = generateQuiz(g, 10, 55)
    expect(new Set(quiz.map((q) => q.id)).size).toBe(quiz.length)
  })

  it('returns [] for a graph that supports no question type', () => {
    expect(generateQuiz(graphOf({}, ['A'], []), 5, 1)).toEqual([])
  })

  it('every generated question is independently well-formed (4-ish options, valid correctIndex)', () => {
    const quiz = generateQuiz(richGraph(), 8, 999)
    for (const q of quiz) {
      expect(q.options.length).toBeGreaterThanOrEqual(2)
      expect(q.correctIndex).toBeGreaterThanOrEqual(0)
      expect(q.correctIndex).toBeLessThan(q.options.length)
      expect(q.explanation.length).toBeGreaterThan(0)
    }
  })

  it('only asks about types the graph actually supports', () => {
    // directed, weighted, connected: shortest-path only (bfs-order needs >=3 reachable, mst-weight needs undirected)
    const g = graphOf({ directed: true, weighted: true }, ['A', 'B'], [['A', 'B', 4]])
    const quiz = generateQuiz(g, 10, 1)
    expect(quiz.every((q) => q.type === 'shortest-path')).toBe(true)
  })
})
