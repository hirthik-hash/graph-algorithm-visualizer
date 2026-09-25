# Product audit — v1.0 baseline

Walking the app in the order a person actually uses it, not the order it was
built in. Each finding has a severity (High / Medium / Low) and, where one
exists, a concrete fix rather than a vague complaint. This audit is grounded
in the actual v1.0 code, not a general checklist.

## 1. Graph creation

**Medium — the "New edge weight" field is easy to forget about.**
It lives in the side panel (`GraphControls`), physically separate from the
canvas where you actually click two nodes to connect them. Nothing on the
canvas itself shows what weight the *next* click-created edge will get. This
is almost certainly what caused the "wrong weight" report that turned out not
to be a bug at v1.0 (Day 20's investigation): the field wasn't wrong, it just
wasn't visible at the moment it mattered.
*Fix direction:* show the pending weight near the canvas itself while a
connection is in progress (e.g. a small floating label near the source node
once `connectFromId` is set), not just in the side panel.

**Low — node ids are assigned, not chosen.** A-Z then N26+ is predictable but
gives no way to give a node a meaningful id (only a label). Probably fine for
an algorithm-teaching tool where ids are incidental, but worth a deliberate
"not fixing this" note rather than leaving it undiscussed.

## 2. Graph editing

**Medium — two separate places edit an edge's weight.** Since Day 20, you can
edit inline on the canvas. `GraphControls`'s "Edit edge" dropdown + "Set
weight" button still exists from Day 2 and does the exact same thing. Neither
is wrong, but a first-time user has no way to know they're equivalent, and
might reasonably wonder which one is "real."
*Fix direction:* keep both (the dropdown is the accessible/keyboard-only path
when the canvas is hard to target precisely), but say so explicitly in the UI
— a one-line hint under the dropdown: "You can also click a weight directly
on the canvas."

**Low — Undo/Redo lack a visible indicator of *what* the next undo will do.**
A tooltip like "Undo: add node" would remove the need to Undo-then-look to
find out what just got undone. Nice-to-have, not urgent.

## 3. Algorithm selection

**Medium — the algorithm dropdown gives no hint about WHY an option might
fail before you pick it.** You only find out an algorithm can't run (needs
directed, needs weighted, etc.) after selecting it and pressing Play, via the
warning panel. A person could reasonably try several algorithms in a row
before finding one that works on their current graph.
*Fix direction:* grey out or annotate options in the dropdown itself based on
`checkRequirements`, so the picker reflects reality before the click.

**Low — 11 algorithms in one flat list**, with no grouping by category
(`traversal`/`shortest-path`/`all-pairs`/`spanning-tree`/`ordering`) even
though that categorization already exists in the data model
(`AlgorithmCategory`). A grouped `<optgroup>` would cost almost nothing and
make the picker easier to scan as the algorithm count grows.

## 4. Algorithm execution & step-by-step visualization

**High — Floyd-Warshall's memory footprint scales as O(V³) per run, and
nothing warns the user before they hit it.** Each of the V+1
`matrix_update` events carries a full V×V matrix. At 100 nodes that is
roughly 1,000,000 numbers held across the run's event list; at 200 nodes
(the generator's own maximum) it's about 8,000,000. This has been a
documented "known limitation" in code comments since Day 8, but it was never
actually load-tested, and there's no user-facing warning before someone
generates a 150-node graph and picks Floyd-Warshall.
*Fix direction:* either warn in the UI when Floyd-Warshall + a large node
count are combined, or cap matrix-based algorithms' node count separately
from other algorithms. This is the single most concrete risk in this audit
and the natural first performance-milestone target.

**Medium — no visual distinction between "considering" and "committing."**
`relax_edge` and `add_to_mst`/`reject_edge` all render the same way regardless
of whether the algorithm is *examining* a possibility or *deciding* on it.
Kruskal's already distinguishes accept/reject visually; Dijkstra/Bellman-Ford
don't distinguish "this edge is being checked" from "this edge just improved
something," beyond the edge briefly flashing during `relax_edge`. This is
this audit's strongest argument for Milestone 4 (deeper explanation), covered
below.

## 5. Playback

**Low — no visible indicator of playback speed as a number**, only a slider
position. Minor, but a "0.5×" / "2×" style label costs little.

**Low (already caught, not re-flagging as new) — Floyd-Warshall progress in
the event log shows raw step numbers, not "waypoint 3 of 12."** Would help
orient a person during a long matrix run.

## 6. Analysis / representations

No high or medium findings. The adjacency matrix/list/edge-list panels and
the analysis panel are consistent, always-available, and match the graph
state directly — this part of the app has aged well since Day 3/4.

## 7. Quiz

**Low — quiz questions don't currently reuse a run already on screen.**
Starting a quiz always re-runs algorithms fresh even if you just finished
stepping through one manually. Functionally harmless (identical results
either way) but a very minor duplication of work, noted originally at Day 14
and still true.

## 8. Import / Export

No new findings beyond the Day 20b fixes (BOM/quotes, node layout). Worth
re-testing at genuinely large scale as part of the performance milestone
(see Phase 6 note below) — a 500-row CSV has never actually been tried.

## 9. Sharing

**Low (documented already) — URLs aren't compressed.** Still true, still
low-priority for hand-drawn or generator-sized graphs.

## 10. Accessibility

No new high-severity findings since the Day 18 pass. Worth a real screen
reader pass eventually (never done — Day 18's own retro said as much), but
nothing here contradicts what was already known.

## 11. Overall structure — the finding that matters most

**High — the app is one long vertical scroll of 14 always-mounted panels**,
with no navigation, tabs, or way to jump to a section. On desktop this is a
long scroll; on mobile (even after the Day 18 responsive pass, which made
individual panels not break, but didn't change the page's information
architecture) it is a very long one. A first-time user has to scroll past
the canvas, controls, playback, the Floyd-Warshall matrix view, the code-sync
panel, three representation panels, a quiz, a generator, import/export,
sharing, trace export, and a Union-Find demo — in that order — to discover
everything the app can do.
*Fix direction:* this is a real information-architecture decision, not a
one-line fix, and belongs in its own scoped milestone rather than being
patched incidentally. Options worth weighing: collapsible sections, a tabbed
layout (Draw / Run / Analyze / Learn), or a persistent sidebar nav. This
should be decided deliberately, not squeezed in as a side effect of some
other change.

## Summary — ranked

| # | Finding | Severity | Area |
|---|---|---|---|
| 1 | One long scroll, no navigation | High | Structure |
| 2 | Floyd-Warshall memory risk, unwarned | High | Performance |
| 3 | Pending edge weight invisible at click time | Medium | Graph creation |
| 4 | Two weight-editing UIs, unexplained | Medium | Graph editing |
| 5 | Algorithm picker doesn't show requirement mismatches up front | Medium | Algorithm selection |
| 6 | No "considering vs. deciding" visual distinction | Medium | Visualization |
| 7 | Flat algorithm list, no grouping | Low | Algorithm selection |
| 8 | Everything else in this document | Low | Various |
