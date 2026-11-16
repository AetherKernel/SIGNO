// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
// 2026-11-15: MODIS tree cover removed from the measures; tree cover loss has ONE tested window (2011-2025: Hansen reprocessed loss
// from 2011); the years before it are real data, shown greyed and not tested. Every yearly value stays visible.
//
// Presentation helpers of the Trends view: which measures there are and how they are named, how numbers and slopes are
// worded, and which state each yearly point has (used in the test, satellite-drift year, incomplete). It computes no
// statistics: slopes, p-values, significance and counts come from zones.json as they are. The only derived numbers are
// differences of two backend values (D11); the Sen line is drawn from the end points the pipeline exports (zoneTrend.line).

import type { Zone, ZoneTrendResult, ZoneVariable, ZoneYearValue } from '../../shared/contracts.ts'
import { EN, type Tr } from './i18n.ts'

export interface Measure {
  /** Key in zones.json (zone.variables). */
  key: string
  /** Id used in the URL (?var=); the same ids as the map's trend layers where one exists. */
  id: string
  name: string
  nameEs: string
  /** Lines for states (greenness, temperature, tree cover); bars for amounts (rain, loss, burned area). */
  kind: 'line' | 'bars'
  /** Source line shown under the chart. */
  source: string
  /** The yearly values after the test window are satellite-drift years (NDVI and EVI), shown greyed. */
  drift: boolean
  /** Short plain note about the measure. */
  note: string | null
  noteEs: string | null
  /** Map link: parameters of ?view=map, or null when the map has no such layer. */
  map: Record<string, string> | null
}

/** Row order of the table: loss and fire, vegetation, climate, then the tree cover context. */
export const MEASURES: Measure[] = [
  {
    key: 'lossKm2',
    id: 'hansen_loss',
    name: 'Tree cover loss',
    nameEs: 'Pérdida de cobertura arbórea',
    kind: 'bars',
    source: 'Hansen/UMD/Google/USGS/NASA Global Forest Change (Landsat, 30 m).',
    drift: false,
    note: 'Loss includes fire, logging, mining and clearing; it is not the same as deforestation.',
    noteEs: 'La pérdida incluye fuego, tala, minería y desbroce; no es lo mismo que deforestación.',
    map: { map: 'loss' },
  },
  {
    key: 'burned_area',
    id: 'burned_area',
    name: 'Burned area',
    nameEs: 'Área quemada',
    kind: 'bars',
    source: 'NASA MODIS MCD64A1 v061 (LP DAAC).',
    drift: false,
    note: 'Fire and tree cover loss often happen in the same places; that alone does not show which caused which.',
    noteEs: 'El fuego y la pérdida de cobertura suelen darse en los mismos lugares; eso solo no muestra cuál causó cuál.',
    map: { map: 'trend', var: 'burned_area' },
  },
  {
    key: 'ndvi',
    id: 'ndvi',
    name: 'Greenness (NDVI)',
    nameEs: 'Verdor (NDVI)',
    kind: 'line',
    source: 'NASA MODIS MOD13C2 v061 (LP DAAC).',
    drift: true,
    note: null,
    noteEs: null,
    map: { map: 'trend', var: 'ndvi' },
  },
  {
    key: 'evi',
    id: 'evi',
    name: 'Greenness (EVI)',
    nameEs: 'Verdor (EVI)',
    kind: 'line',
    source: 'NASA MODIS MOD13C2 v061 (LP DAAC).',
    drift: true,
    note: null,
    noteEs: null,
    map: { map: 'trend', var: 'evi' },
  },
  {
    key: 'lst_day',
    id: 'lst_day',
    name: 'Daytime surface temperature',
    nameEs: 'Temperatura diurna de superficie',
    kind: 'line',
    source: 'NASA MODIS MOD11C3 v061 (LP DAAC).',
    drift: true,
    note: null,
    noteEs: null,
    map: { map: 'trend', var: 'lst_day' },
  },
  {
    key: 'precip',
    id: 'precip',
    name: 'Rainfall',
    nameEs: 'Lluvia',
    kind: 'bars',
    source: 'NASA GPM IMERG monthly v07 (GES DISC).',
    drift: false,
    note: null,
    noteEs: null,
    map: { map: 'trend', var: 'precip' },
  },
  {
    key: 'hansenTreeCover',
    id: 'hansen_tree_cover',
    name: 'Tree cover',
    nameEs: 'Cobertura arbórea',
    kind: 'line',
    source: 'Hansen/UMD/Google/USGS/NASA Global Forest Change (Landsat, 30 m).',
    drift: false,
    note: 'Not tested: it can only go down, because regrowth is not counted. Shown as context.',
    noteEs: 'Sin probar: solo puede bajar, porque no cuenta el rebrote. Se muestra como contexto.',
    map: { map: 'cover' },
  },
]

/** Why the test of a satellite-drift measure (NDVI, EVI, temperature) ends in `end`; the later years are shown, not tested. */
export function testEndNote(end: number, t: Tr = EN): string {
  return t(
    `The test ends in ${end}: from ${end + 1} the satellite's overpass time drifts, so those years are shown but not tested.`,
    `El test termina en ${end}: desde ${end + 1} la hora de paso del satélite deriva, así que esos años se muestran pero no se prueban.`,
  )
}

/** The measure's name and note in the current language. */
export function measureName(measure: Measure, t: Tr = EN): string {
  return t(measure.name, measure.nameEs)
}

export function measureNote(measure: Measure, t: Tr = EN): string | null {
  return measure.note === null ? null : t(measure.note, measure.noteEs ?? measure.note)
}

/** The measure for a ?var= value: the URL id or the zones.json key. */
export function measureFor(param: string | null): Measure | null {
  if (param === null) return null
  return MEASURES.find((m) => m.id === param || m.key === param) ?? null
}

export const periodOf = (trend: ZoneTrendResult) => `${trend.years[0]}–${trend.years[1]}`

/** The zone's measures that its report holds, in table order. */
export function measuresOf(zone: Zone): { measure: Measure; variable: ZoneVariable }[] {
  return MEASURES.flatMap((measure) => {
    const variable = zone.variables[measure.key]
    return variable ? [{ measure, variable }] : []
  })
}

/** Short names of the zones for the heading and the selector. Unknown ids use the label from the report. */
const ZONE_SHORT: Record<string, { heading: [string, string]; selector: [string, string] }> = {
  amazon: { heading: ['Amazon', 'Amazonía'], selector: ['Whole Amazon', 'Toda la Amazonía'] },
  amazon_brazil: { heading: ['Brazilian Amazon', 'Amazonía brasileña'], selector: ['Brazilian Amazon', 'Amazonía brasileña'] },
  amazon_peru: { heading: ['Peruvian Amazon', 'Amazonía peruana'], selector: ['Peruvian Amazon', 'Amazonía peruana'] },
}

export function zoneHeading(id: string, label: string, t: Tr = EN): string {
  const z = ZONE_SHORT[id]
  return z ? t(...z.heading) : label
}

export function zoneSelectorLabel(id: string, label: string, t: Tr = EN): string {
  const z = ZONE_SHORT[id]
  return z ? t(...z.selector) : label
}

/** Zone ids in a fixed order (whole region first); ids the UI does not know follow in report order. */
export function orderedZoneIds(ids: string[]): string[] {
  const known = Object.keys(ZONE_SHORT)
  return [...known.filter((id) => ids.includes(id)), ...ids.filter((id) => !known.includes(id))]
}

// Numbers

const MINUS = '−'

/** Number with a precision that suits its size, e.g. 0.0010, 0.800, 27.1, 2,341. */
export function formatNumber(value: number): string {
  const abs = Math.abs(value)
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : abs >= 1 ? 2 : abs >= 0.01 ? 3 : abs === 0 ? 0 : 4
  const text = new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(abs)
  return `${value < 0 && Number(text.replace(/,/g, '')) !== 0 ? MINUS : ''}${text}`
}

export function formatSignedNumber(value: number): string {
  const text = formatNumber(value)
  return value < 0 || Number(text.replace(/[,−]/g, '')) === 0 ? text : `+${text}`
}

interface UnitParts {
  /** Unit written after a value, e.g. "km²", "°C", "%". */
  value: string
  /** Unit written after a slope, e.g. "km²/yr", "points". */
  slopeShort: string
  /** Same in full words, e.g. "km² per year, per decade" is built from this: "km² per year". */
  slopeLong: string
}

export function unitParts(units: string, t: Tr = EN): UnitParts {
  if (units === 'unitless') return { value: '', slopeShort: '', slopeLong: '' }
  if (units === '%') return { value: '%', slopeShort: t('points', 'puntos'), slopeLong: t('points', 'puntos') }
  if (/ per year$/.test(units)) {
    const base = units.replace(/ per year$/, '')
    return { value: base, slopeShort: t(`${base}/yr`, `${base}/año`), slopeLong: t(`${base} per year`, `${base} por año`) }
  }
  return { value: units, slopeShort: units, slopeLong: units }
}

/** "27.1 °C", "2,341 mm", "86.5 %", "0.800". */
export function formatValue(value: number, units: string): string {
  const unit = unitParts(units).value
  return unit === '' ? formatNumber(value) : unit === '%' ? `${formatNumber(value)} %` : `${formatNumber(value)} ${unit}`
}

/** Slope per decade, compact: { value: "+0.33", unit: "°C" } → "+0.33 °C per decade". */
export function slopeParts(slope: number, units: string, t: Tr = EN): { value: string; unit: string } {
  return { value: formatSignedNumber(slope), unit: unitParts(units, t).slopeShort }
}

/** Slope per decade in a sentence: "+4,768 km² per year, per decade", "−0.86 points per decade". */
export function slopeSentence(slope: number, units: string, t: Tr = EN): string {
  const { slopeLong } = unitParts(units, t)
  const perYear = / (per year|por año)$/.test(slopeLong)
  const decade = t('per decade', 'por década')
  const per = perYear ? `${slopeLong}, ${decade}` : `${slopeLong} ${decade}`
  return `${formatSignedNumber(slope)} ${slopeLong === '' ? decade : per}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function monthName(month: number, t: Tr = EN): string {
  return t(MONTHS[month - 1] ?? String(month), MONTHS_ES[month - 1] ?? String(month))
}

/** Percent of a 0 to 1 share the backend sent, with enough digits to show tiny values ("0.009 %"). */
export function formatShare(share: number): string {
  const percent = share * 100
  if (percent === 0) return '0 %'
  if (percent < 0.1) return `${percent.toPrecision(1)} %`
  return `${percent < 10 ? percent.toFixed(1) : Math.round(percent)} %`
}

// Direction

export type Direction = 'rising' | 'falling' | 'flat' | 'untested'

/** "rising" or "falling" only when the zone test says the trend is clear; otherwise "flat" (no clear trend) or "untested". */
export function directionOf(variable: ZoneVariable): Direction {
  return directionOfTrend(variable.zoneTrend)
}

export function directionOfTrend(trend: ZoneTrendResult | undefined): Direction {
  if (!trend || trend.slopePerDecade === null) return 'untested'
  if (!trend.significant || trend.slopePerDecade === 0) return 'flat' // zero Sen slope: clear order but nothing measurable
  return trend.slopePerDecade < 0 ? 'falling' : 'rising'
}

export const DIRECTION_WORD: Record<Direction, string> = {
  rising: 'Rising',
  falling: 'Falling',
  flat: 'No clear trend',
  untested: 'Not tested',
}

const DIRECTION_WORD_ES: Record<Direction, string> = {
  rising: 'Sube',
  falling: 'Baja',
  flat: 'Sin tendencia clara',
  untested: 'Sin probar',
}

export function directionWord(direction: Direction, t: Tr = EN): string {
  return t(DIRECTION_WORD[direction], DIRECTION_WORD_ES[direction])
}

// Yearly points

/** used = in the test; drift = after the tested years of a satellite-drift measure; unused = outside the tested years;
 * incomplete = a partial year with a value; missing = no value. */
export type PointState = 'used' | 'drift' | 'unused' | 'incomplete' | 'missing'

export function pointState(point: ZoneYearValue, variable: ZoneVariable, measure: Measure): PointState {
  if (point.value === null) return 'missing'
  const trend = variable.zoneTrend
  if (!trend) return 'used'
  if (!point.complete) return 'incomplete'
  if (point.year >= trend.years[0] && point.year <= trend.years[1]) return 'used'
  return measure.drift && point.year > trend.years[1] ? 'drift' : 'unused'
}

export function stateReason(state: PointState, variable: ZoneVariable, measure: Measure, t: Tr = EN): string {
  const trend = variable.zoneTrend
  const end = trend?.years[1]
  if (state === 'used') return trend ? t('used in the test', 'usado en el test') : t('shown as context, not tested', 'se muestra como contexto, sin probar')
  if (state === 'drift')
    return t(`satellite drift year, shown, not in the test (the test ends in ${end})`, `año con deriva del satélite, se muestra pero no entra en el test (el test termina en ${end})`)
  if (state === 'unused') {
    if (measure.key === 'lossKm2')
      return t(
        `shown, not in the trend (it starts in ${trend?.years[0]}: Hansen's earlier method)`,
        `se muestra, pero no entra en la tendencia (empieza en ${trend?.years[0]}: método anterior de Hansen)`,
      )
    return t(`outside the tested years (${trend?.years[0]}–${end})`, `fuera de los años probados (${trend?.years[0]}–${end})`)
  }
  if (state === 'incomplete') return t('incomplete year, not used in the test', 'año incompleto, no se usa en el test')
  return measure.drift ? t('no value', 'sin valor') : t('no value (incomplete year)', 'sin valor (año incompleto)')
}

export interface DrawnLine {
  x0: number
  y0: number
  x1: number
  y1: number
  /** The zone test this line belongs to. */
  trend: ZoneTrendResult
}

/** The Sen line to draw over the tested years only (none for a measure that is not tested), from the pipeline's end points. */
export function drawnSenLines(variable: ZoneVariable): DrawnLine[] {
  const trend = variable.zoneTrend
  return trend?.line ? [{ x0: trend.line.start.year, y0: trend.line.start.value, x1: trend.line.end.year, y1: trend.line.end.value, trend }] : []
}

/** Round ticks covering [min, max] (about `count` of them). */
export function niceTicks(min: number, max: number, count: number): number[] {
  const span = max - min || Math.abs(max) || 1
  const rough = span / Math.max(1, count)
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? 10 * magnitude
  const first = Math.ceil(min / step - 1e-9) * step
  const ticks: number[] = []
  for (let t = first; t <= max + step * 1e-9; t += step) ticks.push(Number(t.toPrecision(12)))
  return ticks
}

// Seasonality as information (team decision B2): the lowest and highest month of a year

/** "In 2010 it ranged from 0.79 (Mar) to 0.81 (Nov)." Null when the measure has no monthly range for that year. */
export function rangeSentence(variable: ZoneVariable, year: number, t: Tr = EN): string | null {
  const range = variable.monthlyRange?.find((r) => r.year === year)
  if (!range) return null
  // Rainfall and burned area are yearly totals: their months are monthly totals.
  const monthlyUnits = variable.units.replace(/ per year$/, ' per month')
  const lo = `${formatValue(range.min, monthlyUnits)} (${monthName(range.minMonth, t)})`
  const hi = `${formatValue(range.max, monthlyUnits)} (${monthName(range.maxMonth, t)})`
  return t(`In ${year} it ranged from ${lo} to ${hi}.`, `En ${year} fue de ${lo} a ${hi}.`)
}

/** The year the detail shows first: the last year used in the test that has a monthly range, else the last used one. */
export function defaultYear(variable: ZoneVariable, measure: Measure): number | null {
  const used = variable.annual.filter((p) => pointState(p, variable, measure) === 'used')
  const withRange = used.filter((p) => variable.monthlyRange?.some((r) => r.year === p.year))
  const pick = withRange[withRange.length - 1] ?? used[used.length - 1]
  return pick?.year ?? null
}

/** What a yearly value means in words, for a tooltip or readout: "tree cover lost", "yearly mean 0.80". */
export function valueSentence(measure: Measure, value: number, units: string, t: Tr = EN): string {
  const text = formatValue(value, units)
  switch (measure.key) {
    case 'lossKm2':
      return t(`${text} of tree cover lost`, `${text} de cobertura perdida`)
    case 'burned_area':
      return t(`${text} burned`, `${text} quemados`)
    case 'precip':
      return t(`${text} of rain`, `${text} de lluvia`)
    case 'hansenTreeCover':
      return t(`tree cover ${text}`, `cobertura arbórea ${text}`)
    default:
      return t(`yearly mean ${text}`, `media anual ${text}`)
  }
}
