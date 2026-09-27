import './App.css'
import AnalysisPanel from './ui/AnalysisPanel'
import CodeSyncPanel from './ui/CodeSyncPanel'
import CollapsibleSection from './ui/CollapsibleSection'
import ComparisonPanel from './ui/ComparisonPanel'
import FloydWarshallView from './ui/FloydWarshallView'
import GeneratorPanel from './ui/GeneratorPanel'
import GraphCanvas from './ui/GraphCanvas'
import GraphControls from './ui/GraphControls'
import ImportExportPanel from './ui/ImportExportPanel'
import PlaybackControls from './ui/PlaybackControls'
import QuizPanel from './ui/QuizPanel'
import RepresentationPanels from './ui/RepresentationPanels'
import ShareLinkPanel from './ui/ShareLinkPanel'
import TraceExportPanel from './ui/TraceExportPanel'
import UnionFindDemo from './ui/UnionFindDemo'
import { useGraphStore } from './ui/graphStore'

/**
 * Milestone 3: the canvas stays always visible at the top — collapsing it
 * along with whichever section happens to be open would hide the one thing
 * every other section refers back to. Everything else is grouped into five
 * named, collapsible sections (Graph / Algorithms / Analysis / Learning /
 * Tools), matching the categories chosen during the audit review, instead of
 * fourteen panels stacked in one undifferentiated scroll. Graph and
 * Algorithms default open, since drawing and running are the core loop;
 * Analysis, Learning and Tools default closed as secondary/supporting.
 */
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

      <GraphCanvas />
      <p className="hint">
        Click empty space to add a node · drag a node to move it · click a node, then another, to connect them ·
        click a node twice quickly to delete it · {nodeCount} nodes, {edgeCount} edges
      </p>

      <CollapsibleSection title="Graph" defaultExpanded>
        <GraphControls />
        <ImportExportPanel />
      </CollapsibleSection>

      <CollapsibleSection title="Algorithms" defaultExpanded>
        <PlaybackControls />
        <FloydWarshallView />
        <ComparisonPanel />
      </CollapsibleSection>

      <CollapsibleSection title="Analysis">
        <AnalysisPanel />
        <RepresentationPanels />
        <CodeSyncPanel />
      </CollapsibleSection>

      <CollapsibleSection title="Learning">
        <QuizPanel />
        <UnionFindDemo />
      </CollapsibleSection>

      <CollapsibleSection title="Tools">
        <GeneratorPanel />
        <ShareLinkPanel />
        <TraceExportPanel />
      </CollapsibleSection>
    </main>
  )
}
