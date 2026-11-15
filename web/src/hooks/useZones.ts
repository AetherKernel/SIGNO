// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
//
// Loads zones.json for the Trends view. The request is cancelled when the view unmounts; `retry` asks again after an error.

import { useCallback, useEffect, useState } from 'react'
import type { ZonesReport } from '../../shared/contracts.ts'
import { zonesApi } from '../services/zonesApi.ts'
import type { Remote } from './useSignoData.ts'

export function useZones(enabled: boolean): Remote<ZonesReport> & { retry: () => void } {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<{ attempt: number; data: ZonesReport | null; error: string | null } | null>(null)

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    zonesApi
      .getZones(controller.signal)
      .then((data) => setState({ attempt, data, error: null }))
      .catch((error: Error) => {
        if (error.name !== 'AbortError') setState({ attempt, data: null, error: error.message })
      })
    return () => controller.abort()
  }, [enabled, attempt])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  const current = enabled && state !== null && state.attempt === attempt
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    loading: enabled && !current,
    retry,
  }
}
