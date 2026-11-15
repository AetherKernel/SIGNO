// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-14; useUrlParams with history push added 2026-11-15.
// Reviewed and owned by team AETHER.
//
// Keeps the query string (e.g. ?view=map&map=loss&year=2014&cell=r08c09) in sync with view state, so any view can be
// shared as a link. The app has a single route ("/"); its state lives in the query string. Every hook reads the same
// source (window.location), so a change made by one component is seen by all of them, and Back/Forward work.
//   - replace (default): a refinement of the same view (year, opacity, map moves). No new history entry.
//   - push: a new place to go back to (changing view, opening or closing an area).

import { useCallback, useMemo, useSyncExternalStore } from 'react'

const CHANGE_EVENT = 'signo:urlchange'

function subscribe(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange)
  window.addEventListener(CHANGE_EVENT, onChange)
  return () => {
    window.removeEventListener('popstate', onChange)
    window.removeEventListener(CHANGE_EVENT, onChange)
  }
}

const getSearch = () => window.location.search
const getServerSearch = () => ''

export interface SetParamsOptions {
  /** Add a history entry (Back returns to the previous state). Default: replace the current entry. */
  push?: boolean
  /** Fragment to set (e.g. "trend-test"); default: none. */
  hash?: string
}

/** A set of changes: a string sets the key, null removes it. */
export type ParamsPatch = Record<string, string | null>

/** Applies a patch to the current URL. Does nothing when the URL would not change. */
export function updateUrl(patch: ParamsPatch, options: SetParamsOptions = {}): void {
  const params = new URLSearchParams(window.location.search)
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) params.delete(key)
    else params.set(key, value)
  }
  const query = params.toString()
  const hash = options.hash ? `#${options.hash}` : ''
  const next = `${window.location.pathname}${query ? `?${query}` : ''}${hash}`
  if (next === `${window.location.pathname}${window.location.search}${window.location.hash}`) return
  if (options.push) window.history.pushState(null, '', next)
  else window.history.replaceState(null, '', next)
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

/** All query parameters, and one function that changes several of them in a single history entry. */
export function useUrlParams(): [URLSearchParams, (patch: ParamsPatch, options?: SetParamsOptions) => void] {
  const search = useSyncExternalStore(subscribe, getSearch, getServerSearch)
  const params = useMemo(() => new URLSearchParams(search), [search])
  const setParams = useCallback((patch: ParamsPatch, options?: SetParamsOptions) => updateUrl(patch, options), [])
  return [params, setParams]
}

/** One query parameter. */
export function useUrlParam(name: string): [string | null, (value: string | null, options?: SetParamsOptions) => void] {
  const [params, setParams] = useUrlParams()
  const update = useCallback(
    (next: string | null, options?: SetParamsOptions) => setParams({ [name]: next }, options),
    [name, setParams],
  )
  return [params.get(name), update]
}
