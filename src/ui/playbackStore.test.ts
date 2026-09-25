import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { aStarAlgorithm } from '../algorithms/aStar'
import { bfsAlgorithm } from '../algorithms/bfs'
import { dfsAlgorithm } from '../algorithms/dfs'
import type { Algorithm } from '../engine/algorithm'
import { createGraph } from '../model/graph'
import { useGraphStore } from './graphStore'
import { usePlaybackStore } from './playbackStore'

const g = () => useGraphStore.getState()
const p = () => usePlaybackStore.getState()

/** A-B and A-C: BFS on this emits 17 events. */
function buildTriangleTree() {
  g().addNodeAt(10, 10)
  g().addNodeAt(100, 10)
  g().addNodeAt(200, 10)
  g().clickNode('A')
  g().clickNode('B')
  g().clickNode('A')
  g().clickNode('C')
}
const BFS_EVENT_COUNT = 17

beforeEach(() => {
  vi.useFakeTimers()
  p().clearRun()
  usePlaybackStore.setState({ algorithm: null, startNodeId: null, goalNodeId: null, delayMs: 600 })
  useGraphStore.setState({ graph: createGraph(), connectFromId: null, newEdgeWeight: 1, notice: null })
})

afterEach(() => {
  p().pause()
  vi.useRealTimers()
})

describe('playback store', () => {
  it('run() loads an engine at position 0 and defaults the start node to the first node', () => {
    buildTriangleTree()
    p().selectAlgorithm(bfsAlgorithm)
    p().run()
    expect(p().engine?.position).toBe(0)
    expect(p().engine?.length).toBe(BFS_EVENT_COUNT)
    expect(p().startNodeId).toBe('A')
    expect(p().problems).toEqual([])
  })

  it('reports unmet requirements as problems and loads no engine', () => {
    buildTriangleTree() // undirected
    const directedOnly: Algorithm = { ...bfsAlgorithm, id: 'x', requirements: { graphType: 'directed' } }
    p().selectAlgorithm(directedOnly)
    p().run()
    expect(p().engine).toBeNull()
    expect(p().problems).toEqual(['Requires a directed graph.'])
  })

  it('asks for an algorithm when none is selected', () => {
    p().run()
    expect(p().engine).toBeNull()
    expect(p().problems).toEqual(['Choose an algorithm first.'])
  })

  it('stepForward auto-runs, then steps; stepBack and reset move back', () => {
    buildTriangleTree()
    p().selectAlgorithm(bfsAlgorithm)
    p().stepForward()
    expect(p().engine?.position).toBe(1)
    p().stepForward()
    expect(p().engine?.position).toBe(2)
    p().stepBack()
    expect(p().engine?.position).toBe(1)
    p().stepForward()
    p().reset()
    expect(p().engine?.position).toBe(0)
  })

  it('play advances one step per delay and stops by itself at the end', () => {
    buildTriangleTree()
    p().selectAlgorithm(dfsAlgorithm)
    p().setDelayMs(100)
    p().play()
    expect(p().isPlaying).toBe(true)
    vi.advanceTimersByTime(100)
    expect(p().engine?.position).toBe(1)
    vi.advanceTimersByTime(200)
    expect(p().engine?.position).toBe(3)
    vi.advanceTimersByTime(100 * 1000)
    expect(p().engine?.isAtEnd).toBe(true)
    expect(p().isPlaying).toBe(false)
  })

  it('pause stops advancing', () => {
    buildTriangleTree()
    p().selectAlgorithm(bfsAlgorithm)
    p().setDelayMs(100)
    p().play()
    vi.advanceTimersByTime(100)
    p().pause()
    vi.advanceTimersByTime(1000)
    expect(p().engine?.position).toBe(1)
    expect(p().isPlaying).toBe(false)
  })

  it('a speed change takes effect on the very next scheduled step', () => {
    buildTriangleTree()
    p().selectAlgorithm(bfsAlgorithm)
    p().setDelayMs(100)
    p().play()
    vi.advanceTimersByTime(100) // step 1 fires, next is scheduled with the current delay
    p().setDelayMs(1000)
    vi.advanceTimersByTime(100) // step 2 was already scheduled at 100ms
    expect(p().engine?.position).toBe(2)
    vi.advanceTimersByTime(500) // step 3 now waits the new 1000ms
    expect(p().engine?.position).toBe(2)
    vi.advanceTimersByTime(500)
    expect(p().engine?.position).toBe(3)
  })

  it('clamps the delay into a sane range', () => {
    p().setDelayMs(1)
    expect(p().delayMs).toBe(50)
    p().setDelayMs(999999)
    expect(p().delayMs).toBe(3000)
  })

  it('pressing play on a finished run replays it from the start', () => {
    buildTriangleTree()
    p().selectAlgorithm(bfsAlgorithm)
    p().run()
    p().goToStep(BFS_EVENT_COUNT)
    p().play()
    expect(p().engine?.position).toBe(0)
    expect(p().isPlaying).toBe(true)
  })

  it('manual stepping and scrubbing pause playback', () => {
    buildTriangleTree()
    p().selectAlgorithm(bfsAlgorithm)
    p().play()
    p().stepForward()
    expect(p().isPlaying).toBe(false)
    p().play()
    p().goToStep(5)
    expect(p().isPlaying).toBe(false)
    expect(p().engine?.position).toBe(5)
  })

  it('changing the algorithm or start node discards the loaded run', () => {
    buildTriangleTree()
    p().selectAlgorithm(bfsAlgorithm)
    p().run()
    p().setStartNode('B')
    expect(p().engine).toBeNull()
    p().run()
    expect(p().startNodeId).toBe('B')
    p().selectAlgorithm(dfsAlgorithm)
    expect(p().engine).toBeNull()
  })

  it('a structural graph edit invalidates the run and stops playback, but moving a node does not', () => {
    buildTriangleTree()
    p().selectAlgorithm(bfsAlgorithm)
    p().play()
    expect(p().engine).not.toBeNull()

    g().moveNode('B', 300, 300)
    g().renameNode('B', 'Bee')
    expect(p().engine).not.toBeNull()
    expect(p().invalidated).toBe(false)

    g().addNodeAt(400, 400)
    expect(p().engine).toBeNull()
    expect(p().isPlaying).toBe(false)
    expect(p().invalidated).toBe(true)
    vi.advanceTimersByTime(10000) // the old timer must be dead
    expect(p().engine).toBeNull()
  })

  it('goal-based algorithms default the goal to the last node, and changing the goal discards the run', () => {
    g().setWeighted(true)
    buildTriangleTree()
    p().selectAlgorithm(aStarAlgorithm)
    p().run()
    expect(p().problems).toEqual([])
    expect(p().startNodeId).toBe('A')
    expect(p().goalNodeId).toBe('C')
    p().setGoalNode('B')
    expect(p().engine).toBeNull()
    p().run()
    expect(p().goalNodeId).toBe('B')
    p().goToStep(p().engine!.length)
    const last = p().engine!.currentEvent
    expect(last?.type === 'finish' && last.result.path).toEqual(['A', 'B'])
  })

  it('does not invent a goal for algorithms that do not use one', () => {
    buildTriangleTree()
    p().selectAlgorithm(bfsAlgorithm)
    p().run()
    expect(p().goalNodeId).toBeNull()
  })

  it('moving a node discards an A* run (its heuristic uses positions) but not a BFS run', () => {
    g().setWeighted(true)
    buildTriangleTree()
    p().selectAlgorithm(aStarAlgorithm)
    p().run()
    expect(p().engine).not.toBeNull()
    g().moveNode('B', 333, 222)
    expect(p().engine).toBeNull()
    expect(p().invalidated).toBe(true)

    p().selectAlgorithm(bfsAlgorithm)
    p().run()
    g().moveNode('B', 111, 111)
    expect(p().engine).not.toBeNull()
  })

  it('undo/redo invalidates a loaded run exactly like any other structural edit (Day 21 interaction)', () => {
    buildTriangleTree()
    p().selectAlgorithm(bfsAlgorithm)
    p().play()
    expect(p().engine).not.toBeNull()

    g().recordHistory()
    g().addNodeAt(400, 400) // a structural change, same as any edit
    expect(p().engine).toBeNull()
    expect(p().invalidated).toBe(true)

    g().undo() // back to the pre-add graph
    expect(p().engine).toBeNull() // still invalidated: undo is itself a structural change
    expect(p().invalidated).toBe(true)

    p().selectAlgorithm(bfsAlgorithm)
    p().run()
    expect(p().engine).not.toBeNull()
    g().redo() // forward again to the post-add graph
    expect(p().engine).toBeNull()
  })
})
