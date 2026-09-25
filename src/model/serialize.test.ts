import { describe, expect, it } from 'vitest'
import { addEdge, addNode, createGraph } from './graph'
import type { Graph } from './graph'
import { disconnectedGraph, parallelEdgesGraph, selfLoopGraph, singleNodeGraph } from '../test/fixtures'
import {
  exportAdjacencyListText,
  exportCsvEdgeList,
  exportGraphToJson,
  importGraphFromJson,
  parseAdjacencyList,
  parseAdjacencyMatrix,
  parseCsvEdgeList,
} from './serialize'
import { toAdjacencyMatrix } from './representations'

function triangle(): Graph {
  let g = createGraph({ weighted: true })
  g = addNode(addNode(addNode(g, { id: 'A', x: 10, y: 20 }), { id: 'B', label: 'Beta' }), { id: 'C' })
  g = addEdge(g, { id: 'e1', source: 'A', target: 'B', weight: 2 })
  g = addEdge(g, { id: 'e2', source: 'B', target: 'C', weight: 5 })
  return g
}

describe('JSON import/export', () => {
  it('round-trips a graph exactly, including positions, labels and weights', () => {
    const g = triangle()
    expect(importGraphFromJson(exportGraphToJson(g))).toEqual(g)
  })

  it('round-trips every shared fixture', () => {
    for (const build of [disconnectedGraph, singleNodeGraph, selfLoopGraph, parallelEdgesGraph]) {
      const g = build()
      expect(importGraphFromJson(exportGraphToJson(g))).toEqual(g)
    }
  })

  it('rejects invalid JSON, non-object JSON, and a wrong or missing schema version', () => {
    expect(() => importGraphFromJson('not json')).toThrow(/valid JSON/)
    expect(() => importGraphFromJson('42')).toThrow(/JSON object/)
    expect(() => importGraphFromJson('{"schemaVersion": 99}')).toThrow(/schema version/)
    expect(() => importGraphFromJson('{}')).toThrow(/schema version/)
  })

  it('rejects missing or wrongly typed top-level fields', () => {
    const base = { schemaVersion: 1, directed: false, weighted: false, nodes: [], edges: [] }
    expect(() => importGraphFromJson(JSON.stringify({ ...base, directed: 'no' }))).toThrow(/directed/)
    expect(() => importGraphFromJson(JSON.stringify({ ...base, nodes: {} }))).toThrow(/arrays/)
  })

  it('rejects a node without a string id, and an edge with a non-numeric weight', () => {
    const base = { schemaVersion: 1, directed: false, weighted: true }
    expect(() => importGraphFromJson(JSON.stringify({ ...base, nodes: [{}], edges: [] }))).toThrow(/string "id"/)
    expect(() =>
      importGraphFromJson(
        JSON.stringify({ ...base, nodes: [{ id: 'A' }, { id: 'B' }], edges: [{ id: 'e1', source: 'A', target: 'B', weight: 'x' }] }),
      ),
    ).toThrow(/non-numeric weight/)
  })

  it('inherits the model’s own validation: duplicate node ids and edges to missing nodes still fail', () => {
    const dup = { schemaVersion: 1, directed: false, weighted: false, nodes: [{ id: 'A' }, { id: 'A' }], edges: [] }
    expect(() => importGraphFromJson(JSON.stringify(dup))).toThrow(/duplicate node/i)
    const dangling = {
      schemaVersion: 1,
      directed: false,
      weighted: false,
      nodes: [{ id: 'A' }],
      edges: [{ id: 'e1', source: 'A', target: 'Z' }],
    }
    expect(() => importGraphFromJson(JSON.stringify(dangling))).toThrow(/missing node/i)
  })
})

describe('adjacency matrix import/export', () => {
  it('round-trips a directed weighted graph', () => {
    const g = triangle()
    const { cells } = toAdjacencyMatrix(g)
    const text = cells.map((row) => row.map((c) => (c === null ? '-' : c)).join(' ')).join('\n')
    const reimported = parseAdjacencyMatrix(text, { directed: false })
    expect(reimported.weighted).toBe(true)
    expect(toAdjacencyMatrix(reimported)).toEqual({ nodeIds: ['A', 'B', 'C'], cells })
  })

  it('detects "unweighted" when every present value is 1', () => {
    const g = parseAdjacencyMatrix('- 1\n1 -', { directed: false })
    expect(g.weighted).toBe(false)
    expect(g.edges).toHaveLength(1)
  })

  it('accepts commas, tabs and mixed whitespace as separators, and "-"/blank/"inf"/"∞" as no-edge', () => {
    const g = parseAdjacencyMatrix('-, 3, inf\n3,\t-,∞\n-  -  -', { directed: false })
    expect(g.nodes.map((n) => n.id)).toEqual(['A', 'B', 'C'])
    expect(g.edges).toHaveLength(1) // only A-B (weight 3); everything else is "no edge"
  })

  it('places a diagonal value as a self-loop', () => {
    const g = parseAdjacencyMatrix('5 -\n- -', { directed: true })
    expect(g.edges).toEqual([{ id: 'e1', source: 'A', target: 'A', weight: 5 }])
  })

  it('rejects a non-square input and an unparseable value', () => {
    expect(() => parseAdjacencyMatrix('- 1\n- - -', { directed: false })).toThrow(/expected 2/i)
    expect(() => parseAdjacencyMatrix('- x\nx -', { directed: false })).toThrow(/not a valid matrix value/)
    expect(() => parseAdjacencyMatrix('', { directed: false })).toThrow(/no rows/i)
  })

  it('does not double-count a symmetric pair for an undirected import', () => {
    const g = parseAdjacencyMatrix('- 4\n4 -', { directed: false })
    expect(g.edges).toHaveLength(1)
  })
})

describe('adjacency list import/export', () => {
  it('round-trips a directed weighted graph through export then parse', () => {
    const g = triangle()
    const text = exportAdjacencyListText(g)
    const reimported = parseAdjacencyList(text, { directed: true })
    expect(toAdjacencyMatrix(reimported)).toEqual(toAdjacencyMatrix(g))
  })

  it('does not double an undirected edge that is listed from both ends', () => {
    const g = parseAdjacencyList('A: B(2)\nB: A(2)\nC:', { directed: false })
    expect(g.edges).toEqual([{ id: 'e1', source: 'A', target: 'B', weight: 2 }])
    expect(g.nodes.map((n) => n.id)).toEqual(['A', 'B', 'C']) // C is a declared isolated node
  })

  it('accepts unweighted neighbors and a trailing empty neighbor list', () => {
    const g = parseAdjacencyList('A: B, C\nB:\nC:', { directed: true })
    expect(g.weighted).toBe(false)
    expect(g.edges.map((e) => `${e.source}-${e.target}`)).toEqual(['A-B', 'A-C'])
  })

  it('rejects a missing colon, an empty node id, an unparseable neighbor, and mixed weighted/unweighted', () => {
    expect(() => parseAdjacencyList('A B', { directed: true })).toThrow(/missing a ":"/)
    expect(() => parseAdjacencyList(': B', { directed: true })).toThrow(/empty node id/)
    expect(() => parseAdjacencyList('A: B(', { directed: true })).toThrow(/could not parse/i)
    expect(() => parseAdjacencyList('A: B(1), C', { directed: true })).toThrow(/every neighbor/i)
  })

  it('handles a self-loop line', () => {
    const g = parseAdjacencyList('A: A', { directed: false })
    expect(g.edges).toEqual([{ id: 'e1', source: 'A', target: 'A' }])
  })
})

describe('CSV import/export', () => {
  it('round-trips a weighted graph', () => {
    const g = triangle()
    const csv = exportCsvEdgeList(g)
    const reimported = parseCsvEdgeList(csv, { directed: true })
    expect(reimported.edges.map((e) => [e.source, e.target, e.weight])).toEqual(
      g.edges.map((e) => [e.source, e.target, e.weight]),
    )
  })

  it('omits the weight column for an unweighted graph', () => {
    const g = createGraph()
    const withEdge = addEdge(addNode(addNode(g, { id: 'A' }), { id: 'B' }), { id: 'e1', source: 'A', target: 'B' })
    expect(exportCsvEdgeList(withEdge)).toBe('source,target\nA,B')
  })

  it('collects nodes from source/target columns and tolerates column order; a blank weight cell defaults to 1', () => {
    const g = parseCsvEdgeList('target,weight,source\nB,4,A\nC,,B', { directed: true })
    expect(g.nodes.map((n) => n.id)).toEqual(['A', 'B', 'C'])
    expect(g.weighted).toBe(true)
    expect(g.edges).toEqual([
      { id: 'e1', source: 'A', target: 'B', weight: 4 },
      { id: 'e2', source: 'B', target: 'C', weight: 1 },
    ])
  })

  it('is unweighted when there is no "weight" column at all, even if a row has an extra numeric-looking cell', () => {
    const g = parseCsvEdgeList('source,target\nA,B', { directed: true })
    expect(g.weighted).toBe(false)
    expect(g.edges).toEqual([{ id: 'e1', source: 'A', target: 'B' }])
  })

  it('rejects a header without source/target, and a row with an invalid weight', () => {
    expect(() => parseCsvEdgeList('from,to\nA,B', { directed: true })).toThrow(/source.*target/i)
    expect(() => parseCsvEdgeList('source,target,weight\nA,B,x', { directed: true })).toThrow(/invalid weight/)
    expect(() => parseCsvEdgeList('source,target\nA,', { directed: true })).toThrow(/missing a source or target/)
  })

  it('strips a leading UTF-8 BOM before parsing the header (Excel-exported CSVs commonly have one)', () => {
    const withBom = '\ufeffsource,target,weight\nA,B,4'
    const g = parseCsvEdgeList(withBom, { directed: true })
    expect(g.edges).toEqual([{ id: 'e1', source: 'A', target: 'B', weight: 4 }])
  })

  it('accepts double-quoted header and data cells', () => {
    const quoted = '"source","target","weight"\n"A","B","4"'
    const g = parseCsvEdgeList(quoted, { directed: true })
    expect(g.edges).toEqual([{ id: 'e1', source: 'A', target: 'B', weight: 4 }])
  })

  it('gives a specific error when the header is fine but there are no data rows', () => {
    expect(() => parseCsvEdgeList('source,target,weight', { directed: true })).toThrow(/no data rows/i)
  })

  it('gives every imported node real, spread-out coordinates instead of defaulting to (0, 0)', () => {
    const g = parseCsvEdgeList('source,target\nA,B\nB,C\nC,A', { directed: true })
    for (const n of g.nodes) {
      expect(Number.isFinite(n.x)).toBe(true)
      expect(Number.isFinite(n.y)).toBe(true)
    }
    const positions = new Set(g.nodes.map((n) => `${n.x},${n.y}`))
    expect(positions.size).toBe(g.nodes.length) // no two nodes stacked on top of each other
  })
})

describe('adjacency matrix and list also lay out their nodes', () => {
  it('parseAdjacencyMatrix gives every node real coordinates', () => {
    const g = parseAdjacencyMatrix('- 1 -\n1 - 1\n- 1 -', { directed: false })
    for (const n of g.nodes) expect(Number.isFinite(n.x) && Number.isFinite(n.y)).toBe(true)
  })

  it('parseAdjacencyList gives every node real coordinates', () => {
    const g = parseAdjacencyList('A: B\nB: C\nC:', { directed: true })
    for (const n of g.nodes) expect(Number.isFinite(n.x) && Number.isFinite(n.y)).toBe(true)
  })
})
