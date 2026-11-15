// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15; one file per square (cells/{cellId}.json)
// instead of one series file per variable plus every trend layer, 2026-11-15. Reviewed and owned by team AETHER.
//
// Data of the cell viewer: for one square, the yearly values of every monthly variable and that square's trend result
// for each variable. Both come from the square's one API file, published by the backend from the same
// validated series and trend layers. A variable missing from the file only blanks its own rows; a failed file shows a
// Retry. The request is cancelled when the square changes. Nothing is computed here.

import { useCallback, useEffect, useState } from 'react'
import type { CellBundle, CellTrend, CellYearlySeries } from '../../shared/contracts.ts'
import { signoApi } from '../services/signoApi.ts'

/** One file: loading, loaded, or failed with a message. */
export type Slot<T> = { state: 'loading' } | { state: 'ready'; data: T } | { state: 'error'; message: string }

export interface CellProfile {
  /** Yearly values of this square, by variable id (the monthly points load on demand, from the series file). */
  series: Record<string, Slot<CellYearlySeries>>
  /** This square's row of each variable's trend layer (null = the layer has no row for it), by variable id. */
  trends: Record<string, Slot<CellTrend | null>>
  /** Load the square's file again after an error. */
  retry: () => void
}

type Loaded = { key: string } & ({ state: 'ready'; data: CellBundle } | { state: 'error'; message: string })

const message = (error: unknown) => (error instanceof Error ? error.message : 'Could not load the data.')

/** The variable's yearly values in the square's file, or null when the file has none for it. */
function seriesOf(bundle: CellBundle, variableId: string): CellYearlySeries | null {
  const v = bundle.variables[variableId]
  return v ? { variableId, cellId: bundle.cellId, units: v.units, annual: v.annual } : null
}

export function useCellProfile(cellId: string | null, variableIds: string[]): CellProfile {
  const [attempts, setAttempts] = useState(0)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const key = cellId ? `${cellId}|${attempts}` : ''

  useEffect(() => {
    if (!cellId) return
    const controller = new AbortController()
    signoApi
      .getCellBundle(cellId, controller.signal)
      .then((data) => setLoaded({ key, state: 'ready', data }))
      .catch((error: Error) => {
        if (error.name !== 'AbortError') setLoaded({ key, state: 'error', message: message(error) })
      })
    return () => controller.abort()
    // `key` identifies the square and the attempt (a Retry loads the file again).
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  const retry = useCallback(() => setAttempts((n) => n + 1), [])

  const current = loaded !== null && loaded.key === key ? loaded : null
  const series: Record<string, Slot<CellYearlySeries>> = {}
  const trends: Record<string, Slot<CellTrend | null>> = {}
  for (const id of variableIds) {
    if (!current) {
      series[id] = { state: 'loading' }
      trends[id] = { state: 'loading' }
    } else if (current.state === 'error') {
      series[id] = { state: 'error', message: current.message }
      trends[id] = { state: 'error', message: current.message }
    } else {
      const s = seriesOf(current.data, id)
      series[id] = s ? { state: 'ready', data: s } : { state: 'error', message: 'This area has no series for this measure.' }
      trends[id] = { state: 'ready', data: current.data.variables[id]?.trend ?? null }
    }
  }
  return { series, trends, retry }
}
