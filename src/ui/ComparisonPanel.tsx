/**
 * Algorithm comparison table (Day 12): runs every registered algorithm on the
 * CURRENT graph (using the same start/goal defaults as the playback bar) and
 * shows one row each, including ones that can't run.
 */
import { useMemo, useState } from 'react'
import { ALGORITHM_REGISTRY } from '../algorithms/registry'
import { compareAlgorithms, defaultOptions, explainDifference } from '../engine/compare'
import { useGraphStore } from './graphStore'
import { usePlaybackStore } from './playbackStore'

export default function ComparisonPanel() {
  const graph = useGraphStore((s) => s.graph)
  const startNodeId = usePlaybackStore((s) => s.startNodeId)
  const goalNodeId = usePlaybackStore((s) => s.goalNodeId)

  // Reuse the playback bar's chosen start/goal when set, otherwise the same
  // defaults it would fall back to (first node / last node).
  const options = useMemo(() => {
    const fallback = defaultOptions(graph)
    return {
      ...fallback,
      ...(startNodeId === null ? {} : { startNodeId }),
      ...(goalNodeId === null ? {} : { goalNodeId }),
    }
  }, [graph, startNodeId, goalNodeId])

  const rows = useMemo(() => compareAlgorithms(graph, ALGORITHM_REGISTRY, options), [graph, options])
  const ranRows = rows.filter((r) => r.ran)

  const [leftId, setLeftId] = useState('')
  const [rightId, setRightId] = useState('')
  const left = rows.find((r) => r.algorithmId === leftId)
  const right = rows.find((r) => r.algorithmId === rightId)

  return (
    <section className="panel comparison">
      <h2>Algorithm comparison</h2>
      {graph.nodes.length === 0 ? (
        <p className="empty">Add some nodes to compare algorithms.</p>
      ) : (
        <>
          <div className="scroll">
            <table className="edge-table">
              <thead>
                <tr>
                  <th>Algorithm</th>
                  <th>Category</th>
                  <th>Ran?</th>
                  <th>Steps</th>
                  <th>Nodes visited</th>
                  <th>Edges examined</th>
                  <th>Time</th>
                  <th>Space</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.algorithmId} className={row.ran ? '' : 'row-not-run'}>
                    <td>{row.name}</td>
                    <td>{row.category}</td>
                    <td>{row.ran ? 'Yes' : 'No'}</td>
                    <td>{row.steps ?? '—'}</td>
                    <td>{row.nodesVisited ?? '—'}</td>
                    <td>{row.edgesExamined ?? '—'}</td>
                    <td>{row.timeComplexity}</td>
                    <td>{row.spaceComplexity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.some((r) => !r.ran) && (
            <ul className="plain-list not-run-reasons">
              {rows
                .filter((r) => !r.ran)
                .map((r) => (
                  <li key={r.algorithmId}>
                    <strong>{r.name}:</strong> {r.problems.join(' ')}
                  </li>
                ))}
            </ul>
          )}

          {ranRows.length >= 2 && (
            <div className="compare-pair">
              <div className="row">
                <select aria-label="Compare: first algorithm" value={leftId} onChange={(e) => setLeftId(e.target.value)}>
                  <option value="">Compare…</option>
                  {ranRows.map((r) => (
                    <option key={r.algorithmId} value={r.algorithmId}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <span>vs</span>
                <select aria-label="Compare: second algorithm" value={rightId} onChange={(e) => setRightId(e.target.value)}>
                  <option value="">…with</option>
                  {ranRows.map((r) => (
                    <option key={r.algorithmId} value={r.algorithmId}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              {left && right && <p className="fact">{explainDifference(left, right)}</p>}
            </div>
          )}
        </>
      )}
    </section>
  )
}
