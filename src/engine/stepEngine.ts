/**
 * Step Engine (Day 5).
 *
 * Steps through a PRECOMPUTED event list. The algorithm has already run to
 * completion; the engine just moves a cursor. That is deliberate:
 *  - stepping BACKWARDS is trivial (a live generator can only go forward),
 *  - jumping to any step is O(1),
 *  - the whole run is available up front for the comparison table and quiz.
 *
 * The engine is IMMUTABLE: next()/prev()/etc. return a new engine (sharing the
 * same frozen event array) instead of changing this one. That fits the
 * project's pattern (pure model functions wrapped by Zustand) and means React
 * state updates need no copying or mirrored counters.
 *
 * `position` is how many events have been applied: 0 = before the first event,
 * events.length = after the last one.
 */
import type { AlgorithmEvent } from './events'

export class StepEngine {
  private constructor(
    readonly events: readonly AlgorithmEvent[],
    readonly position: number,
  ) {}

  /** Copies and freezes the events, so later changes to the caller's array can't alter a run. */
  static create(events: readonly AlgorithmEvent[]): StepEngine {
    return new StepEngine(Object.freeze([...events]), 0)
  }

  get length(): number {
    return this.events.length
  }

  get isAtStart(): boolean {
    return this.position === 0
  }

  get isAtEnd(): boolean {
    return this.position === this.events.length
  }

  /** The most recently applied event, or null before the first step. */
  get currentEvent(): AlgorithmEvent | null {
    return this.position === 0 ? null : this.events[this.position - 1]
  }

  /** Every event applied so far. Highlighting and explanations are derived from this. */
  get eventsSoFar(): readonly AlgorithmEvent[] {
    return this.events.slice(0, this.position)
  }

  next(): StepEngine {
    return this.isAtEnd ? this : new StepEngine(this.events, this.position + 1)
  }

  prev(): StepEngine {
    return this.isAtStart ? this : new StepEngine(this.events, this.position - 1)
  }

  reset(): StepEngine {
    return this.isAtStart ? this : new StepEngine(this.events, 0)
  }

  goToEnd(): StepEngine {
    return this.isAtEnd ? this : new StepEngine(this.events, this.events.length)
  }

  /**
   * Jumps to `step` (0 to length inclusive). Out-of-range or non-integer input
   * throws instead of being silently clamped, so a UI bug shows up immediately.
   */
  goToStep(step: number): StepEngine {
    if (!Number.isInteger(step) || step < 0 || step > this.events.length) {
      throw new RangeError(`Step ${step} is out of range (0 to ${this.events.length})`)
    }
    return step === this.position ? this : new StepEngine(this.events, step)
  }
}
