// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-14. Reviewed and owned by team AETHER.
//
// Data hooks for the views. Each request is cancelled when its inputs change or the view unmounts.

import { useEffect, useState } from 'react'
import type { CellSeries, CoverLayer, Manifest, TrendLayer, ValidationReport } from '../../shared/contracts.ts'
import { signoApi } from '../services/signoApi.ts'
import { getBorders, type Borders } from '../services/staticData.ts'

export interface Remote<T> {
  data: T | null
  error: string | null
  loading: boolean
}

/** Runs `load` whenever `key` changes; a null key means "nothing to load yet". */
function useRemote<T>(key: string | null, load: (signal: AbortSignal) => Promise<T>): Remote<T> {
  const [state, setState] = useState<{ key: string | null; data: T | null; error: string | null }>({
    key: null,
    data: null,
    error: null,
  })

  useEffect(() => {
    if (key === null) return
    const controller = new AbortController()
    load(controller.signal)
      .then((data) => setState({ key, data, error: null }))
      .catch((error: Error) => {
        if (error.name !== 'AbortError') setState({ key, data: null, error: error.message })
      })
    return () => controller.abort()
    // `load` is rebuilt on every render; `key` identifies the request.
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  const current = state.key === key
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    loading: key !== null && !current,
  }
}

export function useManifest(): Remote<Manifest> {
  return useRemote('manifest', (signal) => signoApi.getManifest(signal))
}

export function useTrendLayer(variableId: string | null): Remote<TrendLayer> {
  return useRemote(variableId, (signal) => signoApi.getTrendLayer(variableId as string, signal))
}

export function useCellSeries(variableId: string | null, cellId: string | null): Remote<CellSeries> {
  const key = variableId && cellId ? `${variableId}/${cellId}` : null
  return useRemote(key, (signal) => signoApi.getCellSeries(variableId as string, cellId as string, signal))
}

/** Yearly tree cover, loss and burned area. Pass false when the API does not serve it (manifest.extras.cover). */
export function useCover(enabled: boolean): Remote<CoverLayer> {
  return useRemote(enabled ? 'cover' : null, (signal) => signoApi.getCover(signal))
}

/** Validation report. Loads only once `enabled` is true (the tab was opened) and the API serves it. */
export function useValidation(enabled: boolean): Remote<ValidationReport> {
  return useRemote(enabled ? 'validation' : null, (signal) => signoApi.getValidation(signal))
}

/** Country borders (a static file, not API v1). A missing file only hides the layer: the error is never shown. */
export function useBorders(enabled: boolean): Remote<Borders> {
  return useRemote(enabled ? 'borders' : null, (signal) => getBorders(signal))
}
