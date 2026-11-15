// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
// Unit tests for the six-month periods (run with `npm test`; part of `npm run build`).

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { SeriesPoint } from '../shared/contracts.ts'
import { computeSemesters } from './periods.ts'

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

describe('computeSemesters', () => {
  it('returns nothing for an empty series', () => assert.deepEqual(computeSemesters([], 'mean'), []))

  it('splits the year into H1 (Jan-Jun) and H2 (Jul-Dec) in chronological order', () => {
    const result = computeSemesters(series('2001-01', '2002-12', () => 1), 'mean')
    assert.deepEqual(result.map((s) => s.period), ['2001-H1', '2001-H2', '2002-H1', '2002-H2'])
    assert.ok(result.every((s) => s.complete && s.validMonths === 6))
  })

  it('averages the six months of a complete "mean" semester', () => {
    const [h1] = computeSemesters(series('2001-01', '2001-06', (m) => Number(m.slice(5))), 'mean')
    assert.equal(h1.value, 3.5)
    assert.equal(h1.complete, true)
  })

  it('sums the six months of a complete "sum" semester', () => {
    const [h1] = computeSemesters(series('2001-01', '2001-06', () => 10), 'sum')
    assert.equal(h1.value, 60)
    assert.equal(h1.complete, true)
  })

  it('marks a partial semester incomplete: the mean uses the valid months, the sum is null', () => {
    const points = series('2001-01', '2001-06', (m) => (m === '2001-02' || m === '2001-05' ? null : 10))
    const [mean] = computeSemesters(points, 'mean')
    assert.deepEqual([mean.value, mean.validMonths, mean.complete], [10, 4, false])
    const [sum] = computeSemesters(points, 'sum')
    assert.deepEqual([sum.value, sum.validMonths, sum.complete], [null, 4, false])
  })

  it('treats months missing from the series (a series that ends mid-semester) as invalid', () => {
    const result = computeSemesters(series('2025-01', '2026-09', () => 2), 'sum')
    const last = result[result.length - 1]
    assert.equal(last.period, '2026-H2')
    assert.deepEqual([last.value, last.validMonths, last.complete, last.changeVsPreviousYear], [null, 3, false, null])
  })

  it('has a null value when a semester has no valid month, even for "mean"', () => {
    const points = series('2001-01', '2001-12', (m) => (m <= '2001-06' ? null : 5))
    const [h1, h2] = computeSemesters(points, 'mean')
    assert.deepEqual([h1.value, h1.validMonths, h1.complete], [null, 0, false])
    assert.equal(h2.value, 5)
  })

  it('computes the change vs the same half one year earlier as an absolute difference', () => {
    // Temperature-like values: H1 of 2001 = 20, H1 of 2002 = 22, H2 of 2001 = 30, H2 of 2002 = 29.
    const level = (m: string): number => (m.startsWith('2001') ? (m <= '2001-06' ? 20 : 30) : m <= '2002-06' ? 22 : 29)
    const result = computeSemesters(series('2001-01', '2002-12', level), 'mean')
    const byPeriod = Object.fromEntries(result.map((s) => [s.period, s.changeVsPreviousYear]))
    assert.deepEqual(byPeriod, { '2001-H1': null, '2001-H2': null, '2002-H1': 2, '2002-H2': -1 })
  })

  it('never compares H1 with H2', () => {
    const level = (m: string): number => (m <= '2001-06' ? 100 : 1)
    const result = computeSemesters(series('2001-01', '2001-12', level), 'mean')
    assert.deepEqual(result.map((s) => s.changeVsPreviousYear), [null, null])
  })

  it('gives a change only when both semesters are complete', () => {
    // 2002-H1 has a gap: no change for it, and none for 2003-H1 either (its reference is incomplete).
    const points = series('2001-01', '2003-06', (m) => (m === '2002-03' ? null : 10))
    const byPeriod = Object.fromEntries(computeSemesters(points, 'mean').map((s) => [s.period, s]))
    assert.equal(byPeriod['2002-H1'].complete, false)
    assert.equal(byPeriod['2002-H1'].changeVsPreviousYear, null)
    assert.equal(byPeriod['2003-H1'].complete, true)
    assert.equal(byPeriod['2003-H1'].changeVsPreviousYear, null)
  })

  it('computes the change of "sum" variables on complete totals', () => {
    const points = series('2001-01', '2002-06', (m) => (m.startsWith('2001') ? 100 : 130))
    const result = computeSemesters(points, 'sum')
    assert.equal(result.find((s) => s.period === '2002-H1')?.changeVsPreviousYear, 180)
  })

  it('does not leave floating-point noise in the values', () => {
    const [h1] = computeSemesters(series('2001-01', '2001-06', () => 0.1), 'sum')
    assert.equal(h1.value, 0.6)
  })
})
