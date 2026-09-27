/**
 * Collapsible section (Milestone 3): groups related panels under one
 * expandable header, so the page is a handful of named sections instead of
 * every panel stacked in one long, unlabelled scroll (the audit's top
 * finding). Purely presentational — it has no idea what's inside it, so
 * grouping panels differently later is a one-line change in App.tsx, not a
 * change to this component.
 */
import { useId, useState } from 'react'
import type { ReactNode } from 'react'

export default function CollapsibleSection({
  title,
  defaultExpanded = false,
  children,
}: {
  title: string
  defaultExpanded?: boolean
  children: ReactNode
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const contentId = useId()

  return (
    <section className="collapsible-section">
      <button
        type="button"
        className="collapsible-header"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => setExpanded((e) => !e)}
      >
        <span className={expanded ? 'collapsible-caret collapsible-caret--open' : 'collapsible-caret'} aria-hidden="true">
          ▶
        </span>
        {title}
      </button>
      {expanded && (
        <div id={contentId} className="collapsible-content">
          {children}
        </div>
      )}
    </section>
  )
}
