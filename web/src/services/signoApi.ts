// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-14. Reviewed and owned by team AETHER.
//
// Typed service for the SIGNO API v1. Views reach data only through hooks that call this service.

import { apiPaths } from '../../shared/apiPaths.ts'
import type { CellSeries, CoverLayer, Manifest, RasterIndex, TrendLayer, ValidationReport } from '../../shared/contracts.ts'
import { getJson } from './apiClient.ts'

export const signoApi = {
  getManifest: (signal?: AbortSignal): Promise<Manifest> => getJson<Manifest>(apiPaths.manifest(), signal),

  getTrendLayer: (variableId: string, signal?: AbortSignal): Promise<TrendLayer> =>
    getJson<TrendLayer>(apiPaths.trends(variableId), signal),

  getCellSeries: (variableId: string, cellId: string, signal?: AbortSignal): Promise<CellSeries> =>
    getJson<CellSeries>(apiPaths.series(variableId, cellId), signal),

  // Optional files: only request them when manifest.extras says the API serves them.
  getCover: (signal?: AbortSignal): Promise<CoverLayer> => getJson<CoverLayer>(apiPaths.cover(), signal),

  getValidation: (signal?: AbortSignal): Promise<ValidationReport> =>
    getJson<ValidationReport>(apiPaths.validation(), signal),

  getRasterIndex: (signal?: AbortSignal): Promise<RasterIndex> => getJson<RasterIndex>(apiPaths.rasters(), signal),
}
