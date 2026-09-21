/**
 * Union-Find mini-visualizer (Day 8). Completely independent of the graph and
 * of every graph algorithm: it just lets you poke at the data structure.
 * Each operation works on a CLONE of the structure, so React state stays
 * immutable even though UnionFind itself is a mutable class.
 */
import { useState } from 'react'
import { UnionFind } from '../algorithms/unionFind'

const ELEMENTS = Array.from({ length: 8 }, (_, i) => String(i))
const MAX_LOG = 8

function initialState() {
  return { uf: new UnionFind(ELEMENTS), log: [] as string[] }
}

export default function UnionFindDemo() {
  const [{ uf, log }, setState] = useState(initialState)
  const [a, setA] = useState('0')
  const [b, setB] = useState('1')

  const apply = (operation: (next: UnionFind) => string) => {
    const next = uf.clone()
    const message = operation(next)
    setState({ uf: next, log: [message, ...log].slice(0, MAX_LOG) })
  }

  const doUnion = () =>
    apply((next) => {
      const r = next.union(a, b)
      return r.merged
        ? `union(${a}, ${b}): merged — root ${r.attachedRoot} now points to ${r.root}`
        : `union(${a}, ${b}): already in the same set (root ${r.root})`
    })

  const doFind = () =>
    apply((next) => {
      const path = next.findPath(a)
      const root = next.find(a)
      const compressed = path.length > 2 ? ` — path ${path.join(' → ')} compressed to point at ${root}` : ''
      return `find(${a}): root is ${root}${compressed}`
    })

  const select = (value: string, onChange: (v: string) => void, label: string) => (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      {ELEMENTS.map((id) => (
        <option key={id} value={id}>
          {id}
        </option>
      ))}
    </select>
  )

  return (
    <section className="panel uf-demo">
      <h2>Union-Find playground</h2>
      <div className="row">
        {select(a, setA, 'First element')}
        {select(b, setB, 'Second element')}
        <button onClick={doUnion}>Union</button>
        <button onClick={doFind}>Find (first)</button>
        <button onClick={() => setState(initialState())}>Reset</button>
      </div>

      <div className="uf-grid">
        <table className="edge-table">
          <thead>
            <tr>
              <th>Element</th>
              <th>Parent</th>
              <th>Rank</th>
            </tr>
          </thead>
          <tbody>
            {uf.entries().map((entry) => (
              <tr key={entry.id} className={entry.parent === entry.id ? 'uf-root' : ''}>
                <td>{entry.id}</td>
                <td>{entry.parent === entry.id ? 'root' : entry.parent}</td>
                <td>{entry.rank}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div>
          <p className="fact">
            {uf.componentCount} set{uf.componentCount === 1 ? '' : 's'}
          </p>
          <ul className="plain-list">
            {uf.sets().map((set) => (
              <li key={set[0]}>{`{ ${set.join(', ')} }`}</li>
            ))}
          </ul>
          <ul className="plain-list uf-log" aria-label="Operation log">
            {log.map((entry, i) => (
              <li key={`${i}-${entry}`}>{entry}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
