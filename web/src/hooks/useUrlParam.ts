// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-14. Reviewed and owned by team AETHER.
//
// Keeps one query parameter (e.g. ?variable=ndvi&cell=r03c07) in sync with view state, so any view can be shared
// as a link. The app has a single route ("/"); its state lives in the query string.

import { useCallback, useEffect, useState } from 'react'

function read(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name)
}

export function useUrlParam(name: string): [string | null, (value: string | null) => void] {
  const [value, setValue] = useState<string | null>(() => read(name))

  useEffect(() => {
    const onPop = () => setValue(read(name))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [name])

  const update = useCallback(
    (next: string | null) => {
      const params = new URLSearchParams(window.location.search)
      if (next === null) params.delete(name)
      else params.set(name, next)
      const query = params.toString()
      window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`)
      setValue(next)
    },
    [name],
  )

  return [value, update]
}
