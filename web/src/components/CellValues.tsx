// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
//
// "Exact values" of the cell viewer: every published yearly value of this square in one scrollable table (years A and B
// highlighted), and the result of each trend test (change per decade, raw p-value, whether it is significant after the
// false discovery rate correction). Values are the backend's, written as they are.

import { formatNumber, slopeText, type MeasureRow, type TrendEntry } from '../lib/cellView.ts'
import { formatPValue } from '../lib/format.ts'

interface Props {
  rows: MeasureRow[]
  years: number[]
  from: number
  to: number
  entries: TrendEntry[]
  alpha: number | null
}

function cellText(row: MeasureRow, year: number): string {
  const r = row.reading(year)
  if (r.value === null || r.status === 'none') return '–'
  const text = formatNumber(r.value, row.digits)
  return r.status === 'incomplete' ? `${text}*` : r.status === 'suspect' ? `${text} ⚑` : text
}

const VERDICT: Record<TrendEntry['status'], string> = {
  falling: 'Falling',
  rising: 'Rising',
  none: 'No clear trend',
  untested: 'Not tested',
  loading: 'Loading',
  error: 'Could not load',
}

export function CellValues({ rows, years, from, to, entries, alpha }: Props) {
  const ready = rows.filter((r) => r.state === 'ready' && !r.message)
  return (
    <div className="cv-values">
      <div className="cv-scroll" tabIndex={0} role="region" aria-label="Yearly values of this area">
        <table className="cv-table cv-exact">
          <caption className="sr-only">Every yearly value of this area</caption>
          <thead>
            <tr>
              <th scope="col">Year</th>
              {ready.map((r) => (
                <th key={r.id} scope="col">
                  {r.column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {years.map((year) => (
              <tr key={year} className={year === from || year === to ? 'current' : undefined}>
                <th scope="row">{year}</th>
                {ready.map((r) => (
                  <td key={r.id}>{cellText(r, year)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted">
        * incomplete year (left out of differences and tests) · ⚑ suspect value · – no value. Yearly values of the monthly
        measures are the mean (NDVI, EVI, temperature) or the total (rain, burned share) of the 12 months.
      </p>

      <h4 className="subhead">Trend test results</h4>
      <div className="cv-scroll" tabIndex={0} role="region" aria-label="Trend test results of this area">
        <table className="cv-table cv-exact">
          <caption className="sr-only">Trend test result of each measure in this area</caption>
          <thead>
            <tr>
              <th scope="col">Measure</th>
              <th scope="col">Years tested</th>
              <th scope="col">Months used</th>
              <th scope="col">Change per decade</th>
              <th scope="col">p-value (raw)</th>
              <th scope="col">Significant after FDR</th>
              <th scope="col">Direction</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <th scope="row">{e.name}</th>
                <td>
                  {e.years[0]}–{e.years[1]}
                </td>
                <td>{e.validMonths ?? '–'}</td>
                <td>{slopeText(e) || '–'}</td>
                <td>{e.result ? formatPValue(e.result.pValue) : '–'}</td>
                <td>{e.status === 'falling' || e.status === 'rising' ? 'Yes' : e.status === 'none' ? 'No' : '–'}</td>
                <td>{VERDICT[e.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted">
        Mann-Kendall test on yearly values, Sen slope per decade
        {alpha !== null ? `, α = ${alpha}` : ''}. The p-value is the raw one; “significant” is decided after correcting for
        the many squares tested at once (Benjamini-Hochberg false discovery rate). Hansen tree cover is not tested: it can
        only go down.
      </p>
    </div>
  )
}
