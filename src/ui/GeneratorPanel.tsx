/**
 * Random graph generator panel (Day 12). Purely a front end over
 * model/generator.ts: it builds GeneratorOptions from the controls and hands
 * the result to the store's replaceGraph.
 */
import { useState } from 'react'
import { GRAPH_SHAPES, MAX_GENERATED_NODES, generateGraph } from '../model/generator'
import type { GraphShape } from '../model/generator'
import { useGraphStore } from './graphStore'

const SHAPE_LABEL: Record<GraphShape, string> = {
  random: 'Random',
  sparse: 'Sparse (tree + a few extra edges)',
  dense: 'Dense',
  complete: 'Complete',
  bipartite: 'Bipartite',
  dag: 'DAG (always directed, acyclic)',
  tree: 'Tree',
}

const DEFAULT_NODE_COUNT = 12

/** Clamps to a valid node count; a blank or non-numeric field falls back to the default rather than 1, so blurring a cleared field doesn't silently snap to the smallest possible graph. */
function clampNodeCount(raw: string): number {
  const parsed = Math.floor(Number(raw))
  if (!Number.isFinite(parsed) || raw.trim() === '') return DEFAULT_NODE_COUNT
  return Math.max(1, Math.min(MAX_GENERATED_NODES, parsed))
}

export default function GeneratorPanel() {
  const replaceGraph = useGraphStore((s) => s.replaceGraph)
  const [shape, setShape] = useState<GraphShape>('random')
  // The text box holds whatever the person is CURRENTLY typing, including a
  // transient empty string or a partial number — it is only clamped into a
  // real node count on blur or when Generate is pressed. Clamping on every
  // keystroke (the Day 12 behavior) forced the field back to a minimum value
  // mid-edit, so clearing "1" and typing "8" produced "18": the field never
  // stayed empty long enough to receive a fresh digit.
  const [nodeCountText, setNodeCountText] = useState(String(DEFAULT_NODE_COUNT))
  const [directed, setDirected] = useState(false)
  const [weighted, setWeighted] = useState(false)

  const generate = () => {
    const nodeCount = clampNodeCount(nodeCountText)
    setNodeCountText(String(nodeCount))
    const seed = Math.floor(Math.random() * 2 ** 31)
    replaceGraph(generateGraph({ shape, nodeCount, directed, weighted, seed }))
  }

  return (
    <section className="panel generator">
      <h2>Random graph generator</h2>
      <div className="row">
        <select aria-label="Shape" value={shape} onChange={(e) => setShape(e.target.value as GraphShape)}>
          {GRAPH_SHAPES.map((s) => (
            <option key={s} value={s}>
              {SHAPE_LABEL[s]}
            </option>
          ))}
        </select>

        <label className="row">
          Nodes
          <input
            type="number"
            min={1}
            max={MAX_GENERATED_NODES}
            value={nodeCountText}
            onChange={(e) => setNodeCountText(e.target.value)}
            onBlur={() => setNodeCountText(String(clampNodeCount(nodeCountText)))}
          />
        </label>


        <label className="row">
          <input
            type="checkbox"
            checked={shape === 'dag' ? true : directed}
            disabled={shape === 'dag'}
            onChange={(e) => setDirected(e.target.checked)}
          />
          Directed
        </label>
        <label className="row">
          <input type="checkbox" checked={weighted} onChange={(e) => setWeighted(e.target.checked)} />
          Weighted
        </label>

        <button onClick={generate}>Generate</button>
      </div>
      <p className="hint">Generating replaces the current graph on the canvas.</p>
    </section>
  )
}
