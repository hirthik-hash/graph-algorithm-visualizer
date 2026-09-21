/**
 * Distance-matrix view (Day 8). Shows the latest matrix_update snapshot of the
 * loaded run and renders nothing for algorithms that don't emit one.
 * Cells that improved in this snapshot are highlighted, the waypoint's row and
 * column are shaded, and a negative diagonal (negative cycle) is flagged.
 */
import { useMemo } from 'react'
import { computeHighlights } from '../engine/highlights'
import { useGraphStore } from './graphStore'
import { usePlaybackStore } from './playbackStore'

export default function FloydWarshallView() {
  const engine = usePlaybackStore((s) => s.engine)
  const graph = useGraphStore((s) => s.graph)
  const { matrix } = useMemo(() => computeHighlights(engine?.eventsSoFar ?? []), [engine])

  if (matrix === null) return null

  const labelOf = (id: string) => graph.nodes.find((n) => n.id === id)?.label ?? id
  const changed = new Set(matrix.changed.map(([i, j]) => `${i},${j}`))
  const waypointIndex = matrix.waypointNodeId === undefined ? -1 : matrix.nodeIds.indexOf(matrix.waypointNodeId)

  return (
    <section className="panel fw-view">
      <h2>
        Distance matrix
        {matrix.waypointNodeId !== undefined && <span className="muted"> — via {labelOf(matrix.waypointNodeId)}</span>}
      </h2>
      {matrix.nodeIds.length === 0 ? (
        <p className="empty">No nodes.</p>
      ) : (
        <div className="scroll">
          <table className="matrix">
            <thead>
              <tr>
                <th />
                {matrix.nodeIds.map((id, j) => (
                  <th key={id} scope="col" className={j === waypointIndex ? 'waypoint' : ''}>
                    {labelOf(id)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.nodeIds.map((rowId, i) => (
                <tr key={rowId}>
                  <th scope="row" className={i === waypointIndex ? 'waypoint' : ''}>
                    {labelOf(rowId)}
                  </th>
                  {matrix.matrix[i].map((value, j) => {
                    const classes = ['fw-cell']
                    if (changed.has(`${i},${j}`)) classes.push('improved')
                    if (i === waypointIndex || j === waypointIndex) classes.push('on-waypoint')
                    if (i === j && value !== null && value < 0) classes.push('negative-cycle')
                    if (value === null) classes.push('none')
                    return (
                      <td key={matrix.nodeIds[j]} className={classes.join(' ')}>
                        {value === null ? '∞' : value}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
