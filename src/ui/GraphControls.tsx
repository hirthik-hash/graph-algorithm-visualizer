/**
 * Toolbar + edit dropdowns (Day 2).
 * Local state here is only UI drafts (which dropdown item is selected, text
 * being typed). The graph itself always lives in the store.
 */
import { useState } from 'react'
import { useGraphStore } from './graphStore'
import type { Graph } from '../model/graph'

const nameOf = (graph: Graph, id: string): string =>
  graph.nodes.find((n) => n.id === id)?.label ?? id

export default function GraphControls() {
  const graph = useGraphStore((s) => s.graph)
  const newEdgeWeight = useGraphStore((s) => s.newEdgeWeight)
  const setDirected = useGraphStore((s) => s.setDirected)
  const setWeighted = useGraphStore((s) => s.setWeighted)
  const setNewEdgeWeight = useGraphStore((s) => s.setNewEdgeWeight)
  const clearGraph = useGraphStore((s) => s.clearGraph)
  const renameNode = useGraphStore((s) => s.renameNode)
  const removeEdgeById = useGraphStore((s) => s.removeEdgeById)
  const setEdgeWeight = useGraphStore((s) => s.setEdgeWeight)

  const [nodeId, setNodeId] = useState('')
  const [labelDraft, setLabelDraft] = useState('')
  const [edgeId, setEdgeId] = useState('')
  const [weightDraft, setWeightDraft] = useState('')

  // A selection can go stale when its node/edge is deleted elsewhere; treat that as "nothing selected".
  const selectedNode = graph.nodes.find((n) => n.id === nodeId)
  const selectedEdge = graph.edges.find((e) => e.id === edgeId)

  const arrow = graph.directed ? '→' : '—'

  return (
    <section className="controls">
      <h2>Graph</h2>

      <label className="row">
        <input type="checkbox" checked={graph.directed} onChange={(e) => setDirected(e.target.checked)} />
        Directed
      </label>
      <label className="row">
        <input type="checkbox" checked={graph.weighted} onChange={(e) => setWeighted(e.target.checked)} />
        Weighted
      </label>
      {graph.weighted && (
        <label className="row">
          New edge weight
          <input
            type="number"
            value={newEdgeWeight}
            onChange={(e) => setNewEdgeWeight(Number(e.target.value))}
          />
        </label>
      )}
      <button onClick={clearGraph} disabled={graph.nodes.length === 0}>
        Clear graph
      </button>

      <h2>Rename node</h2>
      <select
        aria-label="Node to rename"
        value={selectedNode ? selectedNode.id : ''}
        onChange={(e) => {
          setNodeId(e.target.value)
          setLabelDraft(graph.nodes.find((n) => n.id === e.target.value)?.label ?? '')
        }}
      >
        <option value="">Select a node…</option>
        {graph.nodes.map((n) => (
          <option key={n.id} value={n.id}>
            {n.label ? `${n.id} (${n.label})` : n.id}
          </option>
        ))}
      </select>
      <div className="row">
        <input
          type="text"
          aria-label="New label"
          placeholder="Label"
          value={labelDraft}
          disabled={!selectedNode}
          onChange={(e) => setLabelDraft(e.target.value)}
        />
        <button disabled={!selectedNode} onClick={() => selectedNode && renameNode(selectedNode.id, labelDraft)}>
          Apply
        </button>
      </div>

      <h2>Edit edge</h2>
      <select
        aria-label="Edge to edit"
        value={selectedEdge ? selectedEdge.id : ''}
        onChange={(e) => {
          setEdgeId(e.target.value)
          const w = graph.edges.find((x) => x.id === e.target.value)?.weight
          setWeightDraft(w === undefined ? '' : String(w))
        }}
      >
        <option value="">Select an edge…</option>
        {graph.edges.map((edge) => (
          <option key={edge.id} value={edge.id}>
            {`${edge.id}: ${nameOf(graph, edge.source)} ${arrow} ${nameOf(graph, edge.target)}`}
            {graph.weighted ? ` (w=${edge.weight})` : ''}
          </option>
        ))}
      </select>
      {graph.weighted && (
        <div className="row">
          <input
            type="number"
            aria-label="Edge weight"
            value={weightDraft}
            disabled={!selectedEdge}
            onChange={(e) => setWeightDraft(e.target.value)}
          />
          <button
            disabled={!selectedEdge}
            onClick={() => selectedEdge && setEdgeWeight(selectedEdge.id, weightDraft.trim() === '' ? NaN : Number(weightDraft))}
          >
            Set weight
          </button>
        </div>
      )}
      <button
        disabled={!selectedEdge}
        onClick={() => {
          if (!selectedEdge) return
          removeEdgeById(selectedEdge.id)
          setEdgeId('')
        }}
      >
        Delete edge
      </button>
    </section>
  )
}
