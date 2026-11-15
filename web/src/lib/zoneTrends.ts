// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
//
// Presentation helpers of the Trends view: which measures there are and how they are named, how numbers and slopes are
// worded, and which state each yearly point has (used in the test, satellite-drift year, incomplete). It computes no
// statistics: slopes, p-values, significance and counts come from zones.json as they are. The only derived numbers are
// differences of two backend values (D11); the Sen line is drawn from the end points the pipeline exports (zoneTrend.line).

import type { Zone, ZoneVariable, ZoneYearValue } from '../../shared/contracts.ts'

export interface Measure {
  /** Key in zones.json (zone.variables). */
  key: string
  /** Id used in the URL (?var=); the same ids as the map's trend layers where one exists. */
  id: string
  name: string
  /** Lines for states (greenness, temperature, tree cover); bars for amounts (rain, loss, burned area). */
  kind: 'line' | 'bars'
  /** Source line shown under the chart. */
  source: string
  /** The yearly values after the test window are satellite-drift years (NDVI and EVI), shown greyed. */
  drift: boolean
  /** Short plain note about the measure. */
  note: string | null
  /** Map link: parameters of ?view=map, or null when the map has no such layer. */
  map: Record<string, string> | null
}

/** Row order of the table: loss and fire, vegetation, climate, then the tree cover context. */
export const MEASURES: Measure[] = [
  {
    key: 'lossKm2',
    id: 'hansen_loss',
    name: 'Tree cover loss',
    kind: 'bars',
    source: 'Hansen/UMD/Google/USGS/NASA Global Forest Change (Landsat, 30 m).',
    drift: false,
    note: 'Loss includes fire, logging, mining and clearing; it is not the same as deforestation.',
    map: { map: 'loss' },
  },
  {
    key: 'burned_area',
    id: 'burned_area',
    name: 'Burned area',
    kind: 'bars',
    source: 'NASA MODIS MCD64A1 v061 (LP DAAC).',
    drift: false,
    note: 'Fire and tree cover loss often happen in the same places; that alone does not show which caused which.',
    map: { map: 'trend', var: 'burned_area' },
  },
  {
    key: 'ndvi',
    id: 'ndvi',
    name: 'Greenness (NDVI)',
    kind: 'line',
    source: 'NASA MODIS MOD13C2 v061 (LP DAAC).',
    drift: true,
    note: null,
    map: { map: 'trend', var: 'ndvi' },
  },
  {
    key: 'evi',
    id: 'evi',
    name: 'Greenness (EVI)',
    kind: 'line',
    source: 'NASA MODIS MOD13C2 v061 (LP DAAC).',
    drift: true,
    note: null,
    map: { map: 'trend', var: 'evi' },
  },
  {
    key: 'lst_day',
    id: 'lst_day',
    name: 'Daytime surface temperature',
    kind: 'line',
    source: 'NASA MODIS MOD11C3 v061 (LP DAAC).',
    drift: true,
    note: null,
    map: { map: 'trend', var: 'lst_day' },
  },
  {
    key: 'precip',
    id: 'precip',
    name: 'Rainfall',
    kind: 'bars',
    source: 'NASA GPM IMERG monthly v07 (GES DISC).',
    drift: false,
    note: null,
    map: { map: 'trend', var: 'precip' },
  },
  {
    key: 'modisTreeCover',
    id: 'modis_tree_cover',
    name: 'Tree cover (MODIS)',
    kind: 'line',
    source: 'NASA MOD44B (MODIS, 250 m).',
    drift: false,
    note: 'MODIS reads lower than Hansen over dense forest; use it for change over time, not for the level.',
    map: null,
  },
  {
    key: 'hansenTreeCover',
    id: 'hansen_tree_cover',
    name: 'Tree cover (Hansen)',
    kind: 'line',
    source: 'Hansen/UMD/Google/USGS/NASA Global Forest Change (Landsat, 30 m).',
    drift: false,
    note: 'Not tested: it can only go down, because regrowth is not counted. Shown as context.',
    map: { map: 'cover' },
  },
]

export const LST_NOTE = "Ends in 2020: later years are biased by the satellite's orbit drift."

/** The measure for a ?var= value: the URL id, the zones.json key, or an old map id. */
export function measureFor(param: string | null): Measure | null {
  if (param === null) return null
  return MEASURES.find((m) => m.id === param || m.key === param) ?? null
}

/** The zone's measures that its report holds, in table order. */
export function measuresOf(zone: Zone): { measure: Measure; variable: ZoneVariable }[] {
  return MEASURES.flatMap((measure) => {
    const variable = zone.variables[measure.key]
    return variable ? [{ measure, variable }] : []
  })
}

/** Short names of the zones for the heading and the selector. Unknown ids use the label from the report. */
const ZONE_SHORT: Record<string, { heading: string; selector: string }> = {
  amazon: { heading: 'Amazon', selector: 'Whole Amazon' },
  amazon_brazil: { heading: 'Brazilian Amazon', selector: 'Brazilian Amazon' },
  amazon_peru: { heading: 'Peruvian Amazon', selector: 'Peruvian Amazon' },
}

export function zoneHeading(id: string, label: string): string {
  return ZONE_SHORT[id]?.heading ?? label
}

export function zoneSelectorLabel(id: string, label: string): string {
  return ZONE_SHORT[id]?.selector ?? label
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

export function unitParts(units: string): UnitParts {
  if (units === 'unitless') return { value: '', slopeShort: '', slopeLong: '' }
  if (units === '%') return { value: '%', slopeShort: 'points', slopeLong: 'points' }
  if (/ per year$/.test(units)) {
    const base = units.replace(/ per year$/, '')
    return { value: base, slopeShort: `${base}/yr`, slopeLong: `${base} per year` }
  }
  return { value: units, slopeShort: units, slopeLong: units }
}

/** "27.1 °C", "2,341 mm", "86.5 %", "0.800". */
export function formatValue(value: number, units: string): string {
  const unit = unitParts(units).value
  return unit === '' ? formatNumber(value) : unit === '%' ? `${formatNumber(value)} %` : `${formatNumber(value)} ${unit}`
}

/** Slope per decade, compact: { value: "+0.33", unit: "°C" } → "+0.33 °C per decade". */
export function slopeParts(slope: number, units: string): { value: string; unit: string } {
  return { value: formatSignedNumber(slope), unit: unitParts(units).slopeShort }
}

/** Slope per decade in a sentence: "+4,768 km² per year, per decade", "−0.86 points per decade". */
export function slopeSentence(slope: number, units: string): string {
  const { slopeLong } = unitParts(units)
  const per = / per year$/.test(slopeLong) ? `${slopeLong}, per decade` : `${slopeLong} per decade`
  return `${formatSignedNumber(slope)} ${slopeLong === '' ? 'per decade' : per}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function monthName(month: number): string {
  return MONTHS[month - 1] ?? String(month)
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
  const trend = variable.zoneTrend
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

// Yearly points

/** used = in the test; drift = after the tested years of a satellite-drift measure; unused = outside the tested years;
 * incomplete = a flagged or partial year with a value; missing = no value. */
export type PointState = 'used' | 'drift' | 'unused' | 'incomplete' | 'missing'

export function pointState(point: ZoneYearValue, variable: ZoneVariable, measure: Measure): PointState {
  if (point.value === null) return 'missing'
  const trend = variable.zoneTrend
  if (!trend) return 'used'
  if (!point.complete) return 'incomplete'
  if (point.year >= trend.years[0] && point.year <= trend.years[1]) return 'used'
  return measure.drift ? 'drift' : 'unused'
}

export function stateReason(state: PointState, variable: ZoneVariable, measure: Measure): string {
  const end = variable.zoneTrend?.years[1]
  if (state === 'used') return variable.zoneTrend ? 'used in the test' : 'shown as context, not tested'
  if (state === 'drift') return `satellite drift year, not used in the test (the test ends in ${end})`
  if (state === 'unused') return `outside the tested years (${variable.zoneTrend?.years[0]}–${end})`
  if (state === 'incomplete') return 'flagged or incomplete year, not used in the test'
  return measure.drift ? 'no value' : 'no value (incomplete year)'
}

/** The Sen line to draw over the tested years, taken from the pipeline's end points; null when the measure has no line. */
export function drawnSenLine(variable: ZoneVariable, _measure: Measure): { x0: number; y0: number; x1: number; y1: number } | null {
  const line = variable.zoneTrend?.line
  if (!line) return null
  return { x0: line.start.year, y0: line.start.value, x1: line.end.year, y1: line.end.value }
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
export function rangeSentence(variable: ZoneVariable, year: number): string | null {
  const range = variable.monthlyRange?.find((r) => r.year === year)
  if (!range) return null
  // Rainfall and burned area are yearly totals: their months are monthly totals.
  const monthlyUnits = variable.units.replace(/ per year$/, ' per month')
  return `In ${year} it ranged from ${formatValue(range.min, monthlyUnits)} (${monthName(range.minMonth)}) to ${formatValue(range.max, monthlyUnits)} (${monthName(range.maxMonth)}).`
}

/** The year the detail shows first: the last year used in the test that has a monthly range, else the last used one. */
export function defaultYear(variable: ZoneVariable, measure: Measure): number | null {
  const used = variable.annual.filter((p) => pointState(p, variable, measure) === 'used')
  const withRange = used.filter((p) => variable.monthlyRange?.some((r) => r.year === p.year))
  const pick = withRange[withRange.length - 1] ?? used[used.length - 1]
  return pick?.year ?? null
}

/** What a yearly value means in words, for a tooltip or readout: "tree cover lost", "yearly mean 0.80". */
export function valueSentence(measure: Measure, value: number, units: string): string {
  const text = formatValue(value, units)
  switch (measure.key) {
    case 'lossKm2':
      return `${text} of tree cover lost`
    case 'burned_area':
      return `${text} burned`
    case 'precip':
      return `${text} of rain`
    case 'modisTreeCover':
    case 'hansenTreeCover':
      return `tree cover ${text}`
    default:
      return `yearly mean ${text}`
  }
}
