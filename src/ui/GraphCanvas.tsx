/**
 * Raw SVG canvas (Day 2; inline weight editing added Day 20).
 *
 * It renders graph.nodes / graph.edges straight from the store: there is no
 * second graph representation. Gestures:
 *   - click empty space ........ add a node
 *   - drag a node .............. move it
 *   - click node, then another . connect them (click the same node again to cancel)
 *   - click a node twice fast .. delete it
 *   - click a weight label ..... edit that edge's weight in place
 *
 * Everything is built on pointer events (not click/dblclick) because we use
 * pointer capture for dragging, and browsers retarget click events to the
 * capturing element, which would make click-based gestures unreliable.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { computeHighlights } from '../engine/highlights'
import { useGraphStore } from './graphStore'
import { usePlaybackStore } from './playbackStore'
import type { GraphEdge, GraphNode } from '../model/graph'

const WIDTH = 800
const HEIGHT = 500
const RADIUS = 20
const DRAG_THRESHOLD_PX = 4 // below this, a press is a "tap", not a drag
const DOUBLE_TAP_MS = 350

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

interface DragState {
  id: string
  startClientX: number
  startClientY: number
  moved: boolean
}

/**
 * A weight label that becomes an inline editor on click/Enter, for the edge
 * whose id matches `editingEdgeId`. Kept as one component so the normal-edge
 * and self-loop branches below share the exact same edit behavior.
 *
 * Commit rule (the "least surprising" choice, documented here since the spec
 * for this feature left it open): Enter commits, Escape cancels and restores
 * the old value, and clicking/tabbing away COMMITS if the typed value is a
 * valid number, or silently reverts if it isn't. An invalid value therefore
 * never reaches the graph — commitOrCancel falls back to canceling rather
 * than ever calling setEdgeWeight with something invalid.
 */
function WeightLabel({
  edge,
  x,
  y,
  isEditing,
  onStartEditing,
  onCommit,
  onCancel,
}: {
  edge: GraphEdge
  x: number
  y: number
  isEditing: boolean
  onStartEditing: () => void
  onCommit: (value: string) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(String(edge.weight ?? ''))

  useEffect(() => {
    if (isEditing) setDraft(String(edge.weight ?? ''))
  }, [isEditing, edge.weight])

  if (isEditing) {
    return (
      <foreignObject x={x - 28} y={y - 12} width={56} height={24} className="weight-editor-host">
        <input
          type="number"
          className="weight-editor"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => onCommit(draft)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onCommit(draft)
            } else if (e.key === 'Escape') {
              e.preventDefault()
              onCancel()
            }
            e.stopPropagation() // don't let arrow keys reach the playback shortcuts while typing
          }}
          aria-label={`Weight of edge ${edge.id}`}
        />
      </foreignObject>
    )
  }

  const openEditor = (e: { stopPropagation: () => void }) => {
    e.stopPropagation() // don't let this reach the SVG background (which would add a node)
    onStartEditing()
  }

  return (
    <g
      className="weight-hit"
      tabIndex={0}
      role="button"
      aria-label={`Edit weight of edge ${edge.id}, currently ${edge.weight}`}
      onPointerDown={openEditor}
      onClick={openEditor}
      onKeyDown={(e: ReactKeyboardEvent<SVGGElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onStartEditing()
        }
      }}
    >
      <rect x={x - 16} y={y - 10} width={32} height={20} className="weight-hit-area" />
      <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="edge-label">
        {edge.weight}
      </text>
    </g>
  )
}

function edgeGeometry(edge: GraphEdge, from: GraphNode, to: GraphNode) {
  const x1 = from.x ?? 0
  const y1 = from.y ?? 0
  const x2 = to.x ?? 0
  const y2 = to.y ?? 0
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  return {
    // Trim the line to the circle boundary so arrowheads touch the node edge.
    startX: x1 + ux * RADIUS,
    startY: y1 + uy * RADIUS,
    endX: x2 - ux * RADIUS,
    endY: y2 - uy * RADIUS,
    // Weight label sits at the midpoint, nudged perpendicular to the line.
    labelX: (x1 + x2) / 2 - uy * 12,
    labelY: (y1 + y2) / 2 + ux * 12,
    key: edge.id,
  }
}

export default function GraphCanvas() {
  const graph = useGraphStore((s) => s.graph)
  const connectFromId = useGraphStore((s) => s.connectFromId)
  const addNodeAt = useGraphStore((s) => s.addNodeAt)
  const moveNode = useGraphStore((s) => s.moveNode)
  const clickNode = useGraphStore((s) => s.clickNode)
  const removeNodeById = useGraphStore((s) => s.removeNodeById)
  const setEdgeWeight = useGraphStore((s) => s.setEdgeWeight)
  const recordHistory = useGraphStore((s) => s.recordHistory)
  const newEdgeWeight = useGraphStore((s) => s.newEdgeWeight)

  // Which edge's weight label is currently an inline editor, if any. This is
  // transient UI state, not graph data, so it lives here rather than in the
  // graph store (the same pattern as `drag`/`lastTap` below).
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null)

  // If the edge being edited is deleted out from under the editor (e.g. its
  // node was removed), drop out of edit mode rather than pointing at nothing.
  useEffect(() => {
    if (editingEdgeId !== null && !graph.edges.some((e) => e.id === editingEdgeId)) {
      setEditingEdgeId(null)
    }
  }, [graph.edges, editingEdgeId])

  const commitWeightEdit = (edgeId: string, raw: string) => {
    const value = Number(raw)
    if (raw.trim() !== '' && Number.isFinite(value)) {
      setEdgeWeight(edgeId, value)
    }
    // An invalid or empty value is silently discarded — the edge keeps its
    // previous weight, and nothing invalid ever reaches the graph.
    setEditingEdgeId(null)
  }

  // Highlighting is derived from the loaded algorithm run (if any); the canvas
  // never needs to know which algorithm produced the events.
  const engine = usePlaybackStore((s) => s.engine)
  const highlights = useMemo(() => computeHighlights(engine?.eventsSoFar ?? []), [engine])
  const edgeClass = (edgeId: string) => {
    if (highlights.mstEdges.has(edgeId)) return 'edge edge--mst'
    if (highlights.rejectedEdges.has(edgeId)) return 'edge edge--rejected'
    if (highlights.bridgeEdges.has(edgeId)) return 'edge edge--bridge'
    return edgeId === highlights.examinedEdgeId ? 'edge edge--examined' : 'edge'
  }
  const nodeClass = (nodeId: string) => {
    const classes = ['node']
    if (nodeId === connectFromId) classes.push('node--source')
    if (nodeId === highlights.waypoint) classes.push('node--waypoint')
    if (highlights.articulationPoints.has(nodeId)) classes.push('node--articulation')
    if (highlights.sccMembers.has(nodeId)) classes.push('node--scc')
    if (nodeId === highlights.active) classes.push('node--active')
    else if (highlights.visited.has(nodeId)) classes.push('node--visited')
    else if (highlights.frontier.has(nodeId)) classes.push('node--frontier')
    return classes.join(' ')
  }

  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<DragState | null>(null)
  const lastTap = useRef<{ id: string; time: number } | null>(null)
  const lastAdd = useRef<{ time: number; x: number; y: number } | null>(null)

  function toSvgPoint(clientX: number, clientY: number) {
    const ctm = svgRef.current?.getScreenCTM()
    if (!ctm) return { x: 0, y: 0 }
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse())
    return { x: p.x, y: p.y }
  }

  function onBackgroundPointerDown(e: ReactPointerEvent<SVGSVGElement>) {
    // Only the bare background adds nodes; edges/nodes/labels are other targets.
    if (e.target !== e.currentTarget || e.button !== 0) return
    const p = toSvgPoint(e.clientX, e.clientY)
    const now = Date.now()
    const prev = lastAdd.current
    // A double-click on empty space would otherwise drop two nodes on top of each other.
    if (prev && now - prev.time < DOUBLE_TAP_MS && Math.hypot(p.x - prev.x, p.y - prev.y) < 15) return
    lastAdd.current = { time: now, x: p.x, y: p.y }
    addNodeAt(clamp(p.x, RADIUS, WIDTH - RADIUS), clamp(p.y, RADIUS, HEIGHT - RADIUS))
  }

  function onNodePointerDown(e: ReactPointerEvent<SVGGElement>, id: string) {
    if (e.button !== 0) return
    e.stopPropagation() // don't let the background handler add a node
    svgRef.current?.setPointerCapture(e.pointerId)
    drag.current = { id, startClientX: e.clientX, startClientY: e.clientY, moved: false }
  }

  function onPointerMove(e: ReactPointerEvent<SVGSVGElement>) {
    const d = drag.current
    if (!d) return
    if (!d.moved) {
      const dist = Math.hypot(e.clientX - d.startClientX, e.clientY - d.startClientY)
      if (dist < DRAG_THRESHOLD_PX) return
      d.moved = true
      // A drag is now confirmed (not just a tap). Record ONE history entry
      // for the whole gesture, before the first actual move — every
      // following moveNode call in this same drag stays history-free.
      recordHistory()
    }
    const p = toSvgPoint(e.clientX, e.clientY)
    moveNode(d.id, clamp(p.x, RADIUS, WIDTH - RADIUS), clamp(p.y, RADIUS, HEIGHT - RADIUS))
  }

  function onPointerUp(e: ReactPointerEvent<SVGSVGElement>) {
    const d = drag.current
    if (!d) return
    drag.current = null
    svgRef.current?.releasePointerCapture(e.pointerId)
    if (d.moved) return

    // It was a tap. Two taps on the same node in quick succession = delete.
    const now = Date.now()
    const prev = lastTap.current
    if (prev && prev.id === d.id && now - prev.time < DOUBLE_TAP_MS) {
      lastTap.current = null
      removeNodeById(d.id)
      return
    }
    lastTap.current = { id: d.id, time: now }
    clickNode(d.id)
  }

  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]))

  return (
    <svg
      ref={svgRef}
      id="graph-canvas-svg"
      className="canvas"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label="Graph canvas"
      onPointerDown={onBackgroundPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        drag.current = null
      }}
    >
      <defs>
        <marker
          id="arrowhead"
          viewBox="0 0 10 10"
          refX="10"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto"
        >
          <path d="M0,0 L10,5 L0,10 z" className="arrowhead" />
        </marker>
      </defs>

      {graph.edges.map((edge) => {
        const from = nodeById.get(edge.source)
        const to = nodeById.get(edge.target)
        if (!from || !to) return null // can't happen via the model; belt and braces

        if (edge.source === edge.target) {
          // Self-loop (only reachable via import/generator later): small arc above the node.
          const x = from.x ?? 0
          const y = from.y ?? 0
          const d = `M ${x - 8} ${y - RADIUS} C ${x - 34} ${y - RADIUS - 44}, ${x + 34} ${y - RADIUS - 44}, ${x + 8} ${y - RADIUS}`
          return (
            <g key={edge.id}>
              <path d={d} className={edgeClass(edge.id)} fill="none" markerEnd={graph.directed ? 'url(#arrowhead)' : undefined} />
              {graph.weighted && (
                <WeightLabel
                  edge={edge}
                  x={x}
                  y={y - RADIUS - 38}
                  isEditing={editingEdgeId === edge.id}
                  onStartEditing={() => setEditingEdgeId(edge.id)}
                  onCommit={(value) => commitWeightEdit(edge.id, value)}
                  onCancel={() => setEditingEdgeId(null)}
                />
              )}
            </g>
          )
        }

        const g = edgeGeometry(edge, from, to)
        return (
          <g key={g.key}>
            <line
              x1={g.startX}
              y1={g.startY}
              x2={g.endX}
              y2={g.endY}
              className={edgeClass(edge.id)}
              markerEnd={graph.directed ? 'url(#arrowhead)' : undefined}
            />
            {graph.weighted && (
              <WeightLabel
                edge={edge}
                x={g.labelX}
                y={g.labelY}
                isEditing={editingEdgeId === edge.id}
                onStartEditing={() => setEditingEdgeId(edge.id)}
                onCommit={(value) => commitWeightEdit(edge.id, value)}
                onCancel={() => setEditingEdgeId(null)}
              />
            )}
          </g>
        )
      })}

      {graph.nodes.map((node) => (
        <g
          key={node.id}
          className={nodeClass(node.id)}
          onPointerDown={(e) => onNodePointerDown(e, node.id)}
        >
          <circle cx={node.x ?? 0} cy={node.y ?? 0} r={RADIUS} />
          <text x={node.x ?? 0} y={node.y ?? 0} textAnchor="middle" dominantBaseline="central">
            {node.label ?? node.id}
          </text>
          {highlights.distances.has(node.id) && (
            <text x={node.x ?? 0} y={(node.y ?? 0) + RADIUS + 15} textAnchor="middle" className="node-distance">
              {`d=${highlights.distances.get(node.id)}`}
            </text>
          )}
        </g>
      ))}

      {/* Milestone 2: makes the weight the NEXT click-created edge will use
          visible right where you're about to click, instead of only in the
          side panel — the field itself was never wrong, it was just easy to
          lose track of while focused on the canvas. */}
      {graph.weighted && connectFromId !== null && nodeById.has(connectFromId) && (
        <g className="pending-weight-badge">
          {(() => {
            const source = nodeById.get(connectFromId)!
            const x = source.x ?? 0
            const y = (source.y ?? 0) - RADIUS - 16
            return (
              <>
                <rect x={x - 36} y={y - 10} width={72} height={20} rx={10} />
                <text x={x} y={y} textAnchor="middle" dominantBaseline="middle">
                  {`weight: ${newEdgeWeight}`}
                </text>
              </>
            )
          })()}
        </g>
      )}
    </svg>
  )
}
