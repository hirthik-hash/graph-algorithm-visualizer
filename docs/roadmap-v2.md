# Graph Algorithm Visualizer — v1.0 → v2.0 roadmap

v1.0 is the completed 23-day master plan plus the post-plan additions (inline
weight editing, three real bug fixes, a PDF-popup fallback, and Undo/Redo).
361 tests, ESLint clean, production build clean. Everything from here is
milestone-based rather than day-numbered, because there is no fixed finish
line anymore — each milestone is scoped, delivered, and verified on its own,
the same test/lint/build discipline as every day before it.

## Milestone 1 — Baseline freeze + audit ✅ (this delivery)
- Tag `v1.0.0`.
- Full product audit: `docs/audit-v1.md`.
- One regression test closing a real coverage gap found while auditing
  (undo/redo correctly invalidates a loaded algorithm run — was previously
  true by construction but never actually asserted).

## Milestone 2 — Targeted fixes from the audit
Address the audit's Medium findings that are cheap and self-contained:
- Show the pending edge weight near the canvas while a connection is active.
- Note in the UI that the canvas weight editor and the "Edit edge" dropdown
  do the same thing.
- Grey out / annotate algorithm options that can't run on the current graph,
  before they're selected.
- Group the algorithm dropdown by category.

Each of these is independent and testable; they don't require the larger
structural decision in Milestone 3.

## Milestone 3 — Navigation / information architecture
The audit's top finding: 14 stacked panels with no navigation. This is a real
design decision, not a quick patch, and deserves to be scoped on its own
rather than bundled into a "fixes" milestone. Candidate directions (to be
decided, not assumed): tabbed sections (Draw / Run / Analyze / Learn),
collapsible panels, or a persistent side nav. Whichever is chosen, existing
functionality doesn't change — only how it's organized and reached.

## Milestone 4 — Explanation depth (highest-value remaining work)
The audit's other Medium visualization finding, and the most valuable thing
left for a *teaching* tool specifically: right now `explainEvent` gives one
sentence per event. The next step is showing the algorithm's actual
reasoning at each step — e.g. for Dijkstra: current distance → candidate via
this edge → comparison → decision — not just "found a shorter path." This
builds on the existing event/explain architecture rather than replacing it,
and is genuinely more valuable than adding more algorithms at this point.

## Milestone 5 — Performance pass (scoped, not open-ended)
Scoped specifically to the audit's High finding, not scale-testing for its
own sake:
- A real test at 100–200 nodes with Floyd-Warshall, measuring actual memory/
  time, and either a UI warning or a separate node-count cap for matrix-based
  algorithms.
- A light pass across the graph-type matrix (sparse/dense/directed/
  undirected/disconnected/cyclic/DAG/self-loops/parallel edges) at a
  realistic size (50–100 nodes) — not 1000, since that's far past what a
  person draws or studies by hand, and chasing it now would be solving a
  problem nobody has hit yet.
- Import/export at a genuinely large CSV (hundreds of rows), since it's
  never actually been tried past a handful of lines.

## Milestone 6 — Algorithm expansion
Only after Milestones 2–5, and picked for teaching value, not count:
- **Tarjan's or Kosaraju's (strongly connected components)** — natural next
  step, reuses the existing DFS three-colour pattern almost directly.
- **Bridges and articulation points** — a close cousin of SCC work, similar
  implementation shape, genuinely different lesson (single points of
  failure in a network).
- Network flow, matching, and the rest of the original v2 backlog remain
  possible later, but aren't scoped here.

## Milestone 7 — Release polish
README refresh reflecting the audit-driven changes, a changelog, and the
already-written `CONTRIBUTING.md` / `docs/adding-an-algorithm.md` /
`docs/deployment.md` carried forward unchanged (they don't need to be redone, just kept current as milestones land).

---

Milestones are sized to be independently shippable — each ends in its own
tagged, tested, building state, the same way each day did.
