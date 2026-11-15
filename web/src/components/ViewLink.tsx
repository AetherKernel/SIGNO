// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
//
// A link to another view of the app (?view=…) that works as a normal link (new tab, copy link) and, on a plain click,
// changes the view without reloading the page: one history entry, so Back returns here.

import type { ReactNode } from 'react'
import { updateUrl } from '../hooks/useUrlParam.ts'
import type { AppView } from '../lib/viewState.ts'

interface Props {
  view: AppView
  /** Anchor inside the view, without "#" (e.g. "trend-test"). */
  hash?: string
  /** More parameters to set at the same time (e.g. { var: 'evi' }). */
  params?: Record<string, string>
  className?: string
  children: ReactNode
}

export function ViewLink({ view, hash, params = {}, className, children }: Props) {
  const query = new URLSearchParams({ view, ...params }).toString()
  return (
    <a
      href={`?${query}${hash ? `#${hash}` : ''}`}
      className={className}
      onClick={(event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        event.preventDefault()
        updateUrl({ view, cell: null, from: null, to: null, ...params }, { push: true, hash })
      }}
    >
      {children}
    </a>
  )
}
