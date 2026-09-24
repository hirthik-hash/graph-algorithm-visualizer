# Contributing

Thanks for looking at this project. It was built day-by-day as a learning
tool, and the same habits that shaped it are what make it easy to extend.

## Setup

```bash
npm install
npm run dev
```

Before opening a pull request, all three of these must be clean:

```bash
npm run test     # every test passes
npx eslint src   # no lint errors
npm run build    # tsc --noEmit && vite build succeed
```

## How this codebase is organized

- **`src/model/`** — pure functions operating on a `Graph`. Nothing here
  touches React or Zustand. Every function is immutable: it returns a new
  `Graph` rather than mutating its input, and invalid operations throw rather
  than silently doing nothing.
- **`src/engine/`** — algorithm-agnostic machinery: the `AlgorithmEvent`
  union, the `Algorithm` interface, the step engine, `explainEvent`,
  highlighting, comparison, quiz generation. None of this file knows about
  any specific algorithm.
- **`src/algorithms/`** — one file per algorithm. Each exports an `Algorithm`
  object and emits only the standard events from `engine/events.ts`.
- **`src/ui/`** — React components and the two Zustand stores
  (`graphStore`, `playbackStore`), which are thin wrappers around the model
  and engine layers. Components should not contain graph logic.

## Conventions

- **TypeScript strict mode, no `any`.** Prefer a well-typed union over a
  loose object shape.
- **Pure, immutable functions wherever possible.** Side effects (DOM,
  clipboard, downloads) live only in `src/ui/`.
- **Every non-trivial function has a test.** Algorithms are tested against:
  - an exact, hand-checked event sequence for at least one small graph;
  - edge cases specific to that algorithm (self-loops, parallel edges,
    disconnected graphs, negative weights where relevant);
  - a cross-check against another algorithm or a brute-force reference where
    one exists (see `src/algorithms/mst.test.ts` or `topoSort.test.ts` for
    examples).
- **Comments explain *why*, not *what*.** Every algorithm file has a doc
  comment at the top describing its event order and any non-obvious design
  decision (see any file in `src/algorithms/` for the pattern).
- **Shared test graphs** for recurring edge cases (disconnected, self-loop,
  parallel edges, single node, equal weights) live in `src/test/fixtures.ts`
  — use them instead of rebuilding the same shape locally.

## Adding a new algorithm

This is the most common contribution. Full walkthrough:
[`docs/adding-an-algorithm.md`](docs/adding-an-algorithm.md).

Short version: implement the `Algorithm` interface in a new file under
`src/algorithms/`, emit only the standard `AlgorithmEvent` types (add a new
one in `engine/events.ts` only if genuinely necessary — and update
`engine/explain.ts` to handle it, which is enforced at compile time), write
its test file, and register it with one import and one array entry in
`src/algorithms/registry.ts`. Nothing else needs to change: the playback
picker and the comparison table both read from the registry automatically.

## Commit messages

Short, imperative, and specific: `Add A* search`, not `updates`. If a commit
fixes a bug found while building something else, say so:
`Fix hidden-weight leak in Kruskal's on unweighted graphs`.

## Pull request checklist

- [ ] `npm run test` passes, and the new/changed behavior has a test
- [ ] `npx eslint src` is clean
- [ ] `npm run build` succeeds
- [ ] New algorithms are registered in `src/algorithms/registry.ts`
- [ ] Doc comments explain non-obvious design decisions, especially event
      ordering and edge-case handling
- [ ] Any known limitation introduced is called out in a comment (grep for
      "Known limitation" for the existing style)
