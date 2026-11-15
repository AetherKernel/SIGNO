// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
// Unit tests for the yearly values (run with `npm test`; part of `npm run build`).

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { SeriesPoint } from '../shared/contracts.ts'
import { computeAnnual } from './annual.ts'

/** Monthly points from `start` to `end` ("YYYY-MM"); `valueOf` returns the value of a month (null = missing). */
function series(start: string, end: string, valueOf: (month: string) => number | null): SeriesPoint[] {
  const out: SeriesPoint[] = []
  let [y, m] = start.split('-').map(Number)
  const [y1, m1] = end.split('-').map(Number)
  while (y < y1 || (y === y1 && m <= m1)) {
    const month = `${y}-${String(m).padStart(2, '0')}`
    out.push({ month, value: valueOf(month) })
    if (m === 12) {
      y += 1
      m = 1
    } else m += 1
  }
  return out
}

describe('computeAnnual', () => {
  it('returns nothing for an empty series', () => assert.deepEqual(computeAnnual([], 'mean'), []))

  it('gives one entry per calendar year, in chronological order', () => {
    const result = computeAnnual(series('2001-01', '2003-12', () => 1), 'mean')
    assert.deepEqual(result.map((y) => y.year), [2001, 2002, 2003])
    assert.ok(result.every((y) => y.complete && y.validMonths === 12))
  })

  it('averages the twelve months of a complete "mean" year', () => {
    const [y] = computeAnnual(series('2001-01', '2001-12', (m) => Number(m.slice(5))), 'mean')
    assert.deepEqual([y.value, y.validMonths, y.complete], [6.5, 12, true])
  })

  it('sums the twelve months of a complete "sum" year', () => {
    const [y] = computeAnnual(series('2001-01', '2001-12', () => 10), 'sum')
    assert.deepEqual([y.value, y.validMonths, y.complete], [120, 12, true])
  })

  it('marks a year with a gap incomplete: the mean uses the valid months, the sum is null', () => {
    const points = series('2001-01', '2001-12', (m) => (m === '2001-03' ? null : 10))
    const [mean] = computeAnnual(points, 'mean')
    assert.deepEqual([mean.value, mean.validMonths, mean.complete], [10, 11, false])
    const [sum] = computeAnnual(points, 'sum')
    assert.deepEqual([sum.value, sum.validMonths, sum.complete], [null, 11, false])
  })

  it('treats months missing from the series (a series that ends mid-year) as invalid', () => {
    const result = computeAnnual(series('2025-01', '2026-09', () => 2), 'sum')
    const last = result[result.length - 1]
    assert.deepEqual([last.year, last.value, last.validMonths, last.complete], [2026, null, 9, false])
    assert.deepEqual([result[0].year, result[0].value, result[0].complete], [2025, 24, true])
  })

  it('has a null value when a year has no valid month, even for "mean"', () => {
    const points = series('2001-01', '2002-12', (m) => (m.startsWith('2001') ? null : 5))
    const [first, second] = computeAnnual(points, 'mean')
    assert.deepEqual([first.value, first.validMonths, first.complete], [null, 0, false])
    assert.deepEqual([second.value, second.complete], [5, true])
  })

  it('does not leave floating-point noise in the values', () => {
    const [y] = computeAnnual(series('2001-01', '2001-12', () => 0.1), 'sum')
    assert.equal(y.value, 1.2)
  })

  it('keeps the same complete years as the monthly series for mean and sum variables', () => {
    const points = series('2001-06', '2003-05', () => 3)
    // 2001 starts in June and 2003 ends in May: only 2002 has 12 months.
    const flags = computeAnnual(points, 'mean').map((y) => y.complete)
    assert.deepEqual(flags, [false, true, false])
  })
})
