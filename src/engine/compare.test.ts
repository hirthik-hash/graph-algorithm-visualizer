import { describe, expect, it } from 'vitest'
import { addEdge, addNode, createGraph } from '../model/graph'
import type { Graph } from '../model/graph'
import { bfsAlgorithm } from '../algorithms/bfs'
import { dijkstraAlgorithm } from '../algorithms/dijkstra'
import { kruskalAlgorithm } from '../algorithms/kruskal'
import { primAlgorithm } from '../algorithms/prim'
import type { Algorithm } from './algorithm'
import { BIG_O, algorithmProblems, compareAlgorithms, explainDifference } from './compare'

function triangle(): Graph {
  let g = createGraph({ weighted: true })
  g = addNode(addNode(addNode(g, { id: 'A' }), { id: 'B' }), { id: 'C' })
  g = addEdge(g, { id: 'e1', source: 'A', target: 'B', weight: 1 })
  g = addEdge(g, { id: 'e2', source: 'B', target: 'C', weight: 2 })
  g = addEdge(g, { id: 'e3', source: 'A', target: 'C', weight: 5 })
  return g
}

describe('compareAlgorithms', () => {
  it('includes a row for every algorithm passed in, even ones that cannot run', () => {
    const rows = compareAlgorithms(triangle(), [bfsAlgorithm, kruskalAlgorithm])
    expect(rows).toHaveLength(2)
    const bfsRow = rows.find((r) => r.algorithmId === 'bfs')!
    expect(bfsRow.ran).toBe(true)
    expect(bfsRow.steps).toBeGreaterThan(0)
    expect(bfsRow.problems).toEqual([])
    // Kruskal's runs fine on an undirected graph, so it's a real "ran: true" row here.
    expect(rows.find((r) => r.algorithmId === 'kruskal')!.ran).toBe(true)
  })

  it('reports unmet requirements as a visible row, not an omission', () => {
    const directedOnly: Algorithm = { ...primAlgorithm, id: 'prim-directed-test', requirements: { graphType: 'directed' } }
    const rows = compareAlgorithms(triangle(), [directedOnly])
    expect(rows[0]).toMatchObject({ ran: false, steps: null, nodesVisited: null, edgesExamined: null })
    expect(rows[0].problems).toEqual(['Requires a directed graph.'])
  })

  it('turns a thrown error into a visible row instead of crashing the whole comparison', () => {
    const broken: Algorithm = {
      id: 'broken',
      name: 'Broken',
      category: 'traversal',
      requirements: {},
      run: () => {
        throw new Error('kaboom')
      },
    }
    const rows = compareAlgorithms(triangle(), [bfsAlgorithm, broken])
    expect(rows[0].ran).toBe(true)
    expect(rows[1]).toMatchObject({ ran: false, steps: null })
    expect(rows[1].problems[0]).toMatch(/kaboom/)
  })

  it('counts visit_node and relax_edge events correctly', () => {
    const [row] = compareAlgorithms(triangle(), [dijkstraAlgorithm], { startNodeId: 'A' })
    expect(row.nodesVisited).toBe(3)
    expect(row.edgesExamined).toBeGreaterThanOrEqual(3) // each edge examined at least once
    expect(row.steps).toBe(dijkstraAlgorithm.run(triangle(), { startNodeId: 'A' }).length)
  })

  it('looks up Big-O from the static table and falls back to a placeholder for an unknown id', () => {
    const [known] = compareAlgorithms(triangle(), [bfsAlgorithm])
    expect(known.timeComplexity).toBe(BIG_O.bfs.time)
    const mystery: Algorithm = { id: 'mystery-algo', name: 'Mystery', category: 'traversal', requirements: {}, run: () => [{ type: 'finish', result: {} }] }
    const [unknown] = compareAlgorithms(triangle(), [mystery])
    expect(unknown.timeComplexity).toBe('—')
  })

  it('defaults start to the first node and goal to the last, matching the playback bar', () => {
    const [row] = compareAlgorithms(triangle(), [dijkstraAlgorithm]) // no options passed
    expect(row.ran).toBe(true) // it must have picked A as the start on its own
  })
})

describe('explainDifference', () => {
  const g = triangle()
  const rowFor = (a: Algorithm) => compareAlgorithms(g, [a], { startNodeId: 'A' })[0]

  it('is purely generic: no per-pair hardcoded text, just numbers read off the rows', () => {
    const bfsRow = rowFor(bfsAlgorithm)
    const dijkstraRow = rowFor(dijkstraAlgorithm)
    const text = explainDifference(bfsRow, dijkstraRow)
    expect(text).toMatch(new RegExp(`${bfsRow.steps} step`))
    expect(text).toMatch(new RegExp(`${dijkstraRow.steps}`))
    expect(text).toContain('rough proxy')
  })

  it('handles equal step counts, a row that did not run, and comparing an algorithm with itself', () => {
    const bfsRow = rowFor(bfsAlgorithm)
    const twin = { ...bfsRow, algorithmId: 'bfs-twin' } // same step count, different id
    expect(explainDifference(bfsRow, twin)).toBe(`${bfsRow.name} and ${twin.name} both took ${bfsRow.steps} steps.`)
    expect(explainDifference(bfsRow, bfsRow)).toBe('Pick two different algorithms to compare.')
    const notRun = compareAlgorithms(g, [{ ...primAlgorithm, id: 'x', requirements: { graphType: 'directed' } }])[0]
    expect(explainDifference(bfsRow, notRun)).toMatch(/did not run/)
  })
})

describe('algorithmProblems', () => {
  it('returns no problems when the algorithm can run with realistic default start/goal', () => {
    expect(algorithmProblems(triangle(), dijkstraAlgorithm)).toEqual([])
  })

  it('returns the same problems checkRequirements would report for the default options', () => {
    const directedOnly = { ...primAlgorithm, requirements: { graphType: 'directed' as const } }
    expect(algorithmProblems(triangle(), directedOnly)).toEqual(['Requires a directed graph.'])
  })

  it('reports every algorithm as unusable on an empty graph that needs a start node', () => {
    expect(algorithmProblems(createGraph(), bfsAlgorithm)).toEqual(['Requires a start node.'])
  })
})
