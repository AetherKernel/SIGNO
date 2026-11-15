// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-14 (CellBundle added 2026-11-15). Reviewed and
// owned by team AETHER.
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

/** "sum" for amounts accumulated over time (precipitation, burned area); "mean" for states (NDVI, temperature). */
export type SemesterAggregation = 'mean' | 'sum'

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
  /** How the backend aggregates the monthly values of a six-month period: "sum" for amounts (rain, burned area), "mean" otherwise. */
  semesterAggregation: SemesterAggregation
  /**
   * Units of the trend slope, always "per decade": e.g. "unitless per decade", "°C per decade", "mm per year, per decade",
   * "% of cell per year, per decade". They differ from `units` because the trend is tested on yearly values (mean or total).
   * Optional so a sample export without trend results still validates.
   */
  slopeUnits?: string
  /** First and last year that enter the trend test of this variable (e.g. 2001 to 2020 for LST). Optional like `slopeUnits`. */
  trendYears?: { start: number; end: number }
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
  /** Optional files the API serves besides the trends and series; false when the data source does not provide them. */
  extras: ManifestExtras
}

/** Which optional API files exist (cover.json, validation.json, rasters.json, zones.json). */
export interface ManifestExtras {
  cover: boolean
  validation: boolean
  rasters: boolean
  /** zones.json is served (yearly values and trends per zone). Absent in exports older than the zones file. */
  zones?: boolean
  /**
   * The country borders file exists. It is NOT part of the API: the UI loads it as a static file at BORDERS_URL
   * (GeoJSON FeatureCollection, properties {name, iso3}; Natural Earth, public domain).
   */
  borders?: boolean
}

/** Static (non-API) URL of the country borders, served from public/data. */
export const BORDERS_URL = '/data/borders.json'

/** Trend result for one grid cell, as produced by the team's statistical method. */
/** The Sen line over the tested years, as two end points in the units of the tested yearly value. */
export interface SenLine {
  start: { year: number; value: number }
  end: { year: number; value: number }
}

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
  /** Sen line over the tested years (optional, only for tested cells). */
  line?: SenLine
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
  /** Six-month periods computed by the backend from `points` (never in the browser). Chronological. */
  semesters: SemesterValue[]
  /** Calendar years computed by the backend from `points` (never in the browser). Chronological, first to last year of the series. */
  annual: AnnualValue[]
}

/**
 * GET /api/v1/cells/{cellId}.json (added 2026-11-15): what the area viewer shows first about one cell, in one file.
 * For each variable that has a series for this cell: the yearly values of series/{variableId}/{cellId}.json and the
 * cell's row of trends/{variableId}.json. It replaces one request per variable and the download of every trend layer
 * just to read one row. The monthly points stay in the series file (loaded only when the viewer asks for them).
 * Published by the backend from the same validated data; it adds no value of its own.
 */
export interface CellBundle {
  apiVersion: typeof API_VERSION
  cellId: string
  dataStatus: DataStatus
  /** By variable id, in the manifest's variable order. A variable without a series for this cell is absent. */
  variables: Record<string, CellBundleVariable>
}

export interface CellBundleVariable {
  units: string
  /** Same as CellSeries.annual. */
  annual: AnnualValue[]
  /** This cell's row of the variable's trend layer; null when the layer has no row for it. */
  trend: CellTrend | null
}

/** The yearly part of a CellSeries: what the area viewer reads from the per-cell file. */
export type CellYearlySeries = Pick<CellSeries, 'variableId' | 'cellId' | 'units' | 'annual'>

/**
 * One calendar year of one cell and variable, aggregated with the variable's `semesterAggregation`.
 * A year is `complete` only with all 12 monthly values; an incomplete one is shown greyed and left out of comparisons.
 */
export interface AnnualValue {
  year: number
  /** Mean of the valid months ("mean") or their total ("sum", null unless complete). Null if there is no valid month. */
  value: number | null
  /** Months with a value, 0 to 12. */
  validMonths: number
  complete: boolean
}

/** "YYYY-H1" (January to June) or "YYYY-H2" (July to December). */
export type SemesterKey = string

/**
 * One half-year of one cell and variable. H1 is only ever comparable with H1, H2 with H2.
 * A semester is `complete` only with all 6 monthly values; an incomplete one is shown greyed and left out of comparisons.
 */
export interface SemesterValue {
  period: SemesterKey
  /** Mean of the valid months ("mean") or their total ("sum", null unless complete). Null if there is no valid month. */
  value: number | null
  /** Months with a value, 0 to 6. */
  validMonths: number
  complete: boolean
  /** Absolute difference (variable units, never a percentage) vs the same half one year earlier. Null unless both are complete. */
  changeVsPreviousYear: number | null
}

/** Yearly tree cover, tree cover loss and burned area of one grid cell. Arrays follow CoverLayer.years/lossYears/burnedYears. */
export interface CoverCell {
  cellId: string
  lat: number
  lon: number
  /** Percent of the cell, Hansen/UMD (Landsat 30 m): 2000 canopy minus loss since 2001. Regrowth is not counted, so it never increases. */
  hansenTreeCover: (number | null)[]
  /** Percent of the cell, NASA MOD44B (MODIS 250 m): independent check; reads lower over dense forest. */
  modisTreeCover: (number | null)[]
  /** km2 of stand-replacing tree cover loss per year (fire, logging, mining, clearing; not only deforestation). */
  lossKm2: (number | null)[]
  /** km2 burned per calendar year (MODIS MCD64A1). */
  burnedKm2: (number | null)[]
  /**
   * Trend of `lossKm2` (km2 per year, per decade) and of `modisTreeCover` (% of cell per decade) from the pipeline's test
   * (see CoverLayer.trendMethod). A key is null when the cell was not tested. Hansen tree cover itself is never tested
   * (it cannot rise by construction). Optional: exports from before the team chose the trend method lack it.
   */
  trends?: {
    lossKm2: CoverCellTrend | null
    modisTreeCover: CoverCellTrend | null
  }
}

/** Trend result of one cover measure in one cell. `significant` is decided by the pipeline (after FDR); `pValue` is the raw p. */
export interface CoverCellTrend {
  slopePerDecade: number | null
  pValue: number | null
  significant: boolean
  /** Sen line over the tested years (optional). */
  line?: SenLine
}

export interface CoverFlag {
  source: string
  year: number
  note: string
}

/** GET /api/v1/cover.json (optional, see Manifest.extras.cover) */
export interface CoverLayer {
  apiVersion: typeof API_VERSION
  generatedAt: string
  dataStatus: DataStatus
  cellSizeDeg: number
  /** Years of hansenTreeCover and modisTreeCover (2000 is the baseline). */
  years: number[]
  /** Years of lossKm2. */
  lossYears: number[]
  /** Years of burnedKm2. */
  burnedYears: number[]
  /** Plain-language definition of each measure, keyed by field name. */
  definitions: Record<string, string>
  /** Known problems of a source in a year (e.g. a suspect MODIS year). */
  flags: CoverFlag[]
  /** Plain-language method of the cover trends (tested years, test, FDR, AI disclosure). Optional like CoverCell.trends. */
  trendMethod?: string
  cells: CoverCell[]
}

// Validation report. The agreement, change, fire and hotspot sections are descriptive only: r values carry no p-value and
// no significance wording. The "trendChecks" subtree is the exception: it checks the team's trend method.

export interface HansenClassAgreement {
  /** [from, to] percent of Hansen tree cover in 2000. */
  hansenRange: [number, number]
  cells: number
  hansenMean: number
  modisMean: number
}

export interface Agreement2000 {
  r: number | null
  cells: number
  biasPp: number
  rmsePp: number
  byHansenClass: HansenClassAgreement[]
}

export interface LossDecileChange {
  decile: number
  hansenLossShareMean: number
  modisChangePpMean: number
  cells: number
}

export interface ChangeVsLoss {
  r: number | null
  cells: number
  definition: string
  byLossDecile: LossDecileChange[]
}

export interface LossWithFireYear {
  year: number
  lossKm2: number
  lossInBurnedCellsKm2: number
  /** Share of the year's loss that happened in cells with burned area (co-location, not causation). */
  share: number
  /** Base rate: share of the zone's cells with burned area that year. */
  zoneShareOfCellsBurned: number
}

export interface LossWithFire {
  definition: string
  years: LossWithFireYear[]
}

export interface Hotspot {
  lat: number
  lon: number
  /** Cell of the API grid that contains the hotspot (open it with the usual cell URL). */
  apiCellId: string
  hansenLossShare: number
  peakLossYear: number
  peakLossShare: number
  hansenTreeCover2000: number
  modisChangePp: number
  burnedYears: number[]
}

export interface ValidationZone {
  zoneId: string
  label: string
  agreement2000: Agreement2000
  changeVsLoss: ChangeVsLoss
  lossWithFire: LossWithFire
  hotspots: Hotspot[]
}

/** A documented place (e.g. La Pampa gold mining) checked against the data, with its reference. */
export interface ValidationCase {
  id: string
  label: string
  lat: number
  lon: number
  reference: string
  apiCellId: string
  years: number[]
  hansenTreeCover: (number | null)[]
  modisTreeCover: (number | null)[]
  lossYears: number[]
  hansenLossShare: (number | null)[]
  burnedMonths: number
  burnedMonthsList: string[]
  burnedPeriod: string
}

export interface ValidationMeta {
  generatedUtc: string
  /** Product short name -> DOI. */
  sources: Record<string, string>
  note: string
  aiDisclosure: string
}

/** GET /api/v1/validation.json (optional, see Manifest.extras.validation) */
export interface ValidationReport {
  apiVersion: typeof API_VERSION
  generatedAt: string
  dataStatus: DataStatus
  meta: ValidationMeta
  zones: ValidationZone[]
  cases: ValidationCase[]
  /** How well the team's trend test performs (false alarms, detection, known places). Optional. */
  trendChecks?: TrendChecks
}

/** Result of one trend test: slope per decade in the units of the tested yearly value. */
export interface TrendResultSummary {
  slopePerDecade: number | null
  pValue: number | null
  significant: boolean
  /** Sen line over the tested years (optional). */
  line?: SenLine
}

/** Zone-level test (one test per zone and variable, no multiple-testing correction). */
export interface ZoneTrendResult extends TrendResultSummary {
  /** First and last year tested. */
  years: [number, number]
  /** Number of years used. */
  n: number
  /** Which Mann-Kendall variant ran ("original", or the Hamed-Rao modified test). */
  test: string
}

export interface TrendCheckVariable {
  /** Monthly variable id, or "lossKm2" / "modisTreeCover" for the cover measures. */
  variableId: string
  testUsed: string
  /** Share of tested cells whose residuals show lag-1 autocorrelation (pre-registered rule). */
  autocorrelationShare: number
  /** First and last year tested. */
  period: [number, number]
  /** Slope units, "per decade" included. */
  units: string
  cellsTotal: number
  cellsTested: number
  significantIncreasing: number
  significantDecreasing: number
  medianSlopePerDecade: number | null
  medianSlopePerDecadeSignificant: number | null
  cellsWithMissingYear: number
}

/** Satellite drift check (rule D1): correlation of the overpass time with the NDVI/EVI anomaly. */
export interface DriftCheck {
  years: [number, number]
  overpassHoursFirstYear: number
  overpassHoursLastYear: number
  variables: Record<string, { r: number; pValue: number; n: number; endsIn2020: boolean }>
  rule: string
}

/** V1: share of cells flagged significant after shuffling the years (expected near zero). */
export interface FalsePositiveCheck {
  permutations: number
  meanShareSignificant: number
  maxShareSignificant: number
}

/** V2: share of cells where an injected trend (the median significant slope) is found again. */
export interface DetectionCheck {
  injectedSlopePerDecade: number | null
  meanShareDetected: number
  minShareDetected: number
  meanShareDetectedIncreasing: number
}

/** V3: one measure in a known place. `direction` is what the test found, `expectedDirection` what the references report. */
export interface KnownPlaceResult extends TrendResultSummary {
  /** Benjamini-Hochberg adjusted p. */
  qValue: number | null
  direction: 'increasing' | 'decreasing' | 'none'
  expectedDirection: 'increasing' | 'decreasing'
  directionAsExpected: boolean
}

export interface KnownPlaceCheck {
  /** Cell of the API grid. */
  cellId: string
  kind: 'hotspot' | 'case'
  /** Ids of the zones (zones.json) the cell belongs to. */
  zones: string[]
  /** Only for kind "case": matches ValidationCase.id. */
  caseId?: string
  label?: string
  lossKm2: KnownPlaceResult | null
  modisTreeCover: KnownPlaceResult | null
}

export interface TrendChecks {
  generatedUtc: string
  design: {
    alpha: number
    minCompleteShare: number
    autocorrelationRuleThreshold: number
    permutations: number
    seed: number
    text: string
  }
  variables: TrendCheckVariable[]
  d1Drift: DriftCheck
  /** Keyed by variable id (V1). */
  v1FalsePositives: Record<string, FalsePositiveCheck>
  /** Keyed by variable id (V2). */
  v2Detection: Record<string, DetectionCheck>
  v3KnownPlaces: KnownPlaceCheck[]
  /** Zone id, then variable id (V4). */
  v4ZoneTrends: Record<string, Record<string, ZoneTrendResult>>
}

/** "percent" = the value 0-100 is the percent; "sqrt_share" = the share of the cell area is (value / 100)^2. */
export type RasterEncoding = 'percent' | 'sqrt_share'

/** Pixel grid shared by all raster frames. Row 0 is the northern edge and column 0 the western edge. */
export interface RasterGrid {
  west: number
  south: number
  east: number
  north: number
  stepDeg: number
  rows: number
  cols: number
  /** Pixel value (R channel) that means "no data". */
  nodata: number
  row0: 'north'
  col0: 'west'
}

export interface RasterFrame {
  /** "2000".."2025" for yearly layers, "YYYY-H1" / "YYYY-H2" for the burned-area half-years. */
  key: string
  /** Absolute path of the PNG on the site, e.g. "/data/maps/hansen/loss_2020.png". */
  url: string
  /** Months of the period that have data (burned half-years only; 6 unless the period is still running). */
  nMonths?: number
}

export interface RasterLayer {
  id: string
  /** Product short name, e.g. "HANSEN". */
  source: string
  doi: string
  encoding: RasterEncoding
  period?: string
  frames: RasterFrame[]
}

/** GET /api/v1/rasters.json (optional, see Manifest.extras.rasters): where the 0.05 degree map PNGs are. */
export interface RasterIndex {
  apiVersion: typeof API_VERSION
  generatedAt: string
  dataStatus: DataStatus
  note?: string
  grid: RasterGrid
  layers: RasterLayer[]
}

// Zone report: yearly values and trends of the whole Amazon and of its Brazilian and Peruvian parts.

export interface ZoneYearValue {
  year: number
  /** Area-weighted zone value; null when the year is not computable. */
  value: number | null
  /** False for a partial year or a flagged one (MODIS 2025): show it greyed; the pipeline leaves it out of the test. */
  complete: boolean
}

/** Lowest and highest monthly zone value of one complete year: the seasonal cycle that the yearly test removes. */
export interface ZoneMonthlyRange {
  year: number
  min: number
  /** 1 (January) to 12 (December). */
  minMonth: number
  max: number
  maxMonth: number
}

/** Cells of the zone counted by the pipeline from the cell tests (a country zone holds the cells mostly inside that country). */
export interface ZoneCellSummary {
  tested: number
  significantIncreasing: number
  significantDecreasing: number
}

export interface ZoneVariable {
  /** Units of the yearly values, e.g. "mm per year", "km2 per year", "%". */
  units: string
  /** Chronological. */
  annual: ZoneYearValue[]
  /** Monthly variables only: lowest and highest month of each complete year. */
  monthlyRange?: ZoneMonthlyRange[]
  /** Absent for hansenTreeCover (never tested). */
  zoneTrend?: ZoneTrendResult
  /** Absent for hansenTreeCover. */
  cellSummary?: ZoneCellSummary
}

export interface Zone {
  label: string
  /** Keyed by "ndvi", "evi", "lst_day", "precip", "burned_area", "hansenTreeCover", "modisTreeCover" and "lossKm2". */
  variables: Record<string, ZoneVariable>
}

/** GET /api/v1/zones.json (optional, see Manifest.extras.zones) */
export interface ZonesReport {
  apiVersion: typeof API_VERSION
  generatedAt: string
  dataStatus: DataStatus
  generatedUtc?: string
  /** Plain-language method note. */
  note: string
  /** Significance level of the zone tests. */
  alpha: number
  aiDisclosure: string
  /** Keyed by zone id: "amazon", "amazon_brazil", "amazon_peru". */
  zones: Record<string, Zone>
}
