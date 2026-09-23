import { describe, expect, it } from 'vitest'
import { bfsAlgorithm } from '../algorithms/bfs'
import { addEdge, addNode, createGraph } from '../model/graph'
import { explainEvent } from './explain'
import { buildTraceReport } from './traceReport'

function graphWithLabel(): ReturnType<typeof createGraph> {
  let g = createGraph()
  g = addNode(addNode(g, { id: 'A', label: 'Start' }), { id: 'B' })
  return addEdge(g, { id: 'e1', source: 'A', target: 'B' })
}

describe('buildTraceReport', () => {
  it('has one step per event, in order, with a 1-based index', () => {
    const g = graphWithLabel()
    const events = bfsAlgorithm.run(g, { startNodeId: 'A' })
    const report = buildTraceReport('Breadth-First Search', g, events)
    expect(report.stepCount).toBe(events.length)
    expect(report.steps).toHaveLength(events.length)
    expect(report.steps.map((s) => s.index)).toEqual(events.map((_, i) => i + 1))
  })

  it('each description matches explainEvent using the graph’s own labels', () => {
    const g = graphWithLabel()
    const events = bfsAlgorithm.run(g, { startNodeId: 'A' })
    const labelOf = (id: string) => g.nodes.find((n) => n.id === id)?.label ?? id
    const report = buildTraceReport('Breadth-First Search', g, events)
    report.steps.forEach((step, i) => {
      expect(step.description).toBe(explainEvent(events[i], labelOf))
    })
    expect(report.steps[0].description).toContain('Start') // the label, not the raw id "A"
  })

  it('includes the algorithm name in the title, and the graph’s node/edge counts', () => {
    const g = graphWithLabel()
    const report = buildTraceReport('Breadth-First Search', g, bfsAlgorithm.run(g, { startNodeId: 'A' }))
    expect(report.title).toBe('Breadth-First Search — step-by-step trace')
    expect(report.nodeCount).toBe(2)
    expect(report.edgeCount).toBe(1)
  })

  it('handles an empty event list', () => {
    const g = graphWithLabel()
    const report = buildTraceReport('Nothing', g, [])
    expect(report.stepCount).toBe(0)
    expect(report.steps).toEqual([])
  })
})
