// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-14. Reviewed and owned by team AETHER.
//
// Data source port. The backend reads all data through this interface, so swapping the mock for Alexis's
// pipeline output means changing only which DataSource is created (see ./index.ts).

import type {
  CellTrend,
  CoverLayer,
  DataStatus,
  MethodInfo,
  Period,
  RasterIndex,
  Region,
  SeriesPoint,
  ValidationReport,
  Variable,
  ZonesReport,
} from '../../shared/contracts.ts'

/** What a data source provides for one variable's trends. The backend adds apiVersion, summary, status and time. */
export interface SourceTrendLayer {
  variableId: string
  regionId: string
  period: Period
  cellSizeDeg: number
  method: MethodInfo
  cells: CellTrend[]
}

/** Monthly series of every cell of one variable, keyed by cellId. */
export type SourceSeries = Record<string, SeriesPoint[]>

/** What a source provides for the cover layer and the other optional files: the backend adds the envelope. */
type WithoutEnvelope<T> = Omit<T, 'apiVersion' | 'generatedAt' | 'dataStatus'>
export type SourceCover = WithoutEnvelope<CoverLayer>
export type SourceValidation = WithoutEnvelope<ValidationReport>
export type SourceRasterIndex = WithoutEnvelope<RasterIndex>
export type SourceZones = WithoutEnvelope<ZonesReport>

export interface DataSource {
  /** Shown to users: mock data must never be presented as real. */
  readonly status: DataStatus
  readonly description: string
  getRegion(): Promise<Region>
  getVariables(): Promise<Variable[]>
  getTrendLayer(variableId: string): Promise<SourceTrendLayer>
  getSeries(variableId: string): Promise<SourceSeries>
  /** Folder holding the raster PNGs that the raster index points to (served by the site at /data/maps). */
  readonly mapsDir?: string
  /** Optional extras. A source that lacks one omits the method or resolves null; the manifest then reports it as absent. */
  getCover?(): Promise<SourceCover | null>
  getValidation?(): Promise<SourceValidation | null>
  getRasterIndex?(): Promise<SourceRasterIndex | null>
  /** Yearly values and trends per zone (zones.json). The mock source omits it. */
  getZones?(): Promise<SourceZones | null>
}
