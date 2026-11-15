// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
//
// What the cell viewer shows, as plain data: the measures of one square read at a year (tree cover, loss, burned area and
// the yearly value of each monthly variable), the A to B difference, the trend of each measure and the documented place.
// Rules it keeps: every number is a value the backend published; the only arithmetic is one subtraction (year B minus
// year A) of two published values; an incomplete year, a suspect year or a missing year is never part of a difference.

import type {
  AnnualValue,
  CellYearlySeries,
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
import { formatTrendSlope, localizeUnits } from './format.ts'
import { EN, type Tr } from './i18n.ts'
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
export function formatChange(row: MeasureRow, a: YearReading, b: YearReading, t: Tr = EN): string | null {
  if (a.status !== 'ok' || b.status !== 'ok' || a.value === null || b.value === null) return null
  const difference = b.value - a.value
  const text = formatNumber(Math.abs(difference), row.digits)
  if (Number(text.replace(/,/g, '')) === 0) return t('no change', 'sin cambio')
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
export function coverRows(cover: CoverLayer, cell: CoverCell | null, t: Tr = EN): MeasureRow[] {
  const base = { state: 'ready' as const, message: null }
  const modisFlagged = (year: number) => flagFor(cover, 'modis', year)
  return [
    {
      ...base,
      id: 'hansen',
      column: 'Hansen %',
      label: t('Tree cover (Hansen)', 'Cobertura arbórea (Hansen)'),
      unit: '%',
      changeUnit: t('points', 'puntos'),
      digits: 1,
      words: [t('up', 'sube'), t('down', 'baja')],
      reading: (year) => {
        const value = valueAt(cell?.hansenTreeCover, cover.years, year)
        return value === null
          ? none(t(`No Hansen value for ${year}`, `Sin valor de Hansen para ${year}`))
          : { value, status: 'ok', note: null, drift: false }
      },
    },
    {
      ...base,
      id: 'modis',
      column: 'MODIS %',
      label: t('Tree cover (MODIS)', 'Cobertura arbórea (MODIS)'),
      unit: '%',
      changeUnit: t('points', 'puntos'),
      digits: 1,
      words: [t('up', 'sube'), t('down', 'baja')],
      reading: (year) => {
        const value = valueAt(cell?.modisTreeCover, cover.years, year)
        if (value === null) return none(t(`No MODIS value for ${year}`, `Sin valor de MODIS para ${year}`))
        const flag = modisFlagged(year)
        return flag
          ? { value, status: 'suspect', note: t(`${year} is suspect: ${flag.note}`, `${year} es dudoso: ${flag.note}`), drift: false }
          : { value, status: 'ok', note: null, drift: false }
      },
    },
    {
      ...base,
      id: 'loss',
      column: t('Loss km²', 'Pérdida km²'),
      label: t('Tree cover lost that year', 'Cobertura perdida ese año'),
      unit: 'km²',
      changeUnit: 'km²',
      digits: 1,
      words: [t('more', 'más'), t('less', 'menos')],
      reading: (year) => {
        if (year < cover.lossYears[0]) return none(t(`Loss is recorded from ${cover.lossYears[0]}`, `La pérdida se registra desde ${cover.lossYears[0]}`))
        const value = valueAt(cell?.lossKm2, cover.lossYears, year)
        return value === null
          ? none(t(`No loss value for ${year}`, `Sin valor de pérdida para ${year}`))
          : { value, status: 'ok', note: null, drift: false }
      },
    },
    {
      ...base,
      id: 'burned',
      column: t('Burned km²', 'Quemado km²'),
      label: t('Area burned that year', 'Superficie quemada ese año'),
      unit: 'km²',
      changeUnit: 'km²',
      digits: 1,
      words: [t('more', 'más'), t('less', 'menos')],
      reading: (year) => {
        if (year < cover.burnedYears[0])
          return none(t(`Burned area is recorded from ${cover.burnedYears[0]}`, `El área quemada se registra desde ${cover.burnedYears[0]}`))
        const value = valueAt(cell?.burnedKm2, cover.burnedYears, year)
        return value === null
          ? none(t(`No burned area value for ${year}`, `Sin valor de área quemada para ${year}`))
          : { value, status: 'ok', note: null, drift: false }
      },
    },
  ]
}

// Monthly variables: the yearly value comes from CellSeries.annual (served in the per-cell file) (mean or total of the 12 months, by the backend).

const DRIFT_IDS = new Set(['ndvi', 'evi', 'lst_day'])
const WORDS: Record<string, [[string, string], [string, string]]> = {
  ndvi: [['greener', 'más verde'], ['less green', 'menos verde']],
  evi: [['greener', 'más verde'], ['less green', 'menos verde']],
  lst_day: [['warmer', 'más cálido'], ['cooler', 'más fresco']],
  precip: [['wetter', 'más húmedo'], ['drier', 'más seco']],
  burned_area: [['more', 'más'], ['less', 'menos']],
}

/** Units of the yearly value: "mm/month" becomes "mm" (a yearly total); unitless stays empty. */
export function yearlyUnit(variable: Variable): string {
  return variable.units === 'unitless' ? '' : variable.units.replace(/\/month$/, '')
}

export function annualByYear(series: CellYearlySeries | null): Map<number, AnnualValue> {
  return new Map((Array.isArray(series?.annual) ? series.annual : []).map((a) => [a.year, a]))
}

/** Short column or chart name of a variable: "NDVI", "EVI", "Daytime temperature"... (the part in brackets, else the name). */
export function shortName(variable: Variable): string {
  return /\(([^)]+)\)/.exec(variable.name)?.[1] ?? variable.name
}

export function seriesRow(variable: Variable, slot: Slot<CellYearlySeries>, t: Tr = EN): MeasureRow {
  const kind = variable.semesterAggregation === 'sum' ? t('total', 'total') : t('mean', 'media')
  const words = WORDS[variable.id] ?? [['higher', 'más alto'], ['lower', 'más bajo']]
  const unit = yearlyUnit(variable)
  const startYear = yearOf(variable.period.start)
  const endYear = yearOf(variable.period.end)
  const testEnd = variable.trendYears?.end ?? null
  const annual = annualByYear(slot.state === 'ready' ? slot.data : null)
  const published = slot.state !== 'ready' || Array.isArray(slot.data.annual)
  return {
    id: variable.id,
    label: t(`${variable.name}, yearly ${kind}`, `${variable.name}, ${kind} anual`),
    column: `${shortName(variable)}${unit ? ` ${localizeUnits(unit, t)}` : ''}`,
    unit: localizeUnits(unit, t),
    changeUnit: localizeUnits(unit, t),
    digits: variable.units === 'unitless' ? 3 : variable.units === '°C' ? 1 : 'auto',
    words: [t(words[0][0], words[0][1]), t(words[1][0], words[1][1])],
    state: slot.state === 'ready' ? 'ready' : slot.state,
    message:
      slot.state === 'error' ? slot.message : published ? null : t('Yearly values are not published yet.', 'Los valores anuales aún no se publican.'),
    reading: (year) => {
      const entry = annual.get(year)
      if (!entry) {
        if (testEnd !== null && year > testEnd && DRIFT_IDS.has(variable.id)) {
          return none(
            t(
              `Not used after ${testEnd}: the satellite's orbit drift biases later years`,
              `No se usa después de ${testEnd}: la deriva de la órbita del satélite sesga los años siguientes`,
            ),
          )
        }
        return none(
          year < startYear
            ? t(`Starts in ${startYear}`, `Empieza en ${startYear}`)
            : year > endYear
              ? t(`Not available after ${endYear}`, `No disponible después de ${endYear}`)
              : t(`No value for ${year}`, `Sin valor para ${year}`),
        )
      }
      if (!entry.complete) {
        return {
          value: entry.value,
          status: 'incomplete',
          note: t(`${year} incomplete (${entry.validMonths} of 12 months)`, `${year} incompleto (${entry.validMonths} de 12 meses)`),
          drift: false,
        }
      }
      if (entry.value === null) return none(t(`No valid value for ${year}`, `Sin valor válido para ${year}`))
      const drift = testEnd !== null && year > testEnd && DRIFT_IDS.has(variable.id)
      return {
        value: entry.value,
        status: 'ok',
        note: drift
          ? t(
              `Satellite drift year: shown, not used in the trend after ${testEnd}`,
              `Año con deriva del satélite: se muestra, pero no entra en la tendencia después de ${testEnd}`,
            )
          : null,
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

function entryFor(option: TrendOption, result: TrendResult | null | undefined, validMonths: number | null, t: Tr = EN): TrendEntry {
  const base = { id: option.id, name: option.name, kind: option.kind, slopeUnits: option.slopeUnits, years: option.years, validMonths, message: null }
  if (!result || result.slopePerDecade === null) return { ...base, status: 'untested', result: result ?? null }
  if (!result.significant) return { ...base, status: 'none', result }
  // Significant order but a Sen slope of exactly zero (e.g. a square with almost no burned area): nothing to report.
  if (result.slopePerDecade === 0)
    return { ...base, status: 'none', result, message: t('Clear order but no measurable slope.', 'Orden claro, pero sin pendiente medible.') }
  return { ...base, status: result.slopePerDecade < 0 ? 'falling' : 'rising', result }
}

const RANK: Record<TrendEntry['status'], number> = { falling: 0, rising: 1, none: 2, untested: 3, loading: 4, error: 4 }

/** One entry per measure, significant first (falling, then rising), then no clear trend, then not tested. */
export function buildTrendEntries(
  options: TrendOption[],
  trends: Record<string, Slot<CellTrend | null>>,
  coverCell: CoverCell | null,
  t: Tr = EN,
): TrendEntry[] {
  const entries = options.map((option): TrendEntry => {
    if (option.kind === 'cover') return entryFor(option, coverCell?.trends?.[option.id as 'lossKm2' | 'modisTreeCover'], null, t)
    const slot = trends[option.id] ?? { state: 'loading' as const }
    if (slot.state === 'ready') return entryFor(option, slot.data, slot.data?.validMonths ?? null, t)
    const base = entryFor(option, null, null, t)
    return { ...base, status: slot.state, message: slot.state === 'error' ? slot.message : null }
  })
  return entries.map((e, i) => ({ e, i })).sort((x, y) => RANK[x.e.status] - RANK[y.e.status] || x.i - y.i).map((x) => x.e)
}

export function slopeText(entry: TrendEntry, t: Tr = EN): string {
  return entry.result?.slopePerDecade == null ? '' : formatTrendSlope(entry.result.slopePerDecade, entry.slopeUnits, t)
}

const span = (entry: TrendEntry) => `${entry.years[0]}–${entry.years[1]}`

/** The one-line verdict of a measure in this square, and the sentence that explains it. */
export function describeTrend(entry: TrendEntry, t: Tr = EN): { headline: string; detail: string } {
  switch (entry.status) {
    case 'falling':
    case 'rising': {
      const word = entry.status === 'falling' ? t('falling', 'baja') : t('rising', 'sube')
      return {
        headline: `${entry.name}: ${word}, ${slopeText(entry, t)} (${span(entry)}).`,
        detail: t(
          'A clear trend, even after correcting for the many squares tested at once (false discovery rate 5 %).',
          'Una tendencia clara, incluso tras corregir por los muchos cuadros probados a la vez (tasa de falsos descubrimientos del 5 %).',
        ),
      }
    }
    case 'none':
      return {
        headline: t(`${entry.name}: no clear trend, ${slopeText(entry, t)} (${span(entry)}).`, `${entry.name}: sin tendencia clara, ${slopeText(entry, t)} (${span(entry)}).`),
        detail: t(
          'The change is within year-to-year variation, so the test does not call it a trend.',
          'El cambio está dentro de la variación de un año a otro, así que el test no lo considera una tendencia.',
        ),
      }
    case 'untested':
      return {
        headline: t(
          `${entry.name}: not tested, too few years with data (${span(entry)}).`,
          `${entry.name}: sin probar, muy pocos años con datos (${span(entry)}).`,
        ),
        detail: t(
          'This square had too few valid years for the test, or the result is not published for it.',
          'Este cuadro tuvo muy pocos años válidos para el test, o su resultado no está publicado.',
        ),
      }
    case 'error':
      return { headline: t(`${entry.name}: could not load.`, `${entry.name}: no se pudo cargar.`), detail: entry.message ?? '' }
    default:
      return { headline: t(`${entry.name}: loading…`, `${entry.name}: cargando…`), detail: '' }
  }
}

/** Sentences of the summary, built from published values with fixed templates; parts without data are skipped. */
export function buildSummary(
  cover: CoverLayer | null,
  coverCell: CoverCell | null,
  entries: TrendEntry[],
  from: number,
  to: number,
  t: Tr = EN,
): string[] {
  const sentences: string[] = []
  const hansen = coverCell?.hansenTreeCover ?? []
  const i0 = cover ? cover.years.indexOf(Math.min(from, to)) : -1
  const i1 = cover ? cover.years.indexOf(Math.max(from, to)) : -1
  const first = i0 >= 0 ? (hansen[i0] ?? null) : null
  const last = i1 >= 0 ? (hansen[i1] ?? null) : null
  if (cover && first !== null && last !== null && i0 !== i1) {
    const y0 = cover.years[i0]
    const y1 = cover.years[i1]
    const base = y0 === cover.years[0] ? t(' (the Hansen baseline)', ' (la línea base de Hansen)') : ''
    sentences.push(
      first.toFixed(1) === last.toFixed(1)
        ? t(
            `Tree cover stayed at ${first.toFixed(1)} % from ${y0}${base} to ${y1} (Hansen).`,
            `La cobertura arbórea se mantuvo en ${first.toFixed(1)} % de ${y0}${base} a ${y1} (Hansen).`,
          )
        : t(
            `Tree cover ${last < first ? 'fell' : 'rose'} from ${first.toFixed(1)} % in ${y0}${base} to ${last.toFixed(1)} % in ${y1} (Hansen).`,
            `La cobertura arbórea ${last < first ? 'bajó' : 'subió'} de ${first.toFixed(1)} % en ${y0}${base} a ${last.toFixed(1)} % en ${y1} (Hansen).`,
          ),
    )
  }
  if (entries.some((e) => e.status === 'loading')) return [...sentences, t('Loading the trend results…', 'Cargando los resultados de tendencia…')]
  const significant = entries.filter((e) => e.status === 'falling' || e.status === 'rising').slice(0, 3)
  for (const e of significant) {
    sentences.push(
      t(
        `${e.name} ${e.status === 'falling' ? 'fell' : 'rose'} significantly: ${slopeText(e, t)} (${span(e)}).`,
        `${e.name} ${e.status === 'falling' ? 'bajó' : 'subió'} de forma significativa: ${slopeText(e, t)} (${span(e)}).`,
      ),
    )
  }
  const flat = entries.filter((e) => e.status === 'none').length
  if (flat > 0)
    sentences.push(
      t(
        `${flat} other measure${flat === 1 ? ' shows' : 's show'} no clear trend.`,
        `${flat} ${flat === 1 ? 'otra medida no muestra' : 'otras medidas no muestran'} una tendencia clara.`,
      ),
    )
  if (significant.length === 0 && flat === 0)
    sentences.push(t('Trend results are not available for this area.', 'No hay resultados de tendencia para esta área.'))
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
