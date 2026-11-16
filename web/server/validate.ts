// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-14. Reviewed and owned by team AETHER.
//
// Runtime checks of the data contract. Pipeline output that breaks the contract fails the build with a clear
// message instead of reaching users. Each function throws ContractError on the first problem it finds.
// 2026-11-15: slopeCi95 (95 % confidence interval of a slope) is checked wherever a trend result carries it: low <= slope <= high;
// driftFromYear is checked as a year. Written with Claude Code, reviewed by team AETHER.

import { closeSync, existsSync, openSync, readSync, statSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { ID_PATTERN } from '../shared/contracts.ts'
import type { CellTrend, Period, Region, SeriesPoint, Variable } from '../shared/contracts.ts'
import type { SourceCover, SourceRasterIndex, SourceSeries, SourceTrendLayer, SourceValidation, SourceZones } from './sources/types.ts'

export class ContractError extends Error {
  constructor(where: string, problem: string) {
    super(`${where}: ${problem}`)
    this.name = 'ContractError'
  }
}

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

function check(condition: boolean, where: string, problem: string): void {
  if (!condition) throw new ContractError(where, problem)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function checkId(id: unknown, where: string): void {
  check(typeof id === 'string' && ID_PATTERN.test(id), where, `invalid id ${JSON.stringify(id)} (use a-z, 0-9, "_", "-")`)
}

function checkPeriod(period: Period | undefined, where: string): void {
  check(!!period && MONTH_PATTERN.test(period.start) && MONTH_PATTERN.test(period.end), where, 'period must be {start, end} as "YYYY-MM"')
  check((period as Period).start <= (period as Period).end, where, 'period.start is after period.end')
}

export function validateRegion(region: Region): void {
  const where = 'region.json'
  checkId(region?.id, `${where} id`)
  check(typeof region.name === 'string' && region.name.length > 0, where, 'name is required')
  check(Array.isArray(region.bbox) && region.bbox.length === 4 && region.bbox.every(isFiniteNumber), where, 'bbox must be [west, south, east, north]')
  const [west, south, east, north] = region.bbox
  check(west < east && south < north && west >= -180 && east <= 180 && south >= -90 && north <= 90, where, 'bbox out of range or inverted')
  check(region.boundarySource === null || typeof region.boundarySource === 'string', where, 'boundarySource must be a string or null')
}

export function validateVariables(variables: Variable[]): void {
  const where = 'variables.json'
  check(Array.isArray(variables) && variables.length > 0, where, 'must be a non-empty array')
  const seen = new Set<string>()
  for (const v of variables) {
    const at = `${where} [${v?.id}]`
    checkId(v?.id, at)
    check(!seen.has(v.id), at, 'duplicate variable id')
    seen.add(v.id)
    check(typeof v.name === 'string' && v.name.length > 0, at, 'name is required')
    check(typeof v.description === 'string' && v.description.length > 0, at, 'description is required (plain language)')
    check(typeof v.units === 'string' && v.units.length > 0, at, 'units are required')
    check(v.temporalResolution === 'monthly', at, 'temporalResolution must be "monthly"')
    checkPeriod(v.period, at)
    check(!!v.product && typeof v.product.shortName === 'string' && typeof v.product.provider === 'string', at, 'product needs shortName and provider')
    check(v.product.kind === 'satellite' || v.product.kind === 'model', at, 'product.kind must be "satellite" or "model"')
    check(v.semesterAggregation === 'mean' || v.semesterAggregation === 'sum', at, 'semesterAggregation must be "mean" or "sum" ("sum" for rain and burned area)')
    check(v.slopeUnits === undefined || (typeof v.slopeUnits === 'string' && /per decade$/.test(v.slopeUnits)), at, 'slopeUnits must be a string ending in "per decade"')
    check(v.driftFromYear === undefined || (Number.isInteger(v.driftFromYear) && v.driftFromYear >= 2000 && v.driftFromYear <= 2100), at, 'driftFromYear must be a year (integer)')
    if (v.trendYears !== undefined) {
      const years = v.trendYears
      check(!!years && Number.isInteger(years.start) && Number.isInteger(years.end) && years.start <= years.end, at, 'trendYears must be {start, end} (integers, start <= end)')
      const first = Number(v.period.start.slice(0, 4))
      const last = Number(v.period.end.slice(0, 4))
      check(years.start >= first && years.end <= last, at, `trendYears ${years.start}-${years.end} must lie inside the period (${first}-${last})`)
    }
  }
}

function validateCell(cell: CellTrend, alpha: number, at: string): void {
  checkId(cell?.cellId, at)
  check(isFiniteNumber(cell.lat) && cell.lat >= -90 && cell.lat <= 90, at, 'lat out of range')
  check(isFiniteNumber(cell.lon) && cell.lon >= -180 && cell.lon <= 180, at, 'lon out of range')
  check(cell.slopePerDecade === null || isFiniteNumber(cell.slopePerDecade), at, 'slopePerDecade must be a number or null')
  check(cell.pValue === null || (isFiniteNumber(cell.pValue) && cell.pValue >= 0 && cell.pValue <= 1), at, 'pValue must be in [0, 1] or null')
  check(typeof cell.significant === 'boolean', at, 'significant must be true or false')
  check(!cell.significant || (cell.pValue !== null && cell.slopePerDecade !== null), at, 'a significant cell needs a slope and a p-value')
  check(!cell.significant || alpha > 0, at, 'method.alpha must be set')
  check(Number.isInteger(cell.validMonths) && cell.validMonths >= 0, at, 'validMonths must be a non-negative integer')
  checkLine(cell.line, at)
  checkCi(cell.slopeCi95, cell.slopePerDecade, at)
}

/**
 * The optional 95 % confidence interval of a slope: null or [low, high] with low <= slope <= high (equality allowed). A slope
 * that is null has no interval to compare with, so only the shape is checked then. Added 2026-11-15.
 */
export function checkCi(ci: unknown, slope: number | null | undefined, at: string): void {
  if (ci === undefined || ci === null) return
  check(Array.isArray(ci) && ci.length === 2 && ci.every(isFiniteNumber), at, 'slopeCi95 must be null or [low, high] with finite numbers')
  const [low, high] = ci as [number, number]
  check(low <= high, at, `slopeCi95 must have low <= high (got ${low}, ${high})`)
  check(slope === null || slope === undefined || (low <= slope && slope <= high), at, `slopePerDecade ${slope} must lie inside slopeCi95 [${low}, ${high}]`)
}

/** The optional Sen line: two end points {year, value}, loosely checked. */
export function checkLine(line: unknown, at: string): void {
  if (line === undefined) return
  const l = line as { start?: { year?: unknown; value?: unknown }; end?: { year?: unknown; value?: unknown } }
  const okPoint = (p?: { year?: unknown; value?: unknown }) => !!p && Number.isInteger(p.year) && isFiniteNumber(p.value)
  check(!!l && okPoint(l.start) && okPoint(l.end), at, 'line must be {start: {year, value}, end: {year, value}} with finite values')
}

export function validateTrendLayer(layer: SourceTrendLayer, variable: Variable, region: Region): void {
  const where = `trends/${variable.id}.json`
  check(layer?.variableId === variable.id, where, `variableId must be "${variable.id}"`)
  check(layer.regionId === region.id, where, `regionId must be "${region.id}"`)
  checkPeriod(layer.period, where)
  check(isFiniteNumber(layer.cellSizeDeg) && layer.cellSizeDeg > 0, where, 'cellSizeDeg must be > 0')
  check(!!layer.method && typeof layer.method.name === 'string' && typeof layer.method.description === 'string', where, 'method needs name and description')
  check(isFiniteNumber(layer.method.alpha) && layer.method.alpha > 0 && layer.method.alpha < 1, where, 'method.alpha must be in (0, 1)')
  check(Array.isArray(layer.cells) && layer.cells.length > 0, where, 'cells must be a non-empty array')
  const seen = new Set<string>()
  for (const cell of layer.cells) {
    const at = `${where} cell ${cell?.cellId}`
    validateCell(cell, layer.method.alpha, at)
    check(!seen.has(cell.cellId), at, 'duplicate cellId')
    seen.add(cell.cellId)
  }
}

export function validateSeries(series: SourceSeries, layer: SourceTrendLayer): void {
  const where = `series/${layer.variableId}.json`
  check(!!series && typeof series === 'object' && !Array.isArray(series), where, 'must be an object keyed by cellId')
  const cellIds = new Set(layer.cells.map((c) => c.cellId))
  for (const [cellId, points] of Object.entries(series)) {
    const at = `${where} cell ${cellId}`
    check(cellIds.has(cellId), at, 'cellId is not in the trend layer')
    check(Array.isArray(points) && points.length > 0, at, 'points must be a non-empty array')
    let previous = ''
    for (const p of points as SeriesPoint[]) {
      check(MONTH_PATTERN.test(p?.month), at, `bad month ${JSON.stringify(p?.month)}`)
      check(p.month > previous, at, `months must be in increasing order (at ${p.month})`)
      check(p.value === null || isFiniteNumber(p.value), at, `value must be a number or null (at ${p.month})`)
      previous = p.month
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Optional extras: tree cover layer, validation report, raster index.
// ---------------------------------------------------------------------------------------------------------------

const TOLERANCE = 1e-6
const KM_PER_DEGREE = 111.32

function isNullableNumber(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value)
}

function checkYears(years: unknown, where: string, name: string): void {
  check(Array.isArray(years) && years.length > 0, where, `${name} must be a non-empty array`)
  let previous = -Infinity
  for (const y of years as unknown[]) {
    check(Number.isInteger(y) && (y as number) > previous, where, `${name} must be increasing integers (at ${JSON.stringify(y)})`)
    previous = y as number
  }
}

/** Checks one yearly array: right length, each value null or inside [min, max]. */
function checkYearly(values: unknown, length: number, where: string, name: string, min: number, max: number): (number | null)[] {
  check(Array.isArray(values) && values.length === length, where, `${name} must have ${length} values (one per year), got ${Array.isArray(values) ? values.length : typeof values}`)
  const list = values as unknown[]
  list.forEach((v, i) => {
    check(isNullableNumber(v), where, `${name}[${i}] must be a number or null`)
    check(v === null || ((v as number) >= min - TOLERANCE && (v as number) <= max + TOLERANCE), where, `${name}[${i}] = ${v} is outside [${min}, ${max}]`)
  })
  return list as (number | null)[]
}

/**
 * The cover layer must sit on the same grid as the trends (same cellIds and centres) and be physically sane.
 * Hansen-derived tree cover is cumulative: canopy only ever goes down (regrowth is not counted).
 */
export function validateCover(cover: SourceCover, layer: SourceTrendLayer): void {
  const where = 'cover.json'
  check(!!cover && typeof cover === 'object', where, 'must be an object')
  check(isFiniteNumber(cover.cellSizeDeg) && Math.abs(cover.cellSizeDeg - layer.cellSizeDeg) < TOLERANCE, where, `cellSizeDeg must equal the trend grid's (${layer.cellSizeDeg})`)
  checkYears(cover.years, where, 'years')
  checkYears(cover.lossYears, where, 'lossYears')
  checkYears(cover.burnedYears, where, 'burnedYears')
  check(!!cover.definitions && typeof cover.definitions === 'object' && Object.values(cover.definitions).every((d) => typeof d === 'string' && d.length > 0), where, 'definitions must map names to non-empty strings')
  check(Array.isArray(cover.flags), where, 'flags must be an array')
  for (const flag of cover.flags) {
    check(typeof flag?.source === 'string' && Number.isInteger(flag.year) && typeof flag.note === 'string' && flag.note.length > 0, where, 'each flag needs source, year and note')
    check(cover.years.includes(flag.year) || cover.lossYears.includes(flag.year) || cover.burnedYears.includes(flag.year), where, `flag year ${flag.year} is not a year of the layer`)
  }
  check(Array.isArray(cover.cells) && cover.cells.length > 0, where, 'cells must be a non-empty array')
  check(cover.trendMethod === undefined || (typeof cover.trendMethod === 'string' && cover.trendMethod.length > 0), where, 'trendMethod must be a non-empty string')
  // The cover trends are the team's results: only the "trends" and "trendMethod" fields may carry p-values and significance.
  checkNoSignificance(cover, where, COVER_TREND_FIELDS)
  let withTrends = 0

  const trendCells = new Map(layer.cells.map((c) => [c.cellId, c]))
  // Largest possible cell area (at the equator) with a small margin: a bigger value is a unit or scaling mistake.
  const maxAreaKm2 = (KM_PER_DEGREE * cover.cellSizeDeg) ** 2 * 1.05
  const seen = new Set<string>()
  for (const cell of cover.cells) {
    const at = `${where} cell ${cell?.cellId}`
    checkId(cell?.cellId, at)
    check(!seen.has(cell.cellId), at, 'duplicate cellId')
    seen.add(cell.cellId)
    const trend = trendCells.get(cell.cellId)
    check(trend !== undefined, at, `cellId is not in the trend grid of "${layer.variableId}"`)
    check(isFiniteNumber(cell.lat) && isFiniteNumber(cell.lon), at, 'lat and lon must be numbers')
    const grid = trend as CellTrend
    check(Math.abs(cell.lat - grid.lat) < TOLERANCE && Math.abs(cell.lon - grid.lon) < TOLERANCE, at, `lat/lon (${cell.lat}, ${cell.lon}) do not match the trend grid (${grid.lat}, ${grid.lon})`)
    const hansen = checkYearly(cell.hansenTreeCover, cover.years.length, at, 'hansenTreeCover', 0, 100)
    checkYearly(cell.modisTreeCover, cover.years.length, at, 'modisTreeCover', 0, 100)
    checkYearly(cell.lossKm2, cover.lossYears.length, at, 'lossKm2', 0, maxAreaKm2)
    checkYearly(cell.burnedKm2, cover.burnedYears.length, at, 'burnedKm2', 0, maxAreaKm2)
    if (cell.trends !== undefined) {
      withTrends += 1
      check(!!cell.trends && typeof cell.trends === 'object', at, 'trends must be an object {lossKm2, modisTreeCover}')
      for (const name of ['lossKm2', 'modisTreeCover'] as const) {
        const t = cell.trends[name]
        if (t === null) continue
        check(!!t && typeof t === 'object', at, `trends.${name} must be an object or null`)
        check(isNullableNumber(t.slopePerDecade), at, `trends.${name}.slopePerDecade must be a number or null`)
        check(t.pValue === null || (isFiniteNumber(t.pValue) && t.pValue >= 0 && t.pValue <= 1), at, `trends.${name}.pValue must be in [0, 1] or null`)
        check(typeof t.significant === 'boolean', at, `trends.${name}.significant must be true or false`)
        check(!t.significant || (t.pValue !== null && t.slopePerDecade !== null), at, `a significant trends.${name} needs a slope and a p-value`)
        checkLine(t.line, at)
        checkCi(t.slopeCi95, t.slopePerDecade, at)
      }
    }
    let previous: number | null = null
    hansen.forEach((value, i) => {
      if (value === null) return
      check(previous === null || value <= previous + TOLERANCE, at, `hansenTreeCover must not increase (regrowth is not counted): ${previous} -> ${value} at ${cover.years[i]}`)
      previous = value
    })
  }
  check(withTrends === 0 || cover.trendMethod !== undefined, where, 'cells have trends but trendMethod (how they were computed) is missing')
}

function checkRatio(value: unknown, where: string, name: string): void {
  check(isFiniteNumber(value) && value >= -1 - TOLERANCE && value <= 1 + TOLERANCE, where, `${name} must be a number in [-1, 1]`)
}

function checkShare(value: unknown, where: string, name: string): void {
  check(isFiniteNumber(value) && value >= -TOLERANCE && value <= 1 + TOLERANCE, where, `${name} must be a share in [0, 1]`)
}

/** Fields of cover.json that carry the team's trend results (allowed to hold p-values and significance). */
const COVER_TREND_FIELDS: ReadonlySet<string> = new Set(['trends', 'trendMethod'])
/** The only subtree of validation.json that checks the team's trend test (allowed to hold p-values and significance). */
const VALIDATION_TREND_FIELDS: ReadonlySet<string> = new Set(['trendChecks'])

/**
 * Team decision P-002: no AI-invented significance. The team has since chosen and run its trend test, so p-values and
 * significance are allowed only inside the `exempt` fields (matched by name at any depth); everywhere else (the agreement,
 * change, fire and hotspot sections) a field named like a p-value or containing "signific" is rejected.
 */
function checkNoSignificance(node: unknown, where: string, exempt: ReadonlySet<string> = new Set()): void {
  if (Array.isArray(node)) {
    node.forEach((n) => checkNoSignificance(n, where, exempt))
    return
  }
  if (node === null || typeof node !== 'object') return
  for (const [key, value] of Object.entries(node)) {
    if (exempt.has(key)) continue
    check(!/^p[_-]?value$/i.test(key) && !/signific/i.test(key), where, `field "${key}": no p-values or significance tests are allowed outside ${[...exempt].map((e) => `"${e}"`).join(', ') || 'the trend results'} (P-002)`)
    checkNoSignificance(value, where, exempt)
  }
}

/** Descriptive cross-checks: r values only, no p-values (except the "trendChecks" subtree, which checks the trend test). `cellIds` are the cells of the API grid (hotspots and cases must open one). */
export function validateValidationReport(report: SourceValidation, cellIds: ReadonlySet<string>): void {
  const where = 'validation.json'
  check(!!report && typeof report === 'object', where, 'must be an object')
  checkNoSignificance(report, where, VALIDATION_TREND_FIELDS)
  check(!!report.meta && typeof report.meta.note === 'string' && typeof report.meta.aiDisclosure === 'string' && !!report.meta.sources && typeof report.meta.sources === 'object', where, 'meta needs sources, note and aiDisclosure')
  check(Array.isArray(report.zones) && report.zones.length > 0, where, 'zones must be a non-empty array')
  const zoneIds = new Set<string>()
  for (const zone of report.zones) {
    const at = `${where} zone ${zone?.zoneId}`
    checkId(zone?.zoneId, at)
    check(!zoneIds.has(zone.zoneId), at, 'duplicate zoneId')
    zoneIds.add(zone.zoneId)
    check(typeof zone.label === 'string' && zone.label.length > 0, at, 'label is required')

    const a = zone.agreement2000
    check(!!a && isNullableNumber(a.r) && Number.isInteger(a.cells) && a.cells >= 0 && isFiniteNumber(a.biasPp) && isFiniteNumber(a.rmsePp) && Array.isArray(a.byHansenClass), at, 'agreement2000 needs r, cells, biasPp, rmsePp and byHansenClass')
    if (a.r !== null) checkRatio(a.r, at, 'agreement2000.r')
    for (const c of a.byHansenClass) {
      check(Array.isArray(c.hansenRange) && c.hansenRange.length === 2 && c.hansenRange[0] <= c.hansenRange[1] && c.hansenRange[0] >= 0 && c.hansenRange[1] <= 100, at, 'byHansenClass.hansenRange must be [from, to] within 0-100')
      check(Number.isInteger(c.cells) && isFiniteNumber(c.hansenMean) && isFiniteNumber(c.modisMean), at, 'byHansenClass needs cells, hansenMean and modisMean')
    }

    const cl = zone.changeVsLoss
    check(!!cl && isNullableNumber(cl.r) && typeof cl.definition === 'string' && Array.isArray(cl.byLossDecile), at, 'changeVsLoss needs r, definition and byLossDecile')
    if (cl.r !== null) checkRatio(cl.r, at, 'changeVsLoss.r')
    for (const d of cl.byLossDecile) {
      check(Number.isInteger(d.decile) && d.decile >= 1 && d.decile <= 10, at, 'byLossDecile.decile must be 1-10')
      checkShare(d.hansenLossShareMean, at, 'byLossDecile.hansenLossShareMean')
      check(isFiniteNumber(d.modisChangePpMean) && Number.isInteger(d.cells), at, 'byLossDecile needs modisChangePpMean and cells')
    }

    const lf = zone.lossWithFire
    check(!!lf && typeof lf.definition === 'string' && Array.isArray(lf.years), at, 'lossWithFire needs definition and years')
    for (const y of lf.years) {
      check(Number.isInteger(y.year) && isFiniteNumber(y.lossKm2) && y.lossKm2 >= 0 && isFiniteNumber(y.lossInBurnedCellsKm2) && y.lossInBurnedCellsKm2 >= 0, at, 'lossWithFire.years needs year, lossKm2 and lossInBurnedCellsKm2 >= 0')
      check(y.lossInBurnedCellsKm2 <= y.lossKm2 + 0.1, at, `lossInBurnedCellsKm2 exceeds lossKm2 in ${y.year}`)
      checkShare(y.share, at, 'lossWithFire.share')
      checkShare(y.zoneShareOfCellsBurned, at, 'lossWithFire.zoneShareOfCellsBurned')
    }

    check(Array.isArray(zone.hotspots), at, 'hotspots must be an array')
    for (const h of zone.hotspots) {
      check(isFiniteNumber(h.lat) && isFiniteNumber(h.lon) && Number.isInteger(h.peakLossYear), at, 'hotspot needs lat, lon and peakLossYear')
      check(cellIds.has(h.apiCellId), at, `hotspot apiCellId "${h.apiCellId}" is not in the API grid`)
      checkShare(h.hansenLossShare, at, 'hotspot.hansenLossShare')
      checkShare(h.peakLossShare, at, 'hotspot.peakLossShare')
      check(Array.isArray(h.burnedYears), at, 'hotspot.burnedYears must be an array')
    }
  }

  check(Array.isArray(report.cases), where, 'cases must be an array')
  for (const c of report.cases) {
    const at = `${where} case ${c?.id}`
    checkId(c?.id, at)
    check(typeof c.label === 'string' && typeof c.reference === 'string' && c.reference.length > 0, at, 'label and reference (citation) are required')
    check(cellIds.has(c.apiCellId), at, `apiCellId "${c.apiCellId}" is not in the API grid`)
    checkYears(c.years, at, 'years')
    checkYears(c.lossYears, at, 'lossYears')
    checkYearly(c.hansenTreeCover, c.years.length, at, 'hansenTreeCover', 0, 100)
    checkYearly(c.modisTreeCover, c.years.length, at, 'modisTreeCover', 0, 100)
    checkYearly(c.hansenLossShare, c.lossYears.length, at, 'hansenLossShare', 0, 1)
    check(Number.isInteger(c.burnedMonths) && Array.isArray(c.burnedMonthsList) && c.burnedMonthsList.length === c.burnedMonths, at, 'burnedMonths must equal the length of burnedMonthsList')
  }

  if (report.trendChecks !== undefined) validateTrendChecks(report.trendChecks, cellIds)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** Loose shape check of the trend-method checks: right containers, shares in [0, 1], known places on the API grid. */
function validateTrendChecks(checks: NonNullable<SourceValidation['trendChecks']>, cellIds: ReadonlySet<string>): void {
  const where = 'validation.json trendChecks'
  check(isRecord(checks), where, 'must be an object')
  check(isRecord(checks.design) && isFiniteNumber(checks.design.alpha) && checks.design.alpha > 0 && checks.design.alpha < 1 && typeof checks.design.text === 'string', where, 'design needs alpha in (0, 1) and text')
  check(Array.isArray(checks.variables) && checks.variables.length > 0, where, 'variables must be a non-empty array')
  for (const v of checks.variables) {
    const at = `${where} variable ${v?.variableId}`
    check(typeof v?.variableId === 'string' && v.variableId.length > 0, at, 'variableId is required')
    check(typeof v.units === 'string' && v.units.length > 0, at, 'units are required')
    check(Array.isArray(v.period) && v.period.length === 2 && v.period.every(Number.isInteger) && v.period[0] <= v.period[1], at, 'period must be [first year, last year]')
    check(Number.isInteger(v.cellsTested) && Number.isInteger(v.cellsTotal) && v.cellsTested <= v.cellsTotal, at, 'cellsTested must be an integer <= cellsTotal')
    check(Number.isInteger(v.significantIncreasing) && Number.isInteger(v.significantDecreasing) && v.significantIncreasing + v.significantDecreasing <= v.cellsTested, at, 'significant counts must add up to at most cellsTested')
    checkShare(v.autocorrelationShare, at, 'autocorrelationShare')
  }
  check(isRecord(checks.v1FalsePositives), where, 'v1FalsePositives must be an object keyed by variable id')
  for (const [id, f] of Object.entries(checks.v1FalsePositives)) {
    const at = `${where} v1FalsePositives ${id}`
    check(Number.isInteger(f?.permutations) && f.permutations > 0, at, 'permutations must be a positive integer')
    checkShare(f.meanShareSignificant, at, 'meanShareSignificant')
    checkShare(f.maxShareSignificant, at, 'maxShareSignificant')
  }
  check(isRecord(checks.v2Detection), where, 'v2Detection must be an object keyed by variable id')
  for (const [id, d] of Object.entries(checks.v2Detection)) {
    const at = `${where} v2Detection ${id}`
    check(isNullableNumber(d?.injectedSlopePerDecade), at, 'injectedSlopePerDecade must be a number or null')
    checkShare(d.meanShareDetected, at, 'meanShareDetected')
    checkShare(d.minShareDetected, at, 'minShareDetected')
  }
  check(Array.isArray(checks.v3KnownPlaces), where, 'v3KnownPlaces must be an array')
  for (const place of checks.v3KnownPlaces) {
    const at = `${where} known place ${place?.cellId}`
    check(cellIds.has(place?.cellId), at, 'cellId is not in the API grid')
    check(place.kind === 'hotspot' || place.kind === 'case', at, 'kind must be "hotspot" or "case"')
    check(Array.isArray(place.zones), at, 'zones must be an array')
    for (const name of ['lossKm2', 'modisTreeCover'] as const) {
      const r = place[name]
      if (r === null) continue
      check(isRecord(r) && isNullableNumber(r.slopePerDecade) && isNullableNumber(r.pValue) && typeof r.significant === 'boolean', at, `${name} needs slopePerDecade, pValue and significant`)
      checkCi(r.slopeCi95, r.slopePerDecade, `${at} ${name}`)
    }
  }
  check(isRecord(checks.v4ZoneTrends), where, 'v4ZoneTrends must be an object keyed by zone id')
  for (const [zoneId, byVariable] of Object.entries(checks.v4ZoneTrends)) {
    check(isRecord(byVariable), where, `v4ZoneTrends ${zoneId} must be an object keyed by variable id`)
    for (const [variableId, r] of Object.entries(byVariable)) checkCi(r?.slopeCi95, r?.slopePerDecade, `${where} v4ZoneTrends ${zoneId} ${variableId}`)
  }
}

/** Last year the team lets the land surface temperature test use (Terra orbit drift, rule B1). */
const LST_LAST_YEAR = 2020

/**
 * zones.json: yearly values and trends of each zone. `gridCells` is the number of cells of the API grid, which
 * bounds the cell counts. Zone ids use ID_PATTERN.
 */
export function validateZones(report: SourceZones, gridCells: number): void {
  const where = 'zones.json'
  check(!!report && typeof report === 'object', where, 'must be an object')
  check(typeof report.note === 'string' && report.note.length > 0 && typeof report.aiDisclosure === 'string' && report.aiDisclosure.length > 0, where, 'note and aiDisclosure are required')
  check(isFiniteNumber(report.alpha) && report.alpha > 0 && report.alpha < 1, where, 'alpha must be in (0, 1)')
  check(isRecord(report.zones) && Object.keys(report.zones).length > 0, where, 'zones must be a non-empty object keyed by zone id')
  for (const [zoneId, zone] of Object.entries(report.zones)) {
    const zat = `${where} zone ${zoneId}`
    checkId(zoneId, zat)
    check(typeof zone?.label === 'string' && zone.label.length > 0, zat, 'label is required')
    check(isRecord(zone.variables) && Object.keys(zone.variables).length > 0, zat, 'variables must be a non-empty object')
    for (const [variableId, v] of Object.entries(zone.variables)) {
      const at = `${zat} variable ${variableId}`
      check(typeof v?.units === 'string' && v.units.length > 0, at, 'units are required')
      check(Array.isArray(v.annual) && v.annual.length > 0, at, 'annual must be a non-empty array')
      let previousYear = -Infinity
      for (const y of v.annual) {
        check(Number.isInteger(y?.year) && y.year > previousYear, at, `annual years must be increasing integers (at ${JSON.stringify(y?.year)})`)
        check(isNullableNumber(y.value), at, `annual value of ${y.year} must be a number or null`)
        check(typeof y.complete === 'boolean', at, `annual complete of ${y.year} must be true or false`)
        previousYear = y.year
      }
      const years = new Set(v.annual.map((y) => y.year))
      if (v.monthlyRange !== undefined) {
        check(Array.isArray(v.monthlyRange), at, 'monthlyRange must be an array')
        let previous = -Infinity
        for (const r of v.monthlyRange) {
          check(Number.isInteger(r?.year) && r.year > previous && years.has(r.year), at, `monthlyRange years must be increasing and be years of annual (at ${JSON.stringify(r?.year)})`)
          check(isFiniteNumber(r.min) && isFiniteNumber(r.max) && r.min <= r.max, at, `monthlyRange ${r.year}: min and max must be numbers with min <= max`)
          check([r.minMonth, r.maxMonth].every((m) => Number.isInteger(m) && m >= 1 && m <= 12), at, `monthlyRange ${r.year}: months must be integers 1-12`)
          previous = r.year
        }
      }
      if (v.zoneTrend !== undefined) {
        const t = v.zoneTrend
        check(isNullableNumber(t.slopePerDecade), at, 'zoneTrend.slopePerDecade must be a number or null')
        check(t.pValue === null || (isFiniteNumber(t.pValue) && t.pValue >= 0 && t.pValue <= 1), at, 'zoneTrend.pValue must be in [0, 1] or null')
        check(typeof t.significant === 'boolean' && (!t.significant || (t.pValue !== null && t.slopePerDecade !== null)), at, 'zoneTrend.significant must be a boolean, and a significant trend needs a slope and a p-value')
        check(Array.isArray(t.years) && t.years.length === 2 && t.years.every(Number.isInteger) && t.years[0] <= t.years[1], at, 'zoneTrend.years must be [first, last]')
        check(Number.isInteger(t.n) && t.n >= 0 && t.n <= t.years[1] - t.years[0] + 1, at, 'zoneTrend.n must be an integer within the tested years')
        check(typeof t.test === 'string' && t.test.length > 0, at, 'zoneTrend.test is required')
        checkCi(t.slopeCi95, t.slopePerDecade, at)
        check(variableId !== 'lst_day' || t.years[1] <= LST_LAST_YEAR, at, `lst_day must not be tested after ${LST_LAST_YEAR} (satellite orbit drift)`)
      }
      if (v.cellSummary !== undefined) {
        const c = v.cellSummary
        check(Number.isInteger(c.tested) && Number.isInteger(c.significantIncreasing) && Number.isInteger(c.significantDecreasing), at, 'cellSummary counts must be integers')
        check(c.tested >= 0 && c.tested <= gridCells, at, `cellSummary.tested (${c.tested}) must be within the ${gridCells} cells of the grid`)
        check(c.significantIncreasing >= 0 && c.significantDecreasing >= 0 && c.significantIncreasing + c.significantDecreasing <= c.tested, at, 'significant counts must add up to at most tested')
      }
      check(variableId !== 'hansenTreeCover' || (v.zoneTrend === undefined && v.cellSummary === undefined), at, 'Hansen tree cover must not be tested (it cannot rise by construction)')
    }
  }
}

/** public/data/borders.json: a GeoJSON FeatureCollection of countries (static file, not part of the API). */
export function validateBorders(borders: unknown): void {
  const where = 'borders.json'
  const features = isRecord(borders) && borders.type === 'FeatureCollection' && Array.isArray(borders.features) ? (borders.features as unknown[]) : []
  check(features.length > 0, where, 'must be a GeoJSON FeatureCollection with features')
  for (const feature of features) {
    const f = feature as { type?: unknown; properties?: { name?: unknown }; geometry?: { type?: unknown } }
    check(isRecord(f) && f.type === 'Feature' && isRecord(f.properties) && typeof f.properties.name === 'string', where, 'each feature needs properties.name')
    check(!!f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'), where, `feature "${f.properties?.name}" must be a Polygon or MultiPolygon`)
  }
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/** [width, height] from the PNG header, or null if the file is not a PNG. */
function pngSize(file: string): [number, number] | null {
  const fd = openSync(file, 'r')
  try {
    const head = Buffer.alloc(24)
    const read = readSync(fd, head, 0, 24, 0)
    if (read < 24 || !PNG_SIGNATURE.every((b, i) => head[i] === b)) return null
    return [head.readUInt32BE(16), head.readUInt32BE(20)]
  } finally {
    closeSync(fd)
  }
}

const FRAME_KEY = /^\d{4}(-H[12])?$/

/**
 * The raster index must be consistent with the PNG files it points to: every frame exists, is a PNG and has
 * the size of the grid (rows x cols), which in turn must match the bounding box and the step.
 */
export function validateRasterIndex(index: SourceRasterIndex, mapsDir: string, urlPrefix = '/data/maps/'): void {
  const where = 'rasters.json'
  const g = index?.grid
  check(!!g && [g.west, g.south, g.east, g.north, g.stepDeg].every(isFiniteNumber), where, 'grid needs west, south, east, north and stepDeg')
  check(g.west < g.east && g.south < g.north && g.stepDeg > 0, where, 'grid bounds are inverted or stepDeg <= 0')
  check(g.row0 === 'north' && g.col0 === 'west', where, 'grid rows must start at the north and columns at the west')
  check(Number.isInteger(g.rows) && Number.isInteger(g.cols) && g.rows > 0 && g.cols > 0, where, 'grid rows and cols must be positive integers')
  check(g.rows === Math.round((g.north - g.south) / g.stepDeg) && g.cols === Math.round((g.east - g.west) / g.stepDeg), where, `grid rows x cols (${g.rows} x ${g.cols}) do not match the bounds and stepDeg`)
  check(Number.isInteger(g.nodata) && g.nodata >= 0 && g.nodata <= 255, where, 'grid.nodata must be an integer 0-255')
  check(Array.isArray(index.layers) && index.layers.length > 0, where, 'layers must be a non-empty array')

  const root = resolve(mapsDir)
  const layerIds = new Set<string>()
  for (const layer of index.layers) {
    const at = `${where} layer ${layer?.id}`
    checkId(layer?.id, at)
    check(!layerIds.has(layer.id), at, 'duplicate layer id')
    layerIds.add(layer.id)
    check(typeof layer.source === 'string' && layer.source.length > 0 && typeof layer.doi === 'string' && layer.doi.length > 0, at, 'source and doi are required')
    check(layer.encoding === 'percent' || layer.encoding === 'sqrt_share', at, 'encoding must be "percent" or "sqrt_share"')
    check(Array.isArray(layer.frames) && layer.frames.length > 0, at, 'frames must be a non-empty array')
    const keys = new Set<string>()
    for (const frame of layer.frames) {
      const fat = `${at} frame ${frame?.key}`
      check(FRAME_KEY.test(frame?.key), fat, 'key must be "YYYY" or "YYYY-H1"/"YYYY-H2"')
      check(!keys.has(frame.key), fat, 'duplicate frame key')
      keys.add(frame.key)
      check(frame.nMonths === undefined || (Number.isInteger(frame.nMonths) && frame.nMonths >= 1 && frame.nMonths <= 6), fat, 'nMonths must be an integer 1-6')
      check(typeof frame.url === 'string' && frame.url.startsWith(urlPrefix) && !frame.url.includes('..'), fat, `url must start with "${urlPrefix}"`)
      const file = resolve(join(root, frame.url.slice(urlPrefix.length)))
      check(file.startsWith(root + sep), fat, 'url points outside the maps folder')
      check(existsSync(file) && statSync(file).isFile(), fat, `missing raster file ${file}`)
      const size = pngSize(file)
      check(size !== null, fat, `${file} is not a PNG`)
      const [width, height] = size as [number, number]
      check(width === g.cols && height === g.rows, fat, `PNG size ${width} x ${height} does not match the grid ${g.cols} x ${g.rows}`)
    }
  }
}
