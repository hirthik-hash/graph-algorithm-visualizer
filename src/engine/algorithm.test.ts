import { describe, expect, it } from 'vitest'
import { addEdge, addNode, createGraph } from '../model/graph'
import type { Graph } from '../model/graph'
import { checkRequirements } from './algorithm'
import type { Algorithm } from './algorithm'

function graphWith(options: { directed?: boolean; weighted?: boolean }, weight?: number): Graph {
  let g = createGraph(options)
  g = addNode(addNode(g, { id: 'A' }), { id: 'B' })
  return addEdge(g, {
    id: 'e1',
    source: 'A',
    target: 'B',
    ...(options.weighted ? { weight: weight ?? 1 } : {}),
  })
}

describe('checkRequirements', () => {
  it('returns no problems when there are no requirements', () => {
    expect(checkRequirements({ requirements: {} }, graphWith({}))).toEqual([])
  })

  it('returns no problems when every requirement is met', () => {
    const dijkstraLike = { requirements: { weighted: true, nonNegativeWeights: true, startNode: true } }
    expect(checkRequirements(dijkstraLike, graphWith({ weighted: true }), { startNodeId: 'A' })).toEqual([])
  })

  it('rejects a directed graph for undirected-only algorithms, and vice versa', () => {
    expect(checkRequirements({ requirements: { graphType: 'undirected' } }, graphWith({ directed: true }))).toEqual([
      'Requires an undirected graph.',
    ])
    expect(checkRequirements({ requirements: { graphType: 'directed' } }, graphWith({}))).toEqual([
      'Requires a directed graph.',
    ])
  })

  it('requires a weighted graph when asked', () => {
    expect(checkRequirements({ requirements: { weighted: true } }, graphWith({}))).toEqual([
      'Requires a weighted graph.',
    ])
  })

  it('rejects negative weights only when the graph is actually weighted', () => {
    const req = { requirements: { nonNegativeWeights: true } }
    expect(checkRequirements(req, graphWith({ weighted: true }, -2))).toEqual([
      'Requires non-negative edge weights (edge e1 has weight -2).',
    ])
    // Stored weights are ignored while the graph is unweighted, so they can't cause a failure.
    const hidden = { ...graphWith({ weighted: true }, -2), weighted: false }
    expect(checkRequirements(req, hidden)).toEqual([])
  })

  it('distinguishes a missing start/goal node from one that is not in the graph', () => {
    const req = { requirements: { startNode: true, goalNode: true } }
    expect(checkRequirements(req, graphWith({}))).toEqual(['Requires a start node.', 'Requires a goal node.'])
    expect(checkRequirements(req, graphWith({}), { startNodeId: 'Z', goalNodeId: 'B' })).toEqual([
      'Start node "Z" is not in the graph.',
    ])
  })

  it('reports every problem at once', () => {
    const problems = checkRequirements(
      { requirements: { graphType: 'undirected', weighted: true, startNode: true } },
      graphWith({ directed: true }),
    )
    expect(problems).toEqual([
      'Requires an undirected graph.',
      'Requires a weighted graph.',
      'Requires a start node.',
    ])
  })

  it('accepts a full Algorithm object (structural typing)', () => {
    const algo: Algorithm = {
      id: 'noop',
      name: 'No-op',
      category: 'traversal',
      requirements: { startNode: true },
      run: () => [{ type: 'finish', result: {} }],
    }
    expect(checkRequirements(algo, graphWith({}), { startNodeId: 'A' })).toEqual([])
    expect(algo.run(graphWith({}))).toEqual([{ type: 'finish', result: {} }])
  })
})
