import { describe, expect, it } from 'vitest'
import { addEdge, addNode, createGraph } from './graph'
import type { Graph } from './graph'
import { disconnectedGraph, parallelEdgesGraph, selfLoopGraph, singleNodeGraph } from '../test/fixtures'
import {
  buildShareUrl,
  decodeGraphFromUrlParam,
  encodeGraphToUrlParam,
  readGraphFromUrl,
  SHARE_PARAM,
} from './urlShare'

function triangle(): Graph {
  let g = createGraph({ weighted: true })
  g = addNode(addNode(addNode(g, { id: 'A', x: 10, y: 20 }), { id: 'B', label: 'Beta' }), { id: 'C' })
  g = addEdge(g, { id: 'e1', source: 'A', target: 'B', weight: 2 })
  g = addEdge(g, { id: 'e2', source: 'B', target: 'C', weight: 5 })
  return g
}

describe('encode/decode round trip', () => {
  it('round-trips a graph exactly, including positions, labels and weights', () => {
    const g = triangle()
    expect(decodeGraphFromUrlParam(encodeGraphToUrlParam(g))).toEqual(g)
  })

  it('round-trips every shared fixture', () => {
    for (const build of [disconnectedGraph, singleNodeGraph, selfLoopGraph, parallelEdgesGraph]) {
      const g = build()
      expect(decodeGraphFromUrlParam(encodeGraphToUrlParam(g))).toEqual(g)
    }
  })

  it('round-trips unicode labels correctly', () => {
    let g = createGraph()
    g = addNode(g, { id: 'A', label: 'Café — Zürich 東京' })
    expect(decodeGraphFromUrlParam(encodeGraphToUrlParam(g)).nodes[0].label).toBe('Café — Zürich 東京')
  })

  it('produces a value with no characters that need escaping in a URL query string', () => {
    const encoded = encodeGraphToUrlParam(triangle())
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(encodeURIComponent(encoded)).toBe(encoded) // nothing in it needed encoding
  })

  it('rejects a corrupted or truncated param instead of returning garbage', () => {
    const encoded = encodeGraphToUrlParam(triangle())
    expect(() => decodeGraphFromUrlParam(encoded.slice(0, -5))).toThrow()
    expect(() => decodeGraphFromUrlParam('not!!!valid***base64')).toThrow()
  })
})

describe('buildShareUrl / readGraphFromUrl', () => {
  it('builds a URL that readGraphFromUrl decodes back to the same graph', () => {
    const g = triangle()
    const url = buildShareUrl(g, 'https://example.com/app')
    expect(url.startsWith('https://example.com/app?g=')).toBe(true)
    expect(readGraphFromUrl(url)).toEqual(g)
  })

  it('strips any existing query string or hash from the base URL', () => {
    const url = buildShareUrl(singleNodeGraph(), 'https://example.com/app?old=1#section')
    expect(url).not.toContain('old=1')
    expect(url).not.toContain('#section')
    const params = new URL(url).searchParams
    expect([...params.keys()]).toEqual([SHARE_PARAM])
  })

  it('returns null when the URL has no share parameter, without throwing', () => {
    expect(readGraphFromUrl('https://example.com/app')).toBeNull()
    expect(readGraphFromUrl('https://example.com/app?other=1')).toBeNull()
  })

  it('a link built for one graph never gets confused with a link built for another', () => {
    const urlA = buildShareUrl(triangle(), 'https://example.com/app')
    const urlB = buildShareUrl(singleNodeGraph(), 'https://example.com/app')
    expect(readGraphFromUrl(urlA)).toEqual(triangle())
    expect(readGraphFromUrl(urlB)).toEqual(singleNodeGraph())
  })
})
