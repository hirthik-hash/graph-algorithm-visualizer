# Graph Algorithm Visualizer

An interactive, step-by-step visualizer for graph algorithms, built as a
learning tool: draw a graph on an SVG canvas, run a real algorithm against it,
and step through exactly what it does — one event at a time, in plain English,
with a deeper "why" for shortest-path steps, pseudocode sync, and canvas
highlighting all kept in lockstep.

Every algorithm here runs for real. There are no canned animations and no
hardcoded example graphs: the visualizer works on whatever you draw, generate,
import, or share.

This project started as a 23-day build plan and, once complete, moved into a
milestone-based `v1.0 → v2.0` evolution: an audit, targeted fixes, a
navigation redesign, deeper step explanations, a performance pass, and new
algorithm families. See [`CHANGELOG.md`](CHANGELOG.md) for the full history
and [`docs/roadmap-v2.md`](docs/roadmap-v2.md) for what's done and what's next.

## Features

- **Draw a graph by hand** on an SVG canvas — click to add nodes, drag to move
  them, click two nodes to connect them, click a weight directly on the canvas
  to edit it in place, toggle directed/weighted.
- **Thirteen algorithms**, each stepped through event by event with
  play/pause, step forward/back, a scrubber, adjustable speed, and keyboard
  shortcuts (`←`/`→` to step, `Space` to play/pause, `Home`/`End`):
  - Traversal: Breadth-First Search, Depth-First Search, Count Reachable Nodes
  - Shortest path: Dijkstra's Algorithm, Bellman-Ford, A* Search
  - All-pairs shortest path: Floyd-Warshall
  - Minimum spanning tree: Prim's Algorithm, Kruskal's Algorithm
  - Ordering: Kahn's Topological Sort, DFS Topological Sort
  - Connectivity: Tarjan's Strongly Connected Components, Bridges &
    Articulation Points
  - The algorithm picker groups these by category and greys out any algorithm
    that can't run on your current graph, with the specific reason why.
- **Undo/redo** for every graph edit — node and edge add/delete/move/rename,
  weight changes, clearing the graph — with `Ctrl+Z` / `Ctrl+Y` /
  `Ctrl+Shift+Z`, a capped history, and a new edit correctly clearing the redo
  branch.
- **Live derived views**: adjacency matrix, adjacency list, edge list, and a
  structural analysis panel (degrees, connected components, cycle detection,
  DAG check, bipartite check) — all computed from the graph, never
  hand-maintained.
- **Plain-English explanations** of every step, generated generically from the
  event's own shape (never hardcoded per algorithm) — plus a deeper **"Why"**
  breakdown for Dijkstra, Bellman-Ford, and A* that reconstructs the actual
  arithmetic behind a decision (current distance → edge weight → candidate →
  comparison), not just "found a shorter path."
- **Code↔Graph Sync**: pseudocode for BFS, Dijkstra, Bellman-Ford and
  Kruskal's, with the current line highlighted as you step through a run.
- **Algorithm comparison table**: every algorithm run side by side on the
  current graph, with step counts and Big-O reference values, including
  algorithms that can't run on the current graph (with the reason why).
- **Quiz mode**: multiple-choice questions generated live from real algorithm
  runs on your own graph — never a fixed answer key.
- **Random graph generator**: seven shapes (random, sparse, dense, complete,
  bipartite, DAG, tree), deterministic given a seed.
- **Import/export**: JSON, adjacency matrix, adjacency list, and CSV, in both
  directions — including large graphs (hundreds of CSV rows tested directly).
- **Sharing**: a graph can be encoded straight into a URL — no backend, no
  account. Opening the link loads that exact graph.
- **Export a run**: a step-by-step trace as a printable report (via your
  browser's own "Save as PDF", with a plain-file fallback if the browser
  blocks the print window), or a PNG snapshot of the current canvas.
- **A performance-aware Floyd-Warshall**: a non-blocking warning appears when
  its memory footprint (which grows as the cube of the node count) could
  genuinely matter for your graph, computed from the graph in front of you,
  not a generic disclaimer.
- **Organized navigation**: everything below the always-visible canvas is
  grouped into five collapsible sections (Graph, Algorithms, Analysis,
  Learning, Tools) instead of one long undifferentiated scroll.
- Built to be **extended**: adding a fourteenth algorithm needs one file and
  two lines of registration — see
  [`docs/adding-an-algorithm.md`](docs/adding-an-algorithm.md).

## Tech stack

- React + TypeScript (pinned to exactly `6.0.3`)
- Vite (dev server and build) and Vitest (tests)
- Raw SVG canvas — no diagramming library — rendering `graph.nodes`/`graph.edges` directly
- Zustand for state, wrapping pure functions in `src/model/`
- No backend: everything runs client-side, including graph sharing

## Getting started

```bash
npm install
npm run dev      # starts the dev server at http://localhost:5173
```

Other scripts:

```bash
npm run test     # run the full test suite (Vitest)
npx eslint src   # lint
npm run build    # type-check and build a production bundle to dist/
```

## Project structure

```
src/
  model/        Graph data model, derived representations, analysis, random
                layout, import/export, URL sharing, the random graph generator
  engine/       Algorithm-agnostic machinery: the event schema, the Algorithm
                interface, the step engine, explanations, deeper step
                reasoning, highlighting, comparison, scale warnings, quiz
                generation, trace reports
  algorithms/   One file per algorithm, plus the registry
                (src/algorithms/registry.ts) that lists them all
  ui/           React components and the Zustand stores (graph history/undo
                lives in graphStore; playback state in playbackStore)
  test/         Shared test fixtures
docs/           Guides: adding an algorithm, deployment, the v1.0 product
                audit, and the v1.0 → v2.0 roadmap
```

## Adding an algorithm

See [`docs/adding-an-algorithm.md`](docs/adding-an-algorithm.md) for a full
walkthrough. In short: write one file that implements the `Algorithm`
interface and emits the standard events, add one import and one array entry
to `src/algorithms/registry.ts`, and it's automatically playable, comparable,
and quiz-able — no other file needs to change. Tarjan's SCC and Bridges &
Articulation Points (added post-v1.0) are recent real examples, including how
to add a brand-new event type when the standard ones don't fit.

## Requesting an algorithm

Open an issue using the
[algorithm request template](.github/ISSUE_TEMPLATE/algorithm-request.md).
That's the project's public request board — no separate account or service
needed.

## Deploying

This is a fully static app (no backend), so it deploys to any static host.
See [`docs/deployment.md`](docs/deployment.md) for exact steps for Vercel,
Netlify, and GitHub Pages.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Project history

- [`CHANGELOG.md`](CHANGELOG.md) — what changed and when.
- [`docs/audit-v1.md`](docs/audit-v1.md) — the v1.0 product audit that shaped
  Milestones 2–4.
- [`docs/roadmap-v2.md`](docs/roadmap-v2.md) — the milestone plan, updated as
  each one lands.

## Known limitations

A living list of deliberate simplifications and known gaps is kept inline in
the relevant source files (search for `Known limitation` or "documented, not
accidental" in comments). Notably: only 4 of 13 algorithms have Code↔Graph
Sync pseudocode; the step-reasoning "Why" breakdown covers shortest-path
algorithms only, not MST or topological ones yet; Quiz Mode's `bfs-order`
question is graded against one specific run's order, not "any valid order";
shared URLs are not compressed, so a very large graph produces a long link;
and Tarjan's SCC groups aren't color-coded individually on the canvas (a node
is only marked "is part of some found component").

## License

MIT — see [`LICENSE`](LICENSE). Fill in your name/year before publishing.
