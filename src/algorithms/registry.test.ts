import { describe, expect, it } from 'vitest'
import { ALGORITHM_REGISTRY, getAlgorithmById } from './registry'

describe('algorithm registry', () => {
  it('lists every algorithm built so far, each with a unique id', () => {
    expect(ALGORITHM_REGISTRY.length).toBeGreaterThanOrEqual(13) // 10 original + the Day 15 proof + Tarjan's SCC + bridges/articulation (Milestone 6)
    const ids = ALGORITHM_REGISTRY.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('getAlgorithmById finds a real algorithm and returns undefined for an unknown id', () => {
    expect(getAlgorithmById('bfs')?.name).toBe('Breadth-First Search')
    expect(getAlgorithmById('nope')).toBeUndefined()
  })

  it('every algorithm has the shape checkRequirements and run() expect', () => {
    for (const a of ALGORITHM_REGISTRY) {
      expect(typeof a.id).toBe('string')
      expect(typeof a.name).toBe('string')
      expect(typeof a.run).toBe('function')
      expect(typeof a.requirements).toBe('object')
    }
  })

  it('includes the Milestone 6 connectivity algorithms, so the registry-wide stress and comparison tests cover them', () => {
    expect(getAlgorithmById('tarjan-scc')?.category).toBe('connectivity')
    expect(getAlgorithmById('bridges-articulation')?.category).toBe('connectivity')
  })
})
