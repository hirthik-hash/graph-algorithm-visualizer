/**
 * Trace report (Day 17): turns a completed algorithm run into a plain data
 * structure — a title plus one description per step — ready to hand to a
 * printable view. This file is pure and has no DOM dependency, so the report
 * CONTENT is unit-testable even though "export it as a PDF" (done by the UI
 * layer via the browser's own print-to-PDF) is not.
 *
 * Each step's description reuses explainEvent (Day 7), so the report and the
 * on-screen event log always say the same thing about the same event.
 */
import { explainEvent } from './explain'
import type { AlgorithmEvent } from './events'
import type { Graph } from '../model/graph'

export interface TraceReportStep {
  index: number
  description: string
}

export interface TraceReport {
  title: string
  nodeCount: number
  edgeCount: number
  stepCount: number
  steps: TraceReportStep[]
}

export function buildTraceReport(algorithmName: string, graph: Graph, events: readonly AlgorithmEvent[]): TraceReport {
  const labelOf = (id: string) => graph.nodes.find((n) => n.id === id)?.label ?? id
  return {
    title: `${algorithmName} — step-by-step trace`,
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    stepCount: events.length,
    steps: events.map((event, i) => ({ index: i + 1, description: explainEvent(event, labelOf) })),
  }
}
