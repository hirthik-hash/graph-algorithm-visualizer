import './App.css'
import AnalysisPanel from './ui/AnalysisPanel'
import GraphCanvas from './ui/GraphCanvas'
import CodeSyncPanel from './ui/CodeSyncPanel'
import ComparisonPanel from './ui/ComparisonPanel'
import FloydWarshallView from './ui/FloydWarshallView'
import GraphControls from './ui/GraphControls'
import PlaybackControls from './ui/PlaybackControls'
import GeneratorPanel from './ui/GeneratorPanel'
import QuizPanel from './ui/QuizPanel'
import RepresentationPanels from './ui/RepresentationPanels'
import UnionFindDemo from './ui/UnionFindDemo'
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
          <FloydWarshallView />
          <CodeSyncPanel />
        </div>
        <GraphControls />
      </div>

      <AnalysisPanel />

      <RepresentationPanels />

      <GeneratorPanel />

      <ComparisonPanel />

      <QuizPanel />

      <UnionFindDemo />
    </main>
  )
}
