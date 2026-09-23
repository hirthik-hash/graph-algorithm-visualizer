/**
 * URL sharing (Day 17, part 2 of the original Day 22 scope). No backend: the
 * whole graph is encoded into a URL query parameter, so a link IS the save
 * file. Reuses exportGraphToJson/importGraphFromJson underneath (Day 16), so
 * sharing inherits the exact same validation and round-trip guarantees rather
 * than re-implementing them.
 *
 * Encoding: JSON -> UTF-8 bytes -> base64url (the URL-safe base64 variant: +
 * and / replaced, no padding), so the result is safe to drop straight into a
 * query string with no further escaping.
 *
 * KNOWN LIMITATION: this does not compress the JSON, so a large or heavily
 * co-ordinated graph produces a long URL. Browsers and most servers tolerate
 * URLs well into the tens of thousands of characters, so this is fine for
 * anything you'd reasonably draw by hand or generate in the editor, but it
 * isn't a general-purpose compact encoding.
 */
import { exportGraphToJson, importGraphFromJson } from './serialize'
import type { Graph } from './graph'

export const SHARE_PARAM = 'g'

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(param: string): string {
  const normalized = param.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  let binary: string
  try {
    binary = atob(padded)
  } catch {
    throw new Error('That share link looks corrupted (could not decode it).')
  }
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

/** Encodes a graph into a value safe to use as a URL query parameter. */
export function encodeGraphToUrlParam(graph: Graph): string {
  return toBase64Url(exportGraphToJson(graph))
}

/** Decodes a value produced by encodeGraphToUrlParam back into a graph, with the same validation Day 16's JSON import applies. */
export function decodeGraphFromUrlParam(param: string): Graph {
  return importGraphFromJson(fromBase64Url(param))
}

/**
 * Builds a shareable URL: `baseUrl` with the graph attached under
 * `SHARE_PARAM`, and any existing query/hash on `baseUrl` discarded, since a
 * share link should point at a clean load of the page.
 */
export function buildShareUrl(graph: Graph, baseUrl: string): string {
  const url = new URL(baseUrl)
  url.search = ''
  url.hash = ''
  url.searchParams.set(SHARE_PARAM, encodeGraphToUrlParam(graph))
  return url.toString()
}

/** Extracts and decodes the graph from a URL's query string, or null if there isn't one. */
export function readGraphFromUrl(url: string): Graph | null {
  const value = new URL(url).searchParams.get(SHARE_PARAM)
  return value === null ? null : decodeGraphFromUrlParam(value)
}
