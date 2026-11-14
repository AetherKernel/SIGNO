// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-14. Reviewed and owned by team AETHER.
//
// Data source port. The backend reads all data through this interface, so swapping the mock for Alexis's
// pipeline output means changing only which DataSource is created (see ./index.ts).

import type { CellTrend, DataStatus, MethodInfo, Period, Region, SeriesPoint, Variable } from '../../shared/contracts.ts'

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

export interface DataSource {
  /** Shown to users: mock data must never be presented as real. */
  readonly status: DataStatus
  readonly description: string
  getRegion(): Promise<Region>
  getVariables(): Promise<Variable[]>
  getTrendLayer(variableId: string): Promise<SourceTrendLayer>
  getSeries(variableId: string): Promise<SourceSeries>
}
