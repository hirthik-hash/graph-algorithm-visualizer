/**
 * Quiz Mode (Day 14): multiple-choice questions generated from a LIVE run of
 * the real algorithm, every time. There is no hardcoded answer key anywhere in
 * this file, so a question can never drift out of sync with how the engine
 * actually behaves — if an algorithm's logic changes, the next generated
 * question reflects it automatically.
 *
 * Three question types:
 *  - shortest-path: distance between two nodes, from a real Dijkstra run.
 *  - bfs-order: the exact visiting order from a real BFS run. Graded on EXACT
 *    string match. BFS order is not unique when a node has multiple
 *    same-level neighbours (ties can go either way) — this is an accepted
 *    simplification: the "correct" answer is whatever THIS run produced, not
 *    "any valid BFS order". Documented, not hidden.
 *  - mst-weight: total weight of a real Kruskal run. Skipped entirely for
 *    directed graphs, since Kruskal's requires undirected (checkRequirements
 *    would refuse it anyway; this file checks it directly rather than
 *    depending on that panel's wiring).
 *
 * Availability checks (`can*`) are deterministic and never touch the RNG, so
 * asking "is this question type possible right now" is stable. Generation
 * (`generate*`) additionally takes a `random` function to choose WHICH
 * instance of the question to ask and to shuffle the options; tests pass a
 * seeded one for reproducibility, and the UI defaults to Math.random.
 */
import { bfsAlgorithm } from '../algorithms/bfs'
import { dijkstraAlgorithm } from '../algorithms/dijkstra'
import { kruskalAlgorithm } from '../algorithms/kruskal'
import type { Graph } from '../model/graph'
import { connectedComponents } from '../model/analyzer'
import { makeRandom } from './random'
import type { AlgorithmEvent } from './events'

export type QuizQuestionType = 'shortest-path' | 'bfs-order' | 'mst-weight'

export interface QuizQuestion {
  /** Identifies this specific question instance (which nodes/graph it came from), not just its type. */
  id: string
  type: QuizQuestionType
  prompt: string
  options: string[]
  correctIndex: number
  explanation: string
}

function finishResult(events: AlgorithmEvent[]): Record<string, unknown> {
  const last = events[events.length - 1]
  if (last.type !== 'finish') throw new Error('Algorithm run did not end in a finish event')
  return last.result
}

function labelOf(graph: Graph, id: string): string {
  return graph.nodes.find((n) => n.id === id)?.label ?? id
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length)]
}

/** Numeric distractors near `correct`, always non-negative, always distinct from it and each other. */
function numericDistractors(correct: number, count: number, random: () => number): number[] {
  const candidates = shuffled([1, 2, 3, -1, -2, -3, 4, -4, 5, -5, 7, -7], random)
  const result = new Set<number>()
  for (const delta of candidates) {
    if (result.size >= count) break
    const value = correct + delta
    if (value >= 0 && value !== correct) result.add(value)
  }
  for (let extra = 1; result.size < count; extra++) result.add(correct + count + extra) // pathological fallback
  return [...result]
}

// ---------------------------------------------------------------------------
// shortest-path
// ---------------------------------------------------------------------------

/** Every (start, target) pair with a finite distance between them, computed once via Dijkstra from each node. */
function reachablePairs(graph: Graph): { startId: string; targetId: string; distance: number }[] {
  if (!graph.weighted) return []
  const pairs: { startId: string; targetId: string; distance: number }[] = []
  for (const start of graph.nodes) {
    const distances = finishResult(dijkstraAlgorithm.run(graph, { startNodeId: start.id })).distances as Record<
      string,
      number | null
    >
    for (const target of graph.nodes) {
      if (target.id === start.id) continue
      const d = distances[target.id]
      if (d !== null) pairs.push({ startId: start.id, targetId: target.id, distance: d })
    }
  }
  return pairs
}

export function canGenerateShortestPath(graph: Graph): boolean {
  return graph.weighted && reachablePairs(graph).length > 0
}

export function generateShortestPathQuestion(graph: Graph, random: () => number = Math.random): QuizQuestion | null {
  const pairs = reachablePairs(graph)
  if (pairs.length === 0) return null
  const chosen = pick(pairs, random)

  const options = shuffled(
    [chosen.distance, ...numericDistractors(chosen.distance, 3, random)],
    random,
  ).map(String)
  const correctIndex = options.indexOf(String(chosen.distance))

  const startLabel = labelOf(graph, chosen.startId)
  const targetLabel = labelOf(graph, chosen.targetId)
  return {
    id: `shortest-path:${chosen.startId}:${chosen.targetId}`,
    type: 'shortest-path',
    prompt: `What is the length of the shortest path from ${startLabel} to ${targetLabel}?`,
    options,
    correctIndex,
    explanation: `Running Dijkstra's algorithm from ${startLabel}, the shortest distance to ${targetLabel} is ${chosen.distance}.`,
  }
}

// ---------------------------------------------------------------------------
// bfs-order
// ---------------------------------------------------------------------------

/** Start nodes whose BFS reaches at least 3 nodes (enough to have several distinct orderings to choose wrong answers from). */
function usableBfsStarts(graph: Graph): string[] {
  return graph.nodes
    .map((n) => n.id)
    .filter((id) => (finishResult(bfsAlgorithm.run(graph, { startNodeId: id })).order as string[]).length >= 3)
}

export function canGenerateBfsOrder(graph: Graph): boolean {
  return usableBfsStarts(graph).length > 0
}

export function generateBfsOrderQuestion(graph: Graph, random: () => number = Math.random): QuizQuestion | null {
  const starts = usableBfsStarts(graph)
  if (starts.length === 0) return null
  const startId = pick(starts, random)
  const order = finishResult(bfsAlgorithm.run(graph, { startNodeId: startId })).order as string[]

  const format = (ids: readonly string[]) => ids.map((id) => labelOf(graph, id)).join(' → ')
  const correctText = format(order)

  const variants = new Set<string>([correctText])
  for (let tries = 0; variants.size < 4 && tries < 50; tries++) {
    variants.add(format(shuffled(order, random)))
  }
  const options = shuffled([...variants], random)
  const correctIndex = options.indexOf(correctText)

  const startLabel = labelOf(graph, startId)
  return {
    id: `bfs-order:${startId}`,
    type: 'bfs-order',
    prompt: `In what order does Breadth-First Search starting from ${startLabel} visit the reachable nodes?`,
    options,
    correctIndex,
    explanation:
      `Starting from ${startLabel}, BFS visits: ${correctText}. ` +
      'Note: when a node has more than one same-level neighbour, another visiting order can be equally valid — this question checks the order this specific run produced.',
  }
}

// ---------------------------------------------------------------------------
// mst-weight
// ---------------------------------------------------------------------------

export function canGenerateMstWeight(graph: Graph): boolean {
  // Kruskal's requires an undirected graph; skip directed graphs entirely, as documented.
  return !graph.directed && graph.edges.length > 0
}

export function generateMstWeightQuestion(graph: Graph, random: () => number = Math.random): QuizQuestion | null {
  if (!canGenerateMstWeight(graph)) return null
  const result = finishResult(kruskalAlgorithm.run(graph))
  const totalWeight = result.totalWeight as number
  const treeCount = result.treeCount as number

  const options = shuffled([totalWeight, ...numericDistractors(totalWeight, 3, random)], random).map(String)
  const correctIndex = options.indexOf(String(totalWeight))

  const forestNote = treeCount > 1 ? ` (the graph is disconnected, so this is a spanning forest of ${treeCount} trees)` : ''
  const components = connectedComponents(graph).length
  return {
    id: `mst-weight:${components}:${graph.edges.length}`,
    type: 'mst-weight',
    prompt: `What is the total weight of the minimum spanning tree${treeCount > 1 ? ' / forest' : ''}?`,
    options,
    correctIndex,
    explanation: `Running Kruskal's algorithm, the minimum total weight is ${totalWeight}${forestNote}.`,
  }
}

// ---------------------------------------------------------------------------
// Putting a quiz together
// ---------------------------------------------------------------------------

const GENERATORS: Record<QuizQuestionType, (graph: Graph, random: () => number) => QuizQuestion | null> = {
  'shortest-path': generateShortestPathQuestion,
  'bfs-order': generateBfsOrderQuestion,
  'mst-weight': generateMstWeightQuestion,
}

const CAN_GENERATE: Record<QuizQuestionType, (graph: Graph) => boolean> = {
  'shortest-path': canGenerateShortestPath,
  'bfs-order': canGenerateBfsOrder,
  'mst-weight': canGenerateMstWeight,
}

/** Which question types this graph currently supports. Never touches the RNG. */
export function availableQuestionTypes(graph: Graph): QuizQuestionType[] {
  return (Object.keys(CAN_GENERATE) as QuizQuestionType[]).filter((type) => CAN_GENERATE[type](graph))
}

/**
 * Builds up to `count` questions, picking a type at random for each from the
 * types this graph supports, skipping duplicate question ids so the same
 * exact question doesn't appear twice in one quiz. Returns fewer than `count`
 * only when the graph has too little variety to fill it, or supports no
 * question types at all (returns []).
 */
export function generateQuiz(graph: Graph, count: number, seed: number = Date.now()): QuizQuestion[] {
  const random = makeRandom(seed)
  const types = availableQuestionTypes(graph)
  if (types.length === 0) return []

  const questions: QuizQuestion[] = []
  const seenIds = new Set<string>()
  const maxAttempts = count * 20
  for (let attempt = 0; questions.length < count && attempt < maxAttempts; attempt++) {
    const type = pick(types, random)
    const question = GENERATORS[type](graph, random)
    if (question === null || seenIds.has(question.id)) continue
    seenIds.add(question.id)
    questions.push(question)
  }
  return questions
}
