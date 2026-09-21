/**
 * Playback store (Day 6).
 *
 * Owns the loaded algorithm run (a StepEngine) and the play/pause timer.
 * It never branches on which algorithm is selected: it just calls
 * algorithm.run() and walks the resulting events.
 *
 * Playback uses a self-rescheduling setTimeout, not setInterval. Each tick
 * reads the CURRENT delay when it schedules the next one, so moving the speed
 * slider takes effect on the very next step, and ticks can never pile up.
 */
import { create } from 'zustand'
import { checkRequirements } from '../engine/algorithm'
import type { Algorithm } from '../engine/algorithm'
import { StepEngine } from '../engine/stepEngine'
import { structureSignature } from '../model/signature'
import { useGraphStore } from './graphStore'

const MIN_DELAY_MS = 50
const MAX_DELAY_MS = 3000

interface PlaybackState {
  algorithm: Algorithm | null
  startNodeId: string | null
  engine: StepEngine | null
  isPlaying: boolean
  delayMs: number
  /** Why the algorithm can't run on this graph (from checkRequirements). */
  problems: string[]
  /** True when a loaded run was thrown away because the graph changed under it. */
  invalidated: boolean
  /** Structure of the graph the loaded run was computed from. */
  runSignature: string | null

  selectAlgorithm: (algorithm: Algorithm | null) => void
  setStartNode: (nodeId: string | null) => void
  run: () => void
  play: () => void
  pause: () => void
  stepForward: () => void
  stepBack: () => void
  reset: () => void
  goToStep: (step: number) => void
  setDelayMs: (ms: number) => void
  clearRun: () => void
}

let timer: ReturnType<typeof setTimeout> | null = null

function clearTimer() {
  if (timer !== null) {
    clearTimeout(timer)
    timer = null
  }
}

function schedule() {
  clearTimer()
  timer = setTimeout(tick, usePlaybackStore.getState().delayMs)
}

function tick() {
  timer = null
  const { engine, isPlaying } = usePlaybackStore.getState()
  if (!isPlaying || engine === null) return
  const advanced = engine.next()
  if (advanced.isAtEnd) {
    usePlaybackStore.setState({ engine: advanced, isPlaying: false })
    return
  }
  usePlaybackStore.setState({ engine: advanced })
  schedule()
}

export const usePlaybackStore = create<PlaybackState>()((set, get) => ({
  algorithm: null,
  startNodeId: null,
  engine: null,
  isPlaying: false,
  delayMs: 600,
  problems: [],
  invalidated: false,
  runSignature: null,

  clearRun: () => {
    clearTimer()
    set({ engine: null, isPlaying: false, runSignature: null, problems: [], invalidated: false })
  },

  selectAlgorithm: (algorithm) => {
    get().clearRun()
    set({ algorithm })
  },

  setStartNode: (nodeId) => {
    get().clearRun()
    set({ startNodeId: nodeId })
  },

  run: () => {
    const { algorithm } = get()
    clearTimer()
    if (algorithm === null) {
      set({ engine: null, isPlaying: false, runSignature: null, problems: ['Choose an algorithm first.'] })
      return
    }

    const graph = useGraphStore.getState().graph
    // Default to the first node so "just press Play" works.
    const startNodeId = get().startNodeId ?? graph.nodes[0]?.id ?? null
    const options = startNodeId === null ? {} : { startNodeId }

    const problems = checkRequirements(algorithm, graph, options)
    if (problems.length > 0) {
      set({ engine: null, isPlaying: false, runSignature: null, problems, startNodeId })
      return
    }

    set({
      engine: StepEngine.create(algorithm.run(graph, options)),
      isPlaying: false,
      runSignature: structureSignature(graph),
      problems: [],
      invalidated: false,
      startNodeId,
    })
  },

  play: () => {
    if (get().engine === null) get().run()
    const { engine } = get()
    if (engine === null) return
    // Pressing Play on a finished run replays it from the start.
    set({ engine: engine.isAtEnd ? engine.reset() : engine, isPlaying: true })
    schedule()
  },

  pause: () => {
    clearTimer()
    set({ isPlaying: false })
  },

  stepForward: () => {
    get().pause()
    if (get().engine === null) get().run()
    const { engine } = get()
    if (engine !== null) set({ engine: engine.next() })
  },

  stepBack: () => {
    get().pause()
    const { engine } = get()
    if (engine !== null) set({ engine: engine.prev() })
  },

  reset: () => {
    get().pause()
    const { engine } = get()
    if (engine !== null) set({ engine: engine.reset() })
  },

  goToStep: (step) => {
    get().pause()
    const { engine } = get()
    if (engine !== null) set({ engine: engine.goToStep(step) })
  },

  setDelayMs: (ms) => {
    set({ delayMs: Math.min(MAX_DELAY_MS, Math.max(MIN_DELAY_MS, Math.round(ms))) })
  },
}))

// A loaded run describes ONE graph. If the graph's structure changes, the run
// is stale and is dropped (moving or renaming nodes doesn't count).
useGraphStore.subscribe((state) => {
  const { runSignature } = usePlaybackStore.getState()
  if (runSignature === null) return
  if (structureSignature(state.graph) !== runSignature) {
    clearTimer()
    usePlaybackStore.setState({ engine: null, isPlaying: false, runSignature: null, invalidated: true })
  }
})
