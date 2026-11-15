// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
//
// Top bar: the name, the four views (?view=map|trends|checks|method) as real links, the sample-data notice. For the pitch, use the
// browser zoom (Ctrl +). A click on a view pushes one history entry (so Back and Forward work); the app then moves focus
// to <main>. On phones the views take a second row that scrolls sideways.

import type { MouseEvent } from 'react'
import type { Manifest } from '../../shared/contracts.ts'
import { APP_VIEWS, type AppView } from '../lib/viewState.ts'
import { DataStatusBanner } from './DataStatusBanner.tsx'

interface Props {
  manifest: Manifest | null
  view: AppView
  /** Link target of a view, so "open in a new tab" and copy link work. */
  hrefFor: (view: AppView) => string
  onNavigate: (view: AppView) => void
}

export function TopBar({ manifest, view, hrefFor, onNavigate }: Props) {
  const go = (event: MouseEvent<HTMLAnchorElement>, target: AppView) => {
    // Let the browser handle new-tab and new-window clicks.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onNavigate(target)
  }
  return (
    <header className="topbar">
      <div className="brand">
        <p className="logo">SIGNO</p>
        <span className="case-title">Amazon vegetation, fire and climate, 2001–2025</span>
      </div>
      <nav className="viewnav" aria-label="Views">
        {APP_VIEWS.map((v) => (
          <a
            key={v.id}
            href={hrefFor(v.id)}
            className="viewlink"
            aria-current={v.id === view ? 'page' : undefined}
            onClick={(event) => go(event, v.id)}
          >
            {v.label}
          </a>
        ))}
      </nav>
      <div className="topactions">
        {manifest && <DataStatusBanner status={manifest.dataStatus} />}
      </div>
    </header>
  )
}
