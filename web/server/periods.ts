// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
//
// Six-month periods ("semesters") computed from a cell's monthly series. This is business logic and lives in the
// backend: the browser only displays the result (no means or differences are computed there).
//
// Rules (team decision):
// - H1 = January-June, H2 = July-December. A half is only compared with the same half of another year.
// - A semester is `complete` only with 6 valid monthly values. Missing months count as invalid.
// - "mean" variables: the mean of the valid months (flagged incomplete if fewer than 6).
// - "sum" variables (rain, burned area): null unless complete, because a partial total would read as a drop.
// - changeVsPreviousYear: absolute difference vs the same half one year earlier, only when both are complete
//   (never a percentage: a percentage of a temperature in °C is meaningless).
// No trend or significance test is applied anywhere.

import type { SemesterAggregation, SemesterValue, SeriesPoint } from '../shared/contracts.ts'

const MONTHS_PER_SEMESTER = 6

interface SemesterId {
  year: number
  half: 1 | 2
}

function semesterOfMonth(month: string): SemesterId {
  return { year: Number(month.slice(0, 4)), half: Number(month.slice(5, 7)) <= 6 ? 1 : 2 }
}

export function semesterKey({ year, half }: SemesterId): string {
  return `${year}-H${half}`
}

/** Round away floating-point noise (e.g. 0.015000000000000001) without hiding real precision. */
export function tidy(value: number): number {
  return Number(value.toPrecision(10))
}

/**
 * Semesters from the first to the last half-year that overlaps the series, in chronological order.
 * `points` must be in increasing month order (validated by validateSeries).
 */
export function computeSemesters(points: SeriesPoint[], aggregation: SemesterAggregation): SemesterValue[] {
  if (points.length === 0) return []
  const byMonth = new Map<string, number>()
  for (const p of points) if (p.value !== null && Number.isFinite(p.value)) byMonth.set(p.month, p.value)

  const first = semesterOfMonth(points[0].month)
  const last = semesterOfMonth(points[points.length - 1].month)
  const semesters: SemesterValue[] = []
  const completeValues = new Map<string, number>()

  for (let year = first.year, half: 1 | 2 = first.half; year < last.year || (year === last.year && half <= last.half); ) {
    const startMonth = half === 1 ? 1 : 7
    const values: number[] = []
    for (let m = startMonth; m < startMonth + MONTHS_PER_SEMESTER; m += 1) {
      const value = byMonth.get(`${year}-${String(m).padStart(2, '0')}`)
      if (value !== undefined) values.push(value)
    }
    const validMonths = values.length
    const complete = validMonths === MONTHS_PER_SEMESTER
    const total = values.reduce((acc, v) => acc + v, 0)
    let value: number | null = null
    if (aggregation === 'sum') value = complete ? tidy(total) : null
    else if (validMonths > 0) value = tidy(total / validMonths)

    let changeVsPreviousYear: number | null = null
    const key = semesterKey({ year, half })
    if (complete && value !== null) {
      const previous = completeValues.get(semesterKey({ year: year - 1, half }))
      if (previous !== undefined) changeVsPreviousYear = tidy(value - previous)
      completeValues.set(key, value)
    }
    semesters.push({ period: key, value, validMonths, complete, changeVsPreviousYear })

    if (half === 1) half = 2
    else {
      half = 1
      year += 1
    }
  }
  return semesters
}
