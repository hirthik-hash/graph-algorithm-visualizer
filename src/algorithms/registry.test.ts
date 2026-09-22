import { describe, expect, it } from 'vitest'
import { ALGORITHM_REGISTRY, getAlgorithmById } from './registry'

describe('algorithm registry', () => {
  it('lists every algorithm built so far, each with a unique id', () => {
    expect(ALGORITHM_REGISTRY.length).toBeGreaterThanOrEqual(10)
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
})
