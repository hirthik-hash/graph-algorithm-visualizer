import './App.css'
import AnalysisPanel from './ui/AnalysisPanel'
import GraphCanvas from './ui/GraphCanvas'
import GraphControls from './ui/GraphControls'
import PlaybackControls from './ui/PlaybackControls'
import RepresentationPanels from './ui/RepresentationPanels'
import { useGraphStore } from './ui/graphStore'

export default function App() {
  const notice = useGraphStore((s) => s.notice)
  const dismissNotice = useGraphStore((s) => s.dismissNotice)
  const nodeCount = useGraphStore((s) => s.graph.nodes.length)
  const edgeCount = useGraphStore((s) => s.graph.edges.length)

  return (
    <main className="app">
      <h1>Graph Algorithm Visualizer</h1>

      {notice && (
        <p role="alert" className="notice">
          {notice}{' '}
          <button onClick={dismissNotice} aria-label="Dismiss message">
            ×
          </button>
        </p>
      )}

      <div className="layout">
        <div>
          <GraphCanvas />
          <p className="hint">
            Click empty space to add a node · drag a node to move it · click a node, then another, to connect them ·
            click a node twice quickly to delete it · {nodeCount} nodes, {edgeCount} edges
          </p>
          <PlaybackControls />
        </div>
        <GraphControls />
      </div>

      <AnalysisPanel />

      <RepresentationPanels />
    </main>
  )
}
