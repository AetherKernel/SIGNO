// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-14; redesigned 2026-11-15. Reviewed and owned
// by team AETHER.
//
// Presentation helpers only (number formatting, colour classes, date ranges for display). No data access and no
// statistics here: significance and slopes come from the backend data as they are.

import type { CellTrend, Period, YearMonth } from '../../shared/contracts.ts'

/** Number of colour classes in the diverging scale (ColorBrewer PuOr): 0-2 decrease, 3-5 increase. */
export const SLOPE_CLASSES = 6

export function formatSlope(slope: number | null, units: string): string {
  if (slope === null) return 'not enough data'
  return `${formatSigned(slope)}${unitSuffix(units)} per decade`
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
  return `${Math.abs(lat).toFixed(digits)}°${ns} ${Math.abs(lon).toFixed(digits)}°${ew}`
}

/** Largest |slope| in a layer: the legend and colour classes are symmetric around zero. */
export function maxAbsSlope(cells: CellTrend[]): number {
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
