/**
 * Toolbar + edit dropdowns (Day 2; Undo/Redo added Day 21).
 * Local state here is only UI drafts (which dropdown item is selected, text
 * being typed). The graph itself always lives in the store.
 */
import { useEffect, useState } from 'react'
import { isEditableTarget, resolveHistoryShortcut } from './keyboardShortcuts'
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
  const historyLength = useGraphStore((s) => s.history.length)
  const futureLength = useGraphStore((s) => s.future.length)
  const undo = useGraphStore((s) => s.undo)
  const redo = useGraphStore((s) => s.redo)

  // Ctrl+Z / Cmd+Z to undo, Ctrl+Y or Ctrl+Shift+Z (Cmd equivalents) to redo.
  // Ignored while typing in a form field, so native text-field undo still works there.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (isEditableTarget(target?.tagName, target?.isContentEditable)) return
      const shortcut = resolveHistoryShortcut(event.key, event.ctrlKey || event.metaKey, event.shiftKey)
      if (shortcut === null) return
      event.preventDefault()
      if (shortcut === 'undo') undo()
      else redo()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo])

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

      <div className="row">
        <button onClick={undo} disabled={historyLength === 0} aria-label="Undo">
          ↶ Undo
        </button>
        <button onClick={redo} disabled={futureLength === 0} aria-label="Redo">
          ↷ Redo
        </button>
      </div>
      <p className="hint">Ctrl+Z to undo · Ctrl+Y or Ctrl+Shift+Z to redo</p>

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
      {graph.weighted && (
        <p className="hint">Tip: you can also click a weight directly on the canvas to edit it in place.</p>
      )}
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
