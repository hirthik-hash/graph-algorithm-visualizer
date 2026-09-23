/**
 * Share-link panel (Day 17). No backend: the graph lives entirely in the URL
 * (see model/urlShare.ts). On mount, if the current page URL already carries
 * a share link, the graph is loaded from it once — this is how opening
 * someone else's link works.
 */
import { useEffect, useRef, useState } from 'react'
import { buildShareUrl, readGraphFromUrl } from '../model/urlShare'
import { useGraphStore } from './graphStore'

export default function ShareLinkPanel() {
  const graph = useGraphStore((s) => s.graph)
  const replaceGraph = useGraphStore((s) => s.replaceGraph)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loadedFromUrl = useRef(false)

  // Runs once, when the page (or a pasted share link) first loads.
  useEffect(() => {
    if (loadedFromUrl.current) return
    loadedFromUrl.current = true
    try {
      const shared = readGraphFromUrl(window.location.href)
      if (shared !== null) {
        replaceGraph(shared)
        // Clean the URL so refreshing or sharing it again doesn't re-encode a re-encoded link.
        window.history.replaceState(null, '', window.location.pathname)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
    // replaceGraph is a stable Zustand action; this effect is meant to run once, on mount only.
  }, [])

  const copyLink = async () => {
    setError(null)
    try {
      const url = buildShareUrl(graph, window.location.href)
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build or copy the share link.')
    }
  }

  return (
    <section className="panel share-link">
      <h2>Share this graph</h2>
      <p className="hint">Copies a link that opens with this exact graph already loaded — no account or server needed.</p>
      <button onClick={copyLink}>{copied ? 'Copied!' : 'Copy share link'}</button>
      {error && <p className="notice" role="alert">{error}</p>}
    </section>
  )
}
