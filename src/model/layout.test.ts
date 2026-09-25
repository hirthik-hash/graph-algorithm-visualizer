import { describe, expect, it } from 'vitest'
import { circleLayout } from './layout'

describe('circleLayout', () => {
  it('returns one point per requested count', () => {
    expect(circleLayout(5)).toHaveLength(5)
    expect(circleLayout(0)).toHaveLength(0)
  })

  it('places a single node at the center, not on the circle', () => {
    const [p] = circleLayout(1)
    expect(p).toEqual({ x: 400, y: 250 })
  })

  it('every point is a finite number, never (0, 0) by accident', () => {
    for (const p of circleLayout(12)) {
      expect(Number.isFinite(p.x)).toBe(true)
      expect(Number.isFinite(p.y)).toBe(true)
      expect(p.x === 0 && p.y === 0).toBe(false)
    }
  })

  it('spreads points out: no two points land on top of each other', () => {
    const points = circleLayout(8)
    const keys = new Set(points.map((p) => `${p.x},${p.y}`))
    expect(keys.size).toBe(points.length)
  })

  it('is deterministic', () => {
    expect(circleLayout(6)).toEqual(circleLayout(6))
  })
})
