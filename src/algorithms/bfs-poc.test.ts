import { describe, expect, it } from 'vitest'
import { addEdge, addNode, createGraph } from '../model/graph'
import { bfsOrder } from './bfs-poc'

function build(directed: boolean) {
  let g = createGraph({ directed })
  for (const id of ['A', 'B', 'C', 'D', 'E']) g = addNode(g, { id })
  g = addEdge(g, { id: 'e1', source: 'A', target: 'B' })
  g = addEdge(g, { id: 'e2', source: 'A', target: 'C' })
  g = addEdge(g, { id: 'e3', source: 'B', target: 'D' })
  // E is deliberately isolated
  return g
}

describe('bfs proof-of-life', () => {
  it('visits nodes level by level and skips unreachable ones', () => {
    expect(bfsOrder(build(false), 'A')).toEqual(['A', 'B', 'C', 'D'])
  })

  it('respects edge direction in directed graphs', () => {
    // From D in a directed graph there is nowhere to go; undirected reaches all but E.
    expect(bfsOrder(build(true), 'D')).toEqual(['D'])
    expect(bfsOrder(build(false), 'D')).toEqual(['D', 'B', 'A', 'C'])
  })
})
