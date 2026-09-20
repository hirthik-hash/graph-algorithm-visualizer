/**
 * Live-updating views of the current graph (Day 3).
 * Everything shown here is derived from the store's graph on every change;
 * nothing is kept in component state.
 */
import { useMemo } from 'react'
import { useGraphStore } from './graphStore'
import { toAdjacencyList, toAdjacencyMatrix, toEdgeList } from '../model/representations'

export default function RepresentationPanels() {
  const graph = useGraphStore((s) => s.graph)

  const matrix = useMemo(() => toAdjacencyMatrix(graph), [graph])
  const list = useMemo(() => toAdjacencyList(graph), [graph])
  const edges = useMemo(() => toEdgeList(graph), [graph])
  const labelOf = useMemo(() => {
    const labels = new Map(graph.nodes.map((n) => [n.id, n.label ?? n.id]))
    return (id: string) => labels.get(id) ?? id
  }, [graph])

  const arrow = graph.directed ? '→' : '—'
  const emptyCell = graph.weighted ? '∞' : '0'

  return (
    <div className="representations">
      <section className="panel">
        <h2>Adjacency matrix</h2>
        {matrix.nodeIds.length === 0 ? (
          <p className="empty">Add some nodes to see the matrix.</p>
        ) : (
          <div className="scroll">
            <table className="matrix">
              <thead>
                <tr>
                  <th />
                  {matrix.nodeIds.map((id) => (
                    <th key={id} scope="col">
                      {labelOf(id)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.nodeIds.map((rowId, i) => (
                  <tr key={rowId}>
                    <th scope="row">{labelOf(rowId)}</th>
                    {matrix.cells[i].map((cell, j) => (
                      <td key={matrix.nodeIds[j]} className={cell === null ? 'none' : 'has-edge'}>
                        {cell === null ? emptyCell : cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Adjacency list</h2>
        {list.length === 0 ? (
          <p className="empty">No nodes yet.</p>
        ) : (
          <ul className="adj-list">
            {list.map((entry) => (
              <li key={entry.nodeId}>
                <strong>{labelOf(entry.nodeId)}</strong>
                {' → '}
                {entry.neighbors.length === 0
                  ? '∅'
                  : entry.neighbors
                      .map((nb) => (nb.weight === undefined ? labelOf(nb.nodeId) : `${labelOf(nb.nodeId)} (${nb.weight})`))
                      .join(', ')}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2>Edge list</h2>
        {edges.length === 0 ? (
          <p className="empty">No edges yet.</p>
        ) : (
          <table className="edge-table">
            <thead>
              <tr>
                <th>Edge</th>
                <th>Connects</th>
                {graph.weighted && <th>Weight</th>}
              </tr>
            </thead>
            <tbody>
              {edges.map((e) => (
                <tr key={e.id}>
                  <td>{e.id}</td>
                  <td>{`${labelOf(e.source)} ${arrow} ${labelOf(e.target)}`}</td>
                  {graph.weighted && <td>{e.weight}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
