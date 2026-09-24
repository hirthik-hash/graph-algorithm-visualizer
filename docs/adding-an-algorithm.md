# Adding a new algorithm

This walks through adding one from scratch, using the simplest real example
in the codebase — `countReachableAlgorithm` (`src/algorithms/countReachable.ts`)
— as the running reference. It was added specifically to prove this process
needs nothing beyond what's described here: one new file, one test file, and
two lines in the registry.

## 1. Decide its shape

Before writing code, settle:

- **`id`** — a short, unique, kebab-or-camel string (`'bfs'`, `'bellman-ford'`,
  `'count-reachable'`). This is used as the React key in lists and as the
  lookup key in `getAlgorithmById`.
- **`category`** — one of `'traversal' | 'shortest-path' | 'all-pairs' |
  'spanning-tree' | 'ordering'` (see `AlgorithmCategory` in
  `src/engine/algorithm.ts`). Add a new category there only if none fit.
- **`requirements`** — which of `graphType`, `weighted`,
  `nonNegativeWeights`, `startNode`, `goalNode` this algorithm needs. These
  are checked automatically by `checkRequirements` before every run, and
  drive the warning panel, so get this right rather than checking manually
  inside `run()`.
- **`usesCoordinates`** — set this to `true` only if the algorithm's *result*
  depends on node positions (like A*'s heuristic). This makes moving a node
  correctly invalidate a loaded run; leave it unset for anything else.

## 2. Write the algorithm file

Create `src/algorithms/yourAlgorithm.ts`, exporting an object matching the
`Algorithm` interface (`src/engine/algorithm.ts`):

```ts
import type { Algorithm } from '../engine/algorithm'
import type { AlgorithmEvent } from '../engine/events'
import { toAdjacencyList } from '../model/representations'

export const yourAlgorithm: Algorithm = {
  id: 'your-algorithm',
  name: 'Your Algorithm',
  category: 'traversal',
  requirements: { startNode: true },

  run(graph, options = {}) {
    const events: AlgorithmEvent[] = []
    // ... push events as the algorithm progresses ...
    events.push({ type: 'finish', result: { /* whatever your algorithm computed */ } })
    return events
  },
}
```

**`run()` must be pure and deterministic**: no mutation of `graph`, and the
same input always produces the same event list. The comparison table, the
quiz engine, and the step engine all re-run algorithms and rely on this.

### Which events to emit

Use the existing event types from `src/engine/events.ts` wherever they fit —
`visit_node`, `enqueue`/`dequeue` (with a `structure` of `'queue'`, `'stack'`,
or `'priority_queue'`), `relax_edge`, `update_distance`, `mark_visited`,
`negative_cycle_detected`, `matrix_update`, `add_to_mst`/`reject_edge`,
and `finish`. Reusing these means:

- `explainEvent` (`src/engine/explain.ts`) already produces a plain-English
  sentence for your algorithm, for free — it reads only the event's shape,
  never the algorithm's id.
- `computeHighlights` (`src/engine/highlights.ts`) already derives canvas
  highlighting (visited nodes, frontier, active node, examined edge) for
  free, the same way.

Only add a **new** event type if none of the existing ones describe what your
algorithm does. If you do: add it to the `AlgorithmEvent` union and the
`EVENT_TYPE_SET` map in `events.ts` (both are required — the second makes a
missing case a compile error elsewhere), then add a case to `explainEvent`'s
switch (also enforced at compile time via `assertNever`).

### `finish.result`

Put whatever your algorithm computed here, as plain JSON (no `Map`, `Set`,
`Infinity`, or class instances — use `null` for "not reached/not applicable").
This is what the comparison table and quiz engine read.

## 3. Write its test file

Every algorithm test file in this project follows the same shape — see
`src/algorithms/countReachable.test.ts` for the shortest real example, or
`src/algorithms/bfs.test.ts` for a fuller one:

1. One test asserting the **exact event sequence** for a small, hand-traced
   graph.
2. Tests for edge cases relevant to your algorithm (self-loops, parallel
   edges, disconnected graphs, negative weights, etc.) — reuse
   `src/test/fixtures.ts` where one of its shapes fits.
3. A test confirming `requirements` is what you intend, and that
   `checkRequirements`/a direct call reports the failures you expect.
4. Where a meaningful comparison exists, a cross-check against another
   algorithm or a brute-force reference (see `src/algorithms/mst.test.ts` or
   `topoSort.test.ts`).

## 4. Register it

In `src/algorithms/registry.ts`, add one import and one array entry:

```ts
import { yourAlgorithm } from './yourAlgorithm'

export const ALGORITHM_REGISTRY: readonly Algorithm[] = [
  // ...existing entries...
  yourAlgorithm,
]
```

That's the only file that needs to change. `PlaybackControls.tsx` and
`ComparisonPanel.tsx` both read from `ALGORITHM_REGISTRY`, so your algorithm
is immediately choosable in the playback picker and appears as a row in the
comparison table — including a `ran: false` row with its unmet requirements
listed, if it can't run on the current graph.

## 5. (Optional) Add Code↔Graph Sync pseudocode

If you want your algorithm's pseudocode to highlight in sync with playback,
add an entry to `PSEUDOCODE` in `src/algorithms/pseudocode.ts`: an array of
`{ text, eventTypes }` lines, where `eventTypes` lists which event types
should highlight that line. See the existing four entries (`bfs`, `dijkstra`,
`bellman-ford`, `kruskal`) for the pattern. This step is genuinely optional —
`CodeSyncPanel` renders nothing for an algorithm with no entry.

## 6. Verify

```bash
npm run test     # your new tests, plus everything else, still pass
npx eslint src
npm run build
npm run dev      # open the picker — your algorithm should be there
```
