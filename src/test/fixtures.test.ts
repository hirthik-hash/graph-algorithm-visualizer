import { describe, expect, it } from 'vitest'
import { connectedComponents, findCycle } from '../model/analyzer'
import {
  disconnectedGraph,
  equalWeightsGraph,
  parallelEdgesGraph,
  selfLoopGraph,
  singleNodeGraph,
} from './fixtures'

describe('shared test fixtures', () => {
  it('disconnectedGraph has three components: two pairs and one isolated node', () => {
    const components = connectedComponents(disconnectedGraph())
    expect(components.map((c) => c.length).sort()).toEqual([1, 2, 2])
  })

  it('singleNodeGraph has one node and no edges', () => {
    const g = singleNodeGraph()
    expect(g.nodes).toHaveLength(1)
    expect(g.edges).toHaveLength(0)
  })

  it('selfLoopGraph has a self-loop, which findCycle reports as a length-1 cycle', () => {
    const g = selfLoopGraph()
    expect(g.edges.some((e) => e.source === e.target)).toBe(true)
    expect(findCycle(g)).toEqual(['A'])
  })

  it('parallelEdgesGraph has two edges between the same ordered pair, with different weights', () => {
    const g = parallelEdgesGraph()
    expect(g.edges).toHaveLength(2)
    expect(g.edges.every((e) => e.source === 'A' && e.target === 'B')).toBe(true)
    expect(new Set(g.edges.map((e) => e.weight)).size).toBe(2)
  })

  it('equalWeightsGraph is a triangle where every edge weighs 1', () => {
    const g = equalWeightsGraph()
    expect(g.edges).toHaveLength(3)
    expect(g.edges.every((e) => e.weight === 1)).toBe(true)
  })

  it('each fixture returns a fresh object, so two calls never share references', () => {
    const a = disconnectedGraph()
    const b = disconnectedGraph()
    expect(a).toEqual(b)
    expect(a).not.toBe(b)
    expect(a.nodes).not.toBe(b.nodes)
  })
})
