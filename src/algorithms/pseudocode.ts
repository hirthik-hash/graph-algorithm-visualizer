/**
 * Code↔Graph Sync (Day 13): pseudocode for an algorithm, tagged line by line
 * with the AlgorithmEvent types that should highlight it.
 *
 * The lookup is purely mechanical: `linesForEvent` matches a line if the
 * CURRENT EVENT'S TYPE appears in that line's `eventTypes`. There is no
 * per-algorithm mapping and no special-casing by algorithm id anywhere in this
 * file's logic — only the pseudocode TEXT differs between algorithms. Adding
 * sync for a fifth algorithm means adding one more entry to PSEUDOCODE, not
 * writing new highlighting code.
 *
 * Only 4 of the 10 registered algorithms have pseudocode so far (BFS,
 * Dijkstra, Bellman-Ford, Kruskal's). Extending to the rest is mechanical:
 * write the lines, tag each with its event types. `hasPseudocode` lets the UI
 * hide the panel for algorithms that don't have an entry yet, rather than
 * showing an empty box.
 */
import type { AlgorithmEventType } from '../engine/events'

export interface PseudocodeLine {
  /** 1-based, stable within an algorithm (used as the React key). */
  line: number
  text: string
  /** Event types that should highlight this line. Empty = never highlights (e.g. a comment). */
  eventTypes: AlgorithmEventType[]
}

const numbered = (lines: [string, AlgorithmEventType[]][]): PseudocodeLine[] =>
  lines.map(([text, eventTypes], i) => ({ line: i + 1, text, eventTypes }))

export const PSEUDOCODE: Record<string, PseudocodeLine[]> = {
  bfs: numbered([
    ['queue ← [start]', ['enqueue']],
    ['visited ← {start}', ['enqueue']],
    ['while queue is not empty:', []],
    ['    u ← queue.dequeue()', ['dequeue']],
    ['    visit(u)', ['visit_node']],
    ['    for each edge (u, v):', ['relax_edge']],
    ['        if v not in visited:', ['relax_edge']],
    ['            visited.add(v)', ['enqueue']],
    ['            queue.enqueue(v)', ['enqueue']],
    ['    mark u finished', ['mark_visited']],
  ]),

  dijkstra: numbered([
    ['dist[start] ← 0, dist[*] ← ∞', ['update_distance']],
    ['pq ← {(start, 0)}', ['enqueue']],
    ['while pq is not empty:', []],
    ['    u ← pq.extractMin()', ['dequeue']],
    ['    if u is finalized: continue', []],
    ['    visit(u)', ['visit_node']],
    ['    for each edge (u, v, weight):', ['relax_edge']],
    ['        if dist[u] + weight < dist[v]:', ['relax_edge']],
    ['            dist[v] ← dist[u] + weight', ['update_distance']],
    ['            pq.insert(v, dist[v])', ['enqueue']],
    ['    mark u finalized', ['mark_visited']],
  ]),

  'bellman-ford': numbered([
    ['dist[start] ← 0, dist[*] ← ∞', ['update_distance']],
    ['repeat (V - 1) times:', []],
    ['    changed ← false', []],
    ['    for each edge (u, v, weight):', ['relax_edge']],
    ['        if dist[u] + weight < dist[v]:', ['relax_edge']],
    ['            dist[v] ← dist[u] + weight', ['update_distance']],
    ['            changed ← true', ['update_distance']],
    ['    if not changed: break', []],
    ['for each edge (u, v, weight):', ['relax_edge']],
    ['    if dist[u] + weight < dist[v]:', ['relax_edge']],
    ['        report negative cycle', ['negative_cycle_detected']],
  ]),

  kruskal: numbered([
    ['sets ← UnionFind(all nodes)', []],
    ['sort edges by weight ascending', []],
    ['for each edge (u, v, weight) in order:', ['relax_edge']],
    ['    if find(u) ≠ find(v):', ['relax_edge']],
    ['        add (u, v) to the tree', ['add_to_mst']],
    ['        union(u, v)', ['add_to_mst']],
    ['    else:', []],
    ['        reject (u, v): would close a cycle', ['reject_edge']],
  ]),
}

export function hasPseudocode(algorithmId: string): boolean {
  return algorithmId in PSEUDOCODE
}

export function pseudocodeFor(algorithmId: string): PseudocodeLine[] | null {
  return PSEUDOCODE[algorithmId] ?? null
}

/** Which of an algorithm's lines should highlight for a given event type. Usually 0 or 1 line; occasionally more. */
export function linesForEvent(lines: readonly PseudocodeLine[], eventType: AlgorithmEventType): PseudocodeLine[] {
  return lines.filter((l) => l.eventTypes.includes(eventType))
}
