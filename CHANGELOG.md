# Changelog

All notable changes to this project. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

Nothing yet.

## [1.1.0] — v1.0 → v2.0 evolution, Milestones 1–6

The `v1.0.0` baseline reviewed as an actual product, then improved
deliberately rather than by adding features on impulse — an audit first,
fixes chosen from it, then depth, performance, and new algorithm families.

### Added
- **Milestone 1 — Baseline audit.** `docs/audit-v1.md`, a section-by-section
  product audit grounded in the real v1.0 code (not a generic checklist), and
  `docs/roadmap-v2.md`, the milestone plan that followed from it. One
  regression test closing a real coverage gap found while auditing: undo/redo
  correctly invalidates a loaded algorithm run.
- **Milestone 2 — Targeted fixes.** The algorithm picker now groups by
  category and greys out (with the specific reason) any algorithm that can't
  run on the current graph. A hint in the edge-editing panel points to the
  newer canvas-inline weight editor. A floating "weight: N" badge appears
  above the pending source node while a connection is in progress, so the
  weight the next edge will use is visible right where you're about to click.
- **Milestone 3 — Navigation.** Everything below the always-visible canvas is
  now grouped into five collapsible sections (Graph, Algorithms, Analysis,
  Learning, Tools) instead of fourteen panels in one long scroll.
- **Milestone 4 — Step reasoning.** A deeper "Why" breakdown under the
  existing one-line step explanation, for Dijkstra, Bellman-Ford, and A*:
  the predecessor's distance, the edge weight, the resulting candidate, and
  the comparison against what was already known — reconstructed from the
  event stream itself, not hardcoded per algorithm.
- **Milestone 5 — Performance pass.** A non-blocking warning when
  Floyd-Warshall's memory footprint could matter for the current graph,
  computed live rather than a generic disclaimer. Real scale tests: a
  120-node Floyd-Warshall run, every registered algorithm across all 7
  generator shapes (weighted/unweighted, directed/undirected) at 80 nodes,
  hand-built self-loop/parallel-edge and disconnected graphs at real scale
  (the generator can't produce the first two by construction), and a 500-row
  CSV import.
- **Milestone 6 — Connectivity algorithms.** Tarjan's Strongly Connected
  Components and Bridges & Articulation Points, both iterative (no recursion,
  so a 20,000-node graph can't overflow the call stack), both cross-checked
  against an independent brute-force reference on dozens of random graphs.
  Three new event types (`scc_found`, `bridge_found`,
  `articulation_point_found`) and a new `connectivity` algorithm category,
  both wired in wherever the type system could enforce it.

### Fixed
- CSV import silently failed to recognize a valid header when it carried a
  leading UTF-8 byte-order mark or quoted cells (both common when exporting
  from Excel).
- Adjacency-matrix, adjacency-list, and CSV imports placed every node at
  `(0, 0)`, stacking them in the canvas's corner instead of spreading them
  out (JSON import was unaffected, since it carries real positions).
- The random generator's node-count field could turn "delete 1, type 8" into
  "18": it clamped to a minimum value on every keystroke, including while
  temporarily empty, forcing a stray digit back in before a new one could be
  typed.
- Kruskal's and Bellman-Ford briefly disagreed with the model's own "hidden
  weights are ignored on an unweighted graph" rule (an unweighted-graph run
  could use leftover stored weights). Caught while building Day 9.
- A blocked pop-up for "Export trace as PDF" now falls back to downloading
  the report as an `.html` file instead of just failing silently.

### Investigated, no code change needed
- A reported "entering 2 gives 4" edge-weight bug was traced end to end
  (input → store → model → render) with no arithmetic fault found anywhere
  in the chain; the likely cause was the pending-weight field being easy to
  lose track of, which Milestone 2's floating badge addresses directly.

## [1.0.0] — Complete 23-day plan + post-plan additions

The original master plan, executed day by day (19 delivery days once a few
were split or pulled forward), plus everything added immediately after it
was finished.

### The 23-day plan
Repo/model scaffolding; the SVG canvas with click/drag/connect/delete
gestures; derived adjacency matrix/list/edge-list views; a structural
analyzer (degrees, components, cycles, DAG check, bipartite check); the
`AlgorithmEvent` schema and step engine; BFS, DFS, Dijkstra, Bellman-Ford,
Floyd-Warshall, Prim's, Kruskal's, Kahn's and DFS topological sort, and A*;
a generic `explainEvent`; the algorithm registry (proven with a deliberately
trivial 11th algorithm, `countReachable`); shared test fixtures; an algorithm
comparison table; a random graph generator (7 shapes); Code↔Graph Sync
pseudocode for 4 algorithms; Quiz Mode (live-generated questions, 3 types);
JSON/adjacency-matrix/adjacency-list/CSV import and export; URL-based sharing
with no backend; trace export and canvas PNG export; keyboard step-through;
an accessibility and mobile pass; and README/CONTRIBUTING/deployment docs
plus a GitHub Pages Actions workflow and an algorithm-request issue template.

### Post-plan additions
Inline edge-weight editing directly on the canvas; Undo/Redo for every graph
edit, with a capped whole-graph-snapshot history and correct redo-branch
clearing.

**329 tests** at the close of the 23-day plan; **361 tests** once undo/redo
landed.
