import { describe, expect, it } from 'vitest'
import { getAlgorithmById } from './registry'
import { countReachableAlgorithm } from './countReachable'
import { disconnectedGraph, singleNodeGraph, selfLoopGraph } from '../test/fixtures'
import type { AlgorithmEvent } from '../engine/events'

function finishResult(events: AlgorithmEvent[]) {
  const last = events[events.length - 1]
  if (last.type !== 'finish') throw new Error('last event is not finish')
  return last.result
}

describe('Count Reachable Nodes', () => {
  it('counts only the component reachable from the start node', () => {
    const g = disconnectedGraph() // A-B, C-D, and isolated E
    expect(finishResult(countReachableAlgorithm.run(g, { startNodeId: 'A' })).count).toBe(2)
    expect(finishResult(countReachableAlgorithm.run(g, { startNodeId: 'C' })).count).toBe(2)
    expect(finishResult(countReachableAlgorithm.run(g, { startNodeId: 'E' })).count).toBe(1)
  })

  it('counts a self-loop node once', () => {
    const g = selfLoopGraph() // A has a self-loop and an edge to B
    expect(finishResult(countReachableAlgorithm.run(g, { startNodeId: 'A' })).count).toBe(2)
  })

  it('handles a single-node graph', () => {
    expect(finishResult(countReachableAlgorithm.run(singleNodeGraph(), { startNodeId: 'A' })).count).toBe(1)
  })

  it('requires a start node', () => {
    expect(countReachableAlgorithm.requirements).toEqual({ startNode: true })
    expect(() => countReachableAlgorithm.run(singleNodeGraph())).toThrow(/start node/i)
  })

  // --- The actual point of this file: prove the plugin architecture. ---
  it('is reachable through the registry alone, with no algorithm-specific wiring needed', () => {
    const fromRegistry = getAlgorithmById('count-reachable')
    expect(fromRegistry).toBe(countReachableAlgorithm) // the registry's entry IS this object
    expect(fromRegistry?.run(disconnectedGraph(), { startNodeId: 'A' })).toEqual(
      countReachableAlgorithm.run(disconnectedGraph(), { startNodeId: 'A' }),
    )
  })
})
