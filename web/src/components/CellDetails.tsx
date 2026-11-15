// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-14; redesigned 2026-11-15. Reviewed and owned
// by team AETHER.
//
// "Area file" panel (right): the evidence behind one cell, like Global Forest Watch's area analysis. It shows the
// backend's verdict as is; it never recomputes significance or period statistics.

import { useState } from 'react'
import { API_BASE_PATH, apiPaths } from '../../shared/apiPaths.ts'
import type { CellTrend, TrendLayer, Variable } from '../../shared/contracts.ts'
import { useCellSeries } from '../hooks/useSignoData.ts'
import { formatCoordinates, formatPValue, formatSlope, monthsInPeriod, splitPeriod } from '../lib/format.ts'
import { SeriesChart } from './SeriesChart.tsx'

interface Props {
  cell: CellTrend
  variable: Variable
  layer: TrendLayer
  compare: boolean
  onClose: () => void
  onOpenMethod: () => void
}

export function CellDetails({ cell, variable, layer, compare, onClose, onOpenMethod }: Props) {
  const series = useCellSeries(variable.id, cell.cellId)
  const [copied, setCopied] = useState(false)
  const periods = compare ? splitPeriod(layer.period) : null
  const verdict =
    cell.pValue === null
      ? { text: 'Not tested: not enough data', inconclusive: true }
      : cell.significant
        ? { text: 'Significant change', inconclusive: false }
        : { text: 'Inconclusive: could be noise', inconclusive: true }

  const copyLink = () => {
    navigator.clipboard
      ?.writeText(window.location.href)
      .then(() => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => setCopied(false))
  }

  return (
    <aside
      className="panel area-file"
      aria-labelledby="area-title"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose()
      }}
    >
      <div className="area-head">
        <div className="area-head-row">
          <span className="kicker">Area file · {cell.cellId}</span>
          <button type="button" className="btn ghost" onClick={onClose} aria-label="Close the area file">
            Close
          </button>
        </div>
        <h2 id="area-title">Area {formatCoordinates(cell.lat, cell.lon)}</h2>
        <p className={verdict.inconclusive ? 'stamp inconclusive' : 'stamp'} aria-live="polite">
          {verdict.text}
        </p>
      </div>

      <dl className="metrics">
        <div>
          <dt>Trend</dt>
          <dd>{formatSlope(cell.slopePerDecade, variable.units)}</dd>
        </div>
        <div>
          <dt>p-value</dt>
          <dd>{formatPValue(cell.pValue)}</dd>
        </div>
        <div>
          <dt>Significance level</dt>
          <dd>α = {layer.method.alpha}</dd>
        </div>
        <div>
          <dt>Valid months</dt>
          <dd>
            {cell.validMonths} of {monthsInPeriod(layer.period)}
          </dd>
        </div>
        <div>
          <dt>Cell centre</dt>
          <dd>{formatCoordinates(cell.lat, cell.lon, 2)}</dd>
        </div>
        <div>
          <dt>Cell size</dt>
          <dd>
            {layer.cellSizeDeg}° × {layer.cellSizeDeg}°
          </dd>
        </div>
      </dl>

      <section className="section" aria-labelledby="series-title">
        <h3 id="series-title" className="kicker">
          Monthly {variable.name}
        </h3>
        {series.loading && <p className="muted small">Loading monthly values…</p>}
        {series.error && <p className="error small">{series.error}</p>}
        {series.data && <SeriesChart series={series.data} variable={variable} compare={periods} />}
      </section>

      {periods && (
        <section className="section" aria-labelledby="compare-head">
          <h3 id="compare-head" className="kicker">
            Period comparison
          </h3>
          <p className="small">
            {periods[0].start} to {periods[0].end} <span className="muted">vs</span> {periods[1].start} to{' '}
            {periods[1].end}
          </p>
          <p className="pending">
            The mean of each period and their difference will come from the pipeline export (pending). Temperature is
            compared as an absolute difference in °C, never as a percentage.
          </p>
        </section>
      )}

      <p className="pending">Land cover in this area (MapBiomas Amazonía): pending a data decision with the pipeline.</p>

      <div className="actions">
        <button type="button" className="btn primary" onClick={copyLink}>
          {copied ? 'Link copied' : 'Copy link to this view'}
        </button>
        <a
          className="btn"
          href={`${API_BASE_PATH}/${apiPaths.series(variable.id, cell.cellId)}`}
          target="_blank"
          rel="noreferrer"
        >
          Series JSON
        </a>
        <button type="button" className="btn" onClick={onOpenMethod}>
          Method
        </button>
      </div>
    </aside>
  )
}
