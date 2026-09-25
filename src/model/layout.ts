/**
 * Circular layout (Day 20 fix): shared by the random generator (Day 12) and
 * the adjacency-matrix / adjacency-list / CSV importers (Day 16), so every
 * code path that creates nodes without the user placing them by hand puts
 * them somewhere visible and spread out.
 *
 * Before this fix, the three text-based importers called addNode with no
 * x/y at all, so every imported node defaulted to (0, 0) in GraphCanvas and
 * landed stacked in the top-left corner, off or at the very edge of the
 * visible canvas. JSON import is NOT run through this: it carries real
 * positions from whatever exported it, and overwriting those with a fresh
 * layout would be wrong.
 */
export interface LayoutPoint {
  x: number
  y: number
}

const CENTER_X = 400
const CENTER_Y = 250
const RADIUS = 210

/** One point per index, evenly spaced around a circle. A single node is placed at the center. */
export function circleLayout(count: number): LayoutPoint[] {
  return Array.from({ length: count }, (_, i) => {
    if (count === 1) return { x: CENTER_X, y: CENTER_Y }
    const angle = (2 * Math.PI * i) / count - Math.PI / 2
    return {
      x: Math.round(CENTER_X + RADIUS * Math.cos(angle)),
      y: Math.round(CENTER_Y + RADIUS * Math.sin(angle)),
    }
  })
}
