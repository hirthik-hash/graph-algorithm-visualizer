/**
 * Algorithm picker + playback controls + event log (Day 6).
 * The algorithm list comes from the registry.
 */
import { useEffect } from 'react'
import { explainEvent } from '../engine/explain'
import { ALGORITHM_REGISTRY } from '../algorithms/registry'
import { isEditableTarget, resolvePlaybackShortcut } from './keyboardShortcuts'
import { useGraphStore } from './graphStore'
import { usePlaybackStore } from './playbackStore'


/** Speed 1..10 maps to a delay of 1200ms / speed. */
const delayToSpeed = (delayMs: number) => Math.min(10, Math.max(1, Math.round(1200 / delayMs)))
const speedToDelay = (speed: number) => Math.round(1200 / speed)

export default function PlaybackControls() {
  const graph = useGraphStore((s) => s.graph)

  const algorithm = usePlaybackStore((s) => s.algorithm)
  const startNodeId = usePlaybackStore((s) => s.startNodeId)
  const goalNodeId = usePlaybackStore((s) => s.goalNodeId)
  const engine = usePlaybackStore((s) => s.engine)
  const isPlaying = usePlaybackStore((s) => s.isPlaying)
  const delayMs = usePlaybackStore((s) => s.delayMs)
  const problems = usePlaybackStore((s) => s.problems)
  const invalidated = usePlaybackStore((s) => s.invalidated)

  const selectAlgorithm = usePlaybackStore((s) => s.selectAlgorithm)
  const setStartNode = usePlaybackStore((s) => s.setStartNode)
  const setGoalNode = usePlaybackStore((s) => s.setGoalNode)
  const play = usePlaybackStore((s) => s.play)
  const pause = usePlaybackStore((s) => s.pause)
  const stepForward = usePlaybackStore((s) => s.stepForward)
  const stepBack = usePlaybackStore((s) => s.stepBack)
  const reset = usePlaybackStore((s) => s.reset)
  const goToStep = usePlaybackStore((s) => s.goToStep)
  const setDelayMs = usePlaybackStore((s) => s.setDelayMs)

  const labelOf = (id: string) => graph.nodes.find((n) => n.id === id)?.label ?? id

  const canRun = algorithm !== null
  const startValue = graph.nodes.some((n) => n.id === startNodeId) ? (startNodeId ?? '') : ''
  const goalValue = graph.nodes.some((n) => n.id === goalNodeId) ? (goalNodeId ?? '') : ''
  const needsGoal = algorithm?.requirements.goalNode === true

  // Keyboard step-through (Day 18): ← / → step, Space plays/pauses, Home
  // resets, End jumps to the end. Ignored while typing in a form field, and
  // never active if no algorithm has been chosen yet.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.altKey || event.metaKey) return
      const target = event.target as HTMLElement | null
      if (isEditableTarget(target?.tagName, target?.isContentEditable)) return
      const shortcut = resolvePlaybackShortcut(event.key)
      if (shortcut === null || !canRun) return

      event.preventDefault()
      switch (shortcut) {
        case 'stepForward':
          stepForward()
          break
        case 'stepBack':
          stepBack()
          break
        case 'playPause':
          if (isPlaying) pause()
          else play()
          break
        case 'reset':
          reset()
          break
        case 'goToEnd':
          if (engine) goToStep(engine.length)
          break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canRun, isPlaying, engine, play, pause, stepForward, stepBack, reset, goToStep])

  return (
    <section className="panel playback">
      <h2>Run an algorithm</h2>

      <div className="row">
        <select
          aria-label="Algorithm"
          value={algorithm?.id ?? ''}
          onChange={(e) => selectAlgorithm(ALGORITHM_REGISTRY.find((a) => a.id === e.target.value) ?? null)}
        >
          <option value="">Choose an algorithm…</option>
          {ALGORITHM_REGISTRY.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Start node"
          value={startValue}
          onChange={(e) => setStartNode(e.target.value === '' ? null : e.target.value)}
        >
          <option value="">Start: first node</option>
          {graph.nodes.map((n) => (
            <option key={n.id} value={n.id}>
              {`Start: ${n.label ?? n.id}`}
            </option>
          ))}
        </select>

        {needsGoal && (
          <select
            aria-label="Goal node"
            value={goalValue}
            onChange={(e) => setGoalNode(e.target.value === '' ? null : e.target.value)}
          >
            <option value="">Goal: last node</option>
            {graph.nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {`Goal: ${n.label ?? n.id}`}
              </option>
            ))}
          </select>
        )}
      </div>

      {problems.length > 0 && (
        <div role="alert" className="notice">
          <strong>Can’t run {algorithm?.name ?? 'this'} on the current graph:</strong>
          <ul>
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {invalidated && problems.length === 0 && (
        <p className="notice" role="status">
          The graph changed, so the previous run was cleared. Press Play or Step to run again.
        </p>
      )}

      <div className="row buttons">
        <button onClick={stepBack} disabled={!engine || engine.isAtStart} aria-label="Step back">
          ◀ Back
        </button>
        {isPlaying ? (
          <button onClick={pause}>Pause</button>
        ) : (
          <button onClick={play} disabled={!canRun}>
            {engine?.isAtEnd ? 'Replay' : 'Play'}
          </button>
        )}
        <button onClick={stepForward} disabled={!canRun || (engine?.isAtEnd ?? false)} aria-label="Step forward">
          Step ▶
        </button>
        <button onClick={reset} disabled={!engine || engine.isAtStart}>
          Reset
        </button>
      </div>

      {canRun && (
        <p className="hint">Keyboard: ← / → to step, Space to play/pause, Home to reset, End to jump to the end.</p>
      )}

      <label className="row">
        Speed
        <input
          type="range"
          min={1}
          max={10}
          value={delayToSpeed(delayMs)}
          onChange={(e) => setDelayMs(speedToDelay(Number(e.target.value)))}
        />
      </label>

      {engine && (
        <>
          <label className="row">
            Step {engine.position} / {engine.length}
            <input
              type="range"
              aria-label="Scrub through steps"
              min={0}
              max={engine.length}
              value={engine.position}
              onChange={(e) => goToStep(Number(e.target.value))}
            />
          </label>

          <p className="step-explanation" aria-live="polite">
            {engine.currentEvent === null
              ? 'Press Step or Play to begin.'
              : explainEvent(engine.currentEvent, labelOf)}
          </p>

          <ol className="event-log" aria-label="Events">
            {engine.events.map((event, i) => (
              <li
                key={i}
                className={i === engine.position - 1 ? 'current' : i < engine.position ? 'done' : ''}
                aria-current={i === engine.position - 1 ? 'step' : undefined}
              >
                {explainEvent(event, labelOf)}
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  )
}
