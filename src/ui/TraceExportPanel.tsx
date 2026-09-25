/**
 * Trace / image export panel (Day 17; popup fallback added Day 20).
 *
 * Two exports, both using only the browser's own capabilities (no PDF
 * library was added — the stack decisions at the top of this project are
 * fixed, and a client-side PDF generator would be a new dependency that
 * changes the size of every future build for a rarely-used feature):
 *
 *  - "Export trace as PDF" builds a plain HTML report (buildTraceReport,
 *    Day 17) in a new tab and calls the browser's native print dialog, where
 *    "Save as PDF" is a standard destination in every major browser. The
 *    generated page has print-only styling (see the <style> block below) so
 *    it prints cleanly without the rest of the app's chrome. If the browser
 *    blocks the pop-up (common with a strict pop-up blocker, since this is
 *    triggered from a click handler but goes through an async report build
 *    first), the same HTML is downloaded as a .html file instead, so the
 *    person still gets something usable: opening it and printing from their
 *    own browser has the identical "Save as PDF" option.
 *  - "Export canvas as PNG" serializes the current SVG canvas, draws it onto
 *    an off-screen <canvas>, and downloads that as a PNG. This only captures
 *    the current step's snapshot, not the whole trace — the PDF report is
 *    what covers "the whole trace" as text.
 */
import { buildTraceReport } from '../engine/traceReport'
import type { TraceReport } from '../engine/traceReport'
import { usePlaybackStore } from './playbackStore'
import { useGraphStore } from './graphStore'

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

function buildReportHtml(report: TraceReport): string {
  const rows = report.steps
    .map((s) => `<li><span class="step-num">${s.index}.</span> ${escapeHtml(s.description)}</li>`)
    .join('\n')
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(report.title)}</title>
<style>
  body { font-family: system-ui, sans-serif; padding: 24px; color: #111; }
  h1 { font-size: 18px; }
  .meta { color: #555; font-size: 13px; margin-bottom: 16px; }
  ol { padding-left: 0; list-style: none; }
  li { padding: 4px 0; border-bottom: 1px solid #eee; font-size: 13px; }
  .step-num { color: #888; margin-right: 6px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <h1>${escapeHtml(report.title)}</h1>
  <p class="meta">${report.nodeCount} nodes, ${report.edgeCount} edges, ${report.stepCount} steps</p>
  <ol>${rows}</ol>
</body>
</html>`
}

function downloadReportHtml(html: string) {
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'trace-report.html'
  link.click()
  URL.revokeObjectURL(url)
}

function exportTraceAsPdf(title: string, graph: ReturnType<typeof useGraphStore.getState>['graph'], events: Parameters<typeof buildTraceReport>[2]) {
  const report = buildTraceReport(title, graph, events)
  const html = buildReportHtml(report)
  const printWindow = window.open('', '_blank', 'noopener,noreferrer')
  if (!printWindow) {
    // Pop-up blocked: the person still gets a usable report, just one extra
    // click away from printing, instead of nothing.
    downloadReportHtml(html)
    window.alert(
      'Your browser blocked the print window, so the report was downloaded as an HTML file instead. ' +
        'Open it and use your browser\'s own "Print… → Save as PDF" to get a PDF.',
    )
    return
  }
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()

}

function exportCanvasAsPng() {
  const svg = document.getElementById('graph-canvas-svg') as SVGSVGElement | null
  if (!svg) return
  const viewBox = svg.viewBox.baseVal
  const width = viewBox.width || svg.clientWidth || 800
  const height = viewBox.height || svg.clientHeight || 500

  const svgString = new XMLSerializer().serializeToString(svg)
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)

  const image = new Image()
  image.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = getComputedStyle(document.body).backgroundColor || '#ffffff'
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(image, 0, 0, width, height)
      canvas.toBlob((blob) => {
        if (!blob) return
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = 'graph.png'
        link.click()
      }, 'image/png')
    }
    URL.revokeObjectURL(url)
  }
  image.onerror = () => URL.revokeObjectURL(url)
  image.src = url
}

export default function TraceExportPanel() {
  const algorithm = usePlaybackStore((s) => s.algorithm)
  const engine = usePlaybackStore((s) => s.engine)
  const graph = useGraphStore((s) => s.graph)

  const canExportTrace = algorithm !== null && engine !== null && engine.length > 0

  return (
    <section className="panel trace-export">
      <h2>Export</h2>
      <div className="row">
        <button
          onClick={() => algorithm && engine && exportTraceAsPdf(algorithm.name, graph, engine.events)}
          disabled={!canExportTrace}
        >
          Export trace as PDF
        </button>
        <button onClick={exportCanvasAsPng} disabled={graph.nodes.length === 0}>
          Export canvas as PNG
        </button>
      </div>
      {!canExportTrace && <p className="hint">Run an algorithm first to export its trace.</p>}
    </section>
  )
}
