# Graph Algorithm Visualizer — v1.0 → v2.0 roadmap

v1.0 is the completed 23-day master plan plus the post-plan additions (inline
weight editing, three real bug fixes, a PDF-popup fallback, and Undo/Redo).
361 tests, ESLint clean, production build clean. Everything from here is
milestone-based rather than day-numbered, because there is no fixed finish
line anymore — each milestone is scoped, delivered, and verified on its own,
the same test/lint/build discipline as every day before it.

**Status: Milestones 1–6 complete (tagged `v1.1.0`, 425 tests). Milestone 7
(this document's own update, plus the changelog) is in progress.**

## Milestone 1 — Baseline freeze + audit ✅
- Tagged `v1.0.0`.
- Full product audit: `docs/audit-v1.md`.
- One regression test closing a real coverage gap found while auditing
  (undo/redo correctly invalidates a loaded algorithm run — was previously
  true by construction but never actually asserted).

## Milestone 2 — Targeted fixes from the audit ✅
- Pending edge weight now shown near the canvas (a floating badge above the
  source node) while a connection is active.
- A hint in the "Edit edge" panel points to the newer canvas weight editor.
- The algorithm picker greys out options that can't run on the current
  graph, with the specific unmet requirement shown inline.
- The algorithm dropdown is grouped by category (`<optgroup>`).

## Milestone 3 — Navigation / information architecture ✅
Chose collapsible sections over tabs or a sidebar (tabs hide related controls
too aggressively for this workflow; a sidebar is the next evolution if the
algorithm/feature set outgrows five sections). The canvas stays always
visible; everything else groups into Graph, Algorithms, Analysis, Learning,
and Tools, with Graph and Algorithms open by default.

## Milestone 4 — Explanation depth ✅
A "Why" breakdown under the existing one-line step explanation, for
Dijkstra, Bellman-Ford, and A*: current distance → edge weight → candidate →
comparison against what was already known — reconstructed from the event
stream itself (reusing `computeHighlights`' own distance tracking), so it
works for all three algorithms without knowing their ids. Returns nothing
for algorithms with no distance concept (BFS/DFS/topological/MST), by
design. MST and topological "why" breakdowns remain a documented, deliberate
gap, not an oversight.

## Milestone 5 — Performance pass ✅
Scoped to what the audit actually flagged as risky, not open-ended
scale-chasing:
- A real 120-node Floyd-Warshall run, measured (well under a 5-second
  bound) and structurally verified at every snapshot; a non-blocking UI
  warning (not a hard cap) appears above 50 nodes, computed live for the
  graph in front of you.
- Every registered algorithm run against all 7 generator shapes ×
  weighted/unweighted × directed/undirected (28 combinations) at 80 nodes,
  plus hand-built self-loop/parallel-edge graphs at 60 nodes and a
  4-cluster disconnected graph at 80 (the generator can't produce
  self-loops or parallel edges by construction, so these needed a
  hand-built graph instead).
- A 500-row CSV import and a 300-edge export/reimport round trip, both
  previously untested past a handful of lines.

## Milestone 6 — Algorithm expansion ✅
- **Tarjan's Strongly Connected Components** (chosen over Kosaraju's: one
  DFS pass instead of two). Iterative, cross-checked against a brute-force
  reachability reference on 60 random directed graphs.
- **Bridges & Articulation Points**, found together in one DFS (as the real
  algorithm naturally does). Iterative, cross-checked against a
  remove-it-and-count-components brute-force reference on 80 random
  undirected graphs, with explicit parallel-edge and self-loop test cases.
- Three new event types (`scc_found`, `bridge_found`,
  `articulation_point_found`) and a new `connectivity` category, both
  compile-enforced everywhere they needed to be wired in.
- Network flow, matching, and the rest of the original v2 backlog remain
  possible later, but aren't scoped here.

## Milestone 7 — Release polish (in progress)
- README refreshed to reflect Milestones 1–6: the algorithm count (13),
  new features (undo/redo, step reasoning, scale warnings, collapsible
  navigation), and an updated known-limitations list.
- `CHANGELOG.md` added, covering `v1.0.0` and `v1.1.0`.
- This document updated to reflect actual completion, not just intent.
- `CONTRIBUTING.md`, `docs/adding-an-algorithm.md`, and
  `docs/deployment.md` carried forward unchanged — they don't need
  rewriting, just to stay accurate, and they still are.

---

Milestones are sized to be independently shippable — each ends in its own
tagged, tested, building state, the same way each day did.
