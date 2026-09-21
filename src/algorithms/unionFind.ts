/**
 * Union-Find / disjoint sets (Day 8). Standalone: it knows nothing about
 * graphs or events. Kruskal's algorithm will use it on a later day.
 *
 *  - Path compression: find() re-points every node on the path straight at the
 *    root, so later finds are nearly O(1).
 *  - Union by rank: the shallower tree is attached under the deeper one, which
 *    keeps trees short. On a tie the FIRST argument's root wins.
 *
 * find() is iterative (two passes), so a deep chain can't overflow the call stack.
 */

export interface UnionResult {
  /** false when both elements were already in the same set. */
  merged: boolean
  /** The root of the combined set. */
  root: string
  /** The root that was attached under `root` (only when merged). */
  attachedRoot?: string
}

export interface UnionFindEntry {
  id: string
  parent: string
  rank: number
}

export class UnionFind {
  private readonly parent = new Map<string, string>()
  private readonly rank = new Map<string, number>()
  private components: number

  constructor(private readonly ids: readonly string[]) {
    for (const id of ids) {
      if (this.parent.has(id)) throw new Error(`Duplicate element: "${id}"`)
      this.parent.set(id, id)
      this.rank.set(id, 0)
    }
    this.components = ids.length
  }

  get componentCount(): number {
    return this.components
  }

  has(id: string): boolean {
    return this.parent.has(id)
  }

  private require(id: string): void {
    if (!this.parent.has(id)) throw new Error(`Unknown element: "${id}"`)
  }

  /** The chain from `id` up to its root, without changing anything. */
  findPath(id: string): string[] {
    this.require(id)
    const path = [id]
    for (let cur = id; this.parent.get(cur) !== cur; ) {
      cur = this.parent.get(cur)!
      path.push(cur)
    }
    return path
  }

  find(id: string): string {
    const path = this.findPath(id)
    const root = path[path.length - 1]
    for (const node of path) this.parent.set(node, root) // path compression
    return root
  }

  connected(a: string, b: string): boolean {
    return this.find(a) === this.find(b)
  }

  union(a: string, b: string): UnionResult {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra === rb) return { merged: false, root: ra }

    const rankA = this.rank.get(ra)!
    const rankB = this.rank.get(rb)!
    let root: string
    let attachedRoot: string
    if (rankA < rankB) {
      root = rb
      attachedRoot = ra
    } else {
      root = ra
      attachedRoot = rb
      if (rankA === rankB) this.rank.set(ra, rankA + 1)
    }
    this.parent.set(attachedRoot, root)
    this.components--
    return { merged: true, root, attachedRoot }
  }

  /** All sets: members and sets both ordered by the original element order. */
  sets(): string[][] {
    const bySet = new Map<string, string[]>()
    for (const id of this.ids) {
      const root = this.find(id)
      const members = bySet.get(root)
      if (members) members.push(id)
      else bySet.set(root, [id])
    }
    return [...bySet.values()]
  }

  /** Current parent pointer and rank of every element, in original order. */
  entries(): UnionFindEntry[] {
    return this.ids.map((id) => ({ id, parent: this.parent.get(id)!, rank: this.rank.get(id)! }))
  }

  clone(): UnionFind {
    const copy = new UnionFind(this.ids)
    for (const [k, v] of this.parent) copy.parent.set(k, v)
    for (const [k, v] of this.rank) copy.rank.set(k, v)
    copy.components = this.components
    return copy
  }
}
