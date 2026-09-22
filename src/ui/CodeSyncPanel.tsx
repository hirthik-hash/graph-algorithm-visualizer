/**
 * Code↔Graph Sync panel (Day 13). Shows the pseudocode for the loaded
 * algorithm and highlights the line(s) matching the CURRENT event's type.
 * Renders nothing when the algorithm has no pseudocode yet (see hasPseudocode).
 *
 * The highlighting itself is a plain lookup (linesForEvent) against the event
 * type — this component adds no algorithm-specific logic of its own.
 */
import { useMemo } from 'react'
import { hasPseudocode, linesForEvent, pseudocodeFor } from '../algorithms/pseudocode'
import { usePlaybackStore } from './playbackStore'

export default function CodeSyncPanel() {
  const algorithm = usePlaybackStore((s) => s.algorithm)
  const engine = usePlaybackStore((s) => s.engine)

  const lines = algorithm && hasPseudocode(algorithm.id) ? pseudocodeFor(algorithm.id) : null
  const currentEvent = engine?.currentEvent ?? null

  const activeLineNumbers = useMemo(() => {
    if (lines === null || currentEvent === null) return new Set<number>()
    return new Set(linesForEvent(lines, currentEvent.type).map((l) => l.line))
  }, [lines, currentEvent])

  if (lines === null) return null

  return (
    <section className="panel code-sync">
      <h2>Pseudocode</h2>
      <pre className="pseudocode">
        {lines.map((l) => (
          <div key={l.line} className={activeLineNumbers.has(l.line) ? 'pc-line pc-active' : 'pc-line'}>
            <span className="pc-line-number">{l.line}</span>
            <span className="pc-text">{l.text}</span>
          </div>
        ))}
      </pre>
    </section>
  )
}
