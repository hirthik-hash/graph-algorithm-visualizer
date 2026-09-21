import { describe, expect, it } from 'vitest'
import {
  addEdge,
  addNode,
  createGraph,
  moveNode,
  removeNode,
  renameNode,
  setDirected,
  setEdgeWeight,
  setWeighted,
} from './graph'
import { structureSignature } from './signature'

function base() {
  let g = createGraph({ weighted: true })
  g = addNode(addNode(g, { id: 'A', x: 0, y: 0 }), { id: 'B', x: 10, y: 10 })
  return addEdge(g, { id: 'e1', source: 'A', target: 'B', weight: 2 })
}

describe('structureSignature', () => {
  it('ignores node positions and labels', () => {
    const g = base()
    const sig = structureSignature(g)
    expect(structureSignature(moveNode(g, 'A', 500, 500))).toBe(sig)
    expect(structureSignature(renameNode(g, 'A', 'Start'))).toBe(sig)
  })

  it('changes when the structure changes', () => {
    const g = base()
    const sig = structureSignature(g)
    expect(structureSignature(addNode(g, { id: 'C' }))).not.toBe(sig)
    expect(structureSignature(removeNode(g, 'B'))).not.toBe(sig)
    expect(structureSignature(addEdge(g, { id: 'e2', source: 'B', target: 'A', weight: 1 }))).not.toBe(sig)
    expect(structureSignature(setDirected(g, true))).not.toBe(sig)
    expect(structureSignature(setWeighted(g, false))).not.toBe(sig)
  })

  it('tracks weights only while the graph is weighted', () => {
    const weighted = base()
    expect(structureSignature(setEdgeWeight(weighted, 'e1', 9))).not.toBe(structureSignature(weighted))
    const off = setWeighted(weighted, false)
    // A hidden weight change on an unweighted graph can't affect any algorithm.
    expect(structureSignature(setEdgeWeight(off, 'e1', 9))).toBe(structureSignature(off))
  })

  it('includes node positions only when asked (for algorithms that use coordinates)', () => {
    const g = base()
    const moved = moveNode(g, 'A', 500, 500)
    expect(structureSignature(moved, { includeCoordinates: true })).not.toBe(
      structureSignature(g, { includeCoordinates: true }),
    )
    expect(structureSignature(moved)).toBe(structureSignature(g)) // default: still ignored
    // labels never matter, even with coordinates
    expect(structureSignature(renameNode(g, 'A', 'X'), { includeCoordinates: true })).toBe(
      structureSignature(g, { includeCoordinates: true }),
    )
  })
})
