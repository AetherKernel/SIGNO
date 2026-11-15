// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
//
// Views loaded on demand (Trends, Cross-checks, Method & sources) live in their own files whose names change with each
// deploy. A tab opened before a deploy still asks for the old names, which no longer exist (404), and React.lazy would
// leave a blank page. lazyView reloads the page once to get the new files; if loading fails again within a minute
// (the network is down, or the file is really missing) it shows the fallback instead of reloading in a loop.

import { lazy, type ComponentType } from 'react'

const KEY = 'signo.viewReloadAt'
const WINDOW_MS = 60_000

function reloadedRecently(): boolean {
  try {
    const at = Number(window.sessionStorage.getItem(KEY))
    return Number.isFinite(at) && Date.now() - at < WINDOW_MS
  } catch {
    return true // no storage (private mode): never risk a reload loop
  }
}

function markReload(): void {
  try {
    window.sessionStorage.setItem(KEY, String(Date.now()))
  } catch {
    /* ignored: reloadedRecently() already returns true without storage */
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyView<P extends Record<string, any>>(
  load: () => Promise<ComponentType<P>>,
  fallback: ComponentType<P>,
) {
  return lazy(async () => {
    try {
      return { default: await load() }
    } catch {
      if (!reloadedRecently()) {
        markReload()
        window.location.reload()
        // The page is reloading: never settle, so nothing renders in between.
        return new Promise<{ default: ComponentType<P> }>(() => {})
      }
      return { default: fallback }
    }
  })
}
