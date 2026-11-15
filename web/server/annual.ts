// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
//
// Calendar years ("annual" values) computed from a cell's monthly series. Business logic of the backend: the browser
// only displays the result (a difference between two published values is the only arithmetic it may do).
//
// Rules (same as the six-month periods in periods.ts, with 12 months):
// - A year is `complete` only with 12 valid monthly values. Missing months count as invalid.
// - "mean" variables: the mean of the valid months (flagged incomplete if fewer than 12).
// - "sum" variables (rain, burned area): null unless complete, because a partial total would read as a drop.
// - These are the yearly values the pipeline's trend test runs on (only complete years enter it); the pipeline owns
//   the test, this file only exposes the same aggregation per cell for display.

import type { AnnualValue, SemesterAggregation, SeriesPoint } from '../shared/contracts.ts'
import { tidy } from './periods.ts'

const MONTHS_PER_YEAR = 12

/**
 * Years from the first to the last year that overlaps the series, in chronological order.
 * `points` must be in increasing month order (validated by validateSeries).
 */
export function computeAnnual(points: SeriesPoint[], aggregation: SemesterAggregation): AnnualValue[] {
  if (points.length === 0) return []
  const sums = new Map<number, { total: number; count: number }>()
  for (const p of points) {
    if (p.value === null || !Number.isFinite(p.value)) continue
    const year = Number(p.month.slice(0, 4))
    const entry = sums.get(year) ?? { total: 0, count: 0 }
    entry.total += p.value
    entry.count += 1
    sums.set(year, entry)
  }

  const first = Number(points[0].month.slice(0, 4))
  const last = Number(points[points.length - 1].month.slice(0, 4))
  const years: AnnualValue[] = []
  for (let year = first; year <= last; year += 1) {
    const { total, count } = sums.get(year) ?? { total: 0, count: 0 }
    const complete = count === MONTHS_PER_YEAR
    let value: number | null = null
    if (aggregation === 'sum') value = complete ? tidy(total) : null
    else if (count > 0) value = tidy(total / count)
    years.push({ year, value, validMonths: count, complete })
  }
  return years
}
