// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-14. Reviewed and owned by team AETHER.
//
// SIGNO data contract (API v1). This file is the single source of truth shared by the backend (`server/`) and the
// frontend (`src/`). It holds types and constants only: no logic, no imports.
//
// For Alexis (data pipeline): export one JSON file per shape below into `server/data/` (see server/data/README.md)
// and build with SIGNO_DATA_SOURCE=files. The frontend does not change.
//
// Conventions:
// - Months are strings "YYYY-MM". Timestamps are ISO 8601 UTC.
// - Ids (variables, cells, region) match ID_PATTERN so they can be used in URLs and file names.
// - Coordinates are WGS84 degrees: longitude east-positive, latitude north-positive.
// - Missing values (e.g. cloud gaps) are `null`, never NaN or a sentinel such as -9999.

export const API_VERSION = 'v1'

/** Ids for variables, cells and regions: lowercase letters, digits, "_" and "-". */
export const ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/

/** "mock" = synthetic sample data for development. "real" = produced from NASA data by the team's pipeline. */
export type DataStatus = 'mock' | 'real'

/** "YYYY-MM" */
export type YearMonth = string

/** [west, south, east, north] in degrees. */
export type BoundingBox = [number, number, number, number]

export interface Period {
  start: YearMonth
  end: YearMonth
}

/** The NASA (or other) product a variable comes from. Cited on the project page and in the README. */
export interface DataProduct {
  /** CMR short name, e.g. "MOD13C2". */
  shortName: string
  version: string
  /** e.g. "LP DAAC", "GES DISC". */
  provider: string
  /** DOI without the https://doi.org/ prefix, or null if the product has none. */
  doi: string | null
  /** "satellite" = observation; "model" = model or reanalysis output. Shown to users. */
  kind: 'satellite' | 'model'
}

export interface Variable {
  id: string
  /** Short display name, e.g. "Vegetation greenness (NDVI)". */
  name: string
  /** One or two plain-language sentences for students and the public. */
  description: string
  /** Units of the values in the time series, e.g. "unitless", "°C". */
  units: string
  temporalResolution: 'monthly'
  period: Period
  product: DataProduct
}

export interface Region {
  id: string
  name: string
  /** Cited source of the region boundary, or null while it is undecided (P-008). */
  boundarySource: string | null
  bbox: BoundingBox
}

/** GET /api/v1/manifest.json: what the API currently serves. */
export interface Manifest {
  apiVersion: typeof API_VERSION
  generatedAt: string
  dataStatus: DataStatus
  region: Region
  variables: Variable[]
}

/** Trend result for one grid cell, as produced by the team's statistical method. */
export interface CellTrend {
  /** Unique within a variable, e.g. "r03c07". Also used in the series URL. */
  cellId: string
  /** Cell centre. */
  lat: number
  lon: number
  /** Rate of change in variable units per decade. Null if the cell has too little data. */
  slopePerDecade: number | null
  /** p-value of the significance test, or null if not tested. */
  pValue: number | null
  /** Decided by the pipeline's method (including any multiple-testing correction), not by the frontend. */
  significant: boolean
  /** Number of non-missing monthly values used. */
  validMonths: number
}

/** Computed by the backend from `cells`; never sent by the pipeline. */
export interface TrendSummary {
  cellsTotal: number
  cellsTested: number
  cellsSignificant: number
  significantIncreasing: number
  significantDecreasing: number
}

/** The method that produced the trends. Free text: the method is the team's decision. */
export interface MethodInfo {
  name: string
  description: string
  /** Significance level used to set `significant`, e.g. 0.05. */
  alpha: number
}

/** GET /api/v1/trends/{variableId}.json */
export interface TrendLayer {
  apiVersion: typeof API_VERSION
  variableId: string
  regionId: string
  period: Period
  /** Cell size in degrees (square cells). */
  cellSizeDeg: number
  method: MethodInfo
  generatedAt: string
  dataStatus: DataStatus
  summary: TrendSummary
  cells: CellTrend[]
}

export interface SeriesPoint {
  month: YearMonth
  value: number | null
}

/** GET /api/v1/series/{variableId}/{cellId}.json: monthly values behind one cell's trend. */
export interface CellSeries {
  apiVersion: typeof API_VERSION
  variableId: string
  cellId: string
  units: string
  dataStatus: DataStatus
  points: SeriesPoint[]
}
