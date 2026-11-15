// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15 (monthly values loaded on demand, same day).
// Reviewed and owned by team AETHER.
//
// "Trends in this area" of the cell viewer: one line per measure in plain language (direction, slope per decade, tested
// years, and whether the team's test calls it a clear trend after correcting for many squares at once). Each line opens
// to the yearly chart of that measure. "Significant" is only what the backend decided (false discovery rate 5 %); the
// browser never tests, fits or averages. Hansen tree cover is listed as not tested (it can only go down).

import { useState } from 'react'
import type { CellYearlySeries, SenLine, Variable } from '../../shared/contracts.ts'
import type { Slot } from '../hooks/useCellProfile.ts'
import { useCellSeries } from '../hooks/useSignoData.ts'
import { annualByYear, describeTrend, formatNumber, formatValue, seriesRow, type TrendEntry } from '../lib/cellView.ts'
import { SeriesChart } from './SeriesChart.tsx'
import { ViewLink } from './ViewLink.tsx'
import { YearChart, type ChartSeries, type PointKind } from './YearChart.tsx'

interface Props {
  entries: TrendEntry[]
  variables: Variable[]
  series: Record<string, Slot<CellYearlySeries>>
  from: number
  to: number
  onRetry: () => void
}

const ICON: Record<TrendEntry['status'], string> = { falling: '↓', rising: '↑', none: '–', untested: '?', loading: '…', error: '!' }

/** Yearly chart of a monthly variable in this square: tested years shaded, incomplete years hollow, later years muted. */
function SeriesTrendChart({ variable, series, slot, from, to, sen }: { variable: Variable; series: CellYearlySeries; slot: Slot<CellYearlySeries>; from: number; to: number; sen?: SenLine }) {
  const [monthly, setMonthly] = useState(false)
  // The monthly points are not in the per-cell file: the series file loads only when the reader asks for it.
  const monthlySeries = useCellSeries(monthly ? variable.id : null, series.cellId)
  const row = seriesRow(variable, slot)
  const annual = annualByYear(series)
  const years = [...annual.keys()]
  const tested: [number, number] | null = variable.trendYears ? [variable.trendYears.start, variable.trendYears.end] : null
  const kinds: PointKind[] = years.map((year) => {
    const a = annual.get(year)
    if (!a?.complete) return 'hollow'
    return tested && (year < tested[0] || year > tested[1]) ? 'outside' : 'ok'
  })
  const chartSeries: ChartSeries = {
    id: variable.id,
    label: variable.name,
    values: years.map((year) => annual.get(year)?.value ?? null),
    kinds,
    notes: years.map((year) => row.reading(year).note),
  }
  const sum = variable.semesterAggregation === 'sum'
  const product = variable.product
  return (
    <div className="cv-trend-body">
      {years.length === 0 ? (
        <p className="muted small">Yearly values are not published yet.</p>
      ) : (
        <YearChart
          years={years}
          type={sum ? 'bars' : 'line'}
          series={[chartSeries]}
          format={(v) => formatValue(row, v)}
          tick={(v) => formatNumber(v, 'auto')}
          tone={variable.id === 'burned_area' ? 'burned' : 'plain'}
          from={from}
          to={to}
          tested={tested}
          sen={sen}
          label={`${variable.name}, yearly ${sum ? 'total' : 'mean'}, for this area`}
          caption={`${tested ? `Shaded: the years the trend test used (${tested[0]}–${tested[1]}). ` : ''}Hollow: incomplete year, left out of the test.${sen ? ' Line: Sen slope over the tested years.' : ''} Source: NASA ${product.shortName} v${product.version} (${product.provider}).`}
        />
      )}
      <button type="button" className="cv-link" aria-expanded={monthly} onClick={() => setMonthly((on) => !on)}>
        {monthly ? 'Hide monthly values' : 'Show monthly values'}
      </button>
      {monthly && monthlySeries.data && <SeriesChart series={monthlySeries.data} variable={variable} compare={null} />}
      {monthly && monthlySeries.loading && <p className="muted small">Loading the monthly values…</p>}
      {monthly && monthlySeries.error && <p className="error small">Could not load the monthly values. {monthlySeries.error}</p>}
    </div>
  )
}

export function CellTrends({ entries, variables, series, from, to, onRetry }: Props) {
  return (
    <ul className="cv-trends">
      {entries.map((entry) => {
        const { headline, detail } = describeTrend(entry)
        const variable = entry.kind === 'series' ? variables.find((v) => v.id === entry.id) : undefined
        const slot = series[entry.id]
        return (
          <li key={entry.id}>
            <details className={`cv-trend ${entry.status}`}>
              <summary>
                <span className="cv-trend-icon" aria-hidden="true">
                  {ICON[entry.status]}
                </span>
                <span>
                  {headline} <span className="muted">{detail}</span>
                </span>
              </summary>
              {variable && slot?.state === 'ready' && <SeriesTrendChart variable={variable} series={slot.data} slot={slot} from={from} to={to} sen={entry.result?.line} />}
              {variable && slot?.state === 'loading' && <p className="muted small">Loading the yearly values…</p>}
              {variable && slot?.state === 'error' && (
                <p className="error small">
                  Could not load the yearly values. <button type="button" className="cv-link" onClick={onRetry}>Retry</button>
                </p>
              )}
              {entry.kind === 'cover' && (
                <p className="muted small">The yearly values of this measure are in the charts above.</p>
              )}
              <p className="small">
                <ViewLink view="trends" params={{ var: entry.id }}>
                  See {entry.name} trends for the whole zone
                </ViewLink>
              </p>
            </details>
          </li>
        )
      })}
      <li>
        <p className="cv-trend static">
          <span className="cv-trend-icon" aria-hidden="true">
            –
          </span>
          <span>
            Tree cover (Hansen): not tested.{' '}
            <span className="muted">It can only go down, because regrowth is not counted.</span>
          </span>
        </p>
      </li>
    </ul>
  )
}
