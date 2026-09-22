/**
 * Import / export (Day 16, part 1 of the original Day 22 scope: JSON,
 * adjacency matrix, adjacency list and CSV. URL sharing and trace export
 * follow in the next part).
 *
 * Every parser below builds the result through the REAL model functions
 * (createGraph/addNode/addEdge), never by hand-assembling a Graph object.
 * That means every validation rule the model already enforces — duplicate
 * ids, edges to missing nodes, weights required on a weighted graph — is
 * inherited for free, and an imported graph can never be less valid than one
 * built by hand on the canvas.
 *
 * Every parser THROWS a descriptive Error on bad input rather than guessing;
 * the UI layer catches it and shows the message.
 */
import { addEdge, addNode, createGraph, SCHEMA_VERSION } from './graph'
import type { Graph } from './graph'
import { nodeIdForIndex } from './generator'
import { toAdjacencyList, toAdjacencyMatrix } from './representations'

// ---------------------------------------------------------------------------
// JSON
// ---------------------------------------------------------------------------

export function exportGraphToJson(graph: Graph): string {
  return JSON.stringify(graph, null, 2)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function importGraphFromJson(text: string): Graph {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('That is not valid JSON.')
  }
  if (!isRecord(parsed)) throw new Error('Expected a JSON object with schemaVersion, directed, weighted, nodes, edges.')

  if (parsed.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`Unsupported schema version: expected ${SCHEMA_VERSION}, got ${JSON.stringify(parsed.schemaVersion)}.`)
  }
  if (typeof parsed.directed !== 'boolean' || typeof parsed.weighted !== 'boolean') {
    throw new Error('"directed" and "weighted" must both be true or false.')
  }
  if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
    throw new Error('"nodes" and "edges" must both be arrays.')
  }

  let graph = createGraph({ directed: parsed.directed, weighted: parsed.weighted })

  for (const raw of parsed.nodes) {
    if (!isRecord(raw) || typeof raw.id !== 'string') throw new Error('Every node needs a string "id".')
    graph = addNode(graph, {
      id: raw.id,
      ...(typeof raw.label === 'string' ? { label: raw.label } : {}),
      ...(typeof raw.x === 'number' ? { x: raw.x } : {}),
      ...(typeof raw.y === 'number' ? { y: raw.y } : {}),
    })
  }

  for (const raw of parsed.edges) {
    if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.source !== 'string' || typeof raw.target !== 'string') {
      throw new Error('Every edge needs string "id", "source" and "target".')
    }
    if (raw.weight !== undefined && typeof raw.weight !== 'number') {
      throw new Error(`Edge "${raw.id}" has a non-numeric weight.`)
    }
    graph = addEdge(graph, {
      id: raw.id,
      source: raw.source,
      target: raw.target,
      ...(typeof raw.weight === 'number' ? { weight: raw.weight } : {}),
    })
  }

  return graph
}

// ---------------------------------------------------------------------------
// Adjacency matrix (paste-in text; rows separated by newlines, values by
// commas or whitespace; "-" / empty / "inf" / "∞" mean "no edge")
// ---------------------------------------------------------------------------

export interface DirectedOption {
  directed: boolean
}

function parseMatrixCell(token: string): number | null {
  const t = token.trim()
  if (t === '' || t === '-' || t.toLowerCase() === 'inf' || t === '∞') return null
  const value = Number(t)
  if (!Number.isFinite(value)) throw new Error(`"${token}" is not a valid matrix value (use a number, or "-" for no edge).`)
  return value
}

export function exportAdjacencyMatrixText(graph: Graph): string {
  const { nodeIds, cells } = toAdjacencyMatrix(graph)
  return cells.map((row) => row.map((c) => (c === null ? '-' : c)).join('\t')).join('\n') || `(0 nodes: ${nodeIds.length})`
}

export function parseAdjacencyMatrix(text: string, options: DirectedOption): Graph {
  const rows = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  if (rows.length === 0) throw new Error('No rows found. Paste one row per line.')

  const cells = rows.map((row) => row.split(/[\s,]+/).filter((tok) => tok !== ''))
  const n = cells.length
  cells.forEach((row, i) => {
    if (row.length !== n) {
      throw new Error(`Row ${i + 1} has ${row.length} value(s); expected ${n} for a ${n}×${n} matrix.`)
    }
  })
  const values = cells.map((row) => row.map(parseMatrixCell))

  const weighted = values.some((row) => row.some((v) => v !== null && v !== 1))

  let graph = createGraph({ directed: options.directed, weighted })
  for (let i = 0; i < n; i++) graph = addNode(graph, { id: nodeIdForIndex(i) })

  let edgeCount = 0
  for (let i = 0; i < n; i++) {
    const jStart = options.directed ? 0 : i // undirected: diagonal + upper triangle only, to avoid double-adding a symmetric pair
    for (let j = jStart; j < n; j++) {
      const value = values[i][j]
      if (value === null) continue
      edgeCount++
      graph = addEdge(graph, {
        id: `e${edgeCount}`,
        source: nodeIdForIndex(i),
        target: nodeIdForIndex(j),
        ...(weighted ? { weight: value } : {}),
      })
    }
  }
  return graph
}

// ---------------------------------------------------------------------------
// Adjacency list ("A: B, C(3)" — one line per node, neighbors comma-separated,
// an optional "(weight)" after a neighbor id)
// ---------------------------------------------------------------------------

const NEIGHBOR_PATTERN = /^([^()\s]+)(?:\(([-+\d.]+)\))?$/

export function exportAdjacencyListText(graph: Graph): string {
  return toAdjacencyList(graph)
    .map((entry) => {
      const neighbors = entry.neighbors
        .map((nb) => (nb.weight === undefined ? nb.nodeId : `${nb.nodeId}(${nb.weight})`))
        .join(', ')
      return `${entry.nodeId}: ${neighbors}`
    })
    .join('\n')
}

export function parseAdjacencyList(text: string, options: DirectedOption): Graph {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  if (lines.length === 0) throw new Error('No lines found. Use one line per node, like "A: B, C(3)".')

  const nodeIds: string[] = []
  const rememberNode = (id: string) => {
    if (!nodeIds.includes(id)) nodeIds.push(id)
  }
  const rawEdges: { from: string; to: string; weight?: number }[] = []

  for (const line of lines) {
    const colon = line.indexOf(':')
    if (colon === -1) throw new Error(`Line "${line}" is missing a ":" after the node id.`)
    const from = line.slice(0, colon).trim()
    if (from === '') throw new Error(`Line "${line}" has an empty node id before the ":".`)
    rememberNode(from)

    const rest = line.slice(colon + 1).trim()
    if (rest === '') continue
    for (const token of rest.split(',')) {
      const t = token.trim()
      if (t === '') continue
      const match = NEIGHBOR_PATTERN.exec(t)
      if (!match) throw new Error(`Could not parse neighbor "${t}" on line "${line}". Use "id" or "id(weight)".`)
      const to = match[1]
      const weight = match[2] === undefined ? undefined : Number(match[2])
      rememberNode(to)
      rawEdges.push({ from, to, weight })
    }
  }

  const weighted = rawEdges.some((e) => e.weight !== undefined)
  if (weighted && rawEdges.some((e) => e.weight === undefined)) {
    throw new Error('Either give every neighbor a "(weight)", or none at all.')
  }

  let graph = createGraph({ directed: options.directed, weighted })
  for (const id of nodeIds) graph = addNode(graph, { id })

  // An undirected paste naturally lists each edge from both ends ("A: B" and
  // "B: A"); only the first occurrence of a pair is kept, so it isn't doubled.
  const seenPairs = new Set<string>()
  let edgeCount = 0
  for (const { from, to, weight } of rawEdges) {
    const key = options.directed ? `${from}->${to}` : [from, to].sort().join('~')
    if (!options.directed && seenPairs.has(key)) continue
    seenPairs.add(key)
    edgeCount++
    graph = addEdge(graph, { id: `e${edgeCount}`, source: from, target: to, ...(weight === undefined ? {} : { weight }) })
  }
  return graph
}

// ---------------------------------------------------------------------------
// CSV edge list (header row with "source", "target", optional "weight")
// ---------------------------------------------------------------------------

export function exportCsvEdgeList(graph: Graph): string {
  const header = graph.weighted ? 'source,target,weight' : 'source,target'
  const rows = graph.edges.map((e) =>
    graph.weighted ? `${e.source},${e.target},${e.weight ?? ''}` : `${e.source},${e.target}`,
  )
  return [header, ...rows].join('\n')
}

export function parseCsvEdgeList(text: string, options: DirectedOption): Graph {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  if (lines.length === 0) throw new Error('No rows found.')

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase())
  const sourceIdx = header.indexOf('source')
  const targetIdx = header.indexOf('target')
  const weightIdx = header.indexOf('weight')
  if (sourceIdx === -1 || targetIdx === -1) {
    throw new Error('The header row must include "source" and "target" columns.')
  }

  // The COLUMN's presence decides "weighted", not whether every cell in it is
  // filled in: a "weight" column that exists means the graph is weighted, and
  // a row that leaves its own cell blank defaults to weight 1 (same rule Day 2
  // uses when turning "Weighted" on for an edge that had no weight yet).
  const weighted = weightIdx !== -1

  const nodeIds: string[] = []
  const rememberNode = (id: string) => {
    if (!nodeIds.includes(id)) nodeIds.push(id)
  }
  const rows: { source: string; target: string; weight?: number }[] = []

  lines.slice(1).forEach((line, i) => {
    const cells = line.split(',').map((c) => c.trim())
    const source = cells[sourceIdx]
    const target = cells[targetIdx]
    if (!source || !target) throw new Error(`Row ${i + 2} is missing a source or target.`)

    let weight: number | undefined
    if (weighted) {
      const weightText = cells[weightIdx]
      if (weightText === undefined || weightText === '') {
        weight = 1
      } else {
        weight = Number(weightText)
        if (!Number.isFinite(weight)) throw new Error(`Row ${i + 2} has an invalid weight "${weightText}".`)
      }
    }

    rememberNode(source)
    rememberNode(target)
    rows.push({ source, target, weight })
  })

  let graph = createGraph({ directed: options.directed, weighted })
  for (const id of nodeIds) graph = addNode(graph, { id })
  rows.forEach((r, i) => {
    graph = addEdge(graph, {
      id: `e${i + 1}`,
      source: r.source,
      target: r.target,
      ...(r.weight === undefined ? {} : { weight: r.weight }),
    })
  })
  return graph
}
