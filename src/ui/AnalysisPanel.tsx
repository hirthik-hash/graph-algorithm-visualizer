/**
 * Live structural analysis of the current graph (Day 4).
 * Derived from the store's graph on every change; no local graph state.
 */
import { useMemo } from 'react'
import { useGraphStore } from './graphStore'
import { analyzeGraph } from '../model/analyzer'

export default function AnalysisPanel() {
  const graph = useGraphStore((s) => s.graph)
  const analysis = useMemo(() => analyzeGraph(graph), [graph])

  const labels = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n.label ?? n.id])), [graph])
  const labelOf = (id: string) => labels.get(id) ?? id
  const join = (ids: string[]) => ids.map(labelOf).join(', ')

  const colorGroup = (color: 0 | 1) =>
    analysis.coloring
      ? Object.entries(analysis.coloring)
          .filter(([, c]) => c === color)
          .map(([id]) => id)
      : []

  return (
    <section className="panel analysis">
      <h2>Graph analysis</h2>

      {analysis.nodeCount === 0 ? (
        <p className="empty">Add some nodes to analyse the graph.</p>
      ) : (
        <div className="analysis-grid">
          <div>
            <h3>Degrees</h3>
            <table className="edge-table">
              <thead>
                <tr>
                  <th>Node</th>
                  {graph.directed ? (
                    <>
                      <th>In</th>
                      <th>Out</th>
                      <th>Total</th>
                    </>
                  ) : (
                    <th>Degree</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {analysis.degrees.map((d) => (
                  <tr key={d.nodeId}>
                    <td>{labelOf(d.nodeId)}</td>
                    {graph.directed ? (
                      <>
                        <td>{d.inDegree}</td>
                        <td>{d.outDegree}</td>
                        <td>{d.degree}</td>
                      </>
                    ) : (
                      <td>{d.degree}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h3>{graph.directed ? 'Weakly connected components' : 'Connected components'}</h3>
            <p className="fact">
              {analysis.components.length} component{analysis.components.length === 1 ? '' : 's'}
              {analysis.isConnected ? ' (connected)' : ''}
            </p>
            <ul className="plain-list">
              {analysis.components.map((c) => (
                <li key={c[0]}>{`{ ${join(c)} }`}</li>
              ))}
            </ul>

            <h3>Cycles</h3>
            <p className="fact">
              {analysis.hasCycle ? 'Has a cycle' : 'No cycles'}
              {analysis.cycle && `: ${analysis.cycle.map(labelOf).join(' → ')} → ${labelOf(analysis.cycle[0])}`}
            </p>
          </div>

          <div>
            <h3>DAG</h3>
            <p className="fact">
              {analysis.isDag === null ? 'Not applicable (graph is undirected)' : analysis.isDag ? 'Yes, a DAG' : 'No'}
            </p>

            <h3>Bipartite</h3>
            {analysis.isBipartite ? (
              <>
                <p className="fact">Yes</p>
                <ul className="plain-list">
                  <li>{`Set 0: ${colorGroup(0).length ? join(colorGroup(0)) : '—'}`}</li>
                  <li>{`Set 1: ${colorGroup(1).length ? join(colorGroup(1)) : '—'}`}</li>
                </ul>
              </>
            ) : (
              <p className="fact">No</p>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
