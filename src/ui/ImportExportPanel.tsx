/**
 * Import / export panel (Day 16). A thin UI over model/serialize.ts: it never
 * parses anything itself, only calls a parser and hands the result to
 * replaceGraph, or calls an exporter and triggers a download/copy.
 */
import { useRef, useState } from 'react'
import {
  exportAdjacencyListText,
  exportCsvEdgeList,
  exportGraphToJson,
  importGraphFromJson,
  parseAdjacencyList,
  parseAdjacencyMatrix,
  parseCsvEdgeList,
} from '../model/serialize'
import { useGraphStore } from './graphStore'

type ImportFormat = 'json' | 'matrix' | 'list' | 'csv'

const FORMAT_LABEL: Record<ImportFormat, string> = {
  json: 'JSON',
  matrix: 'Adjacency matrix',
  list: 'Adjacency list',
  csv: 'CSV edge list',
}

const FORMAT_PLACEHOLDER: Record<ImportFormat, string> = {
  json: '{ "schemaVersion": 1, "directed": false, ... }',
  matrix: '- 4 -\n4 - 2\n- 2 -',
  list: 'A: B(4)\nB: A(4), C(2)\nC: B(2)',
  csv: 'source,target,weight\nA,B,4\nB,C,2',
}

function download(filename: string, contents: string, mimeType: string) {
  const blob = new Blob([contents], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function ImportExportPanel() {
  const graph = useGraphStore((s) => s.graph)
  const replaceGraph = useGraphStore((s) => s.replaceGraph)

  const [format, setFormat] = useState<ImportFormat>('json')
  const [directed, setDirected] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const exportJson = () => download('graph.json', exportGraphToJson(graph), 'application/json')
  const exportCsv = () => download('graph.csv', exportCsvEdgeList(graph), 'text/csv')

  const copyToClipboard = async (contents: string) => {
    try {
      await navigator.clipboard.writeText(contents)
    } catch {
      setError('Could not copy to the clipboard. Your browser may be blocking it.')
    }
  }

  const loadFromText = () => {
    setError(null)
    try {
      const parsed =
        format === 'json'
          ? importGraphFromJson(text)
          : format === 'matrix'
            ? parseAdjacencyMatrix(text, { directed })
            : format === 'list'
              ? parseAdjacencyList(text, { directed })
              : parseCsvEdgeList(text, { directed })
      replaceGraph(parsed)
      setText('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const loadFromFile = (file: File) => {
    setError(null)
    const reader = new FileReader()
    reader.onload = () => {
      try {
        replaceGraph(importGraphFromJson(String(reader.result)))
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    }
    reader.onerror = () => setError('Could not read that file.')
    reader.readAsText(file)
  }

  return (
    <section className="panel import-export">
      <h2>Import / export</h2>

      <div className="ie-column">
        <h3>Export the current graph</h3>
        <div className="row">
          <button onClick={exportJson}>Download JSON</button>
          <button onClick={() => copyToClipboard(exportGraphToJson(graph))}>Copy JSON</button>
          <button onClick={exportCsv}>Download CSV</button>
          <button onClick={() => copyToClipboard(exportAdjacencyListText(graph))}>Copy adjacency list</button>
        </div>
      </div>

      <div className="ie-column">
        <h3>Import a graph</h3>
        <div className="row">
          <select aria-label="Import format" value={format} onChange={(e) => setFormat(e.target.value as ImportFormat)}>
            {(Object.keys(FORMAT_LABEL) as ImportFormat[]).map((f) => (
              <option key={f} value={f}>
                {FORMAT_LABEL[f]}
              </option>
            ))}
          </select>
          {format !== 'json' && (
            <label className="row">
              <input type="checkbox" checked={directed} onChange={(e) => setDirected(e.target.checked)} />
              Directed
            </label>
          )}
          {format === 'json' && (
            <>
              <button onClick={() => fileInputRef.current?.click()}>Upload a .json file</button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="visually-hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) loadFromFile(file)
                  e.target.value = ''
                }}
              />
            </>
          )}
        </div>

        <textarea
          aria-label={`Paste ${FORMAT_LABEL[format]} here`}
          className="ie-textarea"
          placeholder={FORMAT_PLACEHOLDER[format]}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
        />
        {error && <p className="notice" role="alert">{error}</p>}
        <button onClick={loadFromText} disabled={text.trim() === ''}>
          Load
        </button>
        <p className="hint">Loading replaces the current graph on the canvas.</p>
      </div>
    </section>
  )
}
