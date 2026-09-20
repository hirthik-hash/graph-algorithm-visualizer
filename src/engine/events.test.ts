import { describe, expect, it } from 'vitest'
import { EVENT_SCHEMA_VERSION, EVENT_TYPES } from './events'
import type { AlgorithmEvent } from './events'

// Typed as a Record so this file also fails to COMPILE if a new event type is
// added without a sample here.
const SAMPLES: Record<AlgorithmEvent['type'], AlgorithmEvent> = {
  visit_node: { type: 'visit_node', nodeId: 'A' },
  enqueue: { type: 'enqueue', nodeId: 'B', structure: 'priority_queue', fromNodeId: 'A', priority: 4 },
  dequeue: { type: 'dequeue', nodeId: 'B', structure: 'queue' },
  relax_edge: { type: 'relax_edge', edgeId: 'e1', source: 'A', target: 'B', weight: 3 },
  update_distance: { type: 'update_distance', nodeId: 'B', distance: 3, previousDistance: null, viaNodeId: 'A' },
  mark_visited: { type: 'mark_visited', nodeId: 'B' },
  negative_cycle_detected: { type: 'negative_cycle_detected', edgeId: 'e2' },
  finish: { type: 'finish', result: { hasCycle: false, order: ['A', 'B'], nested: { ok: true } } },
}

describe('algorithm events', () => {
  it('starts at schema version 1', () => {
    expect(EVENT_SCHEMA_VERSION).toBe(1)
  })

  it('lists every event type, derived from the union', () => {
    expect([...EVENT_TYPES].sort()).toEqual(
      [
        'dequeue',
        'enqueue',
        'finish',
        'mark_visited',
        'negative_cycle_detected',
        'relax_edge',
        'update_distance',
        'visit_node',
      ].sort(),
    )
  })

  it('has a sample for every event type, and each sample matches its key', () => {
    for (const type of EVENT_TYPES) {
      expect(SAMPLES[type].type).toBe(type)
    }
  })

  it('every event survives a JSON round trip unchanged (traces must be exportable)', () => {
    for (const type of EVENT_TYPES) {
      const event = SAMPLES[type]
      expect(JSON.parse(JSON.stringify(event))).toEqual(event)
    }
  })
})
