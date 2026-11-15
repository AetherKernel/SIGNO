// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
//
// What the cell viewer shows, as plain data: the measures of one square read at a year (tree cover, loss, burned area and
// the yearly value of each monthly variable), the A to B difference, the trend of each measure and the documented place.
// Rules it keeps: every number is a value the backend published; the only arithmetic is one subtraction (year B minus
// year A) of two published values; an incomplete year, a suspect year or a missing year is never part of a difference.

import type {
  AnnualValue,
  CellSeries,
  CellTrend,
  CoverCell,
  CoverLayer,
  Hotspot,
  ValidationCase,
  ValidationReport,
  Variable,
} from '../../shared/contracts.ts'
import type { Slot } from '../hooks/useCellProfile.ts'
import { flagFor } from './cover.ts'
import { formatTrendSlope } from './format.ts'
import type { TrendOption, TrendResult } from './trendMap.ts'

// Years of the viewer

const yearOf = (month: string) => Number(month.slice(0, 4))

/** Years the viewer can travel between: the years of the cover layer, or (sample data) the span of the variables. */
export function viewerYears(cover: CoverLayer | null, variables: Variable[]): number[] {
  if (cover) return cover.years
  const starts = variables.map((v) => yearOf(v.period.start))
  const ends = variables.map((v) => yearOf(v.period.end))
  if (starts.length === 0) return []
  const first = Math.min(...starts)
  return Array.from({ length: Math.max(...ends) - first + 1 }, (_, i) => first + i)
}

/** Years of ?from= and ?to=: valid values in order (from before to), else the default span (first year every measure has, to the last year). */
export function resolveTravel(years: number[], from: string | null, to: string | null, firstShared: number): { from: number; to: number } {
  const last = years[years.length - 1]
  const defaultFrom = years.includes(firstShared) ? firstShared : years[0]
  const a = Number(from)
  const b = Number(to)
  const aOk = from !== null && years.includes(a)
  const bOk = to !== null && years.includes(b)
  const pickedFrom = aOk ? a : defaultFrom
  const pickedTo = bOk ? b : last
  return pickedFrom < pickedTo ? { from: pickedFrom, to: pickedTo } : { from: defaultFrom, to: last }
}

// Readings: one measure at one year

export type ReadingStatus = 'ok' | 'incomplete' | 'suspect' | 'none'

export interface YearReading {
  value: number | null
  /** ok = usable; incomplete or suspect = shown but left out of differences; none = no value. */
  status: ReadingStatus
  /** Why the value is missing, incomplete, suspect or special, in plain words. */
  note: string | null
  /** A year after the years the trend test used (the satellite drifts): shown, with a note. */
  drift: boolean
}

const none = (note: string): YearReading => ({ value: null, status: 'none', note, drift: false })

/** Number with a fixed or automatic number of decimals: whole numbers from 100, then 1, 2 and 3 decimals as values get smaller. */
export type Digits = number | 'auto'

export function formatNumber(value: number, digits: Digits): string {
  const d = digits === 'auto' ? (Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : Math.abs(value) >= 1 ? 2 : 3) : digits
  return value.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

export interface MeasureRow {
  /** "hansen", "modis", "loss", "burned" or the variable id. */
  id: string
  label: string
  /** Short column title of the exact-values table. */
  column: string
  /** Shown after values ("%", "km²", "°C"); empty when the measure has no unit. */
  unit: string
  /** Unit of a difference: percentages differ in "points". */
  changeUnit: string
  digits: Digits
  /** Words for a rise and a fall of this measure, in plain language. */
  words: [string, string]
  /** Loading or failed files blank their own rows only. */
  state: 'ready' | 'loading' | 'error'
  message: string | null
  reading: (year: number) => YearReading
}

export function formatValue(row: MeasureRow, value: number): string {
  return `${formatNumber(value, row.digits)}${row.unit ? ` ${row.unit}` : ''}`
}

/** B minus A of two usable readings, as "−8.6 points (down)". Null when either one is not usable. */
export function formatChange(row: MeasureRow, a: YearReading, b: YearReading): string | null {
  if (a.status !== 'ok' || b.status !== 'ok' || a.value === null || b.value === null) return null
  const difference = b.value - a.value
  const text = formatNumber(Math.abs(difference), row.digits)
  if (Number(text.replace(/,/g, '')) === 0) return 'no change'
  const unit = row.changeUnit ? ` ${row.changeUnit}` : ''
  return `${difference < 0 ? '−' : '+'}${text}${unit} (${difference < 0 ? row.words[1] : row.words[0]})`
}

/** Values of a row at every year, for a small chart: only usable values, gaps elsewhere. */
export function sparkValues(row: MeasureRow, years: number[]): (number | null)[] {
  return years.map((year) => {
    const reading = row.reading(year)
    return reading.status === 'ok' ? reading.value : null
  })
}

function valueAt(values: (number | null)[] | undefined, years: number[], year: number): number | null {
  const index = years.indexOf(year)
  return index < 0 ? null : (values?.[index] ?? null)
}

/** The four rows read from cover.json: they exist as soon as the cover layer is loaded. */
export function coverRows(cover: CoverLayer, cell: CoverCell | null): MeasureRow[] {
  const base = { state: 'ready' as const, message: null }
  const modisFlagged = (year: number) => flagFor(cover, 'modis', year)
  return [
    {
      ...base,
      id: 'hansen',
      column: 'Hansen %',
      label: 'Tree cover (Hansen)',
      unit: '%',
      changeUnit: 'points',
      digits: 1,
      words: ['up', 'down'],
      reading: (year) => {
        const value = valueAt(cell?.hansenTreeCover, cover.years, year)
        return value === null ? none(`No Hansen value for ${year}`) : { value, status: 'ok', note: null, drift: false }
      },
    },
    {
      ...base,
      id: 'modis',
      column: 'MODIS %',
      label: 'Tree cover (MODIS)',
      unit: '%',
      changeUnit: 'points',
      digits: 1,
      words: ['up', 'down'],
      reading: (year) => {
        const value = valueAt(cell?.modisTreeCover, cover.years, year)
        if (value === null) return none(`No MODIS value for ${year}`)
        const flag = modisFlagged(year)
        return flag
          ? { value, status: 'suspect', note: `${year} is suspect: ${flag.note}`, drift: false }
          : { value, status: 'ok', note: null, drift: false }
      },
    },
    {
      ...base,
      id: 'loss',
      column: 'Loss km²',
      label: 'Tree cover lost that year',
      unit: 'km²',
      changeUnit: 'km²',
      digits: 1,
      words: ['more', 'less'],
      reading: (year) => {
        if (year < cover.lossYears[0]) return none(`Loss is recorded from ${cover.lossYears[0]}`)
        const value = valueAt(cell?.lossKm2, cover.lossYears, year)
        return value === null ? none(`No loss value for ${year}`) : { value, status: 'ok', note: null, drift: false }
      },
    },
    {
      ...base,
      id: 'burned',
      column: 'Burned km²',
      label: 'Area burned that year',
      unit: 'km²',
      changeUnit: 'km²',
      digits: 1,
      words: ['more', 'less'],
      reading: (year) => {
        if (year < cover.burnedYears[0]) return none(`Burned area is recorded from ${cover.burnedYears[0]}`)
        const value = valueAt(cell?.burnedKm2, cover.burnedYears, year)
        return value === null ? none(`No burned area value for ${year}`) : { value, status: 'ok', note: null, drift: false }
      },
    },
  ]
}

// Monthly variables: the yearly value comes from CellSeries.annual (mean or total of the 12 months, by the backend).

const DRIFT_IDS = new Set(['ndvi', 'evi', 'lst_day'])
const WORDS: Record<string, [string, string]> = {
  ndvi: ['greener', 'less green'],
  evi: ['greener', 'less green'],
  lst_day: ['warmer', 'cooler'],
  precip: ['wetter', 'drier'],
  burned_area: ['more', 'less'],
}

/** Units of the yearly value: "mm/month" becomes "mm" (a yearly total); unitless stays empty. */
export function yearlyUnit(variable: Variable): string {
  return variable.units === 'unitless' ? '' : variable.units.replace(/\/month$/, '')
}

export function annualByYear(series: CellSeries | null): Map<number, AnnualValue> {
  return new Map((Array.isArray(series?.annual) ? series.annual : []).map((a) => [a.year, a]))
}

/** Short column or chart name of a variable: "NDVI", "EVI", "Daytime temperature"... (the part in brackets, else the name). */
export function shortName(variable: Variable): string {
  return /\(([^)]+)\)/.exec(variable.name)?.[1] ?? variable.name
}

export function seriesRow(variable: Variable, slot: Slot<CellSeries>): MeasureRow {
  const kind = variable.semesterAggregation === 'sum' ? 'total' : 'mean'
  const unit = yearlyUnit(variable)
  const startYear = yearOf(variable.period.start)
  const endYear = yearOf(variable.period.end)
  const testEnd = variable.trendYears?.end ?? null
  const annual = annualByYear(slot.state === 'ready' ? slot.data : null)
  const published = slot.state !== 'ready' || Array.isArray(slot.data.annual)
  return {
    id: variable.id,
    label: `${variable.name}, yearly ${kind}`,
    column: `${shortName(variable)}${unit ? ` ${unit}` : ''}`,
    unit,
    changeUnit: unit,
    digits: variable.units === 'unitless' ? 3 : variable.units === '°C' ? 1 : 'auto',
    words: WORDS[variable.id] ?? ['higher', 'lower'],
    state: slot.state === 'ready' ? 'ready' : slot.state,
    message: slot.state === 'error' ? slot.message : published ? null : 'Yearly values are not published yet.',
    reading: (year) => {
      const entry = annual.get(year)
      if (!entry) {
        if (testEnd !== null && year > testEnd && DRIFT_IDS.has(variable.id)) {
          return none(`Not used after ${testEnd}: the satellite's orbit drift biases later years`)
        }
        return none(year < startYear ? `Starts in ${startYear}` : year > endYear ? `Not available after ${endYear}` : `No value for ${year}`)
      }
      if (!entry.complete) {
        return { value: entry.value, status: 'incomplete', note: `${year} incomplete (${entry.validMonths} of 12 months)`, drift: false }
      }
      if (entry.value === null) return none(`No valid value for ${year}`)
      const drift = testEnd !== null && year > testEnd && DRIFT_IDS.has(variable.id)
      return {
        value: entry.value,
        status: 'ok',
        note: drift ? `Satellite drift year: shown, not used in the trend after ${testEnd}` : null,
        drift,
      }
    },
  }
}

// Trends of this square

export interface TrendEntry {
  id: string
  name: string
  kind: 'series' | 'cover'
  slopeUnits: string
  years: [number, number]
  /** falling and rising are significant; none = tested, no clear trend; untested = no result for this square. */
  status: 'loading' | 'error' | 'untested' | 'none' | 'falling' | 'rising'
  result: TrendResult | null
  /** Months with a value that entered the test (monthly variables only). */
  validMonths: number | null
  message: string | null
}

function entryFor(option: TrendOption, result: TrendResult | null | undefined, validMonths: number | null): TrendEntry {
  const base = { id: option.id, name: option.name, kind: option.kind, slopeUnits: option.slopeUnits, years: option.years, validMonths, message: null }
  if (!result || result.slopePerDecade === null) return { ...base, status: 'untested', result: result ?? null }
  if (!result.significant) return { ...base, status: 'none', result }
  // Significant order but a Sen slope of exactly zero (e.g. a square with almost no burned area): nothing to report.
  if (result.slopePerDecade === 0) return { ...base, status: 'none', result, message: 'Clear order but no measurable slope.' }
  return { ...base, status: result.slopePerDecade < 0 ? 'falling' : 'rising', result }
}

const RANK: Record<TrendEntry['status'], number> = { falling: 0, rising: 1, none: 2, untested: 3, loading: 4, error: 4 }

/** One entry per measure, significant first (falling, then rising), then no clear trend, then not tested. */
export function buildTrendEntries(
  options: TrendOption[],
  trends: Record<string, Slot<CellTrend | null>>,
  coverCell: CoverCell | null,
): TrendEntry[] {
  const entries = options.map((option): TrendEntry => {
    if (option.kind === 'cover') return entryFor(option, coverCell?.trends?.[option.id as 'lossKm2' | 'modisTreeCover'], null)
    const slot = trends[option.id] ?? { state: 'loading' as const }
    if (slot.state === 'ready') return entryFor(option, slot.data, slot.data?.validMonths ?? null)
    const base = entryFor(option, null, null)
    return { ...base, status: slot.state, message: slot.state === 'error' ? slot.message : null }
  })
  return entries.map((e, i) => ({ e, i })).sort((x, y) => RANK[x.e.status] - RANK[y.e.status] || x.i - y.i).map((x) => x.e)
}

export function slopeText(entry: TrendEntry): string {
  return entry.result?.slopePerDecade == null ? '' : formatTrendSlope(entry.result.slopePerDecade, entry.slopeUnits)
}

const span = (entry: TrendEntry) => `${entry.years[0]}–${entry.years[1]}`

/** The one-line verdict of a measure in this square, and the sentence that explains it. */
export function describeTrend(entry: TrendEntry): { headline: string; detail: string } {
  switch (entry.status) {
    case 'falling':
    case 'rising':
      return {
        headline: `${entry.name}: ${entry.status}, ${slopeText(entry)} (${span(entry)}).`,
        detail: 'A clear trend, even after correcting for the many squares tested at once (false discovery rate 5 %).',
      }
    case 'none':
      return {
        headline: `${entry.name}: no clear trend, ${slopeText(entry)} (${span(entry)}).`,
        detail: 'The change is within year-to-year variation, so the test does not call it a trend.',
      }
    case 'untested':
      return {
        headline: `${entry.name}: not tested, too few years with data (${span(entry)}).`,
        detail: 'This square had too few valid years for the test, or the result is not published for it.',
      }
    case 'error':
      return { headline: `${entry.name}: could not load.`, detail: entry.message ?? '' }
    default:
      return { headline: `${entry.name}: loading…`, detail: '' }
  }
}

/** Sentences of the summary, built from published values with fixed templates; parts without data are skipped. */
export function buildSummary(cover: CoverLayer | null, coverCell: CoverCell | null, entries: TrendEntry[], from: number, to: number): string[] {
  const sentences: string[] = []
  const hansen = coverCell?.hansenTreeCover ?? []
  const i0 = cover ? cover.years.indexOf(Math.min(from, to)) : -1
  const i1 = cover ? cover.years.indexOf(Math.max(from, to)) : -1
  const first = i0 >= 0 ? (hansen[i0] ?? null) : null
  const last = i1 >= 0 ? (hansen[i1] ?? null) : null
  if (cover && first !== null && last !== null && i0 !== i1) {
    const y0 = cover.years[i0]
    const y1 = cover.years[i1]
    const base = y0 === cover.years[0] ? ' (the Hansen baseline)' : ''
    sentences.push(
      first.toFixed(1) === last.toFixed(1)
        ? `Tree cover stayed at ${first.toFixed(1)} % from ${y0}${base} to ${y1} (Hansen).`
        : `Tree cover ${last < first ? 'fell' : 'rose'} from ${first.toFixed(1)} % in ${y0}${base} to ${last.toFixed(1)} % in ${y1} (Hansen).`,
    )
  }
  if (entries.some((e) => e.status === 'loading')) return [...sentences, 'Loading the trend results…']
  const significant = entries.filter((e) => e.status === 'falling' || e.status === 'rising').slice(0, 3)
  for (const e of significant) {
    sentences.push(`${e.name} ${e.status === 'falling' ? 'fell' : 'rose'} significantly: ${slopeText(e)} (${span(e)}).`)
  }
  const flat = entries.filter((e) => e.status === 'none').length
  if (flat > 0) sentences.push(`${flat} other measure${flat === 1 ? ' shows' : 's show'} no clear trend.`)
  if (significant.length === 0 && flat === 0) sentences.push('Trend results are not available for this area.')
  return sentences
}

// Documented places

export type DocumentedPlace =
  | { kind: 'case'; place: ValidationCase; zoneId: string | null }
  | { kind: 'hotspot'; hotspot: Hotspot }

/** The documented case (or cross-check hotspot) whose 1° square is this one, if any. Cases come first. */
export function findDocumentedPlace(validation: ValidationReport | null, cellId: string): DocumentedPlace | null {
  if (!validation) return null
  const place = validation.cases.find((c) => c.apiCellId === cellId)
  if (place) {
    const known = validation.trendChecks?.v3KnownPlaces.find((p) => p.cellId === cellId && p.caseId === place.id)
    return { kind: 'case', place, zoneId: known?.zones[0] ?? null }
  }
  for (const zone of validation.zones) {
    const hotspot = zone.hotspots.find((h) => h.apiCellId === cellId)
    if (hotspot) return { kind: 'hotspot', hotspot }
  }
  return null
}
