// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
//
// Data of the cell viewer: for one square, the series file of every monthly variable (its yearly values) and that
// square's trend result from each variable's trend layer. Each file loads on its own, so one failed file only blanks
// its own rows (with a Retry), never the whole viewer. Series requests are cancelled when the square changes; the trend
// layers (the same files the map uses) are shared and kept for the session. Nothing is computed here.

import { useCallback, useEffect, useState } from 'react'
import type { CellSeries, CellTrend, TrendLayer } from '../../shared/contracts.ts'
import { signoApi } from '../services/signoApi.ts'

/** One file: loading, loaded, or failed with a message. */
export type Slot<T> = { state: 'loading' } | { state: 'ready'; data: T } | { state: 'error'; message: string }

export interface CellProfile {
  /** Monthly series and yearly values of this square, by variable id. */
  series: Record<string, Slot<CellSeries>>
  /** This square's row of each variable's trend layer (null = the layer has no row for it), by variable id. */
  trends: Record<string, Slot<CellTrend | null>>
  /** Load the failed files again. */
  retry: () => void
}

const layers = new Map<string, Promise<TrendLayer>>()

function loadLayer(variableId: string): Promise<TrendLayer> {
  let layer = layers.get(variableId)
  if (!layer) {
    layer = signoApi.getTrendLayer(variableId)
    layers.set(variableId, layer)
    layer.catch(() => layers.delete(variableId))
  }
  return layer
}

interface State {
  key: string
  series: Record<string, Slot<CellSeries>>
  trends: Record<string, Slot<CellTrend | null>>
}

const message = (error: unknown) => (error instanceof Error ? error.message : 'Could not load the data.')

export function useCellProfile(cellId: string | null, variableIds: string[]): CellProfile {
  const [attempts, setAttempts] = useState(0)
  const [state, setState] = useState<State>({ key: '', series: {}, trends: {} })
  const ids = variableIds.join(',')
  const key = cellId ? `${cellId}|${ids}` : ''

  const patch = useCallback(
    (key: string, kind: 'series' | 'trends', id: string, slot: Slot<CellSeries> | Slot<CellTrend | null>) =>
      setState((current) => {
        const base = current.key === key ? current : { key, series: {}, trends: {} }
        return { ...base, [kind]: { ...base[kind], [id]: slot } }
      }),
    [],
  )

  useEffect(() => {
    if (!cellId) return
    const controller = new AbortController()
    let active = true // answers that arrive after the square changed are ignored
    const put = (kind: 'series' | 'trends', id: string, slot: Slot<CellSeries> | Slot<CellTrend | null>) => {
      if (active) patch(key, kind, id, slot)
    }
    for (const id of ids.split(',').filter(Boolean)) {
      signoApi
        .getCellSeries(id, cellId, controller.signal)
        .then((data) => put('series', id, { state: 'ready', data }))
        .catch((error: Error) => {
          if (error.name !== 'AbortError') put('series', id, { state: 'error', message: message(error) })
        })
      loadLayer(id)
        .then((layer) => put('trends', id, { state: 'ready', data: layer.cells.find((c) => c.cellId === cellId) ?? null }))
        .catch((error: Error) => put('trends', id, { state: 'error', message: message(error) }))
    }
    return () => {
      active = false
      controller.abort()
    }
    // `key` identifies the square and the variables; `attempts` re-runs the loads after a Retry.
  }, [key, attempts]) // eslint-disable-line react-hooks/exhaustive-deps

  // A Retry loads this square's files again (the files are small and the browser caches the ones that worked).
  const retry = useCallback(() => setAttempts((n) => n + 1), [])

  const current = state.key === key
  const slots = <T,>(source: Record<string, Slot<T>>): Record<string, Slot<T>> =>
    Object.fromEntries(variableIds.map((id) => [id, (current ? source[id] : undefined) ?? { state: 'loading' as const }]))
  return { series: slots(state.series), trends: slots(state.trends), retry }
}
