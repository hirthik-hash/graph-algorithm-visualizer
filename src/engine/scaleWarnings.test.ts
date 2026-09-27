import { describe, expect, it } from 'vitest'
import { bfsAlgorithm } from '../algorithms/bfs'
import { floydWarshallAlgorithm } from '../algorithms/floydWarshall'
import { createGraph } from '../model/graph'
import type { Graph } from '../model/graph'
import { algorithmScaleWarning, estimateFloydWarshallCells } from './scaleWarnings'

function graphWithNodes(count: number): Graph {
  return { ...createGraph({ weighted: true }), nodes: Array.from({ length: count }, (_, i) => ({ id: `n${i}` })), edges: [] }
}

describe('estimateFloydWarshallCells', () => {
  it('matches (n+1) * n * n', () => {
    expect(estimateFloydWarshallCells(10)).toBe(11 * 10 * 10)
    expect(estimateFloydWarshallCells(100)).toBe(101 * 100 * 100)
  })

  it('is zero for an empty graph', () => {
    expect(estimateFloydWarshallCells(0)).toBe(0)
  })
})

describe('algorithmScaleWarning', () => {
  it('is null for Floyd-Warshall at or below the threshold', () => {
    expect(algorithmScaleWarning(graphWithNodes(50), floydWarshallAlgorithm)).toBeNull()
    expect(algorithmScaleWarning(graphWithNodes(10), floydWarshallAlgorithm)).toBeNull()
  })

  it('warns for Floyd-Warshall above the threshold, with the real numbers for that graph', () => {
    const warning = algorithmScaleWarning(graphWithNodes(100), floydWarshallAlgorithm)
    expect(warning).not.toBeNull()
    expect(warning).toContain('100×100')
    expect(warning).toContain(estimateFloydWarshallCells(100).toLocaleString())
    expect(warning).toContain('101 snapshots')
  })

  it('is null for every other algorithm, regardless of graph size', () => {
    expect(algorithmScaleWarning(graphWithNodes(200), bfsAlgorithm)).toBeNull()
  })
})
