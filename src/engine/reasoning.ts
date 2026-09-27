/**
 * Step reasoning (Milestone 4): a deeper "why" for shortest-path steps, on
 * top of explainEvent's one-line "what". Rather than only saying "found a
 * shorter path to C", this reconstructs the actual arithmetic behind the
 * decision: the predecessor's distance, the edge weight, the resulting
 * candidate, and how it compares to what was already known.
 *
 * Like explainEvent and computeHighlights before it, this reads only event
 * SHAPES — never an algorithm id — so it works for free on Dijkstra,
 * Bellman-Ford, and A*, which all emit the same relax_edge/update_distance
 * shapes. It returns null for anything it has no deeper reasoning for
 * (BFS/DFS/topological/MST/etc., and the start node's own initialization),
 * so those steps fall back to explainEvent's plain sentence with nothing
 * extra shown — this is a deliberately scoped enhancement, not an attempt to
 * give every algorithm a bespoke breakdown.
 *
 * It reuses computeHighlights' own distance-tracking (folding over the
 * events before the current one) rather than re-implementing it, so the two
 * can never disagree about what "the distance to X was" at a given step.
 */
import { computeHighlights } from './highlights'
import type { AlgorithmEvent } from './events'

export interface StepReasoning {
  /** Short lines, in order, building up to the step's decision. */
  lines: string[]
}

/** Whole numbers print bare; anything else keeps two decimal places (weights are normally integers, but this stays safe if that ever changes). */
function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

/** The weight of the most recent examined edge (source, target) BEFORE the given index, or null if none is found. Searches backward rather than assuming strict adjacency to the current event. */
function findEdgeWeight(events: readonly AlgorithmEvent[], source: string, target: string): number | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]
    if (e.type === 'relax_edge' && e.source === source && e.target === target) {
      return e.weight ?? 1
    }
  }
  return null
}

export function buildStepReasoning(
  eventsSoFar: readonly AlgorithmEvent[],
  labelOf: (id: string) => string = (id) => id,
): StepReasoning | null {
  if (eventsSoFar.length === 0) return null
  const current = eventsSoFar[eventsSoFar.length - 1]
  const before = eventsSoFar.slice(0, -1)

  if (current.type === 'relax_edge') {
    const distancesBefore = computeHighlights(before).distances
    const sourceDistance = distancesBefore.get(current.source)
    if (sourceDistance === undefined) return null // no distance known yet: nothing to reason about (e.g. plain BFS/DFS, or an as-yet-unreached Bellman-Ford source)

    const weight = current.weight ?? 1
    const candidate = sourceDistance + weight
    const existing = distancesBefore.get(current.target)

    const lines = [
      `Current distance to ${labelOf(current.source)}: ${fmt(sourceDistance)}`,
      `Edge ${labelOf(current.source)} → ${labelOf(current.target)}, weight ${fmt(weight)}`,
      `Candidate distance to ${labelOf(current.target)}: ${fmt(sourceDistance)} + ${fmt(weight)} = ${fmt(candidate)}`,
    ]
    if (existing === undefined) {
      lines.push(`${labelOf(current.target)} has no known distance yet — this would set it to ${fmt(candidate)}`)
    } else if (candidate < existing) {
      lines.push(`Existing distance to ${labelOf(current.target)}: ${fmt(existing)} — ${fmt(candidate)} is shorter, so this improves it`)
    } else {
      lines.push(`Existing distance to ${labelOf(current.target)}: ${fmt(existing)} — ${fmt(candidate)} is not shorter, so nothing changes`)
    }
    return { lines }
  }

  if (current.type === 'update_distance') {
    if (current.viaNodeId === undefined) return null // the start node's own initialization; the one-liner already covers it

    const distancesBefore = computeHighlights(before).distances
    const viaDistance = distancesBefore.get(current.viaNodeId)
    const weight = findEdgeWeight(before, current.viaNodeId, current.nodeId)
    if (viaDistance === undefined || weight === null) return null // couldn't reconstruct the arithmetic; fall back to the one-liner

    const lines = [
      `Current distance to ${labelOf(current.viaNodeId)}: ${fmt(viaDistance)}`,
      `Edge ${labelOf(current.viaNodeId)} → ${labelOf(current.nodeId)}, weight ${fmt(weight)}`,
      `Candidate distance to ${labelOf(current.nodeId)}: ${fmt(viaDistance)} + ${fmt(weight)} = ${fmt(current.distance)}`,
    ]
    if (current.previousDistance === null) {
      lines.push(`${labelOf(current.nodeId)} had no known distance yet — set to ${fmt(current.distance)}`)
    } else {
      lines.push(
        `Existing distance to ${labelOf(current.nodeId)}: ${fmt(current.previousDistance)} — ${fmt(current.distance)} is shorter, so it's updated`,
      )
    }
    return { lines }
  }

  return null
}
