// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-14; redesigned 2026-11-15. Reviewed and owned
// by team AETHER (extended 2026-11-15).
//
// Presentation helpers only (number formatting, colour classes, date ranges for display). No data access and no
// statistics here: significance and slopes come from the backend data as they are.

import type { Period, TrendLayer, Variable, YearMonth } from '../../shared/contracts.ts'
import { EN, type Tr } from './i18n.ts'

/** Number of colour classes in the diverging scale (ColorBrewer PuOr): 0-2 decrease, 3-5 increase. */
export const SLOPE_CLASSES = 6

/** True when the team's trend test has not been applied to this layer (no cell was tested). Read from the summary. */
export function isTrendTestPending(layer: TrendLayer): boolean {
  return layer.summary.cellsTested === 0
}

/** Unit label for a variable: its own units, or its own name when it is unitless (NDVI, EVI...). */
export function unitLabel(variable: Variable): string {
  return variable.units === 'unitless' ? variable.name : variable.units
}

export function formatSlope(slope: number | null, units: string, testPending = false): string {
  if (slope === null) return testPending ? 'not computed yet' : 'too few valid months'
  return `${formatSigned(slope)}${unitSuffix(units)} per decade`
}

/**
 * A trend slope with the backend's slope units: "−0.012 per decade" (unitless), "+0.3 °C per decade",
 * "+31 mm per year, per decade". `slopeUnits` is Variable.slopeUnits (it already says "per decade").
 */
export function formatTrendSlope(slope: number, slopeUnits: string, t: Tr = EN): string {
  const units = slopeUnits.replace(/^unitless\s*/, '').trim()
  return `${formatSigned(slope)} ${units === '' ? t('per decade', 'por década') : localizeUnits(units, t)}`
}

/**
 * The pipeline's method text says "in unitless per decade" for NDVI and EVI (P-035). Shown as plain words until the
 * pipeline publishes it so; any other text is returned unchanged.
 */
export function plainMethodText(text: string): string {
  return text.replace(/\bin unitless per decade\b/g, 'per decade (NDVI and EVI have no units)')
}

/** Slope units for a heading: "unitless per decade" (NDVI, EVI) becomes "no units"; others are localized. */
export function slopeUnitsLabel(slopeUnits: string, t: Tr = EN): string {
  return /^unitless\b/.test(slopeUnits.trim()) ? t('no units', 'sin unidades') : localizeUnits(slopeUnits, t)
}

/** Units published by the API in English ("km² per year, per decade", "% of cell"), in the current language. */
export function localizeUnits(units: string, t: Tr = EN): string {
  return t(
    units,
    units
      .replace(/\bper decade\b/g, 'por década')
      .replace(/\bper year\b/g, 'por año')
      .replace(/\bper month\b/g, 'por mes')
      .replace(/% of cell/g, '% de la celda')
      .replace(/^unitless$/, 'sin unidades'),
  )
}

/** Signed number with a true minus sign and precision that suits small slopes. */
export function formatSigned(value: number): string {
  const digits = Math.abs(value) < 0.1 ? 3 : 2
  const text = Math.abs(value).toFixed(digits)
  if (Number(text) === 0) return text
  return `${value < 0 ? '−' : '+'}${text}`
}

export function unitSuffix(units: string): string {
  return units === 'unitless' ? '' : ` ${units}`
}

export function formatPValue(p: number | null): string {
  if (p === null) return 'not tested'
  return p < 0.001 ? '< 0.001' : p.toFixed(3)
}

export function formatCoordinates(lat: number, lon: number, digits = 1): string {
  const ns = lat >= 0 ? 'N' : 'S'
  const ew = lon >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(digits)}° ${ns}, ${Math.abs(lon).toFixed(digits)}° ${ew}`
}

/** Largest |slope| in a layer: the legend and colour classes are symmetric around zero. */
export function maxAbsSlope(cells: { slopePerDecade: number | null }[]): number {
  return Math.max(0, ...cells.map((c) => Math.abs(c.slopePerDecade ?? 0)))
}

/** Colour class 0..5 for a slope (equal-width classes from -maxAbs to +maxAbs), or null when there is no slope. */
export function slopeClass(slope: number | null, maxAbs: number): number | null {
  if (slope === null) return null
  if (maxAbs === 0) return slope < 0 ? 2 : 3
  const t = (slope + maxAbs) / (2 * maxAbs)
  return Math.max(0, Math.min(SLOPE_CLASSES - 1, Math.floor(t * SLOPE_CLASSES)))
}

export function slopeColor(slope: number | null, maxAbs: number): string {
  const k = slopeClass(slope, maxAbs)
  return k === null ? 'var(--cell-empty)' : `var(--puor-${k})`
}

/** Class boundaries for the legend: SLOPE_CLASSES + 1 values from -maxAbs to +maxAbs. */
export function legendBreaks(maxAbs: number): number[] {
  return Array.from({ length: SLOPE_CLASSES + 1 }, (_, i) => -maxAbs + (2 * maxAbs * i) / SLOPE_CLASSES)
}

function monthIndex(month: YearMonth): number {
  const [year, m] = month.split('-').map(Number)
  return year * 12 + (m - 1)
}

function monthFromIndex(index: number): YearMonth {
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
}

export function monthsInPeriod(period: Period): number {
  return monthIndex(period.end) - monthIndex(period.start) + 1
}

/** Splits a period into two halves for display (series highlight). Not an analysis choice: just two date ranges. */
export function splitPeriod(period: Period): [Period, Period] {
  const start = monthIndex(period.start)
  const end = monthIndex(period.end)
  const mid = start + Math.floor((end - start + 1) / 2)
  return [
    { start: period.start, end: monthFromIndex(mid - 1) },
    { start: monthFromIndex(mid), end: period.end },
  ]
}

export function formatPeriod(period: Period): string {
  return `${period.start} to ${period.end}`
}

export function formatYears(period: Period): string {
  return `${period.start.slice(0, 4)}–${period.end.slice(0, 4)}`
}

/** Percent with one decimal and a non-breaking space, e.g. "23.0 %". */
export function formatPercent(value: number | null): string {
  return value === null ? 'no data' : `${value.toFixed(1)} %`
}

/** Share 0..1 as a whole percent, e.g. 0.584 -> "58 %". */
export function formatShare(share: number): string {
  return `${Math.round(share * 100)} %`
}

export function formatKm2(value: number | null): string {
  if (value === null) return 'no data'
  return `${value >= 100 ? Math.round(value).toLocaleString('en-US') : value.toFixed(1)} km²`
}

/** Points of percent (a difference between two percents): "−22.5 points". */
export function formatPoints(value: number): string {
  return `${formatSigned(value)} points`
}

export type Half = 'H1' | 'H2'

/** "2025-H2" -> { year: 2025, half: "H2" }, or null if the key is malformed. */
export function parseSemester(key: string): { year: number; half: Half } | null {
  const match = /^(\d{4})-(H1|H2)$/.exec(key)
  return match ? { year: Number(match[1]), half: match[2] as Half } : null
}

export const HALF_NAMES: Record<Half, string> = { H1: 'January to June', H2: 'July to December' }
const HALF_NAMES_ES: Record<Half, string> = { H1: 'enero a junio', H2: 'julio a diciembre' }

export function semesterLabel(key: string, t: Tr = EN): string {
  const s = parseSemester(key)
  return s ? t(`${HALF_NAMES[s.half]} ${s.year}`, `${HALF_NAMES_ES[s.half]} de ${s.year}`) : key
}
