import { describe, expect, it } from 'vitest'
import type { AlgorithmEvent } from './events'
import { StepEngine } from './stepEngine'

const events: AlgorithmEvent[] = [
  { type: 'visit_node', nodeId: 'A' },
  { type: 'enqueue', nodeId: 'B', structure: 'queue', fromNodeId: 'A' },
  { type: 'mark_visited', nodeId: 'A' },
  { type: 'finish', result: { done: true } },
]

describe('StepEngine', () => {
  it('starts before the first event', () => {
    const e = StepEngine.create(events)
    expect(e.position).toBe(0)
    expect(e.length).toBe(4)
    expect(e.isAtStart).toBe(true)
    expect(e.isAtEnd).toBe(false)
    expect(e.currentEvent).toBeNull()
    expect(e.eventsSoFar).toEqual([])
  })

  it('next() applies one event at a time; currentEvent is the last applied', () => {
    const e = StepEngine.create(events).next().next()
    expect(e.position).toBe(2)
    expect(e.currentEvent).toEqual(events[1])
    expect(e.eventsSoFar).toEqual([events[0], events[1]])
  })

  it('next() at the end and prev() at the start do nothing', () => {
    const end = StepEngine.create(events).goToEnd()
    expect(end.isAtEnd).toBe(true)
    expect(end.currentEvent).toEqual(events[3])
    expect(end.next()).toBe(end)
    const start = StepEngine.create(events)
    expect(start.prev()).toBe(start)
  })

  it('prev() steps backwards', () => {
    const e = StepEngine.create(events).goToStep(3).prev()
    expect(e.position).toBe(2)
    expect(e.currentEvent).toEqual(events[1])
  })

  it('reset() returns to the start; goToEnd() jumps to the end', () => {
    const e = StepEngine.create(events).goToStep(2)
    expect(e.reset().position).toBe(0)
    expect(e.goToEnd().position).toBe(4)
  })

  it('goToStep accepts 0 through length inclusive', () => {
    const e = StepEngine.create(events)
    expect(e.goToStep(0).position).toBe(0)
    expect(e.goToStep(4).position).toBe(4)
    expect(e.goToStep(2).eventsSoFar).toHaveLength(2)
  })

  it('goToStep throws on out-of-range or non-integer steps instead of clamping', () => {
    const e = StepEngine.create(events)
    for (const bad of [-1, 5, 1.5, NaN]) {
      expect(() => e.goToStep(bad)).toThrow(RangeError)
    }
  })

  it('is immutable: stepping returns a new engine and leaves the original alone', () => {
    const a = StepEngine.create(events)
    const b = a.next()
    expect(a.position).toBe(0)
    expect(b.position).toBe(1)
    expect(b).not.toBe(a)
    expect(b.events).toBe(a.events) // the event array is shared, not copied per step
  })

  it('is not affected by later changes to the array it was created from', () => {
    const source = [...events]
    const e = StepEngine.create(source)
    source.pop()
    expect(e.length).toBe(4)
    expect(Object.isFrozen(e.events)).toBe(true)
  })

  it('handles an empty run: at start and end at once, no current event', () => {
    const e = StepEngine.create([])
    expect(e.isAtStart).toBe(true)
    expect(e.isAtEnd).toBe(true)
    expect(e.currentEvent).toBeNull()
    expect(e.next()).toBe(e)
    expect(e.prev()).toBe(e)
  })

  it('walking forward then backward visits the same states in reverse', () => {
    let e = StepEngine.create(events)
    const forward: (AlgorithmEvent | null)[] = [e.currentEvent]
    while (!e.isAtEnd) {
      e = e.next()
      forward.push(e.currentEvent)
    }
    const backward: (AlgorithmEvent | null)[] = [e.currentEvent]
    while (!e.isAtStart) {
      e = e.prev()
      backward.push(e.currentEvent)
    }
    expect(backward).toEqual([...forward].reverse())
  })
})
